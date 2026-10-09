import Link from "next/link";
import { WelcomeAnimation } from "../../components/welcome/WelcomeAnimation";
import "./welcome.css";

export const metadata = {
  title: "Atomic Bond — You are more connected than you know",
  description: "Create your Atom. Make a Bond. See where it leads.",
};
export default function WelcomePage() {
  return (
    <main className="welcome-page">
      <header>
        <Link href="/" className="welcome-brand">
          ATOMIC BOND
        </Link>
        <nav aria-label="Welcome navigation">
          <Link href="/about">ABOUT</Link>
          <Link href="/auth?mode=access">ACCESS MY ATOM</Link>
        </nav>
      </header>
      <h1>
        YOU ARE MORE CONNECTED
        <br />
        THAN YOU KNOW.
      </h1>
      <WelcomeAnimation />
      <section className="welcome-conversion" aria-label="Join Atomic Bond">
        <p>Create your Atom. Make a Bond. See where it leads.</p>
        <Link className="welcome-cta" href="/auth?mode=register">
          CREATE YOUR ATOM
        </Link>
      </section>
    </main>
  );
}
