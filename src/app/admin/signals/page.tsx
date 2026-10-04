import { connection } from "next/server";
import { signalHistory } from "../../../services/signals/actions";
import { SignalAdmin } from "../../../components/signals/SignalAdmin";
export default async function SignalsPage() {
  await connection();
  const initial = await signalHistory().catch(() => null);
  if (initial === null) {
    return (
      <main className="signal-admin">
        <h1>ACCESS DENIED</h1>
        <p>Verified Network Signal administrator access is required.</p>
        <a href="/auth?mode=access">ACCESS MY ATOM</a>
      </main>
    );
  }
  return <SignalAdmin initial={initial} />;
}
