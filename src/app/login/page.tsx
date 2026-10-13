import Link from "next/link";
import { ErrorNote } from "@/components/ui";
import { guest, login } from "../actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next = "/rigs" } = await searchParams;
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-1 text-2xl font-bold">Welcome back</h1>
      <p className="mb-6 text-mute">Your rigs are waiting.</p>
      <form action={login} className="card space-y-4 p-5">
        <ErrorNote error={error} />
        <input type="hidden" name="next" value={next} />
        <div><label className="label">Email</label><input className="input" name="email" type="email" required autoComplete="email" /></div>
        <div><label className="label">Password</label><input className="input" name="password" type="password" required autoComplete="current-password" /></div>
        <button className="btn w-full justify-center">Log in</button>
      </form>
      <form action={guest} className="mt-4">
        <button className="btn btn-ghost w-full justify-center">Just exploring? Continue as a guest →</button>
      </form>
      <p className="mt-4 text-center text-sm text-mute">No account? <Link className="text-acid" href={`/signup?next=${encodeURIComponent(next)}`}>Sign up</Link></p>
    </div>
  );
}
