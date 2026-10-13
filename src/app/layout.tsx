import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { currentUser } from "@/lib/auth";
import { logout } from "./actions";

export const metadata: Metadata = {
  title: "Will It Run? · local LLM rig planner",
  description: "Find out which open-weight LLMs your machine can actually run, how fast, and what expert paging unlocks.",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  return (
    <html lang="en">
      <body className="antialiased">
        <header className="sticky top-0 z-20 border-b border-line bg-ink/85 backdrop-blur">
          <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
            <Link href="/" className="num mr-2 text-[15px] font-bold tracking-tight">
              <span className="text-acid">$</span> will-it-run<span className="cursor" />
            </Link>
            <Link href="/check" className="text-sm text-mute hover:text-text">Check</Link>
            <Link href="/models" className="text-sm text-mute hover:text-text">Models</Link>
            <Link href="/runs" className="text-sm text-mute hover:text-text">Community runs</Link>
            {user && <Link href="/rigs" className="text-sm text-mute hover:text-text">My rigs</Link>}
            <Link href="/how" className="text-sm text-mute hover:text-text">How it works</Link>
            <div className="ml-auto flex items-center gap-3">
              {user ? (
                <>
                  <span className="text-sm text-mute">
                    {user.name}
                    {user.is_guest ? <span className="ml-1 rounded bg-white/5 px-1.5 py-0.5 text-[10px] uppercase">guest</span> : null}
                  </span>
                  <form action={logout}>
                    <button className="btn btn-ghost !px-3 !py-1.5 text-xs">Log out</button>
                  </form>
                </>
              ) : (
                <>
                  <Link href="/login" className="text-sm text-mute hover:text-text">Log in</Link>
                  <Link href="/signup" className="btn !px-3 !py-1.5 text-xs">Sign up</Link>
                </>
              )}
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 pb-10 pt-6 text-xs text-mute">
          Built by Waqas Hussain Shah. The paging model is calibrated on <a className="underline hover:text-text" href="https://strata.amperor.ai">Strata</a> expert-routing research.
          Estimates are bandwidth math, not promises; log a real run to keep them honest.
        </footer>
      </body>
    </html>
  );
}
