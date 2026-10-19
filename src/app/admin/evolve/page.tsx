import { notFound } from "next/navigation";
import { executeEvolve } from "../../../services/evolve/production";
import {
  AdminDenied,
  AdminNavigation,
} from "../../../components/admin/AdminNavigation";
import { EvolveView } from "../../../components/evolve/EvolveView";
export const dynamic = "force-dynamic";
export default async function Page() {
  if (process.env.EVOLVE_ENABLED !== "true") notFound();
  const result = await executeEvolve({
    operation: "admin_list",
    payload: {},
  }).catch(() => null);
  if (!result || result.error) return <AdminDenied />;
  const cleanup = await executeEvolve({ operation: "cleanup_status" }).catch(
    () => null,
  );
  const health = cleanup?.data as
    | {
        healthy?: boolean;
        last_success?: string;
        last_failure?: string;
        removed?: number;
      }
    | undefined;
  return (
    <>
      <AdminNavigation />
      <p role="status">
        EVOLVE cleanup: {health?.healthy ? "HEALTHY" : "CHECK REQUIRED"}. Last
        successful run: {health?.last_success ?? "Not yet recorded"}. Last
        failure: {health?.last_failure ?? "None recorded"}. Ideas processed in
        last successful run: {health?.removed ?? 0}.
      </p>
      <EvolveView administrator />
    </>
  );
}
