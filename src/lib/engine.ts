// The "will it run?" estimator.
//
// Decode speed on local hardware is memory-bandwidth bound: every generated
// token has to stream the active weights plus the KV cache through the
// processor. So we work out where each byte lives (fast memory, system RAM,
// or SSD) and add up the time it takes to read one token's worth of bytes
// from each tier.
//
// Three modes:
//   stock       llama.cpp / MLX. Weights fill fast memory, then RAM, then get
//               mmap'd from SSD. The OS page cache has no idea what an expert
//               is, so SSD hits scale with the resident fraction and the reads
//               are small random page faults.
//   strata      Expert paging. The dense core (attention, embeddings, shared
//               experts) and KV stay resident; routed experts are cached by
//               expert, with an LRU whose hit curve comes from measured routing
//               traces. Misses are whole-expert sequential reads.
//   strata+bias Strata plus a quality-gated routing bias toward resident
//               experts (<=0.5% perplexity), which removes a measured share of
//               the miss traffic.

import { type Model, type Quant, type RigSpec, QUANTS } from "./catalog";

export const ASSUMPTIONS = {
  memEfficiency: 0.7, // real decode reaches ~70% of the bandwidth bound
  ssdStockEfficiency: 0.3, // page-fault-driven 16 KB random reads
  ssdStrataEfficiency: 0.8, // whole-expert preads, several in flight
  overheadGB: 1.2, // runtime, compute buffers, graph
  osReserveGB: 6, // discrete rigs: RAM the OS and apps keep
  plateauHit: 0.95, // hit rate once the working set is resident
  runnableTps: 0.03, // slower than ~33 s/token and we call it "won't run"
};

export type Mode = "stock" | "strata" | "strataBias";
export const MODE_LABEL: Record<Mode, string> = {
  stock: "Stock (llama.cpp / MLX)",
  strata: "Strata paging (exact)",
  strataBias: "Strata + routing bias (≤0.5% ppl)",
};

export type Verdict = { key: string; label: string; tone: "great" | "good" | "ok" | "slow" | "bad" | "no" };

export function verdictFor(tps: number, runs: boolean): Verdict {
  if (!runs || tps < ASSUMPTIONS.runnableTps) return { key: "no", label: "Won't run", tone: "no" };
  if (tps >= 30) return { key: "flies", label: "Flies", tone: "great" };
  if (tps >= 12) return { key: "smooth", label: "Smooth", tone: "good" };
  if (tps >= 5) return { key: "usable", label: "Usable", tone: "ok" };
  if (tps >= 1) return { key: "patient", label: "Patient", tone: "slow" };
  return { key: "crawls", label: "Crawls (but runs)", tone: "bad" };
}

export type Tier = { name: string; capGB: number; bw: number };

export function tiersFor(rig: RigSpec): { fast: Tier; slow: Tier | null } {
  if (rig.kind === "unified") {
    return { fast: { name: "Unified memory", capGB: (rig.memGB * rig.gpuLimitPct) / 100, bw: rig.memBw }, slow: null };
  }
  return {
    fast: { name: "VRAM", capGB: rig.vramGB, bw: rig.vramBw },
    slow: { name: "System RAM", capGB: Math.max(0, rig.ramGB - ASSUMPTIONS.osReserveGB), bw: rig.ramBw },
  };
}

// Expert-cache hit rate given the resident fraction r of all routed experts.
// Below the working set it falls off like sqrt; above it, it climbs linearly to 1.
// Calibrated on Qwen3-30B-A3B: r=0.0625 -> 0.42 (measured ~0.46), r=0.25 -> 0.85
// (measured 0.76-0.86), r=0.5 -> 0.96 (measured 0.94-0.98).
export function hitRate(r: number, ws: number): number {
  if (r >= 1) return 1;
  if (r <= 0) return 0;
  const H = ASSUMPTIONS.plateauHit;
  if (r >= ws) return H + ((1 - H) * (r - ws)) / (1 - ws);
  return H * Math.sqrt(r / ws);
}

export type Footprint = {
  weightsGB: number;
  coreGB: number; // always-read, non-expert weights (all weights for dense models)
  expertGB: number;
  activeGB: number; // bytes read per token (weights)
  expertActiveGB: number;
  kvGB: number;
  overheadGB: number;
  totalGB: number;
};

export function footprint(model: Model, quant: Quant, ctx: number, kvBytes: number): Footprint {
  const b = quant.bpw / 8; // bytes per param
  const weightsGB = model.totalB * b;
  const expertB = model.moe?.expertB ?? 0;
  const expertGB = expertB * b;
  const coreGB = weightsGB - expertGB;
  const expertActiveGB = model.moe ? (expertB * model.moe.topK * b) / model.moe.experts : 0;
  const activeGB = model.moe ? coreGB + expertActiveGB : weightsGB;
  const kvGB = (model.kvLayers * model.kvElemsPerToken * kvBytes * Math.min(ctx, model.maxCtx)) / 1e9;
  const overheadGB = ASSUMPTIONS.overheadGB;
  return { weightsGB, coreGB, expertGB, activeGB, expertActiveGB, kvGB, overheadGB, totalGB: weightsGB + kvGB + overheadGB };
}

