import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <section className="w-full max-w-md rounded-md border border-stone-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">Cleaning Duty</h1>
        <p className="mt-2 text-sm text-stone-600">
          Увійди через email, щоб побачити своє чергування або адмінку.
        </p>
        <div className="mt-6">
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
