"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

type PublicConfig = {
  backendMode: "local" | "supabase";
  setupUsername: string;
  appUrl: string;
  appTimezone: string;
  emailFrom: string;
  supabaseUrl: string;
  supabasePublishableKey: string;
  hasSupabaseSecretKey: boolean;
  hasResendApiKey: boolean;
  hasCronSecret: boolean;
  configPath: string;
  dataDir: string;
};

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed");
  }

  return payload;
}

export function SetupForm({
  config,
}: {
  config: PublicConfig;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setIsSubmitting(true);
    setMessage(null);

    try {
      await postJson("/api/setup/config", {
        backendMode: String(form.get("backendMode")),
        setupUsername: String(form.get("setupUsername") ?? ""),
        setupPassword: String(form.get("setupPassword") ?? ""),
        appUrl: String(form.get("appUrl") ?? ""),
        appTimezone: String(form.get("appTimezone") ?? ""),
        emailFrom: String(form.get("emailFrom") ?? ""),
        supabaseUrl: String(form.get("supabaseUrl") ?? ""),
        supabasePublishableKey: String(form.get("supabasePublishableKey") ?? ""),
        supabaseSecretKey: String(form.get("supabaseSecretKey") ?? ""),
        resendApiKey: String(form.get("resendApiKey") ?? ""),
        cronSecret: String(form.get("cronSecret") ?? ""),
      });
      setMessage("Налаштування збережено");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Помилка");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function logout() {
    await postJson("/api/auth/logout", {});
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="grid gap-6">
      <div className="rounded-md border border-stone-200 bg-white p-4">
        <h2 className="text-lg font-semibold">Runtime state</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-stone-500">Config</dt>
            <dd className="break-all font-mono">{config.configPath}</dd>
          </div>
          <div>
            <dt className="text-stone-500">Data dir</dt>
            <dd className="break-all font-mono">{config.dataDir}</dd>
          </div>
          <div>
            <dt className="text-stone-500">Supabase secret</dt>
            <dd>{config.hasSupabaseSecretKey ? "configured" : "missing"}</dd>
          </div>
          <div>
            <dt className="text-stone-500">Resend key</dt>
            <dd>{config.hasResendApiKey ? "configured" : "missing"}</dd>
          </div>
        </dl>
      </div>

      <form onSubmit={onSubmit} className="grid gap-6">
        <section className="rounded-md border border-stone-200 bg-white p-4">
          <h2 className="text-lg font-semibold">Backend mode</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="rounded-md border border-stone-200 p-3">
              <input
                className="mr-2"
                name="backendMode"
                type="radio"
                value="local"
                defaultChecked={config.backendMode === "local"}
              />
              Local SQLite
            </label>
            <label className="rounded-md border border-stone-200 p-3">
              <input
                className="mr-2"
                name="backendMode"
                type="radio"
                value="supabase"
                defaultChecked={config.backendMode === "supabase"}
              />
              Supabase
            </label>
          </div>
        </section>

        <section className="rounded-md border border-stone-200 bg-white p-4">
          <h2 className="text-lg font-semibold">Setup admin</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium">
              Username
              <input className="h-10 rounded-md border px-3" name="setupUsername" defaultValue={config.setupUsername} />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              New password
              <input className="h-10 rounded-md border px-3" name="setupPassword" placeholder="leave blank to keep" type="password" />
            </label>
          </div>
        </section>

        <section className="rounded-md border border-stone-200 bg-white p-4">
          <h2 className="text-lg font-semibold">Supabase and email</h2>
          <div className="mt-4 grid gap-3">
            <input className="h-10 rounded-md border px-3" name="supabaseUrl" placeholder="NEXT_PUBLIC_SUPABASE_URL" defaultValue={config.supabaseUrl} />
            <input className="h-10 rounded-md border px-3" name="supabasePublishableKey" placeholder="NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" defaultValue={config.supabasePublishableKey} />
            <input className="h-10 rounded-md border px-3" name="supabaseSecretKey" placeholder={config.hasSupabaseSecretKey ? "SUPABASE_SECRET_KEY configured; leave blank to keep" : "SUPABASE_SECRET_KEY"} type="password" />
            <input className="h-10 rounded-md border px-3" name="resendApiKey" placeholder={config.hasResendApiKey ? "RESEND_API_KEY configured; leave blank to keep" : "RESEND_API_KEY"} type="password" />
            <input className="h-10 rounded-md border px-3" name="emailFrom" placeholder="EMAIL_FROM" defaultValue={config.emailFrom} />
            <input className="h-10 rounded-md border px-3" name="cronSecret" placeholder={config.hasCronSecret ? "CRON_SECRET configured; leave blank to keep" : "CRON_SECRET"} type="password" />
          </div>
        </section>

        <section className="rounded-md border border-stone-200 bg-white p-4">
          <h2 className="text-lg font-semibold">App settings</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium">
              APP_URL
              <input className="h-10 rounded-md border px-3" name="appUrl" defaultValue={config.appUrl} />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              APP_TIMEZONE
              <input className="h-10 rounded-md border px-3" name="appTimezone" defaultValue={config.appTimezone} />
            </label>
          </div>
        </section>

        <div className="flex flex-wrap gap-3">
          <Button disabled={isSubmitting} type="submit">
            {isSubmitting ? "Збереження..." : "Зберегти налаштування"}
          </Button>
          <Button type="button" variant="secondary" onClick={logout}>
            Вийти з setup
          </Button>
        </div>
        {message ? <p className="text-sm text-stone-700">{message}</p> : null}
      </form>
    </div>
  );
}
