import { PageHead } from "@/components/ui";
import { ASSUMPTIONS, hitRate } from "@/lib/engine";

export default function How() {
  const pts = Array.from({ length: 41 }, (_, i) => i / 40);
  const curve = (ws: number) => pts.map((r) => `${(r * 300).toFixed(1)},${(150 - hitRate(r, ws) * 140).toFixed(1)}`).join(" ");
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHead title="How the estimate works" sub="Short version: local decoding is memory-bandwidth bound. Every token streams the active weights and the KV cache. Where those bytes live decides your speed." />
      <section className="card space-y-3 p-5 text-sm text-mute">
        <h2 className="text-base font-semibold text-text">1 · Footprint</h2>
        <p><span className="num text-text">weights = params × bits-per-weight ÷ 8</span>. KV cache = KV layers × per-token width × context × bytes per element. That covers GQA, MLA (DeepSeek/Kimi latent) and hybrid or sliding-window layers (Qwen3-Next, Gemma 3, gpt-oss), which only keep full-context KV on some layers.</p>
        <h2 className="pt-2 text-base font-semibold text-text">2 · Placement</h2>
        <p>Fast tier = unified memory (× the GPU wired limit) or VRAM. Slow tier = system RAM minus {ASSUMPTIONS.osReserveGB} GB for the OS. Anything left over lives on SSD.</p>
        <h2 className="pt-2 text-base font-semibold text-text">3 · Three runtime modes</h2>
        <p><b className="text-text">Stock</b>: weights fill fast → RAM → mmap'd SSD. The page cache doesn't know what an expert is, so SSD traffic scales with the non-resident fraction, as small random faults at {ASSUMPTIONS.ssdStockEfficiency * 100}% of sequential speed.</p>
        <p><b className="text-text">Strata</b>: the dense core (attention, embeddings, shared experts) and KV stay resident. Routed experts are cached per expert, and misses are whole-expert reads at {ASSUMPTIONS.ssdStrataEfficiency * 100}% of sequential speed.</p>
        <p><b className="text-text">Strata + routing bias</b>: a small logit bonus for resident experts, capped at ≤0.5% perplexity cost, removes a per-model share of the miss traffic (measured for Qwen3-30B, Qwen3-Next, GLM-4.5-Air, Mixtral).</p>
        <h2 className="pt-2 text-base font-semibold text-text">4 · Speed</h2>
        <p className="num text-text">seconds/token = Σ over tiers of (bytes read from that tier ÷ (tier bandwidth × efficiency))</p>
        <p>Memory reaches ~{ASSUMPTIONS.memEfficiency * 100}% of its bandwidth bound in practice. Below {ASSUMPTIONS.runnableTps} tok/s we call it "won't run".</p>
      </section>
      <section className="card p-5">
        <h2 className="font-semibold">Expert-cache hit curve</h2>
        <p className="mt-1 text-sm text-mute">Hit rate vs. fraction of experts resident. Below a model's working set it falls off like √r; above it, it climbs to 100%. Calibrated against Qwen3-30B-A3B traces (25% resident → 76–86% measured; 50% → 94–98%).</p>
        <svg viewBox="-30 0 340 175" className="mt-4 w-full">
          <line x1="0" y1="150" x2="300" y2="150" stroke="var(--color-line)" />
          <line x1="0" y1="10" x2="0" y2="150" stroke="var(--color-line)" />
          <polyline fill="none" stroke="var(--color-acid)" strokeWidth="2" points={curve(0.2)} />
          <polyline fill="none" stroke="var(--color-sky)" strokeWidth="2" points={curve(0.31)} />
          <polyline fill="none" stroke="var(--color-rose)" strokeWidth="2" points={curve(0.94)} />
          <text x="150" y="168" fill="var(--color-mute)" fontSize="9" textAnchor="middle">fraction of experts resident →</text>
          <text x="-6" y="14" fill="var(--color-mute)" fontSize="8" textAnchor="end">100%</text>
          <text x="-6" y="150" fill="var(--color-mute)" fontSize="8" textAnchor="end">0</text>
          <text x="210" y="40" fill="var(--color-acid)" fontSize="9">Qwen3-Next (ws 20%)</text>
          <text x="210" y="52" fill="var(--color-sky)" fontSize="9">Qwen3-30B (ws 31%)</text>
          <text x="210" y="100" fill="var(--color-rose)" fontSize="9">Mixtral (ws 94%)</text>
        </svg>
      </section>
      <section className="card space-y-2 p-5 text-sm text-mute">
        <h2 className="text-base font-semibold text-text">What it ignores (on purpose, for now)</h2>
        <p>Prefill / time-to-first-token (compute bound), batching, speculative decoding, PCIe latency when paging into VRAM, and thermal throttling.
          The community board measures how wrong that makes us, broken down by runtime.</p>
      </section>
    </div>
  );
}
