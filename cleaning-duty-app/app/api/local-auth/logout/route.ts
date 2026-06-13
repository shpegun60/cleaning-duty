import { NextResponse } from "next/server";

import { clearLocalSession } from "@/lib/local/auth";

export async function POST() {
  await clearLocalSession();
  return NextResponse.json({ ok: true });
}
