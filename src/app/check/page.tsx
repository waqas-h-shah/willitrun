import Link from "next/link";
import { AutoSubmitForm } from "@/components/AutoSubmit";
import { PlacementBar, VerdictBadge, gb, tps } from "@/components/ui";
import { currentUser } from "@/lib/auth";
import { MODELS, QUANTS, RIG_PRESETS, modelById, quantById, type RigSpec } from "@/lib/catalog";
import { db, rigSpec, type RigRow } from "@/lib/db";
import { MODE_LABEL, estimate, memoryNeeded, tiersFor, type Mode, type ModeResult } from "@/lib/engine";
import { toggleWish } from "../actions";

const CTX = [4096, 8192, 32768, 131072];
const MODES: Mode[] = ["stock", "strata", "strataBias"];

type SP = { rig?: string; model?: string; quant?: string; ctx?: string; kv?: string; target?: string };

export default async function CheckPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const user = await currentUser();
  const myRigs = user ? (db.prepare("SELECT * FROM rigs WHERE user_id = ? ORDER BY id").all(user.id) as RigRow[]) : [];

  const rigKey = sp.rig ?? (myRigs[0] ? `my:${myRigs[0].id}` : "preset:mba-m4-16");
  let rigName = "";
  let rig: RigSpec | null = null;
  let myRigId: number | null = null;
  if (rigKey.startsWith("my:")) {
    const r = myRigs.find((x) => x.id === Number(rigKey.slice(3)));
    if (r) [rigName, rig, myRigId] = [r.name, rigSpec(r), r.id];
  }
  if (!rig) {
    const p = RIG_PRESETS.find((x) => `preset:${x.id}` === rigKey) ?? RIG_PRESETS[0];
    [rigName, rig] = [p.name, p];
  }
  const model = modelById(sp.model ?? "") ?? MODELS[0];
  const quant = quantById(sp.quant ?? "") ?? quantById(model.nativeQuant ?? "Q4_K_M")!;
  const ctx = CTX.includes(Number(sp.ctx)) ? Number(sp.ctx) : 8192;
  const kvBytes = sp.kv === "8" ? 1.06 : 2;
  const target = Math.min(200, Math.max(1, Number(sp.target) || user?.target_tps || 10));

  const est = estimate(model, quant, rig, ctx, kvBytes);
  const { fast, slow } = tiersFor(rig);
  const caps = { fast: fast.capGB, slow: slow?.capGB ?? 0 };
  const stock = est.modes.stock;
  const paged = est.modes.strataBias;
  const unlock = model.moe && paged.runs && paged.tps > 1.5 * Math.max(stock.tps, 0.0001) && paged.verdict.key !== "no";
  const memLabel = rig.kind === "unified" ? "unified memory" : "VRAM";
  const needStock = memoryNeeded(model, quant, rig, ctx, target, "stock", kvBytes);
  const needStrata = model.moe ? memoryNeeded(model, quant, rig, ctx, target, "strataBias", kvBytes) : null;
  const wished = user ? !!db.prepare("SELECT 1 FROM wishlist WHERE user_id = ? AND model_id = ?").get(user.id, model.id) : false;
  const logHref = `/runs/new?model=${model.id}&quant=${quant.id}&ctx=${ctx}${myRigId ? `&rig=${myRigId}` : ""}`;

  return (
    <div className="space-y-6">
      <AutoSubmitForm className="card grid grid-cols-2 gap-3 p-4 md:grid-cols-6">
        <div className="col-span-2">
          <label className="label">Rig</label>
          <select name="rig" defaultValue={rigKey} className="input">
            {myRigs.length > 0 && (
              <optgroup label="My rigs">
                {myRigs.map((r) => <option key={r.id} value={`my:${r.id}`}>{r.name}</option>)}
              </optgroup>
            )}
            <optgroup label="Presets">
              {RIG_PRESETS.map((p) => <option key={p.id} value={`preset:${p.id}`}>{p.name}</option>)}
            </optgroup>
          </select>
        </div>
        <div className="col-span-2">
          <label className="label">Model</label>
          <select name="model" defaultValue={model.id} className="input">
            {MODELS.map((m) => <option key={m.id} value={m.id}>{m.name} · {m.totalB >= 100 ? m.totalB.toFixed(0) : m.totalB}B{m.moe ? ` (${m.activeB}B active)` : ""}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Quant</label>
          <select name="quant" defaultValue={quant.id} className="input">
            {QUANTS.map((q) => <option key={q.id} value={q.id}>{q.id} · {q.bpw} bpw</option>)}
          </select>
        </div>
        <div>
          <label className="label">Context</label>
          <select name="ctx" defaultValue={ctx} className="input">
            {CTX.map((c) => <option key={c} value={c}>{c / 1024}k tokens</option>)}
          </select>
        </div>
        <div>
          <label className="label">KV cache</label>
          <select name="kv" defaultValue={sp.kv === "8" ? "8" : "16"} className="input">
            <option value="16">f16</option>
            <option value="8">q8_0</option>
          </select>
        </div>
        <div>
          <label className="label">Target speed</label>
          <select name="target" defaultValue={target} className="input">
            {[3, 5, 10, 20, 40].includes(target) ? null : <option value={target}>{target} tok/s</option>}
            {[3, 5, 10, 20, 40].map((t) => <option key={t} value={t}>{t} tok/s</option>)}
          </select>
        </div>
        <noscript><button className="btn">Check</button></noscript>
      </AutoSubmitForm>

      {/* Headline */}
      <section className="card relative overflow-hidden p-6">
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-40" />
        <div className="relative">
          <p className="num text-sm text-mute">$ will-it-run --model {model.id} --quant {quant.id} --ctx {ctx / 1024}k</p>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
            {model.name} on <span className="text-acid">{rigName}</span>
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <VerdictBadge verdict={est.best.verdict} big />
            <span className="num text-3xl font-bold">{tps(est.best.tps)}</span>
            <span className="text-sm text-mute">best mode: {MODE_LABEL[est.best.mode]}</span>
          </div>
          {unlock && (
            <div className="mt-5 rounded-xl border border-acid/40 bg-acid/10 p-4">
              <p className="font-semibold text-acid">
                {stock.verdict.key === "no" || stock.verdict.key === "crawls" ? "Strata unlocks this model on this rig." : "Strata makes this a lot faster."}
              </p>
              <p className="mt-1 text-sm">
                Stock: <b className="num">{tps(stock.tps)}</b> ({stock.verdict.label.toLowerCase()}) → with expert paging + routing bias:{" "}
                <b className="num text-acid">{tps(paged.tps)}</b>, <b>{(paged.tps / Math.max(stock.tps, 0.0001)).toFixed(1)}× faster</b>.
                {needStock && needStrata && needStrata < needStock && (
                  <> To reach {target} tok/s you'd need <b className="num">{needStock} GB</b> of {memLabel} stock, or <b className="num text-acid">{needStrata} GB</b> with Strata.</>
                )}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Footprint */}
      <section className="grid gap-4 md:grid-cols-4">
        {[
          ["Weights", est.footprint.weightsGB, `${model.totalB}B × ${quant.bpw} bpw`],
          ["KV cache", est.footprint.kvGB, `${ctx / 1024}k ctx · ${model.kvLayers} KV layers`],
          ["Read / token", est.footprint.activeGB + est.footprint.kvGB, model.moe ? `${model.activeB}B active of ${model.totalB}B` : "dense: every weight, every token"],
          ["Total to load", est.footprint.totalGB, `vs ${gb(caps.fast + caps.slow)} usable memory`],
        ].map(([k, v, sub]) => (
          <div key={k as string} className="card p-4">
            <div className="label">{k}</div>
            <div className="num text-2xl font-bold">{gb(v as number)}</div>
            <div className="mt-1 text-xs text-mute">{sub}</div>
          </div>
        ))}
      </section>

      {/* Modes */}
      <section className="grid gap-4 md:grid-cols-3">
        {MODES.map((m) => <ModeCard key={m} r={est.modes[m]} caps={caps} best={est.best.mode === m} />)}
      </section>

      {/* Quant ladder */}
      <section className="card p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Quant ladder</h2>
          <p className="text-sm text-mute">Highest quality that still hits <b className="text-text">{target} tok/s</b> gets the ★</p>
        </div>
        <QuantLadder modelId={model.id} rig={rig} ctx={ctx} kvBytes={kvBytes} target={target} current={quant.id} sp={sp} />
      </section>

      <section className="flex flex-wrap gap-3">
        <Link href={user ? logHref : `/login?next=${encodeURIComponent(logHref)}`} className="btn">I ran this, log my real speed</Link>
        {user ? (
          <form action={toggleWish}>
            <input type="hidden" name="modelId" value={model.id} />
            <button className="btn btn-ghost">{wished ? "★ On your wishlist" : "☆ Add to wishlist"}</button>
          </form>
        ) : null}
        {myRigId && <Link href={`/rigs/${myRigId}`} className="btn btn-ghost">Everything this rig can run →</Link>}
        <Link href={`/models/${model.id}`} className="btn btn-ghost">About {model.name}</Link>
      </section>
    </div>
  );
}

function ModeCard({ r, caps, best }: { r: ModeResult; caps: { fast: number; slow: number }; best: boolean }) {
  return (
    <div className={`card p-5 ${best ? "ring-1 ring-acid/50" : ""}`}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold">{MODE_LABEL[r.mode]}</h3>
        {r.applicable ? <VerdictBadge verdict={r.verdict} /> : <span className="text-xs text-mute">n/a</span>}
      </div>
      {r.applicable ? (
        <>
          <div className="num mb-3 text-2xl font-bold">{r.runs ? tps(r.tps) : "—"}</div>
          {r.runs && <PlacementBar placed={r.placed} caps={caps} />}
          {r.runs && (
            <p className="num mt-3 text-xs text-mute">
              per token: {(r.perToken.fast * 1000).toFixed(0)} MB fast
              {r.perToken.slow > 0.0005 ? ` · ${(r.perToken.slow * 1000).toFixed(0)} MB RAM` : ""}
              {r.perToken.ssd > 0.0005 ? ` · ${(r.perToken.ssd * 1000).toFixed(0)} MB SSD` : ""}
            </p>
          )}
        </>
      ) : null}
      <ul className="mt-3 space-y-1 text-xs text-mute">
        {r.notes.map((n) => <li key={n}>› {n}</li>)}
      </ul>
    </div>
  );
}

function QuantLadder({ modelId, rig, ctx, kvBytes, target, current, sp }: { modelId: string; rig: RigSpec; ctx: number; kvBytes: number; target: number; current: string; sp: SP }) {
  const model = modelById(modelId)!;
  const rows = QUANTS.map((q) => ({ q, e: estimate(model, q, rig, ctx, kvBytes) }));
  const pick = (mode: Mode) => rows.find((r) => r.e.modes[mode].applicable && r.e.modes[mode].runs && r.e.modes[mode].tps >= target)?.q.id;
  const stockPick = pick("stock");
  const strataPick = model.moe ? pick("strataBias") : undefined;
  const href = (q: string) => `/check?${new URLSearchParams({ ...(sp as Record<string, string>), model: modelId, quant: q }).toString()}`;
  return (
    <div className="overflow-x-auto">
      <table className="data">
        <thead>
          <tr><th>Quant</th><th>Quality</th><th>Size</th><th>Stock</th>{model.moe && <th>Strata + bias</th>}</tr>
        </thead>
        <tbody>
          {rows.map(({ q, e }) => (
            <tr key={q.id} className={q.id === current ? "bg-white/[0.03]" : ""}>
              <td><Link href={href(q.id)} className="num font-semibold hover:text-acid">{q.id}</Link></td>
              <td className="text-mute">{q.quality}</td>
              <td className="num">{gb(e.footprint.weightsGB)}</td>
              <td>
                <span className="num mr-2">{e.modes.stock.runs ? tps(e.modes.stock.tps) : "—"}</span>
                <VerdictBadge verdict={e.modes.stock.verdict} />
                {stockPick === q.id && <span className="ml-1 text-amber">★</span>}
              </td>
              {model.moe && (
                <td>
                  <span className="num mr-2">{e.modes.strataBias.runs ? tps(e.modes.strataBias.tps) : "—"}</span>
                  <VerdictBadge verdict={e.modes.strataBias.verdict} />
                  {strataPick === q.id && <span className="ml-1 text-amber">★</span>}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {!stockPick && !strataPick && <p className="mt-3 text-sm text-mute">Nothing reaches {target} tok/s on this rig. Try a lower target or a bigger rig.</p>}
    </div>
  );
}
