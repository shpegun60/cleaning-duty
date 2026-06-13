import { RoomForm } from "@/components/admin/admin-forms";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Room } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminRoomsPage() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("rooms")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    throw error;
  }

  const rooms = (data ?? []) as Room[];

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold">Кімнати</h1>
        <p className="mt-1 text-stone-600">Створення, порядок і деактивація кімнат.</p>
      </div>
      <RoomForm />
      <div className="grid gap-3">
        {rooms.map((room) => (
          <RoomForm key={room.id} room={room} />
        ))}
      </div>
    </div>
  );
}
