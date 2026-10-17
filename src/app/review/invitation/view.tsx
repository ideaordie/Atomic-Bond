"use client";
import { useState } from "react";
import {
  BondInvitation,
  type DisplayInvitation,
} from "../../../components/auth/BondInvitation";
import { AppearancePreference } from "../../../components/appearance/AppearancePreference";
import "../../../components/auth/auth.css";
import "../../../components/participation/participation.css";
export function InvitationReview({
  recipient,
  image,
  url,
}: {
  recipient: boolean;
  image: string;
  url: string;
}) {
  const [open, setOpen] = useState(false);
  const [invite, setInvite] = useState<DisplayInvitation | null>(null);
  const [created, setCreated] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  return (
    <main className="auth-panel">
      <h1>FIRST BOND — LOCAL REVIEW</h1>
      <p>
        Synthetic presentation only. No production invitations, authentication
        or Bonds. The review link is not an authoritative invitation.
      </p>
      <AppearancePreference />
      {recipient ? (
        <section>
          <h2>
            {confirmed
              ? "BOND CONFIRMED — SIMULATION"
              : "Confirm your Bond — SIMULATION"}
          </h2>
          <p>
            A real recipient securely creates or accesses their Atom before
            confirming.
          </p>
          <button disabled={confirmed} onClick={() => setConfirmed(true)}>
            CONFIRM BOND — SIMULATION
          </button>
        </section>
      ) : (
        <>
          <h2>YOUR ATOM IS READY</h2>
          <p>
            Create your first Bond with someone you know and watch your network
            come alive.
          </p>
          <button onClick={() => setOpen(true)}>CREATE YOUR FIRST BOND</button>
          <p role="status">Synthetic invitations prepared: {created}</p>
          <button
            disabled={!invite}
            onClick={() =>
              setInvite(
                (previous) =>
                  previous && {
                    ...previous,
                    expiresAt: new Date(Date.now() - 1000).toISOString(),
                  },
              )
            }
          >
            SIMULATE EXPIRATION
          </button>
          <p>
            Use COPY LINK and paste into another tab for the synthetic recipient
            demonstration. No account or email is needed in this preview.
          </p>
          {open && (
            <BondInvitation
              invite={invite}
              publicId="DEMO"
              firstBond
              close={() => setOpen(false)}
              create={async () => {
                if (invite && Date.parse(invite.expiresAt) > Date.now()) return;
                setCreated((count) => count + 1);
                const issuedAt = Date.now();
                setInvite({
                  id: "synthetic",
                  image,
                  url,
                  createdAt: new Date(issuedAt).toISOString(),
                  expiresAt: new Date(issuedAt + 86400000).toISOString(),
                });
              }}
              cancel={async () => {
                setInvite(null);
              }}
            />
          )}
        </>
      )}
    </main>
  );
}
