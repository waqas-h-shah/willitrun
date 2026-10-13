import Link from "next/link";
import { PageHead } from "@/components/ui";
import { RunsTable } from "@/components/RunsTable";
import { currentUser } from "@/lib/auth";
import { MODELS } from "@/lib/catalog";
import { db, type RunRow } from "@/lib/db";

export default async function RunsPage({ searchParams }: { searchParams: Promise<{ model?: string; mine?: string; logged?: string }> }) {
  const sp = await searchParams;
  const user = await currentUser();
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (sp.model) { where.push("r.model_id = ?"); args.push(sp.model); }
  if (sp.mine && user) { where.push("r.user_id = ?"); args.push(user.id); }
  const runs = db
    .prepare(`SELECT r.*, u.name user_name FROM runs r JOIN users u ON u.id = r.user_id ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY r.id DESC LIMIT 200`)
    .all(...args) as RunRow[];

  // Calibration: how far off is the estimator, per runtime? Ratio > 1 means we over-promise.
  const byRuntime = new Map<string, number[]>();
  for (const r of runs) byRuntime.set(r.runtime, [...(byRuntime.get(r.runtime) ?? []), r.predicted_tps / r.measured_tps]);
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const calib = [...byRuntime.entries()].map(([rt, xs]) => ({ rt, n: xs.length, ratio: median(xs) })).sort((a, b) => b.n - a.n);

  const link = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const next = { model: sp.model, mine: sp.mine, ...patch };
    for (const [k, v] of Object.entries(next)) if (v) p.set(k, v);
    return `/runs${p.size ? `?${p}` : ""}`;
  };

  return (
    <div className="space-y-6">
      {sp.logged && <div className="rounded-xl border border-acid/40 bg-acid/10 p-3 text-sm text-acid">Run logged. Thanks for keeping the estimates honest.</div>}
      <PageHead title="Community runs" sub="Real tokens/sec from real machines, next to what the estimator predicted. This is how the model earns trust.">
        <Link href={user ? "/runs/new" : "/login?next=/runs/new"} className="btn">+ Log a run</Link>
      </PageHead>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Link href={link({ model: undefined })} className={`btn btn-ghost !px-3 !py-1.5 ${!sp.model ? "!border-acid text-acid" : ""}`}>All models</Link>
        {MODELS.map((m) => (
          <Link key={m.id} href={link({ model: m.id })} className={`btn btn-ghost !px-3 !py-1.5 ${sp.model === m.id ? "!border-acid text-acid" : ""}`}>{m.name}</Link>
        ))}
        {user && (
          <Link href={link({ mine: sp.mine ? undefined : "1" })} className={`btn btn-ghost !px-3 !py-1.5 ${sp.mine ? "!border-sky text-sky" : ""}`}>{sp.mine ? "✓ Only mine" : "Only mine"}</Link>
        )}
      </div>

      {calib.length > 0 && (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {calib.map((c) => (
            <div key={c.rt} className="card p-4">
              <div className="label">{c.rt} · {c.n} run{c.n > 1 ? "s" : ""}</div>
              <div className="num text-xl font-bold">{c.ratio >= 1 ? "+" : ""}{((c.ratio - 1) * 100).toFixed(0)}%</div>
              <div className="text-xs text-mute">median estimator bias ({c.ratio >= 1 ? "optimistic" : "pessimistic"})</div>
            </div>
          ))}
        </section>
      )}

      <RunsTable runs={runs} userId={user?.id} />
    </div>
  );
}
