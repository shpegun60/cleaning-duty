import { RotationForm } from "@/components/admin/admin-forms";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminRotationPage() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("is_active", true)
    .order("rotation_order", { ascending: true, nullsFirst: false });

  if (error) {
    throw error;
  }

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold">Порядок чергування</h1>
        <p className="mt-1 text-stone-600">MVP використовує прості numeric rotation_order inputs.</p>
      </div>
      <RotationForm profiles={(data ?? []) as Profile[]} />
    </div>
  );
}
