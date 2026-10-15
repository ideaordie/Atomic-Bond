import Link from "next/link";
import { WelcomeAnimation } from "../../components/welcome/WelcomeAnimation";
import "./welcome.css";

export const metadata = {
  title: "Atomic Bond — Connect. Create. Play. Together.",
  description: "One world. More ways to connect.",
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
        CONNECT. CREATE. PLAY.
        <br />
        TOGETHER.
      </h1>
      <WelcomeAnimation />
      <section className="welcome-conversion" aria-label="Join Atomic Bond">
        <p>One world. More ways to connect.</p>
        <Link className="welcome-cta" href="/auth?mode=register">
          CREATE YOUR ATOM
        </Link>
      </section>
    </main>
  );
}
