import Link from "next/link";
import { PageHead, VerdictBadge, gb, tps } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { MODELS, modelById } from "@/lib/catalog";
import { db, rigSpec, type RigRow } from "@/lib/db";
import { rigMenu, tiersFor } from "@/lib/engine";
import { saveTarget } from "../actions";

export default async function RigsPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const user = await requireUser("/rigs");
  const { welcome } = await searchParams;
  const rigs = db.prepare("SELECT * FROM rigs WHERE user_id = ? ORDER BY id").all(user.id) as RigRow[];
  const wish = (db.prepare("SELECT model_id FROM wishlist WHERE user_id = ? ORDER BY created_at").all(user.id) as { model_id: string }[])
    .map((w) => modelById(w.model_id))
    .filter((m) => !!m);
  const target = user.target_tps;

  return (
    <div>
      {welcome && (
        <div className="mb-6 rounded-xl border border-acid/40 bg-acid/10 p-4 text-sm">
          <b className="text-acid">You're in as {user.name}.</b> We gave you two starter rigs: a 16 GB MacBook Air and an RTX 4090 gaming PC.
          Open one to see everything it can run, or <Link className="underline" href="/check?model=deepseek-v3.1&rig=preset:mbp-m4max-128">try a 671B model on a laptop</Link>.
        </div>
      )}
      <PageHead title="My rigs" sub="Each rig gets a menu of every model it can run, at the best quant for your target speed.">
        <Link href="/rigs/new" className="btn">+ Add rig</Link>
      </PageHead>

      <form action={saveTarget} className="card mb-6 flex flex-wrap items-center gap-3 p-4 text-sm">
        <span className="text-mute">I'm happy when a model generates at least</span>
        <input name="target" type="number" min={1} max={200} step={1} defaultValue={target} className="input num !w-20" />
        <span className="text-mute">tokens/sec (reading speed is ~5–8)</span>
        <button className="btn btn-ghost !py-1.5">Save</button>
      </form>

      {rigs.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-lg font-semibold">No rigs yet</p>
          <p className="mt-1 text-mute">Add the machine you own, or the one you're thinking of buying.</p>
          <Link href="/rigs/new" className="btn mt-4">Add your first rig</Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rigs.map((r) => {
            const spec = rigSpec(r);
            const menu = rigMenu(MODELS, spec, 8192, target);
            const native = menu.filter((m) => m.status === "native").length;
            const unlocked = menu.filter((m) => m.status === "unlocked");
            const { fast, slow } = tiersFor(spec);
            const biggest = menu.filter((m) => m.status === "native" || m.status === "unlocked").sort((a, b) => b.model.totalB - a.model.totalB)[0];
            return (
              <Link key={r.id} href={`/rigs/${r.id}`} className="card block p-5 transition hover:border-acid/50">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{r.name}</h2>
                    <p className="num text-xs text-mute">
                      {r.kind === "unified" ? `${r.mem_gb} GB unified · ${r.mem_bw} GB/s` : `${r.vram_gb} GB VRAM · ${r.vram_bw} GB/s + ${r.ram_gb} GB RAM`} · SSD {r.ssd_gbs} GB/s
                    </p>
                  </div>
                  <span className="num text-xs text-mute">{gb(fast.capGB + (slow?.capGB ?? 0))} usable</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-white/[0.03] p-3"><div className="num text-2xl font-bold">{native}</div><div className="text-xs text-mute">models at ≥ {target} tok/s stock</div></div>
                  <div className="rounded-lg bg-acid/10 p-3"><div className="num text-2xl font-bold text-acid">+{unlocked.length}</div><div className="text-xs text-mute">more unlocked by Strata</div></div>
                </div>
                {biggest && <p className="mt-3 text-xs text-mute">Biggest model it handles at your target: <b className="text-text">{biggest.model.name}</b></p>}
              </Link>
            );
          })}
        </div>
      )}

      <h2 className="mb-3 mt-10 text-lg font-semibold">Wishlist</h2>
      {wish.length === 0 ? (
        <p className="text-sm text-mute">Star models from the <Link href="/models" className="text-acid">catalog</Link> or a check to track which of your rigs can run them.</p>
      ) : (
        <div className="card overflow-x-auto p-2">
          <table className="data">
            <thead><tr><th>Model</th>{rigs.map((r) => <th key={r.id}>{r.name}</th>)}</tr></thead>
            <tbody>
              {wish.map((m) => (
                <tr key={m!.id}>
                  <td><Link href={`/models/${m!.id}`} className="font-semibold hover:text-acid">{m!.name}</Link></td>
                  {rigs.map((r) => {
                    const entry = rigMenu([m!], rigSpec(r), 8192, target)[0];
                    const best = entry.fastestAnywhere;
                    return (
                      <td key={r.id}>
                        <Link href={`/check?rig=my:${r.id}&model=${m!.id}`} className="inline-flex items-center gap-2">
                          {best ? <><VerdictBadge verdict={best.verdict} /><span className="num text-xs text-mute">{tps(best.tps)}</span></> : <span className="text-xs text-mute">won't run</span>}
                        </Link>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
