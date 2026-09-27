"use client";
import Link from "next/link";
import "../components/auth/auth.css";
export default function ApplicationError({ reset }: { reset: () => void }) {
  return (
    <main>
      <section className="auth-panel">
        <h1>We couldn&apos;t open this page</h1>
        <p>
          Check your connection and try again. If this continues, come back in a
          little while.
        </p>
        <button onClick={reset}>Try again</button>
        <p>
          <Link href="/">Return to Atomic Bond</Link>
        </p>
      </section>
    </main>
  );
}
