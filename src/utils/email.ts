import { validEmail } from "../services/participation/contracts";
/** Identity policy: trim surrounding ASCII whitespace and case-fold; retain dots/plus tags. */
export function normalizeEmail(input: string): string {
  const normalized = input
    .replace(/^[\t\n\r ]+|[\t\n\r ]+$/g, "")
    .toLowerCase();
  if (!validEmail(normalized)) throw new Error("Invalid email address");
  return normalized;
}
