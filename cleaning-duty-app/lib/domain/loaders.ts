import type { SupabaseClient } from "@supabase/supabase-js";

import { notFound } from "@/lib/http";
import type { DutyPeriod, Profile, Room, Task } from "@/lib/types";

export async function loadDutyPeriod(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase
    .from("duty_periods")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    throw notFound("Duty period not found");
  }

  return data as DutyPeriod;
}

export async function loadProfile(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,full_name,role,rotation_order,is_active")
    .eq("id", id)
    .single();

  if (error || !data) {
    throw notFound("Profile not found");
  }

  return data as Profile;
}

export async function loadActiveTask(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", id)
    .eq("is_active", true)
    .single();

  if (error || !data) {
    throw notFound("Task not found");
  }

  return data as Task;
}

export async function loadActiveRoom(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase
    .from("rooms")
    .select("*")
    .eq("id", id)
    .eq("is_active", true)
    .single();

  if (error || !data) {
    throw notFound("Room not found");
  }

  return data as Room;
}
