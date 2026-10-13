import { notFound } from "next/navigation";
import { ErrorNote, PageHead } from "@/components/ui";
import { RigForm } from "@/components/RigForm";
import { requireUser } from "@/lib/auth";
import { db, rigSpec, type RigRow } from "@/lib/db";
import { deleteRig, updateRig } from "../../../actions";

export default async function EditRig({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/rigs/${id}/edit`);
  const rig = db.prepare("SELECT * FROM rigs WHERE id = ? AND user_id = ?").get(Number(id), user.id) as RigRow | undefined;
  if (!rig) notFound();
  const { error } = await searchParams;
  return (
    <div className="mx-auto max-w-2xl">
      <PageHead title={`Edit ${rig.name}`} />
      <div className="mb-4"><ErrorNote error={error} /></div>
      <RigForm action={updateRig} initial={{ ...rigSpec(rig), id: rig.id, name: rig.name }} submitLabel="Save changes" />
      <form action={deleteRig} className="mt-6">
        <input type="hidden" name="id" value={rig.id} />
        <button className="btn btn-danger">Delete this rig</button>
      </form>
    </div>
  );
}
