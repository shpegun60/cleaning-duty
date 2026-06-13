import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { readRuntimeConfig } from "@/lib/config/runtime";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const config = readRuntimeConfig();

  if (!config.supabaseUrl || !config.supabasePublishableKey) {
    throw new Error("Missing Supabase public configuration");
  }

  return createServerClient(config.supabaseUrl, config.supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot always write cookies. Route Handlers and
          // Proxy still can, which is enough for session refresh.
        }
      },
    },
  });
}
