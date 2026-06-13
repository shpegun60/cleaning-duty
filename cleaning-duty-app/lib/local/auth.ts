import { cookies } from "next/headers";

import { readRuntimeConfig } from "@/lib/config/runtime";

export const LOCAL_SESSION_COOKIE = "cleaning-duty-local-session";

export async function hasLocalSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(LOCAL_SESSION_COOKIE)?.value;
  const config = readRuntimeConfig();
  return Boolean(token && token === config.localAuthToken);
}

export async function setLocalSession() {
  const cookieStore = await cookies();
  const config = readRuntimeConfig();
  cookieStore.set(LOCAL_SESSION_COOKIE, config.localAuthToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearLocalSession() {
  const cookieStore = await cookies();
  cookieStore.delete(LOCAL_SESSION_COOKIE);
}
