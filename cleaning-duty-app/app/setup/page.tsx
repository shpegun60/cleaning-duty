import Link from "next/link";

import { SetupForm } from "@/components/setup/setup-form";
import { SetupLoginForm } from "@/components/setup/setup-login-form";
import { publicRuntimeConfig } from "@/lib/config/runtime";
import { getLocalAppSettingsDirect } from "@/lib/data/store";
import { hasLocalSession } from "@/lib/local/auth";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const config = publicRuntimeConfig();
  const loggedIn = await hasLocalSession();

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Local setup admin</h1>
          <p className="mt-1 text-stone-600">
            System configuration hook for local SQLite and Supabase modes.
          </p>
        </div>
        <Link className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-stone-100" href="/login">
          Login
        </Link>
      </div>

      {!loggedIn ? (
        <section className="max-w-md rounded-md border border-stone-200 bg-white p-6">
          <SetupLoginForm />
        </section>
      ) : (
        <SetupForm config={config} settings={getLocalAppSettingsDirect()} />
      )}
    </main>
  );
}
