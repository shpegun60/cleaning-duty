import { notFound } from "next/navigation";

import { HandoverChecklist } from "@/components/handover/handover-checklist";
import { AppShell } from "@/components/layout/app-shell";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireUserPage } from "@/lib/auth/page-guards";
import {
  isDutyRepeatedAfterRejectedHandover,
  listRoomAcceptances,
  listRooms,
  listTaskChecks,
  listTasks,
  loadDutyPeriod,
  loadProfile,
} from "@/lib/data/store";
import type { Room, RoomAcceptance, Task, TaskCheck } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HandoverPage({
  params,
}: {
  params: Promise<{ dutyId: string }>;
}) {
  const user = await requireUserPage();
  const { dutyId } = await params;
  const duty = await loadDutyPeriod(dutyId);

  if (duty.next_assignee_id !== user.id && user.role !== "admin") {
    notFound();
  }

  const [rooms, tasks, taskChecks, acceptances] = await Promise.all([
    listRooms({ activeOnly: true }),
    listTasks({ activeOnly: true }),
    listTaskChecks(duty.id),
    listRoomAcceptances(duty.id),
  ]);
  const previous = await loadProfile(duty.assignee_id);
  const isRepeatedAfterReject = await isDutyRepeatedAfterRejectedHandover(duty);
  const acceptanceMap = new Map(
    (acceptances as RoomAcceptance[]).map((acceptance) => [
      acceptance.room_id,
      acceptance.status,
    ]),
  );
  const checklistKey = (acceptances as RoomAcceptance[])
    .map(
      (acceptance) =>
        `${acceptance.room_id}:${acceptance.status}:${acceptance.checked_at ?? ""}`,
    )
    .sort()
    .join("|");
  const taskChecklistKey = (taskChecks as TaskCheck[])
    .map((check) => `${check.task_id}:${check.is_checked ? 1 : 0}:${check.checked_at ?? ""}`)
    .sort()
    .join("|");
  const taskCheckMap = new Map(
    (taskChecks as TaskCheck[]).map((check) => [check.task_id, check.is_checked]),
  );
  const activeTasks = tasks as Task[];
  const roomItems = (rooms as Room[]).map((room) => ({
    id: room.id,
    name: room.name,
    description: room.description,
    isAccepted: acceptanceMap.get(room.id) === "accepted",
    tasks: activeTasks
      .filter((task) => task.room_id === room.id)
      .map((task) => ({
        id: task.id,
        title: task.title,
        description: task.description,
        isChecked: Boolean(taskCheckMap.get(task.id)),
      })),
  }));

  return (
    <AppShell user={user}>
      <div className="mb-6 grid gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Приймання кімнат</h1>
            <p className="mt-1 text-stone-600">
              Перевір кімнати і підтвердь, що все прибрано.
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
            <dt className="text-stone-500">Передає</dt>
            <dd className="font-semibold">{previous.full_name}</dd>
          </div>
          <div>
            <dt className="text-stone-500">Завершення</dt>
            <dd className="font-semibold">{duty.cleaned_at ? "позначено" : "не позначено"}</dd>
          </div>
        </dl>
      </div>
      <HandoverChecklist
        key={`${duty.id}:${duty.status}:${checklistKey}:${taskChecklistKey}`}
        dutyPeriodId={duty.id}
        canOverride={user.role === "admin"}
        cleaningDone={Boolean(duty.cleaned_at)}
        initialComment={duty.reject_comment ?? ""}
        isRepeatedAfterReject={isRepeatedAfterReject}
        isNextAssignee={duty.next_assignee_id === user.id}
        rooms={roomItems}
        status={duty.status}
      />
    </AppShell>
  );
}
