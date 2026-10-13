import Link from "next/link";
import { ErrorNote } from "@/components/ui";
import { guest, signup } from "../actions";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next = "/rigs/new" } = await searchParams;
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-1 text-2xl font-bold">Make an account</h1>
      <p className="mb-6 text-mute">Save your rigs, log real benchmark runs, and keep a wishlist of models to chase.</p>
      <form action={signup} className="card space-y-4 p-5">
        <ErrorNote error={error} />
        <input type="hidden" name="next" value={next} />
        <div><label className="label">Name</label><input className="input" name="name" required autoComplete="nickname" /></div>
        <div><label className="label">Email</label><input className="input" name="email" type="email" required autoComplete="email" /></div>
        <div><label className="label">Password</label><input className="input" name="password" type="password" required minLength={8} autoComplete="new-password" /></div>
        <button className="btn w-full justify-center">Create account</button>
      </form>
      <form action={guest} className="mt-4">
        <button className="btn btn-ghost w-full justify-center">Skip it: continue as a guest →</button>
      </form>
      <p className="mt-4 text-center text-sm text-mute">Have an account? <Link className="text-acid" href={`/login?next=${encodeURIComponent(next)}`}>Log in</Link></p>
    </div>
  );
}
