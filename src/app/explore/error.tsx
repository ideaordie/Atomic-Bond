"use client";
export default function NetworkError({ reset }: { reset: () => void }) {
  return (
    <main>
      <h1>Network unavailable</h1>
      <p>
        Atomic Bond could not load its configured network. Check the deployment
        data mode, Supabase configuration and migrations, then try again.
      </p>
      <button type="button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
