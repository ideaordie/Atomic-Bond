import type { Metadata } from "next";
import Link from "next/link";
import "./about.css";

export const metadata: Metadata = {
  title: "About & Privacy | Atomic Bond",
  description:
    "Human connection, Bonds, Emotional Pulse and your privacy in the Atomic Bond beta.",
};

export default function About() {
  return (
    <main className="about-page">
      <nav aria-label="Main navigation" className="about-nav">
        <Link href="/" className="wordmark">
          ATOMIC BOND
        </Link>
        <span aria-current="page">ABOUT</span>
      </nav>
      <header className="about-intro">
        <p className="eyebrow">ATOMIC BOND</p>
        <h1>See how connected we already are.</h1>
        <p className="about-lead">
          Atomic Bond is a living visualization of human connection.
        </p>
        <p>
          Each person has an Atom. When two people choose to connect, they
          create a Bond. As those people form Bonds with others, each Atom
          becomes part of a larger network that can extend across regions and
          countries.
        </p>
        <p>
          Atomic Bond is not about followers, popularity or scores. It is
          designed to make the connections between people visible—and to let you
          watch your network grow through the relationships people create.
        </p>
      </header>
      <section aria-labelledby="about-bonds">
        <h2 id="about-bonds">BONDS</h2>
        <p>A Bond represents a connection that both people choose to make.</p>
        <p>
          Creating a Bond does not mean that two people share the same beliefs,
          opinions or affiliations. It simply records a human connection between
          them.
        </p>
        <p>
          Your network can continue growing when people connected to you create
          Bonds of their own.
        </p>
      </section>
      <section aria-labelledby="about-pulse">
        <h2 id="about-pulse">EMOTIONAL PULSE</h2>
        <p>
          Pulse lets you voluntarily share how you&apos;re feeling with your
          connected network.
        </p>
        <p>
          An active Pulse lasts for 24 hours and is represented through color in
          the Living Atom.
        </p>
        <p>
          Emotions are selected by you. Atomic Bond does not infer your
          emotional state, score it, rank it or use it as a measure of
          reputation.
        </p>
      </section>
      <section aria-labelledby="about-privacy">
        <h2 id="about-privacy">YOUR PRIVACY</h2>
        <p>
          Atomic Bond is designed to collect only the information needed to
          operate the network.
        </p>
        <p>
          Your email address is private. It is used for identity verification,
          secure access to your Atom and email communications you have enabled.
        </p>
        <p>
          Your Home Region uses coarse geographic information such as country
          and state/province/region. Atomic Bond does not require your street
          address or precise GPS location.
        </p>
        <p>Your name or alias and X handle are optional.</p>
        <p>
          You may deactivate your account to temporarily step away. Your private
          account, profile, Atom number and Bonds are preserved for your
          verified return. Your public profile is hidden, your Pulse is removed
          and weekly updates pause until you explicitly reactivate.
        </p>
        <p>
          You can permanently delete your account from Profile &amp;
          Preferences. This cannot be undone. Deletion removes your personal
          identity, Home Region, active Pulse and account access. Your permanent
          Atom number and anonymized confirmed Bonds remain to preserve network
          connections. Inactivity alone does not delete an account.
        </p>
        <p>
          Atoms and the structural Bond network may be publicly viewable.
          Private identity information, including email addresses, is not part
          of the public Atom profile.
        </p>
        <p>
          Emotional Pulse information is handled separately from unrestricted
          public profile information and is shown according to the
          connected-network privacy rules of Atomic Bond.
        </p>
      </section>
      <section aria-labelledby="about-email">
        <h2 id="about-email">EMAIL</h2>
        <p>
          Atomic Bond may send secure transactional emails required for
          verification and access.
        </p>
        <p>
          New Atoms also have Weekly Atom Growth Updates enabled by default.
          These updates are sent only when there is meaningful network growth to
          report.
        </p>
        <p>
          Weekly updates can be turned off at any time from Profile &amp;
          Preferences or through the unsubscribe link included in the email.
        </p>
        <p>
          Unsubscribing from growth updates does not prevent essential
          authentication or account-access email.
        </p>
      </section>
      <section aria-labelledby="about-choices">
        <h2 id="about-choices">YOUR CHOICES</h2>
        <p>You control whether you:</p>
        <ul>
          <li>create an Atom</li>
          <li>create or confirm a Bond</li>
          <li>provide an optional alias</li>
          <li>provide an optional X handle</li>
          <li>send an Emotional Pulse</li>
          <li>receive Weekly Atom Growth Updates</li>
        </ul>
        <p>
          Atomic Bond is intended to show how human connections grow—not to
          determine the value, popularity or influence of the people in them.
        </p>
      </section>
      <section aria-labelledby="about-beta">
        <h2 id="about-beta">BETA</h2>
        <p>Atomic Bond is currently in beta.</p>
        <p>
          Features, presentation and network behavior may continue to evolve as
          the system is tested with real participants.
        </p>
      </section>
      <footer>
        <Link className="about-return" href="/">
          ← RETURN TO ATOMIC BOND
        </Link>
      </footer>
    </main>
  );
}
