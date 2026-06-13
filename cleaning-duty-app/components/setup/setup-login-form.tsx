"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function SetupLoginForm() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setIsSubmitting(true);
    setMessage(null);

    try {
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

      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Помилка");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <label className="grid gap-2 text-sm font-medium">
        Setup login
        <input
          className="h-11 rounded-md border border-stone-300 bg-white px-3 outline-none focus:border-emerald-700"
          name="username"
          defaultValue="admin"
          required
        />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Setup password
        <input
          className="h-11 rounded-md border border-stone-300 bg-white px-3 outline-none focus:border-emerald-700"
          name="password"
          type="password"
          defaultValue="admin"
          required
        />
      </label>
      <Button disabled={isSubmitting} type="submit">
        {isSubmitting ? "Вхід..." : "Увійти в setup"}
      </Button>
      {message ? <p className="text-sm text-red-700">{message}</p> : null}
    </form>
  );
}
