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
}

export function HandoverChecklist({
  dutyPeriodId,
  status,
  isNextAssignee,
  cleaningDone,
  rooms,
}: {
  dutyPeriodId: string;
  status: DutyStatus;
  isNextAssignee: boolean;
  cleaningDone: boolean;
  rooms: RoomItem[];
}) {
  const router = useRouter();
  const [accepted, setAccepted] = useState(
    () => new Map(rooms.map((room) => [room.id, room.isAccepted] as const)),
  );
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const canEdit = isNextAssignee && ["handover_pending", "ready_for_recheck"].includes(status);
  const allAccepted = useMemo(
    () => rooms.every((room) => accepted.get(room.id)),
    [accepted, rooms],
  );
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
      router.refresh();
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

  return (
    <div className="grid gap-4">
      {!cleaningDone ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Попередній черговий не натиснув завершення прибирання.
        </div>
      ) : null}
      <section className="rounded-md border border-stone-200 bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold">Кімнати</h2>
        <div className="grid gap-2">
          {rooms.map((room) => (
            <label
              key={room.id}
              className="grid grid-cols-[24px_1fr] gap-3 rounded-md border border-stone-100 p-3"
            >
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
          disabled={!canEdit || allAccepted || comment.trim().length < 5}
          onClick={rejectHandover}
          type="button"
          variant="danger"
        >
          Не прийняти
        </Button>
      </div>
      {message ? <p className="text-sm text-stone-700">{message}</p> : null}
    </div>
  );
}