export type ModeResult = {
  mode: Mode;
  applicable: boolean;
  runs: boolean;
  tps: number;
  verdict: Verdict;
  // where the bytes live (GB)
  placed: { fast: number; slow: number; ssd: number };
  // bytes streamed per generated token (GB) by tier
  perToken: { fast: number; slow: number; ssd: number };
  hit?: number;
  notes: string[];
};

const na = (mode: Mode, why: string): ModeResult => ({
  mode,
  applicable: false,
  runs: false,
  tps: 0,
  verdict: { key: "na", label: "n/a", tone: "no" },
  placed: { fast: 0, slow: 0, ssd: 0 },
  perToken: { fast: 0, slow: 0, ssd: 0 },
  notes: [why],
});

function finish(mode: Mode, rig: RigSpec, fast: Tier, slow: Tier | null, ssdEff: number, r: Omit<ModeResult, "tps" | "verdict" | "mode" | "applicable">): ModeResult {
  const E = ASSUMPTIONS.memEfficiency;
  const seconds =
    r.perToken.fast / (fast.bw * E) +
    (slow && r.perToken.slow ? r.perToken.slow / (slow.bw * E) : 0) +
    (r.perToken.ssd ? r.perToken.ssd / (rig.ssdGBs * ssdEff) : 0);
  const tps = r.runs && seconds > 0 ? 1 / seconds : 0;
  return { ...r, mode, applicable: true, tps, verdict: verdictFor(tps, r.runs) };
}

function stock(model: Model, fp: Footprint, rig: RigSpec): ModeResult {
  const { fast, slow } = tiersFor(rig);
  const notes: string[] = [];
  const fixed = fp.kvGB + fp.overheadGB;
  const memTotal = fast.capGB + (slow?.capGB ?? 0);
  if (fixed > memTotal) {
    return finish("stock", rig, fast, slow, ASSUMPTIONS.ssdStockEfficiency, {
      runs: false,
      placed: { fast: 0, slow: 0, ssd: 0 },
      perToken: { fast: 0, slow: 0, ssd: 0 },
      notes: ["The KV cache alone doesn't fit in memory. Shrink the context."],
    });
  }
  const fixedInFast = Math.min(fixed, fast.capGB);
  const fixedInSlow = fixed - fixedInFast;
  const wFast = Math.min(fp.weightsGB, fast.capGB - fixedInFast);
  const wSlow = Math.min(fp.weightsGB - wFast, Math.max(0, (slow?.capGB ?? 0) - fixedInSlow));
  const wSsd = Math.max(0, fp.weightsGB - wFast - wSlow);
  const fF = wFast / fp.weightsGB;
  const fS = wSlow / fp.weightsGB;
  const fD = wSsd / fp.weightsGB;
  if (wSlow > 0.01) notes.push(`${wSlow.toFixed(1)} GB of weights offloaded to system RAM (CPU does those layers).`);
  if (wSsd > 0.01) {
    notes.push(`${wSsd.toFixed(1)} GB doesn't fit in memory and gets mmap'd from SSD. The page cache thrashes.`);
    if (rig.kind === "unified") notes.push("MLX won't load this at all; only llama.cpp's mmap path will try.");
  }
  // KV is read from wherever it lives; it lives in fast memory unless it spilled.
  const kvFast = fixedInSlow > 0 ? fp.kvGB * (fixedInFast / fixed) : fp.kvGB;
  return finish("stock", rig, fast, slow, ASSUMPTIONS.ssdStockEfficiency, {
    runs: true,
    placed: { fast: wFast + fixedInFast, slow: wSlow + fixedInSlow, ssd: wSsd },
    perToken: { fast: fp.activeGB * fF + kvFast, slow: fp.activeGB * fS + (fp.kvGB - kvFast), ssd: fp.activeGB * fD },
    notes,
  });
}

