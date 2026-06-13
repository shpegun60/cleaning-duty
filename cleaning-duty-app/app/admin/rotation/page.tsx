import { RotationForm } from "@/components/admin/admin-forms";
import { listProfiles } from "@/lib/data/store";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminRotationPage() {
  const profiles = (await listProfiles()).filter((profile) => profile.is_active);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold">Порядок чергування</h1>
        <p className="mt-1 text-stone-600">MVP використовує прості numeric rotation_order inputs.</p>
      </div>
      <RotationForm profiles={profiles as Profile[]} />
    </div>
  );
}
