"use client";

import { FormEvent, ReactNode, useState } from "react";
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
  supabaseSecretKey: string;
  resendApiKey: string;
  cronSecret: string;
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

export function SetupForm({ config }: { config: PublicConfig }) {
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
      <section className="rounded-md border border-stone-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Deployment settings</h2>
            <p className="mt-1 max-w-3xl text-sm text-stone-600">
              Заповнюй зверху вниз. У Docker/local ці значення зберігаються через цей екран.
              На Vercel ті самі назви треба внести в Project Settings / Environment Variables,
              бо env змінні платформи мають пріоритет.
            </p>
          </div>
          <StatusPill ok={config.backendMode === "supabase"}>
            Backend: {config.backendMode}
          </StatusPill>
        </div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatusCard label="Supabase URL" ok={Boolean(config.supabaseUrl)} />
          <StatusCard label="Supabase publishable key" ok={Boolean(config.supabasePublishableKey)} />
          <StatusCard label="Supabase secret key" ok={config.hasSupabaseSecretKey} />
          <StatusCard label="Resend API key" ok={config.hasResendApiKey} />
          <StatusCard label="Cron secret" ok={config.hasCronSecret} />
          <StatusCard label="App URL" ok={Boolean(config.appUrl)} value={config.appUrl} />
          <StatusCard label="Timezone" ok={Boolean(config.appTimezone)} value={config.appTimezone} />
          <StatusCard label="Email sender" ok={Boolean(config.emailFrom)} value={config.emailFrom} />
        </dl>
      </section>

      <form onSubmit={onSubmit} className="grid gap-6">
        <section className="rounded-md border border-stone-200 bg-white p-4">
          <SectionHeader
            step="1"
            title="Backend mode"
            description="Для Vercel/Supabase production вибирай Supabase. Local SQLite лишай для локального або Docker/VPS режиму."
          />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="rounded-md border border-stone-200 p-3 text-sm font-medium">
              <input
                className="mr-2"
                name="backendMode"
                type="radio"
                value="local"
                defaultChecked={config.backendMode === "local"}
              />
              Local SQLite
              <span className="mt-1 block text-xs font-normal text-stone-600">
                Дані у `data/`; потрібен persistent disk.
              </span>
            </label>
            <label className="rounded-md border border-stone-200 p-3 text-sm font-medium">
              <input
                className="mr-2"
                name="backendMode"
                type="radio"
                value="supabase"
                defaultChecked={config.backendMode === "supabase"}
              />
              Supabase
              <span className="mt-1 block text-xs font-normal text-stone-600">
                База, auth і файли у Supabase; підходить для Vercel.
              </span>
            </label>
          </div>
        </section>

        <section className="rounded-md border border-stone-200 bg-white p-4">
          <SectionHeader
            step="2"
            title="App URL and timezone"
            description="APP_URL використовується в email-посиланнях. Для Vercel бери production URL або custom domain."
          />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <TextField
              label="APP_URL"
              name="appUrl"
              defaultValue={config.appUrl}
              placeholder="https://your-app.vercel.app"
              hint="Vercel -> Project -> Domains або production deployment URL."
            />
            <TextField
              label="APP_TIMEZONE"
              name="appTimezone"
              defaultValue={config.appTimezone}
              placeholder="Europe/Warsaw"
              hint="Для України/Польщі зараз лишай Europe/Warsaw, якщо графік має жити в цій зоні."
            />
          </div>
        </section>

        <section className="rounded-md border border-stone-200 bg-white p-4">
          <SectionHeader
            step="3"
            title="Supabase"
            description="Ці три значення беруться в Supabase Dashboard -> Project Settings -> API."
          />
          <div className="mt-4 grid gap-3">
            <TextField
              label="NEXT_PUBLIC_SUPABASE_URL"
              name="supabaseUrl"
              defaultValue={config.supabaseUrl}
              placeholder="https://your-project.supabase.co"
              hint="Supabase Project URL."
            />
            <TextField
              label="NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
              name="supabasePublishableKey"
              defaultValue={config.supabasePublishableKey}
              placeholder="publishable / anon key"
              hint="Публічний ключ для browser login."
            />
            <SecretField
              label="SUPABASE_SECRET_KEY"
              name="supabaseSecretKey"
              configured={config.hasSupabaseSecretKey}
              secretValue={config.supabaseSecretKey}
              placeholder="service role / secret key"
              hint="Секретний server-side ключ. Не публікуй його в frontend і не показуй користувачам."
            />
          </div>
        </section>

        <section className="rounded-md border border-stone-200 bg-white p-4">
          <SectionHeader
            step="4"
            title="Email / Resend"
            description="Ці значення потрібні, щоб запрошення, заміни, reject і нагадування реально приходили на email."
          />
          <div className="mt-4 grid gap-3">
            <SecretField
              label="RESEND_API_KEY"
              name="resendApiKey"
              configured={config.hasResendApiKey}
              secretValue={config.resendApiKey}
              placeholder="re_..."
              hint="Resend Dashboard -> API Keys -> Create API key."
            />
            <TextField
              label="EMAIL_FROM"
              name="emailFrom"
              defaultValue={config.emailFrom}
              placeholder="Cleaning Duty <noreply@your-domain.com>"
              hint="Resend Dashboard -> Domains: домен має бути verified."
            />
          </div>
        </section>

        <section className="rounded-md border border-stone-200 bg-white p-4">
          <SectionHeader
            step="5"
            title="Cron"
            description="Cron викликає scheduler і запускає автоматичні нагадування. Secret придумуєш сам."
          />
          <div className="mt-4 grid gap-3">
            <SecretField
              label="CRON_SECRET"
              name="cronSecret"
              configured={config.hasCronSecret}
              secretValue={config.cronSecret}
              placeholder="long random string"
              hint="Те саме значення має бути у Vercel env. Route: /api/cron/scheduler."
            />
          </div>
        </section>

        <section className="rounded-md border border-stone-200 bg-white p-4">
          <SectionHeader
            step="6"
            title="Setup access"
            description="Це локальний доступ до /setup. У production не лишай admin/admin."
          />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <TextField
              label="SETUP_USERNAME"
              name="setupUsername"
              defaultValue={config.setupUsername}
              placeholder="admin"
              hint="Логін для /setup."
            />
            <SecretField
              label="SETUP_PASSWORD"
              name="setupPassword"
              configured
              placeholder="leave blank to keep current password"
              hint="Заповни тільки якщо хочеш змінити пароль."
            />
          </div>
        </section>

        <section className="rounded-md border border-stone-200 bg-white p-4">
          <h2 className="text-lg font-semibold">Runtime state</h2>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-stone-500">Config file</dt>
              <dd className="break-all font-mono text-xs">{config.configPath}</dd>
            </div>
            <div>
              <dt className="text-stone-500">Data dir</dt>
              <dd className="break-all font-mono text-xs">{config.dataDir}</dd>
            </div>
          </dl>
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

function SectionHeader({
  step,
  title,
  description,
}: {
  step: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-700 text-sm font-bold text-white">
        {step}
      </span>
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-stone-600">{description}</p>
      </div>
    </div>
  );
}

function TextField({
  label,
  name,
  defaultValue,
  placeholder,
  hint,
}: {
  label: string;
  name: string;
  defaultValue: string;
  placeholder: string;
  hint: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <input
        className="h-10 rounded-md border border-stone-300 px-3 font-mono text-sm"
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
      />
      <span className="text-xs font-normal leading-tight text-stone-600">{hint}</span>
    </label>
  );
}

function SecretField({
  label,
  name,
  configured,
  secretValue,
  placeholder,
  hint,
}: {
  label: string;
  name: string;
  configured: boolean;
  secretValue?: string;
  placeholder: string;
  hint: string;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const hasValue = Boolean(secretValue);

  return (
    <label className="grid gap-2 text-sm font-medium">
      <span className="flex flex-wrap items-center gap-2">
        {label}
        <StatusPill ok={configured}>{configured ? "configured" : "missing"}</StatusPill>
      </span>
      <span className="flex min-w-0 overflow-hidden rounded-md border border-stone-300 bg-white focus-within:border-emerald-700">
        <input
          autoComplete="off"
          className="h-10 min-w-0 flex-1 border-0 px-3 font-mono text-sm outline-none"
          name={name}
          defaultValue={secretValue ?? ""}
          placeholder={configured ? "configured; leave blank to keep" : placeholder}
          type={isVisible ? "text" : "password"}
        />
        <button
          aria-label={isVisible ? "Сховати секрет" : "Показати секрет"}
          className="flex h-10 w-11 shrink-0 items-center justify-center border-l border-stone-300 text-stone-600 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!hasValue}
          onClick={() => setIsVisible((value) => !value)}
          type="button"
        >
          {isVisible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </span>
      <span className="text-xs font-normal leading-tight text-stone-600">{hint}</span>
    </label>
  );
}

function EyeIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path
        d="m4 4 16 16"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <path
        d="M10.6 6.2A10.7 10.7 0 0 1 12 6c6.1 0 9.5 6 9.5 6a17.6 17.6 0 0 1-3.1 3.7M14.1 14.1A3 3 0 0 1 9.9 9.9M6.7 7.4A17.2 17.2 0 0 0 2.5 12s3.4 6 9.5 6c1.3 0 2.5-.3 3.6-.7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function StatusCard({
  label,
  ok,
  value,
}: {
  label: string;
  ok: boolean;
  value?: string;
}) {
  return (
    <div className="min-w-0 rounded-md border border-stone-200 bg-stone-50 p-3">
      <dt className="text-xs font-semibold uppercase text-stone-500 [overflow-wrap:anywhere]">
        {label}
      </dt>
      <dd className="mt-1">
        <StatusPill ok={ok}>{ok ? "configured" : "missing"}</StatusPill>
      </dd>
      {value ? (
        <dd className="mt-2 truncate text-xs text-stone-600" title={value}>
          {value}
        </dd>
      ) : null}
    </div>
  );
}

function StatusPill({
  ok,
  children,
}: {
  ok: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex max-w-full items-center rounded-md px-2 py-1 text-xs font-semibold leading-tight ${
        ok ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
      }`}
    >
      {children}
    </span>
  );
}
