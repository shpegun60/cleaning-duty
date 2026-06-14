"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import type { Profile } from "@/lib/types";

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

export function ProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const form = new FormData(event.currentTarget);

    try {
      await postJson("/api/profile", {
        email: String(form.get("email") ?? ""),
        fullName: String(form.get("fullName") ?? ""),
        password: String(form.get("password") ?? ""),
      });
      setMessage("Збережено");
      router.refresh();
      setTimeout(() => router.refresh(), 100);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Помилка");
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid max-w-2xl gap-4 rounded-md border border-stone-200 bg-white p-4">
      <div className="grid gap-1">
        <h2 className="text-lg font-semibold">Дані акаунту</h2>
        <p className="text-sm text-stone-600">
          Email використовується як логін. Новий пароль має мати щонайменше 8 символів.
        </p>
      </div>

      <label className="grid gap-1 text-sm">
        Email
        <input
          autoComplete="email"
          className="h-10 rounded-md border px-3"
          defaultValue={profile.email}
          name="email"
          required
          type="email"
        />
      </label>

      <label className="grid gap-1 text-sm">
        Ім&apos;я
        <input
          autoComplete="name"
          className="h-10 rounded-md border px-3"
          defaultValue={profile.full_name}
          name="fullName"
          required
        />
      </label>

      <label className="grid gap-1 text-sm">
        Новий пароль
        <input
          autoComplete="new-password"
          className="h-10 rounded-md border px-3 font-mono text-sm"
          name="password"
          placeholder="залиш пустим, щоб не міняти"
          type="password"
        />
      </label>

      <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700">
        Роль: <span className="font-semibold">{profile.role}</span>
        {profile.role === "worker" ? (
          <>
            {" "}
            · Rotation: <span className="font-semibold">{profile.rotation_order ?? "немає"}</span>
          </>
        ) : null}
      </div>

      <Button type="submit" className="w-full">Зберегти профіль</Button>
      {message ? <p className="text-sm text-stone-700">{message}</p> : null}
    </form>
  );
}
