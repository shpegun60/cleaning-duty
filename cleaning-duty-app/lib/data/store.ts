import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { readRuntimeConfig } from "@/lib/config/runtime";
import { weekEndFromStart } from "@/lib/domain/dates";
import { badRequest, conflict, forbidden } from "@/lib/http";
import { getLocalDb, mapBooleanFields, nowIso } from "@/lib/local/sqlite";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  AppSettings,
  DutyPeriod,
  Notification,
  NotificationType,
  Profile,
  Room,
  RoomAcceptance,
  RoomAcceptanceStatus,
  Task,
  TaskCheck,
} from "@/lib/types";

type Json = Record<string, unknown> | null | undefined;

export function backendMode() {
  return readRuntimeConfig().backendMode;
}

export function isLocalBackend() {
  return backendMode() === "local";
}

export function getSupabaseForStore() {
  return createSupabaseAdminClient();
}

function asProfile(row: Record<string, unknown>) {
  return mapBooleanFields(row, ["is_active"]) as Profile;
}

function asRoom(row: Record<string, unknown>) {
  return mapBooleanFields(row, ["is_active"]) as Room;
}

function asTask(row: Record<string, unknown>) {
  return mapBooleanFields(row, ["is_active"]) as Task;
}

function asTaskCheck(row: Record<string, unknown>) {
  return mapBooleanFields(row, ["is_checked"]) as TaskCheck;
}

function asSettings(row: Record<string, unknown>) {
  return { ...row, id: true } as AppSettings;
}

function jsonPayload(value: Json) {
  return value ? JSON.stringify(value) : null;
}

async function sbList<T>(
  callback: (supabase: SupabaseClient) => unknown,
) {
  const { data, error } = (await callback(getSupabaseForStore())) as {
    data: unknown;
    error: unknown;
  };
  if (error) throw error;
  return (data ?? []) as T[];
}

export async function listProfiles() {
  if (!isLocalBackend()) {
    const profiles = await sbList<Profile>((supabase) =>
      supabase
        .from("profiles")
        .select("*")
        .order("full_name", { ascending: true }),
    );

    return sortProfilesForAdmin(profiles);
  }

  const profiles = getLocalDb()
    .prepare("select * from profiles order by rotation_order is null, rotation_order asc, full_name asc")
    .all()
    .map((row) => asProfile(row as Record<string, unknown>));

  return sortProfilesForAdmin(profiles);
}

export async function listActiveRotationProfiles() {
  const profiles = await listProfiles();
  return profiles
    .filter(
      (profile) =>
        profile.role === "worker" &&
        profile.is_active &&
        profile.rotation_order !== null &&
        profile.rotation_order >= 1,
    )
    .sort((a, b) => Number(a.rotation_order) - Number(b.rotation_order));
}

function sortProfilesForAdmin(profiles: Profile[]) {
  return [...profiles].sort((a, b) => {
    if (a.role !== b.role) {
      return a.role === "admin" ? -1 : 1;
    }

    if (a.role === "admin") {
      return a.full_name.localeCompare(b.full_name);
    }

    const aOrder = a.rotation_order ?? Number.POSITIVE_INFINITY;
    const bOrder = b.rotation_order ?? Number.POSITIVE_INFINITY;

    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }

    return a.full_name.localeCompare(b.full_name);
  });
}

async function assertRotationOrderAvailable(params: {
  userId?: string;
  role: "admin" | "worker";
  rotationOrder: number | null;
  isActive?: boolean;
}) {
  if (params.role !== "worker" || params.isActive === false || params.rotationOrder === null) {
    return;
  }

  if (!Number.isInteger(params.rotationOrder) || params.rotationOrder < 1) {
    throw badRequest("Rotation order must be empty or a positive number starting from 1");
  }

  const profiles = await listProfiles();
  const existing = profiles.find(
    (profile) =>
      profile.id !== params.userId &&
      profile.role === "worker" &&
      profile.is_active &&
      profile.rotation_order === params.rotationOrder,
  );

  if (existing) {
    throw conflict(`Rotation order ${params.rotationOrder} is already used by ${existing.full_name}`);
  }
}

function normalizedRotationOrder(role: "admin" | "worker", rotationOrder: number | null) {
  return role === "worker" ? rotationOrder : null;
}

function firstFreeRotationOrder(profiles: Profile[]) {
  const usedOrders = new Set(
    profiles
      .filter(
        (profile) =>
          profile.role === "worker" &&
          profile.is_active &&
          profile.rotation_order !== null &&
          profile.rotation_order >= 1,
      )
      .map((profile) => Number(profile.rotation_order)),
  );

  let order = 1;
  while (usedOrders.has(order)) {
    order += 1;
  }
  return order;
}

async function createRotationOrder(role: "admin" | "worker", rotationOrder: number | null) {
  if (role !== "worker") {
    return null;
  }

  if (rotationOrder !== null) {
    return rotationOrder;
  }

  return firstFreeRotationOrder(await listProfiles());
}

