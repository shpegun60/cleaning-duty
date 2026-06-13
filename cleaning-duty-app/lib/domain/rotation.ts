import type { SupabaseClient } from "@supabase/supabase-js";

import type { Profile } from "@/lib/types";

export async function getRotationUsers(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,full_name,role,rotation_order,is_active")
    .eq("role", "worker")
    .eq("is_active", true)
    .not("rotation_order", "is", null)
    .gte("rotation_order", 1)
    .order("rotation_order", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as Profile[];
}

export async function resolveNextAssignee(
  supabase: SupabaseClient,
  currentAssigneeId: string,
) {
  const users = await getRotationUsers(supabase);

  if (users.length < 2) {
    throw new Error("At least two active users are required for rotation");
  }

  const currentIndex = users.findIndex((user) => user.id === currentAssigneeId);

  if (currentIndex < 0) {
    return users[0];
  }

  return users[(currentIndex + 1) % users.length];
}

export function getNextRotationUser(users: Profile[], currentAssigneeId: string) {
  const currentIndex = users.findIndex((user) => user.id === currentAssigneeId);
  return users[currentIndex < 0 ? 0 : (currentIndex + 1) % users.length];
}
