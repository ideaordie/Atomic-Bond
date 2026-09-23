"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  validEmail,
  type BondResult,
  type Invitation,
  type ParticipationServices,
} from "../../services/participation/contracts";
import { LocationField } from "./LocationField";
import { normalizeXHandle, X_HANDLE_ERROR } from "../../utils/x-profile";

export function BondFlow({
  services,
  initial,
  onClose,
  onComplete,
}: {
  services: ParticipationServices;
  initial: Invitation;
  onClose: () => void;
  onComplete: (result: BondResult) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [invite, setInvite] = useState(initial);
  const [remaining, setRemaining] = useState(300);
  const [error, setError] = useState("");
  const [existing, setExisting] = useState(false);
  const [email, setEmail] = useState("");
  const [alias, setAlias] = useState("");
  const [xHandle, setXHandle] = useState("");
  const [locationId, setLocationId] = useState("");
  const [result, setResult] = useState<BondResult | null>(null);
  const close = () => {
    dialog.current?.close();
    if (result) onComplete(result);
    else onClose();
  };
  const url = `/explore#invite=${initial.code}`;
  useEffect(() => {
    dialog.current?.showModal();
    // Only an in-session development URL: no email or identity data in URLs.
    const timer = window.setInterval(() => {
      setInvite(services.bonds.read(initial.code));
      setRemaining(
        Math.max(0, Math.ceil((initial.expiresAt - Date.now()) / 1000)),
      );
    }, 500);
    return () => window.clearInterval(timer);
  }, [initial, services]);
  useEffect(() => {
    heading.current?.focus();
  }, [invite.state, existing]);
  const run = (operation: () => Invitation) => {
    try {
      setError("");
      setInvite(operation());
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Please try again.");
      setInvite(services.bonds.read(invite.code));
      return false;
    }
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!validEmail(email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (!locationId) {
      setError("Select a home region from the location results.");
      return;
    }
    try {
      normalizeXHandle(xHandle);
    } catch {
      setError(X_HANDLE_ERROR);
      return;
    }
    const accepted = run(() =>
      services.bonds.createAtom(invite.code, {
        email,
        alias,
        locationId,
        xHandle,
      }),
    );
    if (accepted) setEmail("");
  };
  const inviter = services.atoms.get(invite.inviterId);
  const recipient = invite.recipientId
    ? services.atoms.get(invite.recipientId)
    : null;
  const title = result
    ? "⚛ BOND CREATED"
    : invite.state === "INVITE_CREATED"
      ? "One connection begins here."
      : invite.state === "NEW_ATOM_REQUIRED"
        ? "Create your Atom"
        : invite.state === "EMAIL_VERIFICATION_PENDING"
          ? "Verify your email"
          : invite.state === "BOND_CONFIRMATION_PENDING"
            ? "Confirm your Bond"
            : invite.state === "EXPIRED"
              ? "Invitation expired"
              : invite.state === "DECLINED"
                ? "Invitation closed"
                : existing
                  ? "Find your Atom"
                  : "Welcome to Atomic Bond";
  return (
    <dialog
      ref={dialog}
      className="bond-dialog"
      aria-labelledby="bond-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <div className="bond-dialog-top">
        <span>ATOMIC BOND</span>
        <button type="button" aria-label="Close Bond flow" onClick={close}>
          ×
        </button>
      </div>
      <p className="development-tag">DEVELOPMENT SIMULATION · THIS TAB ONLY</p>
      <h2 id="bond-title" ref={heading} tabIndex={-1}>
        {title}
      </h2>
      {!result && !["DECLINED", "EXPIRED"].includes(invite.state) && (
        <p className="invitation-timer" data-testid="invitation-timer">
          Expires in {String(Math.floor(remaining / 60)).padStart(2, "0")}:
          {String(remaining % 60).padStart(2, "0")}
        </p>
      )}
      {error && (
        <p className="flow-error" role="alert">
          {error}
        </p>
      )}
      {invite.state === "INVITE_CREATED" && (
        <>
          <p>
            Atom <strong>#{inviter.publicId}</strong> wants to Bond with you.
          </p>
          <div className="invitation-symbol" aria-hidden="true">
            ▦<span>⚛</span>▦
          </div>
          <p className="field-help">
            QR-style placeholder · not a scannable code
          </p>
          <strong className="bond-code">{invite.code}</strong>
          <a
            className="invitation-url"
            href={url}
            onClick={(event) => {
              event.preventDefault();
              run(() => services.bonds.open(invite.code));
            }}
          >
            {" "}
            {url}
          </a>
          <p className="field-help">
            Mock invitation link works in this open session. Refreshing clears
            all participation data.
          </p>
          <button
            className="flow-primary"
            onClick={() => run(() => services.bonds.open(invite.code))}
          >
            Simulate recipient
          </button>
          <p className="field-help">
            Development action: open this invitation as its recipient.
          </p>
        </>
      )}
      {invite.state === "INVITE_OPENED" && !existing && (
        <div className="flow-actions">
          <p>Atom #{inviter.publicId} has invited you to connect.</p>
          <button
            className="flow-primary"
            onClick={() => run(() => services.bonds.startNew(invite.code))}
          >
            New to Atomic Bond
          </button>
          <button onClick={() => setExisting(true)}>
            I already have an Atom
          </button>
        </div>
      )}
      {invite.state === "INVITE_OPENED" && existing && (
        <div className="flow-actions">
          <p>
            Development only: choose a verified Atom to simulate identification.
          </p>
          {services.atoms.existingChoices().map((atom) => (
            <button
              key={atom.id}
              onClick={() =>
                run(() => services.bonds.identifyExisting(invite.code, atom.id))
              }
            >
              Use Atom #{atom.publicId}
              {atom.alias ? ` · ${atom.alias}` : ""}
            </button>
          ))}
          <button
            onClick={() => {
              setExisting(false);
              setError("");
            }}
          >
            Back
          </button>
        </div>
      )}
      {invite.state === "NEW_ATOM_REQUIRED" && (
        <form className="atom-form" onSubmit={submit} noValidate>
          <label htmlFor="atom-email">
            Email <span>Private · never shown in your network</span>
          </label>
          <input
            id="atom-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setError("");
            }}
            required
          />
          <label htmlFor="atom-alias">
            Name / alias <span>(optional)</span>
          </label>
          <input
            id="atom-alias"
            autoComplete="given-name"
            maxLength={60}
            value={alias}
            onChange={(event) => setAlias(event.target.value)}
          />
          <LocationField
            service={services.locations}
            onSelect={(id) => {
              setLocationId(id);
              setError("");
            }}
          />
          <label htmlFor="atom-x-handle">
            X handle <span>(optional · public)</span>
          </label>
          <input
            id="atom-x-handle"
            type="text"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="@username"
            value={xHandle}
            aria-describedby="atom-x-help"
            onChange={(event) => {
              setXHandle(event.target.value);
              setError("");
            }}
          />
          <p id="atom-x-help" className="field-help">
            Handle only, not a URL. Shown publicly on your Atom; X ownership is
            not verified.
          </p>
          <button className="flow-primary" type="submit">
            Create my Atom
          </button>
        </form>
      )}
      {invite.state === "EMAIL_VERIFICATION_PENDING" && (
        <>
          <p>
            Your Atom <strong>#{recipient?.publicId}</strong> is pending
            verification.
          </p>
          <p className="verification-address">
            {services.atoms.verificationLabel(invite.recipientId!)}
          </p>
          <p>
            No email has been sent. In production, verification will establish
            access to your Atom without a password.
          </p>
          <button
            className="flow-primary"
            onClick={() => run(() => services.bonds.verify(invite.code))}
          >
            Simulate email verification
          </button>
          <p className="field-help">
            Development action · email verification is required before
            confirming a Bond.
          </p>
        </>
      )}
      {invite.state === "BOND_CONFIRMATION_PENDING" && (
        <>
          <div className="bond-pair">
            <div>
              <span>YOU</span>
              <strong>#{recipient?.publicId}</strong>
            </div>
            <span aria-hidden="true">⟷</span>
            <div>
              <span>INVITING ATOM</span>
              <strong>#{inviter.publicId}</strong>
            </div>
          </div>
          <p>
            Creating a Bond confirms that you know or choose to connect with
            this person. It does not mean you agree with all of their views or
            connections.
          </p>
          <button
            className="flow-primary"
            onClick={() => {
              try {
                setError("");
                const next = services.bonds.confirm(invite.code);
                setResult(next);
                setInvite(services.bonds.read(invite.code));
              } catch (cause) {
                setError(
                  cause instanceof Error ? cause.message : "Unable to confirm.",
                );
                setInvite(services.bonds.read(invite.code));
              }
            }}
          >
            Confirm Bond
          </button>
          <button
            className="flow-secondary"
            onClick={() => run(() => services.bonds.decline(invite.code))}
          >
            Decline
          </button>
        </>
      )}
      {result && (
        <>
          <p>
            Your Atom grew. One mutually confirmed connection opens a wider
            world.
          </p>
          <dl className="impact-metrics">
            <div>
              <dt>Direct Bonds</dt>
              <dd>
                {result.before.direct} → {result.after.direct}
              </dd>
            </div>
            <div>
              <dt>Connected people</dt>
              <dd>
                {result.before.people} → {result.after.people}
              </dd>
            </div>
            <div>
              <dt>Known cities reached</dt>
              <dd>
                {result.before.cities.length} → {result.after.cities.length}
              </dd>
            </div>
            <div>
              <dt>Countries reached</dt>
              <dd>
                {result.before.countries.length} →{" "}
                {result.after.countries.length}
              </dd>
            </div>
          </dl>
          <p className="growth-callout">
            +{result.after.people - result.before.people} connected people
            revealed
          </p>
          {result.after.cities
            .filter((city) => !result.before.cities.includes(city))
            .map((city) => (
              <p className="growth-callout" key={city}>
                New city reached: {city}
              </p>
            ))}
          {result.after.countries
            .filter((country) => !result.before.countries.includes(country))
            .map((country) => (
              <p className="growth-callout" key={country}>
                New country reached:{" "}
                {new Intl.DisplayNames(["en"], { type: "region" }).of(country)}
              </p>
            ))}
          <p className="field-help">
            People include your Atom. City coverage is partial; existing fixture
            Atoms have region and country data only.
          </p>
          <button className="flow-primary" onClick={close}>
            See your network
          </button>
        </>
      )}
      {invite.state === "DECLINED" && (
        <>
          <p>No Bond was created. Your network is unchanged.</p>
          <button className="flow-primary" onClick={close}>
            Return to My Atom
          </button>
        </>
      )}
      {invite.state === "EXPIRED" && (
        <>
          <p>
            This invitation can no longer create a Bond. Return to your Atom to
            create a new invitation.
          </p>
          <button className="flow-primary" onClick={close}>
            Return to My Atom
          </button>
        </>
      )}
    </dialog>
  );
}
