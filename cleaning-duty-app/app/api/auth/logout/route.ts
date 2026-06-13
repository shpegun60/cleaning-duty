import { NextResponse } from "next/server";

import { clearAllSessions } from "@/lib/auth/logout";

export async function POST() {
  await clearAllSessions();
  return NextResponse.json({ ok: true });
}
