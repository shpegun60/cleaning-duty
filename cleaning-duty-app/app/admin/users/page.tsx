import { InviteUserForm, UserEditForm } from "@/components/admin/admin-forms";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("rotation_order", { ascending: true, nullsFirst: false });

  if (error) {
    throw error;
  }

  const profiles = (data ?? []) as Profile[];

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold">Люди</h1>
        <p className="mt-1 text-stone-600">Запрошення, ролі, active flag і rotation order.</p>
      </div>
      <InviteUserForm />
      <div className="grid gap-3">
        {profiles.map((profile) => (
          <UserEditForm key={profile.id} profile={profile} />
        ))}
      </div>
    </div>
  );
}
