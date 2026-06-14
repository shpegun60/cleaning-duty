import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { SetupForm } from "@/components/setup/setup-form";
import { SetupLoginForm } from "@/components/setup/setup-login-form";
import { getCurrentUserProfile } from "@/lib/auth/guards";
import { setupRuntimeConfig } from "@/lib/config/runtime";
import { hasLocalAdminSession } from "@/lib/local/auth";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

const setupAdminProfile: Profile = {
  id: "local-admin",
  email: "admin@local",
  full_name: "Local Admin",
  role: "admin",
  rotation_order: null,
  is_active: true,
};

export default async function SetupPage() {
  const config = setupRuntimeConfig();
  const loggedIn = await hasLocalAdminSession();
  const currentUser = await getCurrentUserProfile().catch(() => null);
  const shellUser = currentUser ?? (loggedIn ? setupAdminProfile : null);

  const content = (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Local setup admin</h1>
          <p className="mt-1 text-stone-600">
            System configuration hook for local SQLite and Supabase modes.
          </p>
        </div>
        {!shellUser ? (
          <Link className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-stone-100" href="/login">
            Login
          </Link>
        ) : null}
      </div>

      {!loggedIn ? (
        <section className="max-w-md rounded-md border border-stone-200 bg-white p-6">
          <SetupLoginForm />
        </section>
      ) : (
        <SetupForm config={config} />
      )}
    </>
  );

  if (shellUser) {
    return <AppShell user={shellUser}>{content}</AppShell>;
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      {content}
    </main>
  );
}
