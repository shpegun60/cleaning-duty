"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import type { AppSettings, Profile, Room, Task, Notification } from "@/lib/types";

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
      setTimeout(() => router.refresh(), 100);
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
    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    await run(async () => {
      await postJson("/api/admin/users/invite", {
        email: String(form.get("email") ?? ""),
        fullName: String(form.get("fullName") ?? ""),
        role: String(form.get("role") ?? "worker"),
      });
      formElement.reset();
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 rounded-md border border-stone-200 bg-white p-4">
      <h2 className="text-base font-semibold">Запросити користувача</h2>
      <input className="h-10 rounded-md border px-3" name="fullName" placeholder="Ім'я" required />
      <input className="h-10 rounded-md border px-3" name="email" placeholder="email@example.com" type="email" required />
      <div className="grid gap-3">
        <select className="h-10 rounded-md border px-3" name="role" defaultValue="worker">
          <option value="worker">worker</option>
          <option value="admin">admin</option>
        </select>
      </div>
      <Button type="submit" className="w-full">Запросити</Button>
      {message ? <p className="text-sm text-stone-700">{message}</p> : null}
    </form>
  );
}

export function UserEditForm({ profile }: { profile: Profile }) {
  const { message, run } = useApiForm();
  const isAdmin = profile.role === "admin";
  const isLocalAdmin = profile.id === "local-admin";

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

  async function onDelete() {
    if (!window.confirm(`Видалити ${profile.full_name}?`)) {
      return;
    }

    await run(async () => {
      await postJson("/api/admin/users/delete", {
        userId: profile.id,
      });
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 rounded-md border border-stone-200 bg-white p-4">
      <div>
        <p className="font-semibold">{profile.email}</p>
        <p className="text-xs text-stone-500">{profile.id}</p>
      </div>
      <label className="grid gap-1 text-sm">
        Пароль
        <input
          className="h-10 rounded-md border bg-stone-50 px-3 font-mono text-sm"
          readOnly
          value={profile.login_password ?? ""}
          placeholder="не задано"
        />
      </label>
      <input className="h-10 rounded-md border px-3" name="fullName" defaultValue={profile.full_name} required />
      <div className="grid gap-3 sm:grid-cols-3">
        {isLocalAdmin ? <input type="hidden" name="role" value="admin" /> : null}
        <select className="h-10 rounded-md border px-3" name="role" defaultValue={profile.role} disabled={isLocalAdmin}>
          <option value="worker">worker</option>
          <option value="admin">admin</option>
        </select>
        <input
          className="h-10 rounded-md border px-3"
          name="rotationOrder"
          defaultValue={isAdmin ? "" : profile.rotation_order ?? ""}
          type="number"
          min={1}
          disabled={isAdmin}
          placeholder={isAdmin ? "Admin is not in rotation" : "Rotation order"}
        />
        <label className="flex items-center gap-2 text-sm">
          {isLocalAdmin ? <input type="hidden" name="isActive" value="on" /> : null}
          <input name="isActive" type="checkbox" defaultChecked={profile.is_active} disabled={isLocalAdmin} />
          active
        </label>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button type="submit" variant="secondary" className="w-full">Зберегти</Button>
        {!isAdmin ? (
          <Button type="button" variant="danger" className="w-full" onClick={onDelete}>
            Видалити
          </Button>
        ) : null}
      </div>
      {message ? <p className="text-sm text-stone-700">{message}</p> : null}
    </form>
  );
}

export function RoomForm({ room }: { room?: Room }) {
  const { message, run } = useApiForm();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    await run(async () => {
      await postJson("/api/admin/rooms", {
        id: room?.id,
        name: String(form.get("name") ?? ""),
        description: String(form.get("description") ?? "") || null,
        isActive: form.get("isActive") === "on",
      });
      if (!room) {
        formElement.reset();
      }
    });
  }

  async function onDelete() {
    if (!room || !window.confirm(`Видалити ${room.name}?`)) {
      return;
    }

    await run(async () => {
      await postJson("/api/admin/rooms/delete", {
        id: room.id,
      });
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 rounded-md border border-stone-200 bg-white p-4">
      <input className="h-10 rounded-md border px-3" name="name" placeholder="Назва кімнати" defaultValue={room?.name ?? ""} required />
      <textarea className="min-h-20 rounded-md border px-3 py-2" name="description" placeholder="Опис" defaultValue={room?.description ?? ""} />
      <div className="grid gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input name="isActive" type="checkbox" defaultChecked={room?.is_active ?? true} />
          active
        </label>
      </div>
      <div className={room ? "grid gap-2 sm:grid-cols-2" : "grid gap-2"}>
        <Button type="submit" variant={room ? "secondary" : "primary"} className="w-full">
          {room ? "Зберегти кімнату" : "Створити кімнату"}
        </Button>
        {room ? (
          <Button type="button" variant="danger" className="w-full" onClick={onDelete}>
            Видалити
          </Button>
        ) : null}
      </div>
      {message ? <p className="text-sm text-stone-700">{message}</p> : null}
    </form>
  );
}

export function TaskForm({ task, rooms }: { task?: Task; rooms: Room[] }) {
  const { message, run } = useApiForm();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    await run(async () => {
      await postJson("/api/admin/tasks", {
        id: task?.id,
        roomId: String(form.get("roomId") ?? ""),
        title: String(form.get("title") ?? ""),
        description: String(form.get("description") ?? "") || null,
        isActive: form.get("isActive") === "on",
      });
      if (!task) {
        formElement.reset();
      }
    });
  }

  async function onDelete() {
    if (!task || !window.confirm(`Видалити ${task.title}?`)) {
      return;
    }

    await run(async () => {
      await postJson("/api/admin/tasks/delete", {
        id: task.id,
      });
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
      <div className="grid gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input name="isActive" type="checkbox" defaultChecked={task?.is_active ?? true} />
          active
        </label>
      </div>
      <div className={task ? "grid gap-2 sm:grid-cols-2" : "grid gap-2"}>
        <Button type="submit" variant={task ? "secondary" : "primary"} className="w-full">
          {task ? "Зберегти роботу" : "Створити роботу"}
        </Button>
        {task ? (
          <Button type="button" variant="danger" className="w-full" onClick={onDelete}>
            Видалити
          </Button>
        ) : null}
      </div>
      {message ? <p className="text-sm text-stone-700">{message}</p> : null}
    </form>
  );
}

export function RotationForm({ profiles }: { profiles: Profile[] }) {
  const { message, run } = useApiForm();
  const profileKey = rotationProfileKey(profiles);
  const [rotationState, setRotationState] = useState(() => ({
    profileKey,
    items: buildRotationItems(profiles),
  }));
  const items =
    rotationState.profileKey === profileKey
      ? rotationState.items
      : buildRotationItems(profiles);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await saveRotation(items);
  }

  async function saveRotation(rotationItems: Array<{ profile: Profile; rotationOrder: number }>) {
    await run(async () => {
      await postJson("/api/admin/reorder-rotation", {
        items: rotationItems.map((item) => ({
          userId: item.profile.id,
          rotationOrder: item.rotationOrder,
        })),
      });
    });
  }

  async function onReorderNumbers() {
    const normalizedItems = renumberRotationItems(items);
    setRotationState({
      profileKey,
      items: normalizedItems,
    });
    await saveRotation(normalizedItems);
  }

  function moveProfileToOrder(userId: string, value: string) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) return;

    updateRotationItems(profileKey, profiles, setRotationState, (current) => {
      const fromIndex = current.findIndex((item) => item.profile.id === userId);
      if (fromIndex < 0) return current;

      const targetIndex = Math.min(Math.max(parsed, 1), current.length) - 1;
      if (fromIndex === targetIndex) return current;

      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(targetIndex, 0, moved);
      return renumberRotationItems(next);
    });
  }

  function onDragOver(targetId: string) {
    if (!draggedId || draggedId === targetId) return;

    updateRotationItems(profileKey, profiles, setRotationState, (current) => {
      const fromIndex = current.findIndex((item) => item.profile.id === draggedId);
      const toIndex = current.findIndex((item) => item.profile.id === targetId);
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return current;

      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return renumberRotationItems(next);
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      {items.map((item) => (
        <div
          key={item.profile.id}
          draggable
          onDragStart={() => setDraggedId(item.profile.id)}
          onDragOver={(event) => {
            event.preventDefault();
            onDragOver(item.profile.id);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDraggedId(null);
          }}
          onDragEnd={() => setDraggedId(null)}
          className={`grid grid-cols-[40px_1fr_96px] items-center gap-3 rounded-md border bg-white p-4 transition ${
            draggedId === item.profile.id ? "border-emerald-500 opacity-60" : "border-stone-200"
          }`}
        >
          <span
            className="flex h-10 cursor-grab items-center justify-center rounded-md border border-stone-300 bg-stone-50 text-stone-600 active:cursor-grabbing"
            aria-label="Перетягнути"
            title="Перетягнути"
          >
            ↕
          </span>
          <span>
            <span className="block font-semibold">{item.profile.full_name}</span>
            <span className="text-sm text-stone-600">{item.profile.email}</span>
          </span>
          <input
            className="h-10 rounded-md border px-3"
            value={item.rotationOrder}
            type="number"
            min={1}
            max={items.length}
            onChange={(event) => moveProfileToOrder(item.profile.id, event.currentTarget.value)}
          />
        </div>
      ))}
      <div className="grid gap-2 sm:grid-cols-2">
        <Button type="button" variant="secondary" className="w-full" onClick={onReorderNumbers}>
          Вирівняти номери
        </Button>
        <Button type="submit" className="w-full">Зберегти порядок</Button>
      </div>
      {message ? <p className="text-sm text-stone-700">{message}</p> : null}
    </form>
  );
}

function buildRotationItems(profiles: Profile[]) {
  const sorted = [...profiles].sort((a, b) => {
    const aOrder = a.rotation_order ?? Number.POSITIVE_INFINITY;
    const bOrder = b.rotation_order ?? Number.POSITIVE_INFINITY;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.full_name.localeCompare(b.full_name);
  });

  return renumberRotationItems(
    sorted.map((profile, index) => ({
      profile,
      rotationOrder: index + 1,
    })),
  );
}

function rotationProfileKey(profiles: Profile[]) {
  return profiles
    .map((profile) =>
      `${profile.id}:${profile.email}:${profile.full_name}:${profile.rotation_order ?? ""}`,
    )
    .sort()
    .join("|");
}

function updateRotationItems(
  profileKey: string,
  profiles: Profile[],
  setRotationState: (
    updater: (current: {
      profileKey: string;
      items: Array<{ profile: Profile; rotationOrder: number }>;
    }) => {
      profileKey: string;
      items: Array<{ profile: Profile; rotationOrder: number }>;
    },
  ) => void,
  updater: (
    current: Array<{ profile: Profile; rotationOrder: number }>,
  ) => Array<{ profile: Profile; rotationOrder: number }>,
) {
  setRotationState((current) => {
    const currentItems =
      current.profileKey === profileKey ? current.items : buildRotationItems(profiles);
    return {
      profileKey,
      items: updater(currentItems),
    };
  });
}

function renumberRotationItems(
  items: Array<{ profile: Profile; rotationOrder: number }>,
) {
  return items.map((item, index) => ({
    ...item,
    rotationOrder: index + 1,
  }));
}

export function ScheduleTools({
  profiles,
  failedNotifications,
  settings,
}: {
  profiles: Profile[];
  failedNotifications: Notification[];
  settings: AppSettings;
}) {
  const { message, run } = useApiForm();
  const activeRotationWorkers = profiles.filter(
    (profile) =>
      profile.role === "worker" &&
      profile.is_active &&
      profile.rotation_order !== null &&
      profile.rotation_order >= 1,
  );

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    await run(async () => {
      await postJson("/api/admin/schedule-settings", {
        rotationPeriodCount: Number(form.get("rotationPeriodCount") ?? 1),
        rotationPeriodUnit: String(form.get("rotationPeriodUnit") ?? "week"),
      });
    });
  }

  async function regenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run(async () => {
      await postJson("/api/admin/regenerate-schedule", {
        startDate: String(form.get("startDate") ?? ""),
        endDate: String(form.get("endDate") ?? ""),
      });
    });
  }

  async function clearSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      !window.confirm(
        "Очистити весь графік? Будуть видалені всі періоди чергування і пов'язані перевірки.",
      )
    ) {
      return;
    }

    await run(async () => {
      await postJson("/api/admin/clear-schedule", {
        confirm: true,
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
    <div className="grid gap-4 lg:grid-cols-2">
      <form onSubmit={saveSettings} className="grid gap-3 rounded-md border border-stone-200 bg-white p-4">
        <h2 className="font-semibold">Налаштування чергування</h2>
        <p className="text-sm text-stone-600">
          Як довго триває одне чергування перед передачею наступній людині.
        </p>
        <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr]">
          <label className="grid gap-1 text-sm">
            Кількість
            <input
              className="h-10 rounded-md border px-3"
              name="rotationPeriodCount"
              defaultValue={settings.rotation_period_count}
              type="number"
              min={1}
              max={12}
            />
          </label>
          <label className="grid gap-1 text-sm">
            Одиниця
            <select
              className="h-10 rounded-md border px-3"
              name="rotationPeriodUnit"
              defaultValue={settings.rotation_period_unit}
            >
              <option value="day">день / дні</option>
              <option value="week">тиждень / тижні</option>
              <option value="month">місяць / місяці</option>
            </select>
          </label>
        </div>
        <Button type="submit" className="w-full">Зберегти налаштування</Button>
      </form>

      <form onSubmit={regenerate} className="grid gap-3 rounded-md border border-stone-200 bg-white p-4">
        <h2 className="font-semibold">Згенерувати майбутній графік</h2>
        <p className="text-sm text-stone-600">
          Видаляє тільки майбутні scheduled записи від цієї дати. Історію і завершені періоди не чіпає.
        </p>
        <label className="grid gap-1 text-sm">
          Початок першого періоду
          <input className="h-10 rounded-md border px-3" name="startDate" type="date" required />
        </label>
        <label className="grid gap-1 text-sm">
          Крайня дата чергування
          <input
            className="h-10 rounded-md border px-3"
            name="endDate"
            type="date"
            required
          />
        </label>
        <p className="text-sm text-stone-600">
          Поточна довжина періоду: {settings.rotation_period_count} {periodUnitLabel(settings.rotation_period_unit)}.
        </p>
        <Button type="submit" className="w-full" disabled={activeRotationWorkers.length < 2}>
          Згенерувати графік
        </Button>
      </form>

      <form onSubmit={clearSchedule} className="grid gap-3 rounded-md border border-red-200 bg-white p-4">
        <h2 className="font-semibold">Очистити графік</h2>
        <p className="text-sm text-stone-600">
          Видаляє всі періоди чергування з графіка. Люди, кімнати, роботи і rotation order залишаються.
        </p>
        <Button type="submit" variant="danger" className="w-full">
          Очистити весь графік
        </Button>
      </form>

      <form onSubmit={retry} className="grid gap-3 rounded-md border border-stone-200 bg-white p-4">
        <h2 className="font-semibold">Повторити email</h2>
        <p className="text-sm text-stone-600">Повторна відправка повідомлень, які завершились помилкою.</p>
        <select className="h-10 rounded-md border px-3" name="notificationId" required>
          {failedNotifications.map((notification) => (
            <option key={notification.id} value={notification.id}>{notification.type} · {notification.id.slice(0, 8)}</option>
          ))}
        </select>
        <Button type="submit" className="w-full" disabled={failedNotifications.length === 0}>Повторити</Button>
      </form>
      {message ? <p className="text-sm text-stone-700 lg:col-span-2">{message}</p> : null}
    </div>
  );
}

function periodUnitLabel(unit: AppSettings["rotation_period_unit"]) {
  if (unit === "day") return "день/дні";
  if (unit === "month") return "місяць/місяці";
  return "тиждень/тижні";
}
