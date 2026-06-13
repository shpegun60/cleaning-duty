import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const SCRYPT_KEY_LENGTH = 64;

export function generateTemporaryPassword(length = 14) {
  const bytes = randomBytes(length);
  let password = "";

  for (const byte of bytes) {
    password += PASSWORD_CHARS[byte % PASSWORD_CHARS.length];
  }

  return password;
}

export function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, SCRYPT_KEY_LENGTH);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export function verifyPassword(password: string, storedHash: string | null | undefined) {
  if (!storedHash) return false;

  const [algorithm, saltValue, hashValue] = storedHash.split("$");
  if (algorithm !== "scrypt" || !saltValue || !hashValue) return false;

  const salt = Buffer.from(saltValue, "base64url");
  const expectedHash = Buffer.from(hashValue, "base64url");
  const actualHash = scryptSync(password, salt, expectedHash.length);

  return (
    actualHash.length === expectedHash.length &&
    timingSafeEqual(actualHash, expectedHash)
  );
}
