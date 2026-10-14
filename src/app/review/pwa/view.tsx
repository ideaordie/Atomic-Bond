"use client";
import { ApplicationNavigation } from "../../../components/navigation/ApplicationNavigation";
import { InstallOffer } from "../../../components/pwa/InstallOffer";
import { useInstall } from "../../../components/pwa/PwaProvider";
import { AppearancePreference } from "../../../components/appearance/AppearancePreference";
import {
  DISMISS_KEY,
  INVITATION_KEY,
} from "../../../components/pwa/install-policy";
import "../../../components/auth/auth.css";
export function InstallReview() {
  const install = useInstall();
  return (
    <>
      <header className="shared-application-header">
        <span>ATOMIC BOND</span>
        <ApplicationNavigation owner doodle puzzle />
      </header>
      <main style={{ maxWidth: 560, margin: "24px auto", padding: 16 }}>
        <h1>INSTALLATION REVIEW</h1>
        <p>Local presentation preview. No account is created or changed.</p>
        <button
          onClick={() => {
            localStorage.removeItem(DISMISS_KEY);
            sessionStorage.setItem(INVITATION_KEY, "pending");
            location.reload();
          }}
        >
          RESET LOCAL INVITATION PREVIEW
        </button>
        <section className="auth-panel">
          <AppearancePreference />
          <h2>WELCOME BACK — PRESENTATION PREVIEW</h2>
          <p>
            Real login offers this invitation only after verified owner
            resolution.
          </p>
          <button onClick={install.invite}>
            PREVIEW VERIFIED OWNER INVITATION
          </button>
          <InstallOffer />
        </section>
        <p>
          Use INSTALL APP for this browser&apos;s instructions. Native prompts
          are offered only when the browser provides one.
        </p>
      </main>
    </>
  );
}
