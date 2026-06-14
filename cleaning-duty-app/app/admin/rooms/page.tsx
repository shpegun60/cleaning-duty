import { RoomForm } from "@/components/admin/admin-forms";
import { hasDutySchedule, listRooms } from "@/lib/data/store";
import type { Room } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminRoomsPage() {
  const [rooms, scheduleLocked] = (await Promise.all([
    listRooms(),
    hasDutySchedule(),
  ])) as [Room[], boolean];

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold">Кімнати</h1>
        <p className="mt-1 text-stone-600">Створення, порядок і деактивація кімнат.</p>
      </div>
      <RoomForm scheduleLocked={scheduleLocked} />
      <div className="grid gap-3">
        {rooms.map((room) => (
          <RoomForm key={room.id} room={room} scheduleLocked={scheduleLocked} />
        ))}
      </div>
    </div>
  );
}
