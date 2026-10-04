import Link from "next/link";
import "../../../components/auth/auth.css";
export default function DeactivatedPage() {
  return (
    <main>
      <section className="auth-panel">
        <h1>ATOM DEACTIVATED</h1>
        <p>Your Atom is no longer active.</p>
        <p>Your account, Atom number and existing Bonds have been preserved.</p>
        <p>
          You can return anytime by securely accessing your account and
          reactivating your Atom.
        </p>
        <Link className="explore-link" href="/">
          RETURN TO ATOMIC BOND
        </Link>
      </section>
    </main>
  );
}
