import type { Verdict } from "@/lib/engine";

const TONE: Record<Verdict["tone"], string> = {
  great: "bg-acid/15 text-acid border-acid/40",
  good: "bg-sky/15 text-sky border-sky/40",
  ok: "bg-amber/10 text-amber border-amber/40",
  slow: "bg-amber/10 text-amber/80 border-amber/30",
  bad: "bg-rose/10 text-rose border-rose/40",
  no: "bg-white/5 text-mute border-line",
};

export function VerdictBadge({ verdict, big = false }: { verdict: Verdict; big?: boolean }) {
  return (
    <span className={`inline-flex items-center rounded-full border font-semibold ${TONE[verdict.tone]} ${big ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs"}`}>
      {verdict.label}
    </span>
  );
}

export function tps(n: number) {
  if (!n) return "—";
  if (n >= 100) return `${n.toFixed(0)} tok/s`;
  if (n >= 1) return `${n.toFixed(1)} tok/s`;
  return `${(1 / n).toFixed(1)} s/token`;
}

export const gb = (n: number) => (n >= 100 ? `${n.toFixed(0)} GB` : `${n.toFixed(1)} GB`);

export function ErrorNote({ error }: { error?: string }) {
  if (!error) return null;
  return <div className="rounded-lg border border-rose/40 bg-rose/10 px-3 py-2 text-sm text-rose">{error}</div>;
}

export function PageHead({ title, sub, children }: { title: string; sub?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {sub && <p className="mt-1 max-w-2xl text-mute">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

// Stacked bar: where the model's bytes land across memory tiers.
export function PlacementBar({ placed, caps }: { placed: { fast: number; slow: number; ssd: number }; caps: { fast: number; slow: number } }) {
  const total = Math.max(placed.fast + placed.slow + placed.ssd, caps.fast + caps.slow, 0.001);
  const seg = (v: number) => `${(v / total) * 100}%`;
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-white/5">
        <div className="bg-acid" style={{ width: seg(placed.fast) }} title="fast memory" />
        <div className="bg-sky" style={{ width: seg(placed.slow) }} title="system RAM" />
        <div className="bg-rose" style={{ width: seg(placed.ssd) }} title="SSD" />
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-mute num">
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-acid" />fast {gb(placed.fast)} / {gb(caps.fast)}</span>
        {caps.slow > 0 && <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-sky" />RAM {gb(placed.slow)} / {gb(caps.slow)}</span>}
        {placed.ssd > 0 && <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-rose" />SSD {gb(placed.ssd)}</span>}
      </div>
    </div>
  );
}
