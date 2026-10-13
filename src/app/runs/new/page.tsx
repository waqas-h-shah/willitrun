import Link from "next/link";
import { ErrorNote, PageHead } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { MODELS, QUANTS, RUNTIMES } from "@/lib/catalog";
import { db, type RigRow } from "@/lib/db";
import { logRun } from "../../actions";

export default async function NewRun({ searchParams }: { searchParams: Promise<{ error?: string; model?: string; quant?: string; ctx?: string; rig?: string }> }) {
  const user = await requireUser("/runs/new");
  const sp = await searchParams;
  const rigs = db.prepare("SELECT * FROM rigs WHERE user_id = ? ORDER BY id").all(user.id) as RigRow[];
  if (!rigs.length) {
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <p className="font-semibold">Add a rig first</p>
        <p className="mt-1 text-sm text-mute">A run is only useful next to the hardware it ran on.</p>
        <Link href="/rigs/new" className="btn mt-4">Add a rig</Link>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-2xl">
      <PageHead title="Log a real run" sub="Paste the tokens/sec your runtime printed (llama.cpp's eval rate, MLX's generation tps, LM Studio's tok/s). We'll store what we predicted next to it." />
      <form action={logRun} className="card space-y-4 p-5">
        <ErrorNote error={sp.error} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">Rig</label>
            <select name="rigId" className="input" defaultValue={sp.rig}>{rigs.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
          <div><label className="label">Model</label>
            <select name="modelId" className="input" defaultValue={sp.model}>{MODELS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
          <div><label className="label">Quant</label>
            <select name="quant" className="input" defaultValue={sp.quant ?? "Q4_K_M"}>{QUANTS.map((q) => <option key={q.id} value={q.id}>{q.id}</option>)}</select></div>
          <div><label className="label">Context (tokens)</label>
            <input name="ctx" type="number" className="input num" defaultValue={sp.ctx ?? 8192} min={512} /></div>
          <div><label className="label">Runtime</label>
            <select name="runtime" className="input">{RUNTIMES.map((r) => <option key={r}>{r}</option>)}</select></div>
          <div><label className="label">Measured decode speed (tok/s)</label>
            <input name="measured" type="number" step="any" min="0.001" className="input num" required placeholder="e.g. 42.5" /></div>
        </div>
        <div><label className="label">Notes (flags, prompt, anything notable)</label>
          <input name="notes" className="input" maxLength={500} placeholder="-ngl 99 -fa, 512-token prompt…" /></div>
        <button className="btn">Log run</button>
      </form>
    </div>
  );
}