export async function resolveNextAssignee(currentAssigneeId: string) {
  const users = await listActiveRotationProfiles();

  if (users.length < 2) {
    throw new Error("At least two active users are required for rotation");
  }

  const currentIndex = users.findIndex((user) => user.id === currentAssigneeId);

  if (currentIndex < 0) {
    return users[0];
  }

  return users[(currentIndex + 1) % users.length];
}

export function getNextRotationUser(users: Profile[], currentAssigneeId: string) {
  const currentIndex = users.findIndex((user) => user.id === currentAssigneeId);
  return users[currentIndex < 0 ? 0 : (currentIndex + 1) % users.length];
}

export async function reorderActiveWorkerRotation(
  items: Array<{ userId: string; rotationOrder: number }>,
) {
  const activeWorkers = (await listProfiles()).filter(
    (profile) => profile.role === "worker" && profile.is_active,
  );
  const activeWorkerIds = new Set(activeWorkers.map((profile) => profile.id));
  const itemIds = new Set<string>();

  for (const item of items) {
    if (itemIds.has(item.userId)) {
      throw badRequest("Rotation users must be unique");
    }
    itemIds.add(item.userId);

    if (!activeWorkerIds.has(item.userId)) {
      throw badRequest("Rotation can include only active workers");
    }

    if (!Number.isInteger(item.rotationOrder) || item.rotationOrder < 1) {
      throw badRequest("Rotation order must be a positive number starting from 1");
    }
  }

  for (const worker of activeWorkers) {
    if (!itemIds.has(worker.id)) {
      throw badRequest("Rotation must include every active worker");
    }
  }

  const normalizedItems = [...items]
    .sort((a, b) => a.rotationOrder - b.rotationOrder)
    .map((item, index) => ({
      userId: item.userId,
      rotationOrder: index + 1,
    }));
  const now = nowIso();

  if (!isLocalBackend()) {
    const supabase = getSupabaseForStore();
    const ids = activeWorkers.map((profile) => profile.id);
    const { error: clearError } = await supabase
      .from("profiles")
      .update({ rotation_order: null })
      .in("id", ids);
    if (clearError) throw clearError;

    for (const item of normalizedItems) {
      const { error } = await supabase
        .from("profiles")
        .update({ rotation_order: item.rotationOrder })
        .eq("id", item.userId);
      if (error) throw error;
    }

    return normalizedItems;
  }

  const db = getLocalDb();
  db.exec("begin");
  try {
    db.prepare(
      "update profiles set rotation_order = null, updated_at = ? where role = 'worker' and is_active = 1",
    ).run(now);
    const update = db.prepare(
      "update profiles set rotation_order = ?, updated_at = ? where id = ?",
    );

    for (const item of normalizedItems) {
      update.run(item.rotationOrder, now, item.userId);
    }

    db.exec("commit");
  } catch (error) {
    db.exec("rollback");
    throw error;
  }

  return normalizedItems;
}

export async function loadProfile(id: string) {
  if (!isLocalBackend()) {
    const supabase = getSupabaseForStore();
    const { data, error } = await supabase.from("profiles").select("*").eq("id", id).single();
    if (error) throw error;
    return data as Profile;
  }

  const row = getLocalDb().prepare("select * from profiles where id = ?").get(id);
  if (!row) throw new Error("Profile not found");
  return asProfile(row as Record<string, unknown>);
}

export async function createProfile(params: {
  email: string;
  fullName: string;
  role: "admin" | "worker";
  rotationOrder: number | null;
}) {
  const rotationOrder = await createRotationOrder(params.role, params.rotationOrder);
  await assertRotationOrderAvailable({
    role: params.role,
    rotationOrder,
    isActive: true,
  });

  if (!isLocalBackend()) {
    const supabase = getSupabaseForStore();
    const { data: inviteData, error: inviteError } =
      await supabase.auth.admin.inviteUserByEmail(params.email);
    if (inviteError) throw inviteError;
    const userId = inviteData.user?.id;
    if (!userId) throw new Error("Invite did not return user id");
    const { error } = await supabase.from("profiles").upsert({
      id: userId,
      email: params.email,
      full_name: params.fullName,
      role: params.role,
      rotation_order: rotationOrder,
      is_active: true,
    });
    if (error) throw error;
    return userId;
  }

  const id = randomUUID();
  getLocalDb()
    .prepare(
      `insert into profiles
       (id, email, full_name, role, rotation_order, is_active, updated_at)
       values (?, ?, ?, ?, ?, 1, ?)`,
    )
    .run(id, params.email, params.fullName, params.role, rotationOrder, nowIso());
  return id;
}

