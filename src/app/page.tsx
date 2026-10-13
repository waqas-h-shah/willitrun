import Link from "next/link";
import { VerdictBadge, tps } from "@/components/ui";
import { currentUser } from "@/lib/auth";
import { RIG_PRESETS, modelById, quantById } from "@/lib/catalog";
import { estimate } from "@/lib/engine";
import { guest } from "./actions";

const SHOWCASE = [
  { model: "qwen3-30b-a3b", rig: "mba-m4-16", hook: "A 30B model on the cheapest MacBook" },
  { model: "glm-4.5-air", rig: "mbp-m4pro-48", hook: "A 106B coder on a 48 GB laptop" },
  { model: "deepseek-v3.1", rig: "mbp-m4max-128", hook: "671B parameters, one laptop" },
];

const LAB = [
  ["601B", "Kimi-K3 (REAP-80) running exact on a 128 GB MacBook, a model that normally needs a 512 GB machine. ~16.8 s/token, down from ~240 s."],
  ["~80%", "of Qwen3-30B's experts get reused within 8 tokens. Routing has strong temporal locality, so an expert cache works."],
  ["+73%", "tok/s on GLM-4.5-Air at a 21 GB budget (6.6 → 11.5) with quality-gated routing bias toward cached experts."],
  ["2×", "over CPU offload for Qwen3-Next-80B on an NVIDIA L40S with byte-identical output, in Strata Server's CUDA paging path."],
];

export default async function Home() {
  const user = await currentUser();
  return (
    <div className="space-y-16">
      <section className="relative overflow-hidden rounded-3xl border border-line px-6 py-14 sm:px-12">
        <div className="grid-bg pointer-events-none absolute inset-0" />
        <div className="relative max-w-3xl">
          <p className="num text-sm text-acid">$ will-it-run --on my-laptop</p>
          <h1 className="mt-3 text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
            Will it run<span className="text-acid">?</span>
          </h1>
          <p className="mt-5 text-lg text-mute">
            Every new open-weight model drop starts the same argument: <i>"can my machine run it?"</i> This answers it with
            bandwidth math instead of vibes. Describe your rig and see which models fit, at what quant, and how many tokens per second.
            You also see what <b className="text-text">expert paging</b> unlocks for the MoE giants that "need a server".
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/check" className="btn">Check a model now</Link>
            {user ? (
              <Link href="/rigs" className="btn btn-ghost">My rigs →</Link>
            ) : (
              <>
                <form action={guest}><button className="btn btn-ghost">Try it as a guest →</button></form>
                <Link href="/signup" className="btn btn-ghost">Sign up to save rigs</Link>
              </>
            )}
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-xl font-semibold">Things that "shouldn't" run</h2>
        <p className="mb-5 text-sm text-mute">Live estimates from the same engine the checker uses. Stock runtime vs. Strata expert paging.</p>
        <div className="grid gap-4 md:grid-cols-3">
          {SHOWCASE.map((s) => {
            const model = modelById(s.model)!;
            const rig = RIG_PRESETS.find((r) => r.id === s.rig)!;
            const e = estimate(model, quantById("Q4_K_M")!, rig, 8192);
            const x = e.modes.strataBias.tps / Math.max(e.modes.stock.tps, 0.0001);
            return (
              <Link key={s.model} href={`/check?rig=preset:${s.rig}&model=${s.model}&quant=Q4_K_M`} className="card group p-5 transition hover:border-acid/50">
                <p className="text-sm text-mute">{s.hook}</p>
                <h3 className="mt-1 font-semibold">{model.name} <span className="text-mute">on</span> {rig.name}</h3>
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between"><span className="text-mute">Stock</span><span className="flex items-center gap-2"><span className="num">{tps(e.modes.stock.tps)}</span><VerdictBadge verdict={e.modes.stock.verdict} /></span></div>
                  <div className="flex items-center justify-between"><span className="text-acid">Strata paging</span><span className="flex items-center gap-2"><span className="num">{tps(e.modes.strataBias.tps)}</span><VerdictBadge verdict={e.modes.strataBias.verdict} /></span></div>
                </div>
                <p className="num mt-4 text-2xl font-bold text-acid">{x.toFixed(0)}× <span className="text-sm font-normal text-mute">faster · see the math →</span></p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="grid gap-10 md:grid-cols-[1.1fr_1fr]">
        <div>
          <h2 className="text-xl font-semibold">Why I built this</h2>
          <div className="mt-3 space-y-3 text-mute">
            <p>
              I'm Waqas, an AI engineer. Every time an open-weight model drops, the same question floods every forum and team chat: can my machine
              run it? The honest answer is bandwidth math that nobody wants to do by hand, so I built the calculator I kept wishing existed.
            </p>
            <p>
              The interesting part is mixture-of-experts. MoE models fire only a few experts per token, yet stock runtimes insist the <i>whole</i> model
              sits in memory. <a href="https://strata.amperor.ai" className="text-acid underline">Strata</a>, the open expert-paging runtime I've been contributing to, keeps the hot experts in memory, streams the cold ones from SSD, and nudges routing toward experts that are already resident.
              Its routing traces show strong locality across MoE architectures, and those measurements calibrate the paging estimates here.
            </p>
            <p>
              Every model says which numbers are measured and which are estimated. If you've actually run a model, log your speed and keep the estimator honest.
            </p>
          </div>
        </div>
        <div className="grid gap-3">
          {LAB.map(([big, text]) => (
            <div key={big} className="card flex gap-4 p-4">
              <div className="num w-20 shrink-0 text-2xl font-bold text-acid">{big}</div>
              <p className="text-sm text-mute">{text}</p>
            </div>
          ))}
          <p className="text-xs text-mute">From the Strata research log (M5 Max 128 GB, rented L40S/A100/H100).</p>
        </div>
      </section>

      <section className="card grid gap-6 p-6 md:grid-cols-4">
        {[
          ["1 · Add your rig", "Pick a preset or punch in memory, bandwidth and SSD speed."],
          ["2 · Check any model", "Footprint, placement across memory tiers, tok/s in three runtime modes, and the best quant for your target."],
          ["3 · See your menu", "Every model ranked for your rig: what runs, what Strata unlocks, what's out of reach."],
          ["4 · Log real runs", "Measured vs. predicted, in public. The estimator's bias per runtime is right there on the board."],
        ].map(([t, d]) => (
          <div key={t}><h3 className="font-semibold">{t}</h3><p className="mt-1 text-sm text-mute">{d}</p></div>
        ))}
      </section>
    </div>
  );
}
