import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { dataConfiguration } from "../data/supabase/config";
import { ownerContext, ownedPublicId } from "../services/auth/server";
import { EntryExperience } from "../components/auth/EntryExperience";

export default async function Home() {
  await connection();
  if (dataConfiguration(process.env).mode === "supabase") {
    if (ownedPublicId(await ownerContext())) redirect("/explore");
    return <EntryExperience />;
  }
  return (
    <main>
      <p className="wordmark">ATOMIC BOND</p>
      <section aria-labelledby="introduction">
        <p className="eyebrow">
          One person. One connection. One Bond at a time.
        </p>
        <h1 id="introduction">
          See how connected
          <br className="desktop-break" /> we already are.
        </h1>
        <p className="introduction">
          Every person is an Atom. Every mutually confirmed human connection is
          a Bond. Together, those Bonds reveal a larger human network.
        </p>
        <p className="status">
          <span aria-hidden="true" />
          Foundation preview
        </p>
        <p className="note">
          <Link href="/explore" className="explore-link">
            Explore the Living Atom →
          </Link>
        </p>
      </section>
      <footer>
        Atomic Bond <span aria-hidden="true">/</span> A shared human network.
      </footer>
    </main>
  );
}
