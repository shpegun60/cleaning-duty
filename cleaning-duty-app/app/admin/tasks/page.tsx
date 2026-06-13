import { TaskForm } from "@/components/admin/admin-forms";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Room, Task } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminTasksPage() {
  const supabase = createSupabaseAdminClient();
  const [{ data: rooms, error: roomsError }, { data: tasks, error: tasksError }] =
    await Promise.all([
      supabase.from("rooms").select("*").order("sort_order", { ascending: true }),
      supabase.from("tasks").select("*").order("sort_order", { ascending: true }),
    ]);

  if (roomsError) {
    throw roomsError;
  }

  if (tasksError) {
    throw tasksError;
  }

  const roomList = (rooms ?? []) as Room[];
  const taskList = (tasks ?? []) as Task[];

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
