import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHead, VerdictBadge, tps } from "@/components/ui";
import { currentUser } from "@/lib/auth";
import { RIG_PRESETS, modelById, quantById } from "@/lib/catalog";
import { db, type RunRow } from "@/lib/db";
import { MODE_LABEL, estimate } from "@/lib/engine";
import { toggleWish } from "../../actions";
import { RunsTable } from "@/components/RunsTable";

export default async function ModelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const model = modelById(id);
  if (!model) notFound();
  const user = await currentUser();
  const wished = user ? !!db.prepare("SELECT 1 FROM wishlist WHERE user_id = ? AND model_id = ?").get(user.id, id) : false;
  const runs = db.prepare("SELECT r.*, u.name user_name FROM runs r JOIN users u ON u.id = r.user_id WHERE model_id = ? ORDER BY r.id DESC LIMIT 50").all(id) as RunRow[];
  const q = quantById(model.nativeQuant ?? "Q4_K_M")!;
  const fans = (db.prepare("SELECT COUNT(*) n FROM wishlist WHERE model_id = ?").get(id) as { n: number }).n;

  return (
    <div className="space-y-8">
      <PageHead title={model.name} sub={model.blurb}>
        <div className="flex gap-2">
          {user && (
            <form action={toggleWish}>
              <input type="hidden" name="modelId" value={model.id} />
              <button className="btn btn-ghost">{wished ? "★ On your wishlist" : "☆ Add to wishlist"}</button>
            </form>
          )}
          <Link href={`/check?model=${model.id}`} className="btn">Check it on my rig</Link>
        </div>
      </PageHead>

      <section className="grid gap-4 md:grid-cols-4">
        {[
          ["Total params", `${model.totalB}B`],
          ["Active / token", `${model.activeB}B`],
          ["Layers (KV layers)", `${model.layers} (${model.kvLayers})`],
          ["Max context", `${model.maxCtx / 1024}k`],
        ].map(([k, v]) => (
          <div key={k} className="card p-4"><div className="label">{k}</div><div className="num text-2xl font-bold">{v}</div></div>
        ))}
      </section>

      {model.moe ? (
        <section className="card p-5">
          <h2 className="text-lg font-semibold">Cacheability <span className="text-sm font-normal text-mute">(from the Strata routing-trace study)</span></h2>
          <div className="num mt-3 grid gap-3 text-sm sm:grid-cols-4">
            <div><span className="label">Experts</span>{model.moe.experts} routed, top-{model.moe.topK}{model.moe.shared ? " + shared" : ""}</div>
            <div><span className="label">Working set</span>{(model.moe.ws * 100).toFixed(0)}% of experts</div>
            <div><span className="label">Routing-bias saving</span>{(model.moe.bias * 100).toFixed(0)}% of misses</div>
            <div><span className="label">Fans</span>{fans} wishlisted</div>
          </div>
          <p className="mt-4 text-sm text-mute">{model.moe.evidence}</p>
        </section>
      ) : (
        <section className="card p-5 text-sm text-mute">Dense model: every parameter is read for every token, so speed is purely (bytes ÷ bandwidth). Paging can't help. Buy bandwidth, or pick a smaller quant.</section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">On popular rigs <span className="text-sm font-normal text-mute">at {q.id}, 8k context</span></h2>
        <div className="card overflow-x-auto p-2">
          <table className="data">
            <thead><tr><th>Rig</th><th>Stock</th><th>Strata + bias</th><th /></tr></thead>
            <tbody>
              {RIG_PRESETS.map((p) => {
                const e = estimate(model, q, p, 8192);
                return (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td><span className="inline-flex items-center gap-2"><VerdictBadge verdict={e.modes.stock.verdict} /><span className="num text-xs">{e.modes.stock.runs ? tps(e.modes.stock.tps) : ""}</span></span></td>
                    <td>{model.moe ? <span className="inline-flex items-center gap-2"><VerdictBadge verdict={e.modes.strataBias.verdict} /><span className="num text-xs">{e.modes.strataBias.runs ? tps(e.modes.strataBias.tps) : ""}</span></span> : <span className="text-xs text-mute">n/a</span>}</td>
                    <td><Link className="text-sm text-acid" href={`/check?rig=preset:${p.id}&model=${model.id}&quant=${q.id}`}>Details →</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-mute">Best mode is chosen per rig: {Object.values(MODE_LABEL).join(" · ")}.</p>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Community runs</h2>
        <RunsTable runs={runs} userId={user?.id} />
      </section>
    </div>
  );
}
