import Link from "next/link";
import "./admin.css";
export function AdminNavigation({ home = false }: { home?: boolean }) {
  return (
    <nav className="admin-navigation" aria-label="Admin navigation">
      {!home && <Link href="/admin">← ADMIN HOME</Link>}
      <Link href="/explore">RETURN TO MY ATOM</Link>
    </nav>
  );
}
export function AdminDenied() {
  return (
    <main className="admin-page">
      <h1>ACCESS DENIED</h1>
      <p>
        Verified ACTIVE administrator access is required. If you are already
        signed in, the tool may be temporarily unavailable.
      </p>
      <a href="/auth?mode=access">ACCESS MY ATOM</a>
    </main>
  );
}
