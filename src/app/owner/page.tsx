import { redirect } from "next/navigation";
import { connection } from "next/server";
import { ownerContext } from "../../services/auth/server";
import { OwnerSettings } from "../../components/auth/OwnerSettings";
export default async function OwnerPage() {
  await connection();
  const { atom, services } = await ownerContext();
  if (!atom?.publicId || !["ACTIVE", "DORMANT"].includes(atom.status))
    redirect("/auth");
  return (
    <main>
      <OwnerSettings
        publicId={atom.publicId}
        alias={atom.alias}
        xHandle={atom.xHandle}
        preferences={await services.preferences.get()}
      />
    </main>
  );
}
