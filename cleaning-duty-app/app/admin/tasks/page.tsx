import { TaskForm } from "@/components/admin/admin-forms";
import { TaskRoomTabs } from "@/components/admin/task-room-tabs";
import { hasDutySchedule, listRooms, listTasks } from "@/lib/data/store";
import type { Room, Task } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminTasksPage() {
  const [roomList, taskList, scheduleLocked] = (await Promise.all([
    listRooms(),
    listTasks(),
    hasDutySchedule(),
  ])) as [
    Room[],
    Task[],
    boolean,
  ];

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold">Роботи</h1>
        <p className="mt-1 text-stone-600">Роботи прив&apos;язані до кімнат і сортуються всередині них.</p>
      </div>
      <TaskForm rooms={roomList.filter((room) => room.is_active)} scheduleLocked={scheduleLocked} />
      <TaskRoomTabs rooms={roomList} tasks={taskList} scheduleLocked={scheduleLocked} />
    </div>
  );
}