export async function updateProfile(params: {
  userId: string;
  fullName: string;
  role: "admin" | "worker";
  rotationOrder: number | null;
  isActive: boolean;
}) {
  const existing = await loadProfile(params.userId);

  if (existing.id === "local-admin" && (params.role !== "admin" || !params.isActive)) {
    throw forbidden("Local admin cannot be demoted or deactivated");
  }

  const rotationOrder = normalizedRotationOrder(params.role, params.rotationOrder);
  await assertRotationOrderAvailable({
    userId: params.userId,
    role: params.role,
    rotationOrder,
    isActive: params.isActive,
  });

  if (!isLocalBackend()) {
    const supabase = getSupabaseForStore();
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: params.fullName,
        role: params.role,
        rotation_order: rotationOrder,
        is_active: params.isActive,
      })
      .eq("id", params.userId);
    if (error) throw error;
    return;
  }

  getLocalDb()
    .prepare(
      `update profiles
       set full_name = ?, role = ?, rotation_order = ?, is_active = ?, updated_at = ?
       where id = ?`,
    )
    .run(
      params.fullName,
      params.role,
      rotationOrder,
      params.isActive ? 1 : 0,
      nowIso(),
      params.userId,
    );
}

export async function removeProfile(userId: string) {
  const profile = await loadProfile(userId);

  if (profile.role === "admin") {
    throw forbidden("Admin users cannot be deleted");
  }

  if (!isLocalBackend()) {
    const supabase = getSupabaseForStore();
    const hasHistory = await profileHasHistory(userId);

    if (hasHistory) {
      await updateProfile({
        userId,
        fullName: profile.full_name,
        role: profile.role,
        rotationOrder: null,
        isActive: false,
      });
      return "deactivated" as const;
    }

    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) throw error;
    return "deleted" as const;
  }

  if (await profileHasHistory(userId)) {
    getLocalDb()
      .prepare("update profiles set is_active = 0, rotation_order = null, updated_at = ? where id = ?")
      .run(nowIso(), userId);
    return "deactivated" as const;
  }

  getLocalDb().prepare("delete from profiles where id = ?").run(userId);
  return "deleted" as const;
}

async function profileHasHistory(userId: string) {
  if (!isLocalBackend()) {
    const supabase = getSupabaseForStore();
    const checks = await Promise.all([
      supabase.from("duty_periods").select("id", { count: "exact", head: true }).or(`assignee_id.eq.${userId},next_assignee_id.eq.${userId},accepted_by.eq.${userId},rejected_by.eq.${userId},created_by.eq.${userId}`),
      supabase.from("task_checks").select("id", { count: "exact", head: true }).eq("checked_by", userId),
      supabase.from("room_acceptances").select("id", { count: "exact", head: true }).eq("accepted_by", userId),
      supabase.from("notifications").select("id", { count: "exact", head: true }).eq("recipient_id", userId),
      supabase.from("audit_log").select("id", { count: "exact", head: true }).eq("actor_id", userId),
    ]);

    for (const result of checks) {
      if (result.error) throw result.error;
      if ((result.count ?? 0) > 0) return true;
    }

    return false;
  }

  const db = getLocalDb();
  const dutyCount = db
    .prepare(
      `select count(*) as count
       from duty_periods
       where assignee_id = ? or next_assignee_id = ? or accepted_by = ?
          or rejected_by = ? or created_by = ?`,
    )
    .get(userId, userId, userId, userId, userId) as { count: number };
  const taskCount = db.prepare("select count(*) as count from task_checks where checked_by = ?").get(userId) as { count: number };
  const roomCount = db.prepare("select count(*) as count from room_acceptances where accepted_by = ?").get(userId) as { count: number };
  const notificationCount = db.prepare("select count(*) as count from notifications where recipient_id = ?").get(userId) as { count: number };
  const auditCount = db.prepare("select count(*) as count from audit_log where actor_id = ?").get(userId) as { count: number };

  return [dutyCount, taskCount, roomCount, notificationCount, auditCount].some(
    (result) => result.count > 0,
  );
}

export async function listRooms(options: { activeOnly?: boolean } = {}) {
  if (!isLocalBackend()) {
    return sbList<Room>((supabase) => {
      let query = supabase.from("rooms").select("*").order("sort_order", { ascending: true });
      if (options.activeOnly) query = query.eq("is_active", true);
      return query;
    });
  }

  const sql = options.activeOnly
    ? "select * from rooms where is_active = 1 order by sort_order asc, name asc"
    : "select * from rooms order by sort_order asc, name asc";
  return getLocalDb()
    .prepare(sql)
    .all()
    .map((row) => asRoom(row as Record<string, unknown>));
}

async function loadRoom(id: string) {
  if (!isLocalBackend()) {
    const supabase = getSupabaseForStore();
    const { data, error } = await supabase.from("rooms").select("*").eq("id", id).single();
    if (error) throw error;
    return data as Room;
  }

  const row = getLocalDb().prepare("select * from rooms where id = ?").get(id);
  if (!row) throw new Error("Room not found");
  return asRoom(row as Record<string, unknown>);
}

async function nextRoomSortOrder() {
  const rooms = await listRooms();
  const maxSortOrder = rooms.reduce(
    (max, room) => Math.max(max, Number(room.sort_order) || 0),
    0,
  );
  return maxSortOrder + 10;
}

