import { ErrorNote, PageHead } from "@/components/ui";
import { RigForm } from "@/components/RigForm";
import { requireUser } from "@/lib/auth";
import { createRig } from "../../actions";

export default async function NewRig({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireUser("/rigs/new");
  const { error } = await searchParams;
  return (
    <div className="mx-auto max-w-2xl">
      <PageHead title="Add a rig" sub="Describe the machine you have (or the one you're eyeing). Bandwidth matters more than FLOPs for local decoding." />
      <div className="mb-4"><ErrorNote error={error} /></div>
      <RigForm action={createRig} submitLabel="Save rig" />
    </div>
  );
}
