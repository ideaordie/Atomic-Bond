import { ApplicationHeader } from "../../components/navigation/ApplicationHeader";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { ownerContext, ownedPublicId } from "../../services/auth/server";
import { OwnerSettings } from "../../components/auth/OwnerSettings";
export default async function OwnerPage() {
  await connection();
  const context = await ownerContext();
  const { atom, services } = context;
  if (atom?.status === "DEACTIVATED") redirect("/account/reactivate");
  if (!ownedPublicId(context)) {
    if (context.user) {
      const { data } = await context.client.rpc("account_deletion_status");
      if (data?.pending) redirect("/account/delete");
    }
    redirect("/auth");
  }
  return (
    <main>
      <ApplicationHeader />
      <OwnerSettings
        directRequestsEnabled={
          atom?.status === "ACTIVE" &&
          process.env.DIRECT_BOND_REQUESTS_ENABLED === "true"
        }
        publicId={atom!.publicId!}
        alias={atom!.alias}
        xHandle={atom!.xHandle}
        preferences={await services.preferences.get()}
        homeRegion={
          atom!.status === "ACTIVE"
            ? (await services.locations.resolve(atom!.locationId))?.displayName
            : undefined
        }
      />
    </main>
  );
}
