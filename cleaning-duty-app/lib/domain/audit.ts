import type { SupabaseClient } from "@supabase/supabase-js";

export async function writeAuditLog(
  supabase: SupabaseClient,
  params: {
    actorId: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    payload?: unknown;
  },
) {
  const { error } = await supabase.from("audit_log").insert({
    actor_id: params.actorId,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId ?? null,
    payload: params.payload ?? null,
  });

  if (error) {
    throw error;
  }
}
