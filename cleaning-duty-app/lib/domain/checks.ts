import type { SupabaseClient } from "@supabase/supabase-js";

export async function assertAllActiveTasksChecked(
  supabase: SupabaseClient,
  dutyPeriodId: string,
) {
  const { data: tasks, error: tasksError } = await supabase
    .from("tasks")
    .select("id")
    .eq("is_active", true);

  if (tasksError) {
    throw tasksError;
  }

  const taskIds = (tasks ?? []).map((task) => task.id as string);

  if (taskIds.length === 0) {
    return;
  }

  const { data: checks, error: checksError } = await supabase
    .from("task_checks")
    .select("task_id")
    .eq("duty_period_id", dutyPeriodId)
    .eq("is_checked", true)
    .in("task_id", taskIds);

  if (checksError) {
    throw checksError;
  }

  const checked = new Set((checks ?? []).map((check) => check.task_id as string));
  const missing = taskIds.filter((taskId) => !checked.has(taskId));

  if (missing.length > 0) {
    throw new Error("All active tasks must be checked");
  }
}

export async function assertAllActiveRoomsAccepted(
  supabase: SupabaseClient,
  dutyPeriodId: string,
) {
  const { data: rooms, error: roomsError } = await supabase
    .from("rooms")
    .select("id")
    .eq("is_active", true);

  if (roomsError) {
    throw roomsError;
  }

  const roomIds = (rooms ?? []).map((room) => room.id as string);

  if (roomIds.length === 0) {
    return;
  }

  const { data: acceptances, error: acceptanceError } = await supabase
    .from("room_acceptances")
    .select("room_id")
    .eq("duty_period_id", dutyPeriodId)
    .eq("status", "accepted")
    .in("room_id", roomIds);

  if (acceptanceError) {
    throw acceptanceError;
  }

  const accepted = new Set(
    (acceptances ?? []).map((acceptance) => acceptance.room_id as string),
  );
  const missing = roomIds.filter((roomId) => !accepted.has(roomId));

  if (missing.length > 0) {
    throw new Error("All active rooms must be accepted");
  }
}
