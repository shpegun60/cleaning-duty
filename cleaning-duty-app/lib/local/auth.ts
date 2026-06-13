import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

import { readRuntimeConfig } from "@/lib/config/runtime";

export const LOCAL_SESSION_COOKIE = "cleaning-duty-local-session";

export async function getLocalSessionUserId() {
  const cookieStore = await cookies();
  const token = cookieStore.get(LOCAL_SESSION_COOKIE)?.value;
  const config = readRuntimeConfig();

  if (!token) return null;
  if (token === config.localAuthToken) return "local-admin";

  const [version, encodedUserId, signature] = token.split(".");
  if (version !== "v1" || !encodedUserId || !signature) return null;

  const userId = Buffer.from(encodedUserId, "base64url").toString("utf8");
  const expectedSignature = signLocalSession(userId, config.localAuthToken);

  if (!safeEqual(signature, expectedSignature)) return null;

  return userId;
}

export async function hasLocalSession() {
  return Boolean(await getLocalSessionUserId());
}

export async function hasLocalAdminSession() {
  return (await getLocalSessionUserId()) === "local-admin";
}

export async function setLocalSession(userId = "local-admin") {
  const cookieStore = await cookies();
  const config = readRuntimeConfig();
  const encodedUserId = Buffer.from(userId, "utf8").toString("base64url");
  const value = `v1.${encodedUserId}.${signLocalSession(userId, config.localAuthToken)}`;

  cookieStore.set(LOCAL_SESSION_COOKIE, value, {
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

function signLocalSession(userId: string, secret: string) {
  return createHmac("sha256", secret)
    .update(userId)
    .digest("base64url");
}

function safeEqual(value: string, expected: string) {
  const valueBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);

  return (
    valueBuffer.length === expectedBuffer.length &&
    timingSafeEqual(valueBuffer, expectedBuffer)
  );
}
