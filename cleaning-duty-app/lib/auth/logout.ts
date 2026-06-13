import { readRuntimeConfig } from "@/lib/config/runtime";
import { clearLocalSession } from "@/lib/local/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function clearAllSessions() {
  await clearLocalSession();

  const config = readRuntimeConfig();
  if (!config.supabaseUrl || !config.supabasePublishableKey) {
    return;
  }

  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  } catch {
    // Logout must still clear the local fallback session if Supabase is misconfigured.
  }
}
