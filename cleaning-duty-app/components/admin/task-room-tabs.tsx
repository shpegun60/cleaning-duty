"use client";

import { useState } from "react";

import { TaskForm } from "@/components/admin/admin-forms";
import type { Room, Task } from "@/lib/types";

export function TaskRoomTabs({
  rooms,
  tasks,
  scheduleLocked = false,
}: {
  rooms: Room[];
  tasks: Task[];
  scheduleLocked?: boolean;
}) {
  const [selectedRoomId, setSelectedRoomId] = useState(rooms[0]?.id ?? "");
  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) ?? rooms[0] ?? null;
  const selectedTasks = selectedRoom
    ? tasks.filter((task) => task.room_id === selectedRoom.id)
    : [];
  const taskCounts = new Map<string, number>();

  for (const task of tasks) {
    taskCounts.set(task.room_id, (taskCounts.get(task.room_id) ?? 0) + 1);
  }

  if (rooms.length === 0) {
    return (
      <section className="rounded-md border border-stone-200 bg-white p-4 text-sm text-stone-600">
        Спочатку створи хоча б одну кімнату, потім додавай роботи.
      </section>
    );
  }

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        {rooms.map((room) => {
          const active = selectedRoom?.id === room.id;
          return (
            <button
              key={room.id}
              className={`rounded-md border px-3 py-2 text-sm font-semibold transition ${
                active
                  ? "border-emerald-700 bg-emerald-700 text-white"
                  : "border-stone-300 bg-white text-stone-900 hover:bg-stone-100"
              }`}
              onClick={() => setSelectedRoomId(room.id)}
              type="button"
            >
              {room.name}
              {!room.is_active ? " · inactive" : ""}
              <span
                className={`ml-2 rounded px-1.5 py-0.5 text-xs ${
                  active ? "bg-white/20 text-white" : "bg-stone-100 text-stone-700"
                }`}
              >
                {taskCounts.get(room.id) ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {selectedRoom ? (
        <div className="rounded-md border border-stone-200 bg-stone-50 p-4">
          <h2 className="font-semibold">{selectedRoom.name}</h2>
          {selectedRoom.description ? (
            <p className="mt-1 text-sm text-stone-600">{selectedRoom.description}</p>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3">
        {selectedTasks.length > 0 ? (
          selectedTasks.map((task) => (
            <TaskForm
              key={task.id}
              rooms={rooms}
              task={task}
              scheduleLocked={scheduleLocked}
            />
          ))
        ) : (
          <div className="rounded-md border border-stone-200 bg-white p-4 text-sm text-stone-600">
            У цій кімнаті ще немає робіт.
          </div>
        )}
      </div>
    </section>
  );
}
