import Link from "next/link";
import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { LogoutButton } from "@/components/layout/logout-button";
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
  const setupAllowed = loggedIn || currentUser?.role === "admin";
  const hasShell = Boolean(currentUser || loggedIn);

  const content = (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Setup</h1>
          <p className="mt-1 text-stone-600">
            System configuration hook for local SQLite and Supabase modes.
          </p>
        </div>
        {!hasShell ? (
          <Link className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-stone-100" href="/login">
            Login
          </Link>
        ) : null}
      </div>

      {!setupAllowed ? (
        <section className="max-w-md rounded-md border border-stone-200 bg-white p-6">
          <SetupLoginForm />
        </section>
      ) : (
        <SetupForm config={config} />
      )}
    </>
  );

  if (currentUser) {
    return <AppShell user={currentUser}>{content}</AppShell>;
  }

  if (loggedIn) {
    return <SetupOnlyShell>{content}</SetupOnlyShell>;
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      {content}
    </main>
  );
}

function SetupOnlyShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <Link href="/setup" className="text-lg font-bold text-stone-950">
            Cleaning Duty
          </Link>
          <nav className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-md bg-stone-100 px-3 py-2 font-semibold text-stone-800">
              Setup
            </span>
            <span className="rounded-md bg-stone-100 px-3 py-2 text-stone-700">
              {setupAdminProfile.full_name}
            </span>
            <LogoutButton />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