async function deactivateRoomTasks(roomId: string) {
  if (!isLocalBackend()) {
    const supabase = getSupabaseForStore();
    const { error } = await supabase
      .from("tasks")
      .update({ is_active: false })
      .eq("room_id", roomId);
    if (error) throw error;
    return;
  }

  getLocalDb()
    .prepare("update tasks set is_active = 0, updated_at = ? where room_id = ?")
    .run(nowIso(), roomId);
}

export async function upsertRoom(params: {
  id?: string;
  name: string;
  description: string | null;
  sortOrder?: number | null;
  isActive: boolean;
}) {
  const sortOrder =
    params.sortOrder ??
    (params.id ? (await loadRoom(params.id)).sort_order : await nextRoomSortOrder());

  if (!Number.isInteger(sortOrder) || sortOrder < 1) {
    throw badRequest("Room order must be a positive number starting from 1");
  }

  if (!isLocalBackend()) {
    const supabase = getSupabaseForStore();
    const { data, error } = await supabase
      .from("rooms")
      .upsert({
        ...(params.id ? { id: params.id } : {}),
        name: params.name,
        description: params.description,
        sort_order: sortOrder,
        is_active: params.isActive,
      })
      .select("id")
      .single();
    if (error) throw error;

    if (!params.isActive) {
      await deactivateRoomTasks(data.id as string);
    }

    return data.id as string;
  }

  const id = params.id ?? randomUUID();
  getLocalDb()
    .prepare(
      `insert into rooms (id, name, description, sort_order, is_active, updated_at)
       values (?, ?, ?, ?, ?, ?)
       on conflict(id) do update set
         name = excluded.name,
         description = excluded.description,
         sort_order = excluded.sort_order,
         is_active = excluded.is_active,
         updated_at = excluded.updated_at`,
    )
    .run(id, params.name, params.description, sortOrder, params.isActive ? 1 : 0, nowIso());

  if (!params.isActive) {
    await deactivateRoomTasks(id);
  }

  return id;
}

export async function removeRoom(id: string) {
  await loadRoom(id);

  if (!isLocalBackend()) {
    const supabase = getSupabaseForStore();

    if (await roomHasHistory(id)) {
      const { error } = await supabase.from("rooms").update({ is_active: false }).eq("id", id);
      if (error) throw error;
      await deactivateRoomTasks(id);
      return "deactivated" as const;
    }

    const { error } = await supabase.from("rooms").delete().eq("id", id);
    if (error) throw error;
    return "deleted" as const;
  }

  if (await roomHasHistory(id)) {
    getLocalDb()
      .prepare("update rooms set is_active = 0, updated_at = ? where id = ?")
      .run(nowIso(), id);
    await deactivateRoomTasks(id);
    return "deactivated" as const;
  }

  getLocalDb().prepare("delete from rooms where id = ?").run(id);
  return "deleted" as const;
}

async function roomHasHistory(id: string) {
  if (!isLocalBackend()) {
    const supabase = getSupabaseForStore();
    const roomAcceptances = await supabase
      .from("room_acceptances")
      .select("id", { count: "exact", head: true })
      .eq("room_id", id);
    if (roomAcceptances.error) throw roomAcceptances.error;
    if ((roomAcceptances.count ?? 0) > 0) return true;

    const tasks = await supabase.from("tasks").select("id").eq("room_id", id);
    if (tasks.error) throw tasks.error;
    const taskIds = (tasks.data ?? []).map((task) => task.id as string);
    if (taskIds.length === 0) return false;

    const taskChecks = await supabase
      .from("task_checks")
      .select("id", { count: "exact", head: true })
      .in("task_id", taskIds);
    if (taskChecks.error) throw taskChecks.error;
    return (taskChecks.count ?? 0) > 0;
  }

  const db = getLocalDb();
  const roomCount = db
    .prepare("select count(*) as count from room_acceptances where room_id = ?")
    .get(id) as { count: number };
  if (roomCount.count > 0) return true;

  const taskCount = db
    .prepare(
      `select count(*) as count
       from task_checks
       where task_id in (select id from tasks where room_id = ?)`,
    )
    .get(id) as { count: number };
  return taskCount.count > 0;
}

export async function listTasks(options: { activeOnly?: boolean } = {}) {
  if (!isLocalBackend()) {
    return sbList<Task>((supabase) => {
      let query = supabase.from("tasks").select("*").order("sort_order", { ascending: true });
      if (options.activeOnly) query = query.eq("is_active", true);
      return query;
    });
  }

  const sql = options.activeOnly
    ? "select * from tasks where is_active = 1 order by sort_order asc, title asc"
    : "select * from tasks order by sort_order asc, title asc";
  return getLocalDb()
    .prepare(sql)
    .all()
    .map((row) => asTask(row as Record<string, unknown>));
}

async function loadTask(id: string) {
  if (!isLocalBackend()) {
    const supabase = getSupabaseForStore();
    const { data, error } = await supabase.from("tasks").select("*").eq("id", id).single();
    if (error) throw error;
    return data as Task;
  }

  const row = getLocalDb().prepare("select * from tasks where id = ?").get(id);
  if (!row) throw new Error("Task not found");
  return asTask(row as Record<string, unknown>);
}

