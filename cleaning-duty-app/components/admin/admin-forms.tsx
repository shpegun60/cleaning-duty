"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import type { Profile, Room, Task, DutyPeriod, Notification } from "@/lib/types";

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

function useApiForm() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);

  async function run(callback: () => Promise<void>) {
    setMessage(null);

    try {
      await callback();
      setMessage("Збережено");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Помилка");
    }
  }

  return { message, run };
}

function intOrNull(value: FormDataEntryValue | null) {
  const stringValue = String(value ?? "").trim();
  return stringValue === "" ? null : Number(stringValue);
}

export function InviteUserForm() {
  const { message, run } = useApiForm();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    await run(async () => {
      await postJson("/api/admin/users/invite", {
        email: String(form.get("email") ?? ""),
        fullName: String(form.get("fullName") ?? ""),
        role: String(form.get("role") ?? "worker"),
        rotationOrder: intOrNull(form.get("rotationOrder")),
      });
      event.currentTarget.reset();
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 rounded-md border border-stone-200 bg-white p-4">
      <h2 className="text-base font-semibold">Запросити користувача</h2>
      <input className="h-10 rounded-md border px-3" name="fullName" placeholder="Ім'я" required />
      <input className="h-10 rounded-md border px-3" name="email" placeholder="email@example.com" type="email" required />
      <div className="grid gap-3 sm:grid-cols-2">
        <select className="h-10 rounded-md border px-3" name="role" defaultValue="worker">
          <option value="worker">worker</option>
          <option value="admin">admin</option>
        </select>
        <input className="h-10 rounded-md border px-3" name="rotationOrder" placeholder="Rotation order" type="number" />
      </div>
      <Button type="submit">Запросити</Button>
      {message ? <p className="text-sm text-stone-700">{message}</p> : null}
    </form>
  );
}

export function UserEditForm({ profile }: { profile: Profile }) {
  const { message, run } = useApiForm();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    await run(async () => {
      await postJson("/api/admin/users/update-profile", {
        userId: profile.id,
        fullName: String(form.get("fullName") ?? ""),
        role: String(form.get("role") ?? "worker"),
        rotationOrder: intOrNull(form.get("rotationOrder")),
        isActive: form.get("isActive") === "on",
      });
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 rounded-md border border-stone-200 bg-white p-4">
      <div>
        <p className="font-semibold">{profile.email}</p>
        <p className="text-xs text-stone-500">{profile.id}</p>
      </div>
      <input className="h-10 rounded-md border px-3" name="fullName" defaultValue={profile.full_name} required />
      <div className="grid gap-3 sm:grid-cols-3">
        <select className="h-10 rounded-md border px-3" name="role" defaultValue={profile.role}>
          <option value="worker">worker</option>
          <option value="admin">admin</option>
        </select>
        <input className="h-10 rounded-md border px-3" name="rotationOrder" defaultValue={profile.rotation_order ?? ""} type="number" />
        <label className="flex items-center gap-2 text-sm">
          <input name="isActive" type="checkbox" defaultChecked={profile.is_active} />
          active
        </label>
      </div>
      <Button type="submit" variant="secondary">Зберегти</Button>
      {message ? <p className="text-sm text-stone-700">{message}</p> : null}
    </form>
  );
}

export function RoomForm({ room }: { room?: Room }) {
  const { message, run } = useApiForm();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    await run(async () => {
      await postJson("/api/admin/rooms", {
        id: room?.id,
        name: String(form.get("name") ?? ""),
        description: String(form.get("description") ?? "") || null,
        sortOrder: Number(form.get("sortOrder") ?? 0),
        isActive: form.get("isActive") === "on",
      });
      if (!room) {
        event.currentTarget.reset();
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 rounded-md border border-stone-200 bg-white p-4">
      <input className="h-10 rounded-md border px-3" name="name" placeholder="Назва кімнати" defaultValue={room?.name ?? ""} required />
      <textarea className="min-h-20 rounded-md border px-3 py-2" name="description" placeholder="Опис" defaultValue={room?.description ?? ""} />
      <div className="grid gap-3 sm:grid-cols-2">
        <input className="h-10 rounded-md border px-3" name="sortOrder" defaultValue={room?.sort_order ?? 0} type="number" />
        <label className="flex items-center gap-2 text-sm">
          <input name="isActive" type="checkbox" defaultChecked={room?.is_active ?? true} />
          active
        </label>
      </div>
      <Button type="submit" variant={room ? "secondary" : "primary"}>
        {room ? "Зберегти кімнату" : "Створити кімнату"}
      </Button>
      {message ? <p className="text-sm text-stone-700">{message}</p> : null}
    </form>
  );
}

export function TaskForm({ task, rooms }: { task?: Task; rooms: Room[] }) {
  const { message, run } = useApiForm();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    await run(async () => {
      await postJson("/api/admin/tasks", {
        id: task?.id,
        roomId: String(form.get("roomId") ?? ""),
        title: String(form.get("title") ?? ""),
        description: String(form.get("description") ?? "") || null,
        sortOrder: Number(form.get("sortOrder") ?? 0),
        isActive: form.get("isActive") === "on",
      });
      if (!task) {
        event.currentTarget.reset();
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 rounded-md border border-stone-200 bg-white p-4">
      <select className="h-10 rounded-md border px-3" name="roomId" defaultValue={task?.room_id ?? rooms[0]?.id} required>
        {rooms.map((room) => (
          <option key={room.id} value={room.id}>{room.name}</option>
        ))}
      </select>
      <input className="h-10 rounded-md border px-3" name="title" placeholder="Назва роботи" defaultValue={task?.title ?? ""} required />
      <textarea className="min-h-20 rounded-md border px-3 py-2" name="description" placeholder="Опис" defaultValue={task?.description ?? ""} />
      <div className="grid gap-3 sm:grid-cols-2">
        <input className="h-10 rounded-md border px-3" name="sortOrder" defaultValue={task?.sort_order ?? 0} type="number" />
        <label className="flex items-center gap-2 text-sm">
          <input name="isActive" type="checkbox" defaultChecked={task?.is_active ?? true} />
          active
        </label>
      </div>
      <Button type="submit" variant={task ? "secondary" : "primary"}>
        {task ? "Зберегти роботу" : "Створити роботу"}
      </Button>
      {message ? <p className="text-sm text-stone-700">{message}</p> : null}
    </form>
  );
}

export function RotationForm({ profiles }: { profiles: Profile[] }) {
  const { message, run } = useApiForm();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    await run(async () => {
      await postJson("/api/admin/reorder-rotation", {
        items: profiles.map((profile) => ({
          userId: profile.id,
          rotationOrder: intOrNull(form.get(profile.id)),
        })),
      });
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      {profiles.map((profile) => (
        <label key={profile.id} className="grid grid-cols-[1fr_120px] items-center gap-3 rounded-md border border-stone-200 bg-white p-4">
          <span>
            <span className="block font-semibold">{profile.full_name}</span>
            <span className="text-sm text-stone-600">{profile.email}</span>
          </span>
          <input className="h-10 rounded-md border px-3" name={profile.id} defaultValue={profile.rotation_order ?? ""} type="number" />
        </label>
      ))}
      <Button type="submit">Зберегти порядок</Button>
      {message ? <p className="text-sm text-stone-700">{message}</p> : null}
    </form>
  );
}

export function ScheduleTools({
  duties,
  profiles,
  failedNotifications,
}: {
  duties: DutyPeriod[];
  profiles: Profile[];
  failedNotifications: Notification[];
}) {
  const { message, run } = useApiForm();

  async function changeAssignee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run(async () => {
      await postJson("/api/admin/change-assignee", {
        dutyPeriodId: String(form.get("dutyPeriodId") ?? ""),
        newAssigneeId: String(form.get("newAssigneeId") ?? ""),
        reason: String(form.get("reason") ?? ""),
      });
    });
  }

  async function regenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run(async () => {
      await postJson("/api/admin/regenerate-schedule", {
        startWeek: String(form.get("startWeek") ?? ""),
        weeks: Number(form.get("weeks") ?? 12),
      });
    });
  }

  async function retry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run(async () => {
      await postJson("/api/admin/retry-notification", {
        notificationId: String(form.get("notificationId") ?? ""),
      });
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <form onSubmit={changeAssignee} className="grid gap-3 rounded-md border border-stone-200 bg-white p-4">
        <h2 className="font-semibold">Змінити чергового</h2>
        <select className="h-10 rounded-md border px-3" name="dutyPeriodId" required>
          {duties.map((duty) => (
            <option key={duty.id} value={duty.id}>{duty.week_start} · {duty.status}</option>
          ))}
        </select>
        <select className="h-10 rounded-md border px-3" name="newAssigneeId" required>
          {profiles.filter((profile) => profile.is_active).map((profile) => (
            <option key={profile.id} value={profile.id}>{profile.full_name}</option>
          ))}
        </select>
        <input className="h-10 rounded-md border px-3" name="reason" placeholder="Причина" required />
        <Button type="submit">Змінити</Button>
      </form>

      <form onSubmit={regenerate} className="grid gap-3 rounded-md border border-stone-200 bg-white p-4">
        <h2 className="font-semibold">Перегенерувати майбутній графік</h2>
        <input className="h-10 rounded-md border px-3" name="startWeek" placeholder="2026-06-22" required />
        <input className="h-10 rounded-md border px-3" name="weeks" defaultValue={12} type="number" min={1} max={52} required />
        <Button type="submit">Згенерувати</Button>
      </form>

      <form onSubmit={retry} className="grid gap-3 rounded-md border border-stone-200 bg-white p-4">
        <h2 className="font-semibold">Retry email</h2>
        <select className="h-10 rounded-md border px-3" name="notificationId" required>
          {failedNotifications.map((notification) => (
            <option key={notification.id} value={notification.id}>{notification.type} · {notification.id.slice(0, 8)}</option>
          ))}
        </select>
        <Button type="submit" disabled={failedNotifications.length === 0}>Повторити</Button>
      </form>
      {message ? <p className="text-sm text-stone-700 lg:col-span-3">{message}</p> : null}
    </div>
  );
}
