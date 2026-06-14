import { RotationForm } from "@/components/admin/admin-forms";
import { hasDutySchedule, listProfiles } from "@/lib/data/store";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminRotationPage() {
  const [profileList, scheduleLocked] = (await Promise.all([
    listProfiles(),
    hasDutySchedule(),
  ])) as [Profile[], boolean];
  const profiles = profileList.filter(
    (profile) => profile.role === "worker" && profile.is_active,
  );

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold">Порядок чергування</h1>
        <p className="mt-1 text-stone-600">Перетягуй людей або введи номер позиції, потім збережи порядок.</p>
      </div>
      <RotationForm profiles={profiles as Profile[]} scheduleLocked={scheduleLocked} />
    </div>
  );
}