async function nextTaskSortOrder(roomId: string) {
  const tasks = await listTasks();
  const maxSortOrder = tasks
    .filter((task) => task.room_id === roomId)
    .reduce((max, task) => Math.max(max, Number(task.sort_order) || 0), 0);
  return maxSortOrder + 10;
}

export async function upsertTask(params: {
  id?: string;
  roomId: string;
  title: string;
  description: string | null;
  sortOrder?: number | null;
  isActive: boolean;
}) {
  const existingTask = params.id ? await loadTask(params.id) : null;
  const sortOrder =
    params.sortOrder ??
    (existingTask && existingTask.room_id === params.roomId
      ? existingTask.sort_order
      : await nextTaskSortOrder(params.roomId));

  if (!Number.isInteger(sortOrder) || sortOrder < 1) {
    throw badRequest("Task order must be a positive number starting from 1");
  }

  if (!isLocalBackend()) {
    const supabase = getSupabaseForStore();
    const { data, error } = await supabase
      .from("tasks")
      .upsert({
        ...(params.id ? { id: params.id } : {}),
        room_id: params.roomId,
        title: params.title,
        description: params.description,
        sort_order: sortOrder,
        is_active: params.isActive,
      })
      .select("id")
      .single();
    if (error) throw error;
    return data.id as string;
  }

  const id = params.id ?? randomUUID();
  getLocalDb()
    .prepare(
      `insert into tasks (id, room_id, title, description, sort_order, is_active, updated_at)
       values (?, ?, ?, ?, ?, ?, ?)
       on conflict(id) do update set
         room_id = excluded.room_id,
         title = excluded.title,
         description = excluded.description,
         sort_order = excluded.sort_order,
         is_active = excluded.is_active,
         updated_at = excluded.updated_at`,
    )
    .run(
      id,
      params.roomId,
      params.title,
      params.description,
      sortOrder,
      params.isActive ? 1 : 0,
      nowIso(),
    );
  return id;
}

export async function removeTask(id: string) {
  await loadTask(id);

  if (!isLocalBackend()) {
    const supabase = getSupabaseForStore();

    if (await taskHasHistory(id)) {
      const { error } = await supabase.from("tasks").update({ is_active: false }).eq("id", id);
      if (error) throw error;
      return "deactivated" as const;
    }

    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) throw error;
    return "deleted" as const;
  }

  if (await taskHasHistory(id)) {
    getLocalDb()
      .prepare("update tasks set is_active = 0, updated_at = ? where id = ?")
      .run(nowIso(), id);
    return "deactivated" as const;
  }

  getLocalDb().prepare("delete from tasks where id = ?").run(id);
  return "deleted" as const;
}

async function taskHasHistory(id: string) {
  if (!isLocalBackend()) {
    const supabase = getSupabaseForStore();
    const checks = await supabase
      .from("task_checks")
      .select("id", { count: "exact", head: true })
      .eq("task_id", id);
    if (checks.error) throw checks.error;
    return (checks.count ?? 0) > 0;
  }

  const count = getLocalDb()
    .prepare("select count(*) as count from task_checks where task_id = ?")
    .get(id) as { count: number };
  return count.count > 0;
}

export async function loadDutyPeriod(id: string) {
  if (!isLocalBackend()) {
    const supabase = getSupabaseForStore();
    const { data, error } = await supabase.from("duty_periods").select("*").eq("id", id).single();
    if (error) throw error;
    return data as DutyPeriod;
  }

  const row = getLocalDb().prepare("select * from duty_periods where id = ?").get(id);
  if (!row) throw new Error("Duty period not found");
  return row as DutyPeriod;
}

export async function listDutiesForUser(userId: string) {
  if (!isLocalBackend()) {
    return sbList<DutyPeriod>((supabase) =>
      supabase
        .from("duty_periods")
        .select("*")
        .or(`assignee_id.eq.${userId},next_assignee_id.eq.${userId}`)
        .in("status", [
          "active",
          "cleaning_done",
          "handover_pending",
          "rejected",
          "ready_for_recheck",
          "scheduled",
        ])
        .order("week_start", { ascending: true })
        .limit(10),
    );
  }

  return getLocalDb()
    .prepare(
      `select * from duty_periods
       where (assignee_id = ? or next_assignee_id = ?)
         and status in ('active','cleaning_done','handover_pending','rejected','ready_for_recheck','scheduled')
       order by week_start asc
       limit 10`,
    )
    .all(userId, userId) as DutyPeriod[];
}

export async function listDuties(limit = 52, descending = true) {
  if (!isLocalBackend()) {
    return sbList<DutyPeriod>((supabase) =>
      supabase
        .from("duty_periods")
        .select("*")
        .order("week_start", { ascending: !descending })
        .limit(limit),
    );
  }

  return getLocalDb()
    .prepare(
      `select * from duty_periods order by week_start ${descending ? "desc" : "asc"} limit ?`,
    )
    .all(limit) as DutyPeriod[];
}

