"use client";

import { FormEvent, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      setMessage(error ? error.message : "Перевір email і відкрий magic link.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Помилка конфігурації");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
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
      <Button disabled={isSubmitting} type="submit">
        {isSubmitting ? "Надсилання..." : "Увійти через email"}
      </Button>
      {message ? <p className="text-sm text-stone-700">{message}</p> : null}
    </form>
  );
}