function strata(model: Model, fp: Footprint, rig: RigSpec, withBias: boolean): ModeResult {
  const mode: Mode = withBias ? "strataBias" : "strata";
  if (!model.moe) return na(mode, "Dense model: every weight is used on every token, so there are no cold experts to page.");
  const { fast, slow } = tiersFor(rig);
  const resident = fp.coreGB + fp.kvGB + fp.overheadGB;
  const memTotal = fast.capGB + (slow?.capGB ?? 0);
  if (resident > memTotal) {
    return finish(mode, rig, fast, slow, ASSUMPTIONS.ssdStrataEfficiency, {
      runs: false,
      placed: { fast: 0, slow: 0, ssd: 0 },
      perToken: { fast: 0, slow: 0, ssd: 0 },
      notes: [`The dense core + KV (${resident.toFixed(1)} GB) must stay resident and doesn't fit.`],
    });
  }
  const resFast = Math.min(resident, fast.capGB);
  const resSlow = resident - resFast;
  const cacheFast = fast.capGB - resFast;
  const cacheSlow = Math.max(0, (slow?.capGB ?? 0) - resSlow);
  const E = fp.expertGB;
  const h1 = hitRate(cacheFast / E, model.moe.ws);
  const h12 = hitRate((cacheFast + cacheSlow) / E, model.moe.ws);
  const missCut = withBias ? 1 - model.moe.bias : 1;
  const A = fp.expertActiveGB;
  const coreFastShare = resFast / resident;
  const notes: string[] = [];
  const cachedGB = Math.min(E, cacheFast + cacheSlow);
  notes.push(`${cachedGB.toFixed(1)} of ${E.toFixed(1)} GB of experts cached → ${(h12 * 100).toFixed(0)}% hit rate.`);
  if (h12 < 1) notes.push(`${(A * (1 - h12) * missCut * 1000).toFixed(0)} MB of expert misses streamed from SSD per token.`);
  if (withBias) notes.push(`Routing bias trims ${(model.moe.bias * 100).toFixed(0)}% of miss traffic (${model.moe.evidence.startsWith("Measured") ? "measured" : "estimated"}).`);
  return finish(mode, rig, fast, slow, ASSUMPTIONS.ssdStrataEfficiency, {
    runs: true,
    placed: { fast: resFast + Math.min(cacheFast, E), slow: resSlow + Math.min(cacheSlow, Math.max(0, E - cacheFast)), ssd: Math.max(0, E - cacheFast - cacheSlow) },
    perToken: {
      fast: (fp.coreGB + fp.kvGB) * coreFastShare + A * h1,
      slow: (fp.coreGB + fp.kvGB) * (1 - coreFastShare) + A * (h12 - h1),
      ssd: A * (1 - h12) * missCut,
    },
    hit: h12,
    notes,
  });
}

export type Estimate = {
  footprint: Footprint;
  modes: Record<Mode, ModeResult>;
  best: ModeResult;
};

export function estimate(model: Model, quant: Quant, rig: RigSpec, ctx: number, kvBytes = 2): Estimate {
  const fp = footprint(model, quant, ctx, kvBytes);
  const modes = {
    stock: stock(model, fp, rig),
    strata: strata(model, fp, rig, false),
    strataBias: strata(model, fp, rig, true),
  };
  const best = [modes.strataBias, modes.strata, modes.stock].filter((m) => m.applicable && m.runs).sort((a, b) => b.tps - a.tps)[0] ?? modes.stock;
  return { footprint: fp, modes, best };
}

// Highest-quality quant that reaches the target speed in a given mode.
export function bestQuant(model: Model, rig: RigSpec, ctx: number, target: number, mode: Mode, kvBytes = 2) {
  for (const q of QUANTS) {
    const r = estimate(model, q, rig, ctx, kvBytes).modes[mode];
    if (r.applicable && r.runs && r.tps >= target) return { quant: q, result: r };
  }
  return null;
}

// Smallest primary memory (unified memory, or VRAM on a discrete rig) that
// reaches the target speed. Null if bandwidth caps out before memory does.
export function memoryNeeded(model: Model, quant: Quant, rig: RigSpec, ctx: number, target: number, mode: Mode, kvBytes = 2): number | null {
  const withMem = (gb: number): RigSpec => (rig.kind === "unified" ? { ...rig, memGB: gb } : { ...rig, vramGB: gb });
  const ok = (gb: number) => {
    const r = estimate(model, quant, withMem(gb), ctx, kvBytes).modes[mode];
    return r.applicable && r.runs && r.tps >= target;
  };
  let hi = 4096;
  if (!ok(hi)) return null;
  let lo = 1;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (ok(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}

export type MenuEntry = {
  model: Model;
  status: "native" | "unlocked" | "stretch" | "out";
  stockPick: { quant: Quant; result: ModeResult } | null;
  strataPick: { quant: Quant; result: ModeResult } | null;
  fastestAnywhere: ModeResult | null;
};

// What can this rig run? Ranks every model in the catalog.
export function rigMenu(models: Model[], rig: RigSpec, ctx: number, target: number): MenuEntry[] {
  const order = { native: 0, unlocked: 1, stretch: 2, out: 3 };
  return models
    .map((model) => {
      const stockPick = bestQuant(model, rig, ctx, target, "stock");
      const strataPick = model.moe ? bestQuant(model, rig, ctx, target, "strataBias") : null;
      let fastestAnywhere: ModeResult | null = null;
      for (const q of QUANTS) {
        const b = estimate(model, q, rig, ctx).best;
        if (b.runs && b.verdict.key !== "no" && (!fastestAnywhere || b.tps > fastestAnywhere.tps)) fastestAnywhere = b;
      }
      const status: MenuEntry["status"] = stockPick ? "native" : strataPick ? "unlocked" : fastestAnywhere ? "stretch" : "out";
      return { model, status, stockPick, strataPick, fastestAnywhere };
    })
    .sort((a, b) => order[a.status] - order[b.status] || b.model.totalB - a.model.totalB);
}
