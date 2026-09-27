import Link from "next/link";
import "./auth.css";

export function EntryExperience() {
  return (
    <main>
      <p className="wordmark">ATOMIC BOND</p>
      <section className="auth-panel" aria-labelledby="entry-title">
        <h1 id="entry-title">See how connected we already are.</h1>
        <p>Create your Atom or securely return to your existing network.</p>
        <div className="entry-actions">
          <Link href="/auth?mode=register">CREATE MY ATOM</Link>
          <Link href="/auth?mode=access">ACCESS MY ATOM</Link>
        </div>
      </section>
    </main>
  );
}
