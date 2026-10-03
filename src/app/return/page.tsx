import { connection } from "next/server";
import { redirect } from "next/navigation";
import { ownerContext, ownedPublicId } from "../../services/auth/server";
export default async function ReturnToAtom() {
  await connection();
  redirect(
    ownedPublicId(await ownerContext())
      ? "/explore"
      : "/auth?mode=access&next=%2Fexplore",
  );
}
