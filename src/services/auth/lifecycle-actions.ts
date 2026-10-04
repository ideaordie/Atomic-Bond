"use server";
import { cookies, headers } from "next/headers";
import { ownerContext } from "./server";
import { appOrigin } from "./policy";

export async function changeAccountLifecycle(
  action: "deactivate" | "reactivate",
) {
  try {
    if ((await headers()).get("origin") !== appOrigin(process.env))
      throw new Error();
    if (action !== "deactivate" && action !== "reactivate") throw new Error();
    const { client, user } = await ownerContext();
    if (!user?.email_confirmed_at) throw new Error();
    const { data, error } = await client.rpc(
      action === "deactivate"
        ? "deactivate_my_account"
        : "reactivate_my_account",
    );
    if (error) throw new Error();
    if (data?.state === "delivery_in_progress")
      return {
        error:
          "An email is being processed. Nothing has changed. Please retry in a few minutes.",
      };
    if (action === "deactivate") {
      if (data?.state !== "deactivated") throw new Error();
      // The database epoch already denies old sessions even if Auth is unavailable.
      try {
        await client.auth.signOut({ scope: "global" });
      } catch {
        /* Clear local access below. */
      }
      const jar = await cookies();
      for (const c of jar.getAll())
        if (c.name.startsWith("sb-") && c.name.includes("auth-token"))
          jar.delete(c.name);
      return { next: "/account/deactivated" };
    }
    if (data?.state !== "active") throw new Error();
    return { next: "/explore" };
  } catch {
    return {
      error:
        "Unable to complete this action. Securely access your account again before retrying.",
    };
  }
}
