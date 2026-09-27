import { redirect } from "next/navigation";
import { connection } from "next/server";
import { ownerContext, ownedPublicId } from "../../services/auth/server";
import { OwnerSettings } from "../../components/auth/OwnerSettings";
export default async function OwnerPage() {
  await connection();
  const context = await ownerContext();
  const { atom, services } = context;
  if (!ownedPublicId(context)) redirect("/auth");
  return (
    <main>
      <OwnerSettings
        publicId={atom!.publicId!}
        alias={atom!.alias}
        xHandle={atom!.xHandle}
        preferences={await services.preferences.get()}
      />
    </main>
  );
}
