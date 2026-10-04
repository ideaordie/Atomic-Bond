import Link from "next/link";
import "../../../components/auth/auth.css";
export default function DeletedPage() {
  return (
    <main>
      <section className="auth-panel">
        <h1>ACCOUNT DELETED</h1>
        <p>Your personal Atomic Bond account information has been removed.</p>
        <p>
          Your former Atom number will not be reassigned. Existing Bonds remain
          as anonymized structural connections.
        </p>
        <Link className="profile-return" href="/">
          RETURN TO ATOMIC BOND
        </Link>
      </section>
    </main>
  );
}