export async function findDutyByWeekStart(weekStart: string) {
  if (!isLocalBackend()) {
    const supabase = getSupabaseForStore();
    const { data, error } = await supabase
      .from("duty_periods")
      .select("*")
      .eq("week_start", weekStart)
      .neq("status", "cancelled")
      .maybeSingle();
    if (error) throw error;
    return data as DutyPeriod | null;
  }

  const row = getLocalDb()
    .prepare("select * from duty_periods where week_start = ? and status <> 'cancelled'")
    .get(weekStart);
  return (row as DutyPeriod | undefined) ?? null;
}

export async function updateDutyPeriod(id: string, patch: Partial<DutyPeriod>) {
  if (!isLocalBackend()) {
    const supabase = getSupabaseForStore();
    const { error } = await supabase.from("duty_periods").update(patch).eq("id", id);
    if (error) throw error;
    return;
  }

  const entries = Object.entries(patch).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return;
  const assignments = entries.map(([key]) => `${key} = ?`).join(", ");
  getLocalDb()
    .prepare(`update duty_periods set ${assignments}, updated_at = ? where id = ?`)
    .run(...entries.map(([, value]) => value), nowIso(), id);
}

export async function insertDutyPeriod(params: {
  assigneeId: string;
  nextAssigneeId: string | null;
  weekStart: string;
  weekEnd?: string;
  status: DutyPeriod["status"];
  createdBy: string | null;
}) {
  if (!isLocalBackend()) {
    const supabase = getSupabaseForStore();
    const { error } = await supabase.from("duty_periods").insert({
      assignee_id: params.assigneeId,
      next_assignee_id: params.nextAssigneeId,
      week_start: params.weekStart,
      week_end: params.weekEnd ?? weekEndFromStart(params.weekStart),
      status: params.status,
      created_by: params.createdBy,
    });
    if (error) throw error;
    return;
  }

  getLocalDb()
    .prepare(
      `insert into duty_periods
       (id, assignee_id, next_assignee_id, week_start, week_end, status, created_by, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      randomUUID(),
      params.assigneeId,
      params.nextAssigneeId,
      params.weekStart,
      params.weekEnd ?? weekEndFromStart(params.weekStart),
      params.status,
      params.createdBy,
      nowIso(),
    );
}

export async function deleteFutureScheduledDuties(startWeek: string) {
  if (!isLocalBackend()) {
    const supabase = getSupabaseForStore();
    const { error } = await supabase
      .from("duty_periods")
      .delete()
      .eq("status", "scheduled")
      .gte("week_start", startWeek);
    if (error) throw error;
    return;
  }

  getLocalDb()
    .prepare("delete from duty_periods where status = 'scheduled' and week_start >= ?")
    .run(startWeek);
}

export async function previousDutyBefore(startWeek: string) {
  if (!isLocalBackend()) {
    const supabase = getSupabaseForStore();
    const { data, error } = await supabase
      .from("duty_periods")
      .select("*")
      .lt("week_start", startWeek)
      .neq("status", "cancelled")
      .order("week_start", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data as DutyPeriod | null;
  }

  const row = getLocalDb()
    .prepare(
      "select * from duty_periods where week_start < ? and status <> 'cancelled' order by week_start desc limit 1",
    )
    .get(startWeek);
  return (row as DutyPeriod | undefined) ?? null;
}

export async function listTaskChecks(dutyPeriodId: string) {
  if (!isLocalBackend()) {
    return sbList<TaskCheck>((supabase) =>
      supabase.from("task_checks").select("*").eq("duty_period_id", dutyPeriodId),
    );
  }

  return getLocalDb()
    .prepare("select * from task_checks where duty_period_id = ?")
    .all(dutyPeriodId)
    .map((row) => asTaskCheck(row as Record<string, unknown>));
}

export async function upsertTaskCheck(params: {
  dutyPeriodId: string;
  taskId: string;
  checkedBy: string;
  isChecked: boolean;
}) {
  if (!isLocalBackend()) {
    const supabase = getSupabaseForStore();
    const { error } = await supabase.from("task_checks").upsert(
      {
        duty_period_id: params.dutyPeriodId,
        task_id: params.taskId,
        checked_by: params.checkedBy,
        is_checked: params.isChecked,
        checked_at: params.isChecked ? nowIso() : null,
      },
      { onConflict: "duty_period_id,task_id" },
    );
    if (error) throw error;
    return;
  }

  getLocalDb()
    .prepare(
      `insert into task_checks
       (id, duty_period_id, task_id, checked_by, is_checked, checked_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?)
       on conflict(duty_period_id, task_id) do update set
         checked_by = excluded.checked_by,
         is_checked = excluded.is_checked,
         checked_at = excluded.checked_at,
         updated_at = excluded.updated_at`,
    )
    .run(
      randomUUID(),
      params.dutyPeriodId,
      params.taskId,
      params.checkedBy,
      params.isChecked ? 1 : 0,
      params.isChecked ? nowIso() : null,
      nowIso(),
    );
}

export async function listRoomAcceptances(dutyPeriodId: string) {
  if (!isLocalBackend()) {
    return sbList<RoomAcceptance>((supabase) =>
      supabase.from("room_acceptances").select("*").eq("duty_period_id", dutyPeriodId),
    );
  }

  return getLocalDb()
    .prepare("select * from room_acceptances where duty_period_id = ?")
    .all(dutyPeriodId) as RoomAcceptance[];
}

export async function upsertRoomAcceptance(params: {
  dutyPeriodId: string;
  roomId: string;
  acceptedBy: string;
  status: RoomAcceptanceStatus;
  comment: string | null;
}) {
  if (!isLocalBackend()) {
    const supabase = getSupabaseForStore();
    const { error } = await supabase.from("room_acceptances").upsert(
      {
        duty_period_id: params.dutyPeriodId,
        room_id: params.roomId,
        accepted_by: params.acceptedBy,
        status: params.status,
        checked_at: params.status === "pending" ? null : nowIso(),
        comment: params.comment,
      },
      { onConflict: "duty_period_id,room_id" },
    );
    if (error) throw error;
    return;
  }

  getLocalDb()
    .prepare(
      `insert into room_acceptances
       (id, duty_period_id, room_id, accepted_by, status, comment, checked_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?)
       on conflict(duty_period_id, room_id) do update set
         accepted_by = excluded.accepted_by,
         status = excluded.status,
         comment = excluded.comment,
         checked_at = excluded.checked_at,
         updated_at = excluded.updated_at`,
    )
    .run(
      randomUUID(),
      params.dutyPeriodId,
      params.roomId,
      params.acceptedBy,
      params.status,
      params.comment,
      params.status === "pending" ? null : nowIso(),
      nowIso(),
    );
}

export async function loadActiveTask(id: string) {
  const task = (await listTasks({ activeOnly: true })).find((item) => item.id === id);
  if (!task) throw new Error("Task not found");
  return task;
}

export async function loadActiveRoom(id: string) {
  const room = (await listRooms({ activeOnly: true })).find((item) => item.id === id);
  if (!room) throw new Error("Room not found");
  return room;
}

export async function assertAllActiveTasksChecked(dutyPeriodId: string) {
  const tasks = await listTasks({ activeOnly: true });
  const checks = await listTaskChecks(dutyPeriodId);
  const checked = new Set(checks.filter((check) => check.is_checked).map((check) => check.task_id));
  const missing = tasks.filter((task) => !checked.has(task.id));
  if (missing.length > 0) throw new Error("All active tasks must be checked");
}

export async function assertAllActiveRoomsAccepted(dutyPeriodId: string) {
  const rooms = await listRooms({ activeOnly: true });
  const acceptances = await listRoomAcceptances(dutyPeriodId);
  const accepted = new Set(
    acceptances
      .filter((acceptance) => acceptance.status === "accepted")
      .map((acceptance) => acceptance.room_id),
  );
  const missing = rooms.filter((room) => !accepted.has(room.id));
  if (missing.length > 0) throw new Error("All active rooms must be accepted");
}

export async function listFailedNotifications() {
  if (!isLocalBackend()) {
    return sbList<Notification>((supabase) =>
      supabase
        .from("notifications")
        .select("*")
        .eq("status", "failed")
        .order("created_at", { ascending: false }),
    );
  }

  return getLocalDb()
    .prepare("select * from notifications where status = 'failed' order by created_at desc")
    .all() as Notification[];
}

export async function loadNotification(id: string) {
  if (!isLocalBackend()) {
    const supabase = getSupabaseForStore();
    const { data, error } = await supabase.from("notifications").select("*").eq("id", id).single();
    if (error) throw error;
    return data as Notification;
  }

  const row = getLocalDb().prepare("select * from notifications where id = ?").get(id);
  if (!row) throw new Error("Notification not found");
  return row as Notification;
}

export async function createNotificationIfMissing(params: {
  dutyPeriodId: string | null;
  recipientId: string;
  type: NotificationType;
  scheduledFor: Date;
}) {
  if (!isLocalBackend()) {
    const supabase = getSupabaseForStore();
    const { data, error } = await supabase
      .from("notifications")
      .insert({
        duty_period_id: params.dutyPeriodId,
        recipient_id: params.recipientId,
        type: params.type,
        status: "pending",
        scheduled_for: params.scheduledFor.toISOString(),
      })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") return { created: false, id: null };
      throw error;
    }
    return { created: true, id: data.id as string };
  }

  const id = randomUUID();
  try {
    getLocalDb()
      .prepare(
        `insert into notifications
         (id, duty_period_id, recipient_id, type, status, scheduled_for, updated_at)
         values (?, ?, ?, ?, 'pending', ?, ?)`,
      )
      .run(id, params.dutyPeriodId, params.recipientId, params.type, params.scheduledFor.toISOString(), nowIso());
    return { created: true, id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("UNIQUE")) return { created: false, id: null };
    throw error;
  }
}

export async function markNotificationSent(notificationId: string) {
  const now = nowIso();
  if (!isLocalBackend()) {
    const supabase = getSupabaseForStore();
    const { error } = await supabase
      .from("notifications")
      .update({
        status: "sent",
        sent_at: now,
        last_attempt_at: now,
        attempt_count: 1,
        error_message: null,
      })
      .eq("id", notificationId);
    if (error) throw error;
    return;
  }

  getLocalDb()
    .prepare(
      `update notifications
       set status = 'sent', sent_at = ?, last_attempt_at = ?, attempt_count = attempt_count + 1,
           error_message = null, updated_at = ?
       where id = ?`,
    )
    .run(now, now, now, notificationId);
}

export async function markNotificationFailed(notificationId: string, cause: unknown) {
  const message = cause instanceof Error ? cause.message : "Unknown email error";
  if (!isLocalBackend()) {
    const supabase = getSupabaseForStore();
    const { data } = await supabase
      .from("notifications")
      .select("attempt_count")
      .eq("id", notificationId)
      .single();
    const { error } = await supabase
      .from("notifications")
      .update({
        status: "failed",
        last_attempt_at: nowIso(),
        attempt_count: Number(data?.attempt_count ?? 0) + 1,
        error_message: message,
      })
      .eq("id", notificationId);
    if (error) throw error;
    return;
  }

  getLocalDb()
    .prepare(
      `update notifications
       set status = 'failed', last_attempt_at = ?, attempt_count = attempt_count + 1,
           error_message = ?, updated_at = ?
       where id = ?`,
    )
    .run(nowIso(), message, nowIso(), notificationId);
}

export async function writeAuditLog(params: {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  payload?: Json;
}) {
  if (!isLocalBackend()) {
    const supabase = getSupabaseForStore();
    const { error } = await supabase.from("audit_log").insert({
      actor_id: params.actorId,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      payload: params.payload ?? null,
    });
    if (error) throw error;
    return;
  }

  getLocalDb()
    .prepare(
      `insert into audit_log
       (id, actor_id, action, entity_type, entity_id, payload)
       values (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      randomUUID(),
      params.actorId,
      params.action,
      params.entityType,
      params.entityId ?? null,
      jsonPayload(params.payload),
    );
}

export async function getAppSettings() {
  if (!isLocalBackend()) {
    const supabase = getSupabaseForStore();
    const { data, error } = await supabase.from("app_settings").select("*").eq("id", true).single();
    if (error) throw error;
    return data as AppSettings;
  }

  const row = getLocalDb().prepare("select * from app_settings where id = 1").get();
  if (!row) throw new Error("App settings not found");
  return asSettings(row as Record<string, unknown>);
}

export function getLocalAppSettingsDirect() {
  const row = getLocalDb().prepare("select * from app_settings where id = 1").get();
  if (!row) throw new Error("Local app settings not found");
  return asSettings(row as Record<string, unknown>);
}

export async function updateAppSettings(params: {
  timezone: string;
  saturdayReminderHour: number;
  sundayReminderHour: number;
  reminderWindowHours: number;
  futureScheduleWeeks: number;
}) {
  if (!isLocalBackend()) {
    const supabase = getSupabaseForStore();
    const { error } = await supabase
      .from("app_settings")
      .update({
        timezone: params.timezone,
        saturday_reminder_hour: params.saturdayReminderHour,
        sunday_reminder_hour: params.sundayReminderHour,
        reminder_window_hours: params.reminderWindowHours,
        future_schedule_weeks: params.futureScheduleWeeks,
      })
      .eq("id", true);
    if (error) throw error;
    return;
  }

  getLocalDb()
    .prepare(
      `update app_settings
       set timezone = ?, saturday_reminder_hour = ?, sunday_reminder_hour = ?,
           reminder_window_hours = ?, future_schedule_weeks = ?, updated_at = ?
       where id = 1`,
    )
    .run(
      params.timezone,
      params.saturdayReminderHour,
      params.sundayReminderHour,
      params.reminderWindowHours,
      params.futureScheduleWeeks,
      nowIso(),
    );
}

export function updateLocalAppSettingsDirect(params: {
  timezone: string;
  saturdayReminderHour: number;
  sundayReminderHour: number;
  reminderWindowHours: number;
  futureScheduleWeeks: number;
}) {
  getLocalDb()
    .prepare(
      `update app_settings
       set timezone = ?, saturday_reminder_hour = ?, sunday_reminder_hour = ?,
           reminder_window_hours = ?, future_schedule_weeks = ?, updated_at = ?
       where id = 1`,
    )
    .run(
      params.timezone,
      params.saturdayReminderHour,
      params.sundayReminderHour,
      params.reminderWindowHours,
      params.futureScheduleWeeks,
      nowIso(),
    );
}

export function writeLocalAuditLogDirect(params: {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  payload?: Json;
}) {
  getLocalDb()
    .prepare(
      `insert into audit_log
       (id, actor_id, action, entity_type, entity_id, payload)
       values (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      randomUUID(),
      params.actorId,
      params.action,
      params.entityType,
      params.entityId ?? null,
      jsonPayload(params.payload),
    );
}
