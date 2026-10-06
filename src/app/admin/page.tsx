import Link from "next/link";
import { connection } from "next/server";
import { signalHistory } from "../../services/signals/actions";
import {
  AdminDenied,
  AdminNavigation,
} from "../../components/admin/AdminNavigation";
export default async function AdminPage() {
  await connection();
  // Existing RPC independently checks live verified ACTIVE membership. No new hub privilege.
  if (
    await signalHistory()
      .then(() => false)
      .catch(() => true)
  )
    return <AdminDenied />;
  return (
    <main className="admin-page">
      <AdminNavigation home />
      <p className="admin-brand">ATOMIC BOND</p>
      <h1>ADMIN</h1>
      <p>Administrative tools and network operations.</p>
      <div className="admin-cards">
        <article className="admin-card">
          <h2>NETWORK ANALYTICS</h2>
          <p>
            Observe current connected groups, organic groups and the founding
            network, with clear limits on historical formation and merge
            information.
          </p>
          <Link href="/admin/network">OPEN ANALYTICS →</Link>
        </article>
        <article className="admin-card">
          <h2>NETWORK SIGNAL</h2>
          <p>
            Manage the current Network Signal, drafts, publishing, scheduling
            and Signal history.
          </p>
          <Link href="/admin/signals">MANAGE SIGNALS →</Link>
        </article>
      </div>
    </main>
  );
}
