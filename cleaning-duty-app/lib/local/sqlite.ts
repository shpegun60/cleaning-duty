import { mkdirSync } from "fs";
import { join } from "path";
import { DatabaseSync } from "node:sqlite";

import { getDataDir } from "@/lib/config/runtime";

let database: DatabaseSync | null = null;

function booleanToInt(value: boolean) {
  return value ? 1 : 0;
}

export function toBoolean(value: unknown) {
  return value === 1 || value === true;
}

export function nowIso() {
  return new Date().toISOString();
}

export function getLocalDb() {
  if (database) {
    return database;
  }

  const dataDir = getDataDir();
  mkdirSync(dataDir, { recursive: true });
  database = new DatabaseSync(join(dataDir, "cleaning-duty.sqlite"));
  database.exec("PRAGMA foreign_keys = ON;");
  initializeLocalDb(database);
  return database;
}

function initializeLocalDb(db: DatabaseSync) {
  db.exec(`
    create table if not exists profiles (
      id text primary key,
      email text not null unique,
      full_name text not null,
      role text not null default 'worker',
      rotation_order integer,
      is_active integer not null default 1,
      created_at text not null default current_timestamp,
      updated_at text not null default current_timestamp
    );

    create table if not exists rooms (
      id text primary key,
      name text not null,
      description text,
      sort_order integer not null default 0,
      is_active integer not null default 1,
      created_at text not null default current_timestamp,
      updated_at text not null default current_timestamp
    );

    create table if not exists tasks (
      id text primary key,
      room_id text not null references rooms(id) on delete cascade,
      title text not null,
      description text,
      sort_order integer not null default 0,
      is_active integer not null default 1,
      created_at text not null default current_timestamp,
      updated_at text not null default current_timestamp
    );

    create table if not exists duty_periods (
      id text primary key,
      assignee_id text not null references profiles(id),
      next_assignee_id text references profiles(id),
      week_start text not null,
      week_end text not null,
      status text not null default 'scheduled',
      cleaned_at text,
      handover_started_at text,
      accepted_at text,
      accepted_by text references profiles(id),
      rejected_at text,
      rejected_by text references profiles(id),
      reject_comment text,
      created_by text references profiles(id),
      created_at text not null default current_timestamp,
      updated_at text not null default current_timestamp
    );

    create unique index if not exists uq_local_duty_week_start_not_cancelled
    on duty_periods(week_start)
    where status <> 'cancelled';

    create table if not exists task_checks (
      id text primary key,
      duty_period_id text not null references duty_periods(id) on delete cascade,
      task_id text not null references tasks(id),
      checked_by text not null references profiles(id),
      is_checked integer not null default 0,
      checked_at text,
      created_at text not null default current_timestamp,
      updated_at text not null default current_timestamp,
      unique (duty_period_id, task_id)
    );

    create table if not exists room_acceptances (
      id text primary key,
      duty_period_id text not null references duty_periods(id) on delete cascade,
      room_id text not null references rooms(id),
      accepted_by text not null references profiles(id),
      status text not null default 'pending',
      comment text,
      checked_at text,
      created_at text not null default current_timestamp,
      updated_at text not null default current_timestamp,
      unique (duty_period_id, room_id)
    );

    create table if not exists notifications (
      id text primary key,
      duty_period_id text references duty_periods(id) on delete cascade,
      recipient_id text not null references profiles(id),
      type text not null,
      status text not null default 'pending',
      scheduled_for text not null,
      sent_at text,
      last_attempt_at text,
      attempt_count integer not null default 0,
      error_message text,
      created_at text not null default current_timestamp,
      updated_at text not null default current_timestamp,
      unique (duty_period_id, recipient_id, type)
    );

    create table if not exists audit_log (
      id text primary key,
      actor_id text references profiles(id),
      action text not null,
      entity_type text not null,
      entity_id text,
      payload text,
      created_at text not null default current_timestamp
    );

    create table if not exists app_settings (
      id integer primary key check (id = 1),
      timezone text not null default 'Europe/Warsaw',
      saturday_reminder_hour integer not null default 8,
      sunday_reminder_hour integer not null default 8,
      reminder_window_hours integer not null default 2,
      future_schedule_weeks integer not null default 12,
      created_at text not null default current_timestamp,
      updated_at text not null default current_timestamp
    );
  `);

  db.prepare(
    `insert or ignore into profiles
      (id, email, full_name, role, rotation_order, is_active)
     values (?, ?, ?, ?, ?, ?)`,
  ).run("local-admin", "admin@local", "Local Admin", "admin", null, booleanToInt(true));

  db.prepare("update profiles set rotation_order = null where role <> 'worker'").run();
  db.prepare("update profiles set rotation_order = null where rotation_order is not null and rotation_order < 1").run();

  const orderedWorkers = db
    .prepare(
      `select id, rotation_order
       from profiles
       where role = 'worker' and is_active = 1 and rotation_order is not null
       order by rotation_order asc, created_at asc, full_name asc`,
    )
    .all() as Array<{ id: string; rotation_order: number }>;
  const usedOrders = new Set<number>();
  for (const worker of orderedWorkers) {
    if (usedOrders.has(worker.rotation_order)) {
      db.prepare("update profiles set rotation_order = null where id = ?").run(worker.id);
    } else {
      usedOrders.add(worker.rotation_order);
    }
  }

  db.prepare(
    `insert or ignore into app_settings
      (id, timezone, saturday_reminder_hour, sunday_reminder_hour, reminder_window_hours, future_schedule_weeks)
     values (1, 'Europe/Warsaw', 8, 8, 2, 12)`,
  ).run();

  const seeded = db.prepare("select count(*) as count from rooms").get() as { count: number };
  if (seeded.count === 0) {
    db.prepare(
      "insert into rooms (id, name, description, sort_order, is_active) values (?, ?, ?, ?, ?)",
    ).run("room-kitchen", "Кухня", "Поверхні, підлога, сміття", 10, 1);
    db.prepare(
      "insert into rooms (id, name, description, sort_order, is_active) values (?, ?, ?, ?, ?)",
    ).run("room-bathroom", "Ванна", "Сантехніка, дзеркало, підлога", 20, 1);
    db.prepare(
      "insert into rooms (id, name, description, sort_order, is_active) values (?, ?, ?, ?, ?)",
    ).run("room-hall", "Коридор", "Підлога і спільні поверхні", 30, 1);
  }
}

export function mapBooleanFields<T extends Record<string, unknown>>(
  row: T,
  fields: string[],
) {
  const copy = { ...row };
  for (const field of fields) {
    copy[field as keyof T] = toBoolean(copy[field as keyof T]) as T[keyof T];
  }
  return copy;
}
