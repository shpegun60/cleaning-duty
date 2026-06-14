"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import type { DutyStatus } from "@/lib/types";

type RoomItem = {
  id: string;
  name: string;
  description: string | null;
  isAccepted: boolean;
  tasks: Array<{
    id: string;
    title: string;
    description: string | null;
    isChecked: boolean;
  }>;
};

const WORKER_HANDOVER_STATUSES: DutyStatus[] = [
  "cleaning_done",
  "handover_pending",
];
const ADMIN_HANDOVER_STATUSES: DutyStatus[] = [
  "cleaning_done",
  "handover_pending",
  "ready_for_recheck",
];
const HANDOVER_CANCEL_STATUSES: DutyStatus[] = [
  "handover_pending",
  "accepted",
  "rejected",
  "ready_for_recheck",
];

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
}

export function HandoverChecklist({
  dutyPeriodId,
  status,
  isNextAssignee,
  canOverride,
  cleaningDone,
  initialComment,
  isRepeatedAfterReject,
  rooms,
}: {
  dutyPeriodId: string;
  status: DutyStatus;
  isNextAssignee: boolean;
  canOverride: boolean;
  cleaningDone: boolean;
  initialComment: string;
  isRepeatedAfterReject: boolean;
  rooms: RoomItem[];
}) {
  const router = useRouter();
  const [accepted, setAccepted] = useState(
    () => new Map(rooms.map((room) => [room.id, room.isAccepted] as const)),
  );
  const [comment, setComment] = useState(initialComment);
  const [message, setMessage] = useState<string | null>(null);
  const canEdit =
    (canOverride && ADMIN_HANDOVER_STATUSES.includes(status)) ||
    (isNextAssignee && WORKER_HANDOVER_STATUSES.includes(status));
  const canCancelHandover =
    canOverride &&
    (HANDOVER_CANCEL_STATUSES.includes(status) ||
      rooms.some((room) => accepted.get(room.id)));
  const allAccepted = useMemo(
    () => rooms.every((room) => accepted.get(room.id)),
    [accepted, rooms],
  );
  const canReject = canEdit && !isRepeatedAfterReject && comment.trim().length >= 5;
  const rejectedRoomIds = rooms
    .filter((room) => !accepted.get(room.id))
    .map((room) => room.id);

  async function toggleRoom(roomId: string, isAccepted: boolean) {
    const next = new Map(accepted);
    next.set(roomId, isAccepted);
    setAccepted(next);
    setMessage(null);

    try {
      await postJson("/api/handover/room-check", {
        dutyPeriodId,
        roomId,
        isAccepted,
      });
    } catch (error) {
      const rollback = new Map(accepted);
      rollback.set(roomId, !isAccepted);
      setAccepted(rollback);
      setMessage(error instanceof Error ? error.message : "Помилка");
    }
  }

  async function acceptHandover() {
    setMessage(null);

    try {
      await postJson("/api/handover/accept", { dutyPeriodId });
      setMessage("Чергування прийнято");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Помилка");
    }
  }

  async function rejectHandover() {
    setMessage(null);

    try {
      await postJson("/api/handover/reject", {
        dutyPeriodId,
        rejectedRoomIds,
        comment,
      });
      setMessage("Чергування відхилено");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Помилка");
    }
  }

  async function cancelHandover() {
    if (!window.confirm("Скасувати приймання кімнат і передачу?")) {
      return;
    }

    setMessage(null);

    try {
      await postJson("/api/admin/cancel-handover", { dutyPeriodId });
      setAccepted(new Map(rooms.map((room) => [room.id, false] as const)));
      setMessage("Передачу скасовано");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Помилка");
    }
  }

  return (
    <div className="grid gap-4">
      {!cleaningDone ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Попередній черговий не натиснув завершення прибирання.
        </div>
      ) : null}
      {isRepeatedAfterReject ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Це перечергування після попередньої відмови. Повторно відхилити його не можна; можна прийняти чергування або попросити адміна вирішити ситуацію.
        </div>
      ) : null}
      <section className="rounded-md border border-stone-200 bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold">Кімнати</h2>
        <div className="grid gap-2">
          {rooms.map((room) => (
            <section
              key={room.id}
              className="rounded-md border border-stone-100 p-3"
            >
              <label className="grid grid-cols-[24px_1fr] gap-3">
                <input
                  type="checkbox"
                  checked={Boolean(accepted.get(room.id))}
                  disabled={!canEdit}
                  onChange={(event) => toggleRoom(room.id, event.target.checked)}
                />
                <span>
                  <span className="block font-medium">{room.name}</span>
                  {room.description ? (
                    <span className="text-sm text-stone-600">{room.description}</span>
                  ) : null}
                </span>
              </label>
              <div className="mt-3 grid gap-2 pl-9">
                <p className="text-xs font-semibold uppercase text-stone-500">
                  Роботи, які відмітив прибиральник
                </p>
                {room.tasks.map((task) => (
                  <div
                    key={task.id}
                    className="grid grid-cols-[22px_1fr] gap-2 rounded-md bg-stone-50 px-3 py-2 text-sm text-stone-600"
                  >
                    <input
                      aria-label={task.title}
                      checked={task.isChecked}
                      className="mt-0.5"
                      disabled
                      readOnly
                      type="checkbox"
                    />
                    <span>
                      <span className="block font-medium text-stone-700">{task.title}</span>
                      {task.description ? (
                        <span className="block text-xs text-stone-500">
                          {task.description}
                        </span>
                      ) : null}
                    </span>
                  </div>
                ))}
                {room.tasks.length === 0 ? (
                  <p className="rounded-md bg-stone-50 px-3 py-2 text-sm text-stone-500">
                    Активних робіт у кімнаті немає.
                  </p>
                ) : null}
              </div>
            </section>
          ))}
        </div>
      </section>
      <textarea
        className="min-h-28 rounded-md border border-stone-300 bg-white px-3 py-2 outline-none focus:border-emerald-700"
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        placeholder="Коментар для reject"
      />
      <div className="flex flex-wrap gap-3">
        <Button disabled={!canEdit || !allAccepted} onClick={acceptHandover} type="button">
          Прийняти чергування
        </Button>
        <Button
          disabled={!canReject}
          onClick={rejectHandover}
          type="button"
          variant="danger"
        >
          Не прийняти
        </Button>
        {canCancelHandover ? (
          <Button onClick={cancelHandover} type="button" variant="secondary">
            Скасувати передачу
          </Button>
        ) : null}
      </div>
      {message ? <p className="text-sm text-stone-700">{message}</p> : null}
    </div>
  );
}
