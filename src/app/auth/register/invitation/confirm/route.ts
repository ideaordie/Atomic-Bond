import { NextResponse } from "next/server";
import { confirmRegistrationInvitation } from "../../../../../services/auth/registration-actions";

/** Clear the receipt in this response, without Server Action page revalidation. */
export async function POST() {
  try {
    const result = await confirmRegistrationInvitation();
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to confirm. Sign in again and retry." },
      { status: 400, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
