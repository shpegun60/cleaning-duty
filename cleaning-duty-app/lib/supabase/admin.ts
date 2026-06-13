import { createClient } from "@supabase/supabase-js";

import { getSupabaseUrl, requireSupabaseServerKey } from "@/lib/env";

export function createSupabaseAdminClient() {
  return createClient(getSupabaseUrl(), requireSupabaseServerKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
