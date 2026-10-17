import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

/** Server-only imports: never import this module into a client component. */
type Receipt = {
  purpose: "request" | "verification" | "session";
  email: string;
  invitation: string;
  deadline: number;
  expires: number;
  nonce: string;
  user?: string;
  attempt?: string;
  session?: string;
};
const aad = Buffer.from("atomic-bond:new-registration-invitation:v1");
function key() {
  const value = process.env.AUTH_CONTINUATION_KEY || "";
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new Error("Receipt unavailable");
  return Buffer.from(value, "hex");
}
function seal(value: Receipt) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(aad);
  const body = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}
export function readReceipt(
  value: unknown,
  purpose: Receipt["purpose"],
  now = Date.now(),
): Receipt | null {
  try {
    if (typeof value !== "string" || !/^[\w-]{80,3500}$/.test(value))
      return null;
    const bytes = Buffer.from(value, "base64url");
    const cipher = createDecipheriv(
      "aes-256-gcm",
      key(),
      bytes.subarray(0, 12),
    );
    cipher.setAAD(aad);
    cipher.setAuthTag(bytes.subarray(12, 28));
    const receipt = JSON.parse(
      Buffer.concat([
        cipher.update(bytes.subarray(28)),
        cipher.final(),
      ]).toString("utf8"),
    ) as Receipt;
    if (
      receipt.purpose !== purpose ||
      !/^[a-f0-9]{64}$/.test(receipt.invitation) ||
      !Number.isFinite(receipt.expires) ||
      receipt.expires <= now ||
      !Number.isFinite(receipt.deadline) ||
      receipt.expires > receipt.deadline ||
      typeof receipt.email !== "string" ||
      !/^[a-f0-9]{32}$/.test(receipt.nonce)
    )
      return null;
    return receipt;
  } catch {
    return null;
  }
}
export function requestReceipt(
  email: string,
  invitation: string,
  deadline: number,
  now = Date.now(),
) {
  try {
    if (deadline <= now || !/^[a-f0-9]{64}$/.test(invitation)) return null;
    return seal({
      purpose: "request",
      email,
      invitation,
      deadline,
      expires: Math.min(deadline, now + 3600000),
      nonce: randomBytes(16).toString("hex"),
    });
  } catch {
    return null;
  }
}
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export function verificationReceipt(
  value: unknown,
  email: string,
  user: string,
  token: string,
  now = Date.now(),
) {
  const receipt = readReceipt(value, "request", now);
  if (!receipt || receipt.email !== email.trim().toLowerCase() || !user)
    return null;
  try {
    return seal({
      ...receipt,
      purpose: "verification",
      user,
      attempt: digest(token),
    });
  } catch {
    return null;
  }
}
export function sessionReceipt(
  value: unknown,
  email: string,
  user: string,
  token: string,
  session: string,
  now = Date.now(),
) {
  const receipt = readReceipt(value, "verification", now);
  if (
    !receipt ||
    receipt.email !== email.trim().toLowerCase() ||
    receipt.user !== user ||
    receipt.attempt !== digest(token) ||
    !session
  )
    return null;
  try {
    delete receipt.attempt;
    return seal({
      ...receipt,
      purpose: "session",
      session,
      expires: receipt.deadline,
    });
  } catch {
    return null;
  }
}
