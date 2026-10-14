"use client";
import { ApplicationNavigation } from "../../../components/navigation/ApplicationNavigation";
import { InstallOffer } from "../../../components/pwa/InstallOffer";
import { useInstall } from "../../../components/pwa/PwaProvider";
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
        <button onClick={install.invite}>
          PREVIEW SUCCESSFUL REGISTRATION
        </button>
        <InstallOffer />
        <p>
          Use INSTALL APP for this browser&apos;s instructions. Native prompts
          are offered only when the browser provides one.
        </p>
      </main>
    </>
  );
}
