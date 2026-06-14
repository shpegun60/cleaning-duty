import { InviteUserForm, UserEditForm } from "@/components/admin/admin-forms";
import { hasDutySchedule, listProfiles } from "@/lib/data/store";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const [profiles, scheduleLocked] = (await Promise.all([
    listProfiles(),
    hasDutySchedule(),
  ])) as [Profile[], boolean];

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold">Люди</h1>
        <p className="mt-1 text-stone-600">Запрошення, ролі, active flag і rotation order.</p>
      </div>
      <InviteUserForm scheduleLocked={scheduleLocked} />
      <div className="grid gap-3">
        {profiles.map((profile) => (
          <UserEditForm key={profile.id} profile={profile} scheduleLocked={scheduleLocked} />
        ))}
      </div>
    </div>
  );
}
