import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { forbidden, unauthorized } from "@/lib/http";
import { isLocalBackend, loadProfile } from "@/lib/data/store";
import { getLocalSessionUserId } from "@/lib/local/auth";

export async function getCurrentUserProfile(): Promise<Profile | null> {
  if (isLocalBackend()) {
    const userId = await getLocalSessionUserId();

    if (!userId) {
      return null;
    }

    try {
      const profile = await loadProfile(userId);
      return profile.is_active ? profile : null;
    } catch {
      return null;
    }
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,email,full_name,role,rotation_order,is_active")
    .eq("id", data.user.id)
    .single();

  if (profileError || !profile || !profile.is_active) {
    return null;
  }

  return profile as Profile;
}

export async function requireUser() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    throw unauthorized();
  }

  return profile;
}

export async function requireAdmin() {
  const profile = await requireUser();

  if (profile.role !== "admin") {
    throw forbidden();
  }

  return profile;
}
