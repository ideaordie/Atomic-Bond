import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

type RequestIntent = {
  email: string;
  next: string;
  nonce: string;
  exp: number;
};
export type BoundIntent = RequestIntent & { userId: string; token: string };
const MAX_AGE = 3600000;
const normalize = (email: string) => email.trim().toLowerCase();
function key() {
  const value = process.env.AUTH_CONTINUATION_KEY;
  if (!value || !/^[a-f0-9]{64}$/.test(value))
    throw new Error("Continuation unavailable");
  return Buffer.from(value, "hex");
}
/** Fail the candidate build before promotion, and verify each production cold start. */
export function verifyProductionContinuationConfiguration() {
  if (process.env.VERCEL_ENV !== "production") return false;
  key();
  return true;
}
if (verifyProductionContinuationConfiguration())
  console.info("Invitation continuation configuration validated.");

function seal(purpose: string, data: unknown) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(`atomic-bond/continuation/v1/${purpose}`));
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(data), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
    "base64url",
  );
}
function decrypt(purpose: string, value: string) {
  if (!/^[A-Za-z0-9_-]{60,3000}$/.test(value))
    throw new Error("Invalid continuation");
  const bytes = Buffer.from(value, "base64url");
  if (bytes.toString("base64url") !== value)
    throw new Error("Invalid continuation");
  const cipher = createDecipheriv("aes-256-gcm", key(), bytes.subarray(0, 12));
  cipher.setAAD(Buffer.from(`atomic-bond/continuation/v1/${purpose}`));
  cipher.setAuthTag(bytes.subarray(12, 28));
  const data = JSON.parse(
    Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString(
      "utf8",
    ),
  );
  return data;
}
function open(purpose: string, value: string, now: number): BoundIntent {
  const data = decrypt(purpose, value);
  if (
    !Number.isSafeInteger(data.exp) ||
    data.exp <= now ||
    data.exp > now + MAX_AGE ||
    typeof data.email !== "string" ||
    !/^[a-f0-9]{32}$/.test(data.nonce) ||
    !/^\/bond\/[a-f0-9]{64}$/.test(data.next)
  )
    throw new Error("Expired continuation");
  return data;
}
export function invitationIntent(
  email: string,
  next: string,
  expiresAt: string,
  now = Date.now(),
) {
  const exp = Math.min(Date.parse(expiresAt), now + MAX_AGE);
  if (
    !Number.isSafeInteger(exp) ||
    exp <= now ||
    !/^\/bond\/[a-f0-9]{64}$/.test(next)
  )
    throw new Error("Invalid invitation");
  return seal("request", {
    email: normalize(email),
    next,
    exp,
    nonce: randomBytes(16).toString("hex"),
  });
}
/** Called only after verification of the provider's signed email hook. */
export function bindInvitation(
  intent: string,
  email: string,
  userId: string,
  token: string,
  now = Date.now(),
) {
  const data = open("request", intent, now);
  if (
    data.email !== normalize(email) ||
    !/^[a-f0-9-]{36}$/i.test(userId) ||
    !/^(?:pkce_)?[a-fA-F0-9]{32,128}$/.test(token)
  )
    throw new Error("Invalid binding");
  return seal("email", { ...data, userId, token });
}
export function readInvitation(value: string, now = Date.now()) {
  const data = open("email", value, now);
  if (
    !/^[a-f0-9-]{36}$/i.test(data.userId) ||
    !/^(?:pkce_)?[a-fA-F0-9]{32,128}$/.test(data.token)
  )
    throw new Error("Invalid binding");
  return data;
}
export function continuationId(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}
export function matchesContinuation(
  data: BoundIntent,
  user: { id: string; email?: string },
) {
  return data.userId === user.id && data.email === normalize(user.email || "");
}

/** Independently staged authentication; invitation context is optional. */
export function sealAccess(
  token: string,
  next: string,
  continuation: string,
  now = Date.now(),
) {
  if (
    !/^(?:pkce_)?[a-fA-F0-9]{32,128}$/.test(token) ||
    continuation.length > 3000
  )
    throw new Error("Invalid access link");
  return seal("access", {
    token,
    next: next === "/account/delete" ? next : "/explore",
    continuation,
    exp: now + MAX_AGE,
    nonce: randomBytes(16).toString("hex"),
  });
}
export function readAccess(
  value: string,
  now = Date.now(),
): { token: string; next: string; continuation: string; exp: number } {
  const data = decrypt("access", value);
  if (
    !Number.isSafeInteger(data.exp) ||
    data.exp <= now ||
    data.exp > now + MAX_AGE ||
    !/^(?:pkce_)?[a-fA-F0-9]{32,128}$/.test(data.token) ||
    !["/explore", "/account/delete"].includes(data.next) ||
    typeof data.continuation !== "string" ||
    data.continuation.length > 3000
  )
    throw new Error("Invalid access link");
  return data;
}
