import { LoginForm } from "@/components/login-form";
import { publicRuntimeConfig } from "@/lib/config/runtime";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const config = publicRuntimeConfig();

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <section className="w-full max-w-md rounded-md border border-stone-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">Cleaning Duty</h1>
        <p className="mt-2 text-sm text-stone-600">
          Увійди через email і пароль, або через setup login, щоб побачити своє чергування, адмінку чи налаштування.
        </p>
        <p className="mt-3 rounded-md bg-stone-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-stone-700">
          Backend: {config.backendMode}
        </p>
        <div className="mt-6">
          <LoginForm
            backendMode={config.backendMode}
            supabasePublishableKey={config.supabasePublishableKey}
            supabaseUrl={config.supabaseUrl}
          />
        </div>
      </section>
    </main>
  );
}
