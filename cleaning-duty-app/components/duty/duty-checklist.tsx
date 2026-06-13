"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import type { DutyStatus } from "@/lib/types";

type TaskItem = {
  id: string;
  title: string;
  description: string | null;
  isChecked: boolean;
};

type RoomGroup = {
  id: string;
  name: string;
  tasks: TaskItem[];
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

export function DutyChecklist({
  dutyPeriodId,
  status,
  isAssignee,
  isWithinDutyPeriod,
  canOverride,
  groups,
}: {
  dutyPeriodId: string;
  status: DutyStatus;
  isAssignee: boolean;
  isWithinDutyPeriod: boolean;
  canOverride: boolean;
  groups: RoomGroup[];
}) {
  const router = useRouter();
  const [checked, setChecked] = useState(
    () =>
      new Map(
        groups.flatMap((group) =>
          group.tasks.map((task) => [task.id, task.isChecked] as const),
        ),
      ),
  );
  const [message, setMessage] = useState<string | null>(null);
  const canEdit =
    canOverride ||
    (isAssignee &&
      isWithinDutyPeriod &&
      ["active", "rejected", "ready_for_recheck"].includes(status));
  const allChecked = useMemo(
    () => groups.every((group) => group.tasks.every((task) => checked.get(task.id))),
    [checked, groups],
  );

  async function toggleTask(taskId: string, isChecked: boolean) {
    const next = new Map(checked);
    next.set(taskId, isChecked);
    setChecked(next);
    setMessage(null);

    try {
      await postJson("/api/duty/task-check", {
        dutyPeriodId,
        taskId,
        isChecked,
      });
      router.refresh();
    } catch (error) {
      const rollback = new Map(checked);
      rollback.set(taskId, !isChecked);
      setChecked(rollback);
      setMessage(error instanceof Error ? error.message : "Помилка");
    }
  }

  async function complete() {
    setMessage(null);

    try {
      await postJson("/api/duty/complete", { dutyPeriodId });
      setMessage("Чергування позначено як прибране");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Помилка");
    }
  }

  async function readyForRecheck() {
    setMessage(null);

    try {
      await postJson("/api/duty/ready-for-recheck", { dutyPeriodId });
      setMessage("Запит на повторну перевірку надіслано");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Помилка");
    }
  }

  return (
    <div className="grid gap-4">
      {groups.map((group) => (
        <section key={group.id} className="rounded-md border border-stone-200 bg-white p-4">
          <h2 className="mb-3 text-lg font-semibold">{group.name}</h2>
          <div className="grid gap-2">
            {group.tasks.map((task) => (
              <label
                key={task.id}
                className="grid grid-cols-[24px_1fr] gap-3 rounded-md border border-stone-100 p-3"
              >
                <input
                  type="checkbox"
                  checked={Boolean(checked.get(task.id))}
                  disabled={!canEdit}
                  onChange={(event) => toggleTask(task.id, event.target.checked)}
                />
                <span>
                  <span className="block font-medium">{task.title}</span>
                  {task.description ? (
                    <span className="text-sm text-stone-600">{task.description}</span>
                  ) : null}
                </span>
              </label>
            ))}
            {group.tasks.length === 0 ? (
              <p className="text-sm text-stone-600">Активних робіт у кімнаті немає.</p>
            ) : null}
          </div>
        </section>
      ))}
      <div className="flex flex-wrap gap-3">
        <Button disabled={!canEdit || !allChecked} onClick={complete} type="button">
          Завершити прибирання
        </Button>
        {status === "rejected" ? (
          <Button
            disabled={!canEdit || !allChecked}
            onClick={readyForRecheck}
            type="button"
            variant="secondary"
          >
            Готово до повторної перевірки
          </Button>
        ) : null}
      </div>
      {message ? <p className="text-sm text-stone-700">{message}</p> : null}
    </div>
  );
}
