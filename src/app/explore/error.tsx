"use client";
export default function NetworkError({ reset }: { reset: () => void }) {
  return (
    <main>
      <h1>Network unavailable</h1>
      <p>
        We couldn&apos;t load your network. Check your connection and try again.
        Your confirmed Bonds are still saved.
      </p>
      <button type="button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
