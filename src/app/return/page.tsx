import { connection } from "next/server";
import { redirect } from "next/navigation";
import { ownerContext, ownedPublicId } from "../../services/auth/server";
export default async function ReturnToAtom() {
  await connection();
  const context = await ownerContext();
  if (context.atom?.status === "DEACTIVATED") redirect("/account/reactivate");
  redirect(
    ownedPublicId(context) ? "/explore" : "/auth?mode=access&next=%2Fexplore",
  );
}
