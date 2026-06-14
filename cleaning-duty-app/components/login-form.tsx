"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

import { Button } from "@/components/ui/button";

export function LoginForm({
  backendMode,
  supabaseUrl,
  supabasePublishableKey,
}: {
  backendMode: "local" | "supabase";
  supabaseUrl: string;
  supabasePublishableKey: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    const form = new FormData(event.currentTarget);

    try {
      if (backendMode === "local") {
        const response = await fetch("/api/local-auth/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            username: String(form.get("username") ?? ""),
            password: String(form.get("password") ?? ""),
          }),
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload.error ?? "Login failed");
        }

        router.push("/dashboard");
        router.refresh();
        return;
      }

      if (!supabaseUrl || !supabasePublishableKey) {
        throw new Error("Supabase mode selected, but public Supabase config is missing");
      }

      const email = String(form.get("email") ?? "");
      const password = String(form.get("password") ?? "");
      const supabase = createBrowserClient(supabaseUrl, supabasePublishableKey);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Помилка конфігурації");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      {backendMode === "local" ? (
        <>
          <label className="grid gap-2 text-sm font-medium">
            Email або setup login
            <input
              className="h-11 rounded-md border border-stone-300 bg-white px-3 outline-none focus:border-emerald-700"
              name="username"
              defaultValue="admin"
              required
              autoComplete="username"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Password
            <input
              className="h-11 rounded-md border border-stone-300 bg-white px-3 outline-none focus:border-emerald-700"
              name="password"
              type="password"
              defaultValue="admin"
              required
              autoComplete="current-password"
            />
          </label>
        </>
      ) : (
        <>
          <label className="grid gap-2 text-sm font-medium">
            Email
            <input
              className="h-11 rounded-md border border-stone-300 bg-white px-3 outline-none focus:border-emerald-700"
              name="email"
              type="email"
              required
              autoComplete="email"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Password
            <input
              className="h-11 rounded-md border border-stone-300 bg-white px-3 outline-none focus:border-emerald-700"
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </label>
        </>
      )}
      <Button disabled={isSubmitting} type="submit">
        {isSubmitting
          ? "Вхід..."
          : backendMode === "local"
            ? "Увійти локально"
            : "Увійти"}
      </Button>
      {message ? <p className="text-sm text-stone-700">{message}</p> : null}
    </form>
  );
}
