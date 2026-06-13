import { TaskForm } from "@/components/admin/admin-forms";
import { listRooms, listTasks } from "@/lib/data/store";
import type { Room, Task } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminTasksPage() {
  const [roomList, taskList] = (await Promise.all([listRooms(), listTasks()])) as [
    Room[],
    Task[],
  ];

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold">Роботи</h1>
        <p className="mt-1 text-stone-600">Роботи прив&apos;язані до кімнат і сортуються всередині них.</p>
      </div>
      <TaskForm rooms={roomList.filter((room) => room.is_active)} />
      <div className="grid gap-3">
        {taskList.map((task) => (
          <TaskForm key={task.id} rooms={roomList} task={task} />
        ))}
      </div>
    </div>
  );
}
