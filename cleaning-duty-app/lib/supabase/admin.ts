import { createClient } from "@supabase/supabase-js";

import { readRuntimeConfig } from "@/lib/config/runtime";

export function createSupabaseAdminClient() {
  const config = readRuntimeConfig();
  const secretKey = config.supabaseSecretKey;

  if (!config.supabaseUrl) {
    throw new Error("Missing Supabase URL");
  }

  if (!secretKey) {
    throw new Error("Missing Supabase secret key");
  }

  return createClient(config.supabaseUrl, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
