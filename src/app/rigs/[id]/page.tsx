import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHead, VerdictBadge, tps } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { MODELS } from "@/lib/catalog";
import { db, rigSpec, type RigRow } from "@/lib/db";
import { MODE_LABEL, rigMenu, type MenuEntry } from "@/lib/engine";

const GROUPS: { status: MenuEntry["status"]; title: string; blurb: string }[] = [
  { status: "native", title: "Runs great out of the box", blurb: "Hits your target with a stock runtime." },
  { status: "unlocked", title: "Unlocked by Strata", blurb: "Stock runtimes thrash or crawl. Expert paging gets these to your target." },
  { status: "stretch", title: "Runs, but below your target", blurb: "Technically works. Bring a book." },
  { status: "out", title: "Out of reach", blurb: "Won't load, even with paging." },
];

export default async function RigMenu({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ctx?: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/rigs/${id}`);
  const rig = db.prepare("SELECT * FROM rigs WHERE id = ? AND user_id = ?").get(Number(id), user.id) as RigRow | undefined;
  if (!rig) notFound();
  const ctx = [4096, 8192, 32768, 131072].includes(Number((await searchParams).ctx)) ? Number((await searchParams).ctx) : 8192;
  const menu = rigMenu(MODELS, rigSpec(rig), ctx, user.target_tps);

  return (
    <div>
      <PageHead title={rig.name} sub={`Everything in the catalog, ranked for this rig at ${ctx / 1024}k context and your ${user.target_tps} tok/s target.`}>
        <div className="flex gap-2">
          {[4096, 8192, 32768, 131072].map((c) => (
            <Link key={c} href={`/rigs/${rig.id}?ctx=${c}`} className={`btn btn-ghost !px-3 !py-1.5 text-xs ${c === ctx ? "!border-acid text-acid" : ""}`}>{c / 1024}k</Link>
          ))}
          <Link href={`/rigs/${rig.id}/edit`} className="btn btn-ghost !px-3 !py-1.5 text-xs">Edit rig</Link>
        </div>
      </PageHead>
      <div className="space-y-8">
        {GROUPS.map((g) => {
          const items = menu.filter((m) => m.status === g.status);
          if (!items.length) return null;
          return (
            <section key={g.status}>
              <h2 className={`text-lg font-semibold ${g.status === "unlocked" ? "text-acid" : ""}`}>{g.title} <span className="num text-sm text-mute">({items.length})</span></h2>
              <p className="mb-3 text-sm text-mute">{g.blurb}</p>
              <div className="card overflow-x-auto p-2">
                <table className="data">
                  <thead><tr><th>Model</th><th>Stock: best quant @ target</th><th>Strata: best quant @ target</th><th>Fastest possible</th><th /></tr></thead>
                  <tbody>
                    {items.map((m) => (
                      <tr key={m.model.id}>
                        <td>
                          <Link href={`/models/${m.model.id}`} className="font-semibold hover:text-acid">{m.model.name}</Link>
                          <div className="num text-xs text-mute">{m.model.totalB}B{m.model.moe ? ` · ${m.model.activeB}B active` : " · dense"}</div>
                        </td>
                        <td>{m.stockPick ? <span className="num">{m.stockPick.quant.id} · {tps(m.stockPick.result.tps)}</span> : <span className="text-mute">—</span>}</td>
                        <td>{m.model.moe ? (m.strataPick ? <span className="num text-acid">{m.strataPick.quant.id} · {tps(m.strataPick.result.tps)}</span> : <span className="text-mute">—</span>) : <span className="text-xs text-mute">dense, n/a</span>}</td>
                        <td>{m.fastestAnywhere ? <span className="inline-flex items-center gap-2"><VerdictBadge verdict={m.fastestAnywhere.verdict} /><span className="num text-xs text-mute">{tps(m.fastestAnywhere.tps)} · {MODE_LABEL[m.fastestAnywhere.mode].split(" (")[0]}</span></span> : <span className="text-mute">—</span>}</td>
                        <td><Link href={`/check?rig=my:${rig.id}&model=${m.model.id}&ctx=${ctx}${(m.stockPick ?? m.strataPick) ? `&quant=${(m.stockPick ?? m.strataPick)!.quant.id}` : ""}`} className="text-sm text-acid">Details →</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
