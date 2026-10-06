import { connection } from "next/server";
import {
  networkReport,
  type ConnectedGroup,
} from "../../../services/admin/network";
import {
  AdminDenied,
  AdminNavigation,
} from "../../../components/admin/AdminNavigation";
function Group({ group }: { group: ConnectedGroup }) {
  return (
    <article className="admin-card">
      <h3>{group.founding ? "FOUNDING NETWORK" : `GROUP #${group.id}`}</h3>
      <p>
        {group.atomCount} structural Atoms · {group.activeAtomCount} ACTIVE
        participants · {group.bondCount} confirmed Bonds
      </p>
      <p>
        {group.regions} regions · {group.countries} countries represented in
        currently visible coarse geography.
      </p>
      <p className="admin-number-list">
        Atoms: {group.publicNumbers.map((n) => `#${n}`).join(", ")}
      </p>
      <p>
        Earliest retained Bond:{" "}
        {group.earliestRetainedBond
          ? new Date(group.earliestRetainedBond)
              .toISOString()
              .replace("T", " ")
              .replace(".000Z", " UTC")
          : "None"}
      </p>
    </article>
  );
}
export default async function NetworkPage() {
  await connection();
  const report = await networkReport().catch(() => null);
  if (!report) return <AdminDenied />;
  const metrics = [
    ["ACTIVE ATOMS", report.activeAtoms],
    ["CONFIRMED BONDS", report.confirmedBonds],
    ["CONNECTED GROUPS", report.connectedGroups],
    ["ORGANIC GROUPS", report.organicGroups],
    ["ISOLATED ACTIVE ATOMS", report.isolatedAtoms.length],
    ["LARGEST GROUP", report.largestGroup],
  ] as const;
  return (
    <main className="admin-page">
      <AdminNavigation />
      <p className="admin-brand">ATOMIC BOND · ADMIN</p>
      <h1>NETWORK ANALYTICS</h1>
      <h2>CURRENT STRUCTURE</h2>
      <p>
        Snapshot: {new Date(report.generatedAt).toISOString()} · Reload to
        refresh.
      </p>
      <p>
        Connected groups contain at least one confirmed Bond. Structural counts
        retain deleted and deactivated endpoints; ACTIVE counts exclude them.
        Hidden Home Regions are excluded.
      </p>
      <dl className="admin-metrics">
        {metrics.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <section aria-label="Founding network">
        {report.foundingNetwork ? (
          <Group group={report.foundingNetwork} />
        ) : (
          <p>Founding network unavailable.</p>
        )}
      </section>
      <section>
        <h2>ORGANIC GROUPS</h2>
        <p>
          Current bonded groups not containing Atom #1. This does not prove a
          group was never connected to the founding network.
        </p>
        <div className="admin-cards">
          {report.groups
            .filter((g) => !g.founding)
            .map((g) => (
              <Group key={g.id} group={g} />
            ))}
        </div>
        {report.organicGroups === 0 && (
          <p>No separate organic groups currently.</p>
        )}
      </section>
      <section>
        <h2>ISOLATED ACTIVE ATOMS</h2>
        <p className="admin-number-list">
          {report.isolatedAtoms.length
            ? report.isolatedAtoms.map((n) => `#${n}`).join(", ")
            : "None"}
        </p>
      </section>
      <section>
        <h2>HISTORICAL EVENTS</h2>
        <p>
          Formation and merge history is unavailable. Retained confirmation
          timestamps do not establish complete past component membership,
          removed Bonds or transaction order. “Earliest retained Bond” is not a
          formation date. No NEW ORGANIC GROUP or NETWORK MERGE events are
          inferred.
        </p>
      </section>
    </main>
  );
}
