import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";

import { readRuntimeConfig } from "@/lib/config/runtime";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const body = LoginSchema.safeParse(await request.json().catch(() => null));

  if (!body.success) {
    return NextResponse.json({ error: "Invalid login payload" }, { status: 400 });
  }

  const config = readRuntimeConfig();

  if (!config.supabaseUrl || !config.supabasePublishableKey) {
    return NextResponse.json(
      { error: "Supabase public configuration is missing" },
      { status: 500 },
    );
  }

  const response = NextResponse.json({ ok: true });
  const supabase = createServerClient(
    config.supabaseUrl,
    config.supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const { data, error } = await supabase.auth.signInWithPassword({
    email: body.data.email,
    password: body.data.password,
  });

  if (error || !data.user) {
    return NextResponse.json(
      { error: error?.message ?? "Login failed" },
      { status: 401 },
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,email,full_name,role,rotation_order,is_active")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json(
      { error: `Profile check failed: ${profileError.message}` },
      { status: 403 },
    );
  }

  if (!profile) {
    return NextResponse.json(
      {
        error:
          "Login succeeded, but this Supabase user has no matching public.profiles row.",
      },
      { status: 403 },
    );
  }

  if (!profile.is_active) {
    return NextResponse.json(
      { error: "This user profile is inactive" },
      { status: 403 },
    );
  }

  return response;
}
