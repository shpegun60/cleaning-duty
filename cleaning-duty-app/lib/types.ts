export type UserRole = "admin" | "worker";

export type DutyStatus =
  | "scheduled"
  | "active"
  | "cleaning_done"
  | "handover_pending"
  | "accepted"
  | "rejected"
  | "ready_for_recheck"
  | "force_closed"
  | "cancelled";

export type NotificationType =
  | "saturday_cleaning_reminder"
  | "sunday_handover_reminder"
  | "handover_rejected"
  | "handover_accepted"
  | "recheck_requested"
  | "admin_changed_assignee"
  | "user_invited";

export type NotificationStatus = "pending" | "sent" | "failed" | "skipped";

export type RoomAcceptanceStatus = "pending" | "accepted" | "rejected";

export type RotationPeriodUnit = "day" | "week" | "month";

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  rotation_order: number | null;
  is_active: boolean;
  login_password?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type Room = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
};

export type Task = {
  id: string;
  room_id: string;
  title: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
};

export type DutyPeriod = {
  id: string;
  assignee_id: string;
  next_assignee_id: string | null;
  week_start: string;
  week_end: string;
  status: DutyStatus;
  cleaned_at: string | null;
  handover_started_at: string | null;
  accepted_at: string | null;
  accepted_by: string | null;
  rejected_at: string | null;
  rejected_by: string | null;
  reject_comment: string | null;
  created_by: string | null;
};

export type AssigneeChange = {
  id: string;
  duty_period_id: string;
  previous_assignee_id: string;
  new_assignee_id: string;
  previous_next_assignee_id: string | null;
  new_next_assignee_id: string | null;
  reason: string;
  created_by: string;
  reverted_at: string | null;
  reverted_by: string | null;
  created_at: string;
};

export type TaskCheck = {
  id: string;
  duty_period_id: string;
  task_id: string;
  checked_by: string;
  is_checked: boolean;
  checked_at: string | null;
};

export type RoomAcceptance = {
  id: string;
  duty_period_id: string;
  room_id: string;
  accepted_by: string;
  status: RoomAcceptanceStatus;
  comment: string | null;
  checked_at: string | null;
};

export type Notification = {
  id: string;
  duty_period_id: string | null;
  recipient_id: string;
  type: NotificationType;
  status: NotificationStatus;
  scheduled_for: string;
  sent_at: string | null;
  last_attempt_at: string | null;
  attempt_count: number;
  error_message: string | null;
};

export type SharedFile = {
  id: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
  uploaded_by: string | null;
  created_at: string;
};

export type AppSettings = {
  id: true;
  timezone: string;
  saturday_reminder_hour: number;
  sunday_reminder_hour: number;
  reminder_window_hours: number;
  future_schedule_weeks: number;
  rotation_period_unit: RotationPeriodUnit;
  rotation_period_count: number;
};
