import { notFound } from "next/navigation";

import { DutyChecklist } from "@/components/duty/duty-checklist";
import { AppShell } from "@/components/layout/app-shell";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireUserPage } from "@/lib/auth/page-guards";
import {
  activateDutyIfCurrentScheduled,
  isDateWithinDutyPeriod,
  listRooms,
  listTaskChecks,
  listTasks,
  loadDutyPeriod,
  loadProfile,
} from "@/lib/data/store";
import { getLocalSchedulerState } from "@/lib/scheduler/dates";
import type { Room, Task, TaskCheck } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DutyPage({
  params,
}: {
  params: Promise<{ dutyId: string }>;
}) {
  const user = await requireUserPage();
  const { dutyId } = await params;
  const localDate = getLocalSchedulerState().dateKey;
  const duty = await activateDutyIfCurrentScheduled(
    await loadDutyPeriod(dutyId),
    localDate,
  );

  if (duty.assignee_id !== user.id && user.role !== "admin") {
    notFound();
  }

  const [rooms, tasks, checks] = await Promise.all([
    listRooms({ activeOnly: true }),
    listTasks({ activeOnly: true }),
    listTaskChecks(duty.id),
  ]);
  const assignee = await loadProfile(duty.assignee_id);
  const checked = new Map(
    (checks as TaskCheck[]).map((check) => [check.task_id, check.is_checked]),
  );
  const checklistKey = (checks as TaskCheck[])
    .map((check) => `${check.task_id}:${check.is_checked ? 1 : 0}:${check.checked_at ?? ""}`)
    .sort()
    .join("|");
  const activeRooms = rooms as Room[];
  const activeTasks = tasks as Task[];
  const groups = activeRooms.map((room) => ({
    id: room.id,
    name: room.name,
    description: room.description,
    tasks: activeTasks
      .filter((task) => task.room_id === room.id)
      .map((task) => ({
        id: task.id,
        title: task.title,
        description: task.description,
        isChecked: Boolean(checked.get(task.id)),
      })),
  }));

  return (
    <AppShell user={user}>
      <div className="mb-6 grid gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Виконання робіт</h1>
            <p className="mt-1 text-stone-600">
              Відміть виконані роботи по кожній кімнаті.
            </p>
          </div>
          <StatusBadge status={duty.status} />
        </div>
        <dl className="grid gap-2 rounded-md border border-stone-200 bg-white p-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-stone-500">Тиждень</dt>
            <dd className="font-semibold">{duty.week_start} - {duty.week_end}</dd>
          </div>
          <div>
            <dt className="text-stone-500">Черговий</dt>
            <dd className="font-semibold">{assignee.full_name}</dd>
          </div>
          <div>
            <dt className="text-stone-500">Коментар reject</dt>
            <dd className="font-semibold">{duty.reject_comment ?? "немає"}</dd>
          </div>
        </dl>
      </div>
      <DutyChecklist
        key={`${duty.id}:${duty.status}:${checklistKey}`}
        dutyPeriodId={duty.id}
        groups={groups}
        canOverride={user.role === "admin"}
        isAssignee={duty.assignee_id === user.id}
        isWithinDutyPeriod={isDateWithinDutyPeriod(duty, localDate)}
        status={duty.status}
      />
    </AppShell>
  );
}
