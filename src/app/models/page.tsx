import Link from "next/link";
import { PageHead, VerdictBadge, tps } from "@/components/ui";
import { MODELS, RIG_PRESETS } from "@/lib/catalog";
import { db } from "@/lib/db";
import { estimate } from "@/lib/engine";
import { quantById } from "@/lib/catalog";

export default async function ModelsPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind } = await searchParams;
  const runCounts = new Map((db.prepare("SELECT model_id, COUNT(*) n FROM runs GROUP BY model_id").all() as { model_id: string; n: number }[]).map((r) => [r.model_id, r.n]));
  const laptop = RIG_PRESETS.find((p) => p.id === "mbp-m4max-128")!;
  const list = MODELS.filter((m) => (kind === "moe" ? m.moe : kind === "dense" ? !m.moe : true));
  return (
    <div>
      <PageHead title="Model catalog" sub="Open-weight models people actually try to run at home. Mixture-of-experts models are where paging gets interesting.">
        <div className="flex gap-2 text-xs">
          {[["", "All"], ["moe", "MoE"], ["dense", "Dense"]].map(([k, l]) => (
            <Link key={k} href={k ? `/models?kind=${k}` : "/models"} className={`btn btn-ghost !px-3 !py-1.5 ${kind === k || (!kind && !k) ? "!border-acid text-acid" : ""}`}>{l}</Link>
          ))}
        </div>
      </PageHead>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {list.map((m) => {
          const q = quantById(m.nativeQuant ?? "Q4_K_M")!;
          const e = estimate(m, q, laptop, 8192);
          return (
            <Link key={m.id} href={`/models/${m.id}`} className="card flex flex-col p-5 transition hover:border-acid/50">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold">{m.name}</h2>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${m.moe ? "bg-acid/15 text-acid" : "bg-white/5 text-mute"}`}>{m.moe ? "MoE" : "dense"}</span>
              </div>
              <p className="text-xs text-mute">{m.org} · {m.released}</p>
              <p className="num mt-3 text-sm">{m.totalB}B total{m.moe ? ` · ${m.activeB}B active · ${m.moe.experts} experts top-${m.moe.topK}` : ""}</p>
              <p className="mt-2 flex-1 text-sm text-mute">{m.blurb}</p>
              <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-xs">
                <span className="text-mute">128 GB M4 Max @ {q.id}:</span>
                <span className="flex items-center gap-2"><VerdictBadge verdict={e.best.verdict} /><span className="num">{tps(e.best.tps)}</span></span>
              </div>
              {runCounts.get(m.id) ? <p className="mt-2 text-xs text-sky">{runCounts.get(m.id)} community run{runCounts.get(m.id)! > 1 ? "s" : ""}</p> : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
