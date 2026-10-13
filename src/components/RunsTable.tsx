import Link from "next/link";
import { modelById } from "@/lib/catalog";
import type { RunRow } from "@/lib/db";
import { deleteRun } from "@/app/actions";
import { tps } from "./ui";

export function errorPct(r: RunRow) {
  return ((r.predicted_tps - r.measured_tps) / r.measured_tps) * 100;
}

export function RunsTable({ runs, userId }: { runs: RunRow[]; userId?: number }) {
  if (!runs.length) {
    return (
      <div className="card p-8 text-center text-sm text-mute">
        No runs logged yet. Ran a model? <Link href="/runs/new" className="text-acid">Log your real tokens/sec</Link> and see how close the estimate was.
      </div>
    );
  }
  return (
    <div className="card overflow-x-auto p-2">
      <table className="data">
        <thead>
          <tr><th>Model</th><th>Rig</th><th>Setup</th><th>Measured</th><th>Predicted</th><th>Model error</th><th>By</th><th /></tr>
        </thead>
        <tbody>
          {runs.map((r) => {
            const err = errorPct(r);
            return (
              <tr key={r.id}>
                <td>
                  <Link href={`/models/${r.model_id}`} className="font-semibold hover:text-acid">{modelById(r.model_id)?.name ?? r.model_id}</Link>
                  {r.notes && <div className="max-w-[220px] truncate text-xs text-mute" title={r.notes}>“{r.notes}”</div>}
                </td>
                <td className="text-sm">{r.rig_name}</td>
                <td className="num text-xs text-mute">{r.quant} · {r.ctx / 1024}k · {r.runtime}</td>
                <td className="num font-semibold">{tps(r.measured_tps)}</td>
                <td className="num text-mute">{tps(r.predicted_tps)}</td>
                <td className={`num text-sm ${Math.abs(err) <= 25 ? "text-acid" : Math.abs(err) <= 60 ? "text-amber" : "text-rose"}`}>
                  {err > 0 ? "+" : ""}{err.toFixed(0)}% {err > 0 ? "optimistic" : "pessimistic"}
                </td>
                <td className="text-xs text-mute">{r.user_name}<div>{r.created_at.slice(0, 10)}</div></td>
                <td>
                  {userId === r.user_id && (
                    <form action={deleteRun}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className="text-xs text-rose hover:underline">delete</button>
                    </form>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
