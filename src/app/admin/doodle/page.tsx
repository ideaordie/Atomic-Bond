import { connection } from "next/server";
import { notFound } from "next/navigation";
import { doodlePageAccess } from "../../../services/doodle/server";
import { signalHistory } from "../../../services/signals/actions";
import { DoodleProductionReview } from "../../../prototypes/doodle/DoodleProductionReview";
import { AdminDenied } from "../../../components/admin/AdminNavigation";
export default async function DoodleAdminPage() {
  await connection();
  if (!(await doodlePageAccess())) notFound();
  if (
    await signalHistory()
      .then(() => false)
      .catch(() => true)
  )
    return <AdminDenied />;
  return <DoodleProductionReview production administrator />;
}
