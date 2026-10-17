# Task #17.3 — Verification email presentation

Product review passed; publication authorized as v0.16.4.3. No live test email or production configuration change is part of publication. Baseline is v0.16.4.2,
`9350234bd69f1f4e721629e92c87794b2068e02b`; main and origin/main were synchronized
and the working tree was clean. Frozen Master Spec v0.8 is unchanged.

## Delivery audit and preservation

Supabase's signed Send Email Hook calls the application endpoint
`/api/auth/email-hook`. `deliverAuthEmail` verifies the signature, event age,
operation and callback origin, then constructs the existing verification URL.
Signup uses `sendVerificationEmail`; magiclink uses `sendMagicAccessLink`.
The existing Resend transport posts the message and webhook-derived idempotency
key. There is no separate deployed Edge Function/template to update.

Ordinary new registration, returning-owner access, resend and recovery use these
same provider event paths. Only a valid marked signup receipt selects the existing
`/auth/register/confirm` destination. Missing/invalid optional receipt retains the
ordinary verification path. These decisions, receipt encryption, exact attempt
binding and URL construction are unchanged.

The notification adapter now adds one shared presentation template. Reading the
already-generated URL's pathname selects copy only; the URL is never serialized
again, shortened or rebuilt. Plain text contains the original string. The HTML
attribute escapes metacharacters; parsing the HTML restores exactly the original
destination, including fragment, percent encoding, token prefix and receipt.
Subjects, recipient selection, authorization and delivery idempotency are unchanged.

## Presentation and compatibility

Two variants share inline styles, presentation tables, system fonts, white
background, black button, explicit foreground colors and a small ignore-email
footer. No images, external assets, JavaScript, analytics or tracking redirect is
introduced. Resend receives both `html` and `text` for multipart delivery; the text
alternative retains the full credential link. Provider MIME assembly is not a new
application implementation.

The standard anchor has an explicit keyboard tab stop. Outlook-compatible table
background and `mso-padding-alt` provide a fallback if anchor padding is ignored;
rounded corners are cosmetic and may appear square in older Outlook. Clients may
override dark-mode colors despite the light color-scheme hints. Browser dark-mode
preference tests cannot establish actual Apple Mail, Gmail or Outlook behavior.
Real inbox rendering and real iPhone email-to-browser/PWA acceptance remain pending.
Provider/security software may independently rewrite links; no new application
tracking or provider configuration is introduced, and this test does not claim
control over upstream retention or enterprise email scanning.

## Local previews

Synthetic-only previews: `http://127.0.0.1:3153/ordinary` and
`http://127.0.0.1:3153/invitation`. Generated HTML/text and screenshots are in ignored
`artifacts/task173/`. Do not use these placeholder links for authentication.

24 Chromium/WebKit cases at 390×844, 768×1024 and 1440×900, with Light/Dark
preferences, passed exact parsed-destination, no horizontal overflow, minimum
44px target and keyboard focus checks. Mobile screenshots were visually inspected.
The HTML requests a white background in either preference, as specified.

## Changed files

- `src/services/notifications/auth-email.ts`: shared HTML/plain-text renderer.
- `src/services/notifications/resend-notification-service.ts`: supply both formats.
- `tests/unit/auth-email-template.test.ts`: exact URL, escaping and presentation checks.
- `tests/security/registration-receipt.test.ts`: signed-hook HTML/text equivalence.
- `docs/operations/TASK_17_3_EMAIL_PRESENTATION.md`: audit and acceptance record.

Release metadata also updates `package.json` and `docs/CHANGELOG.md` only.

## Deployment and recovery

Deploy the application and its existing same-origin email hook
together. No database migration, new secret, environment change, Supabase template
edit, callback allowlist change or Master Spec amendment is required. Existing
emails and authentication sessions remain valid. An application-only revert of the
template and two adapter calls restores text-only delivery without changing
credentials, deadlines, callbacks or records. Do not revert authentication code.

## Regression results

- All 483 unit/integration/security tests in 83 files passed (one worker, 8 GiB heap).
- All 135 authenticated browser cases passed at the three standard viewports (7.9 minutes), including ordinary access, registration, fresh-context invitation continuity, recovery emails, callback reloads, explicit consent and PWA regressions.
- PostgreSQL concurrency and privileged client-import negative checks passed.
- Production build, TypeScript, lint, formatting and diff whitespace checks passed.
- Secret scan: 627 repository files and 53 browser bundles; no known secret or private-key leak, and no receipt implementation in client bundles.
- 24 standalone email rendering/destination/keyboard cases passed in Chromium and WebKit, including both theme preferences. Real email-client forced dark mode is unverified.

An initial test compile required non-null assertions for regex captures. WebKit's initial link-focus test exposed its default keyboard-navigation behavior; the normal anchor now has tabindex=0, and the final Tab test passed in both engines. No authentication code changed. All final checks passed without skipped tests.

The Resend [Send Email API](https://resend.com/docs/api-reference/emails/send-email) documents explicit HTML and plain-text message fields. Both are supplied here; actual delivered MIME and client link handling await authorized inbox acceptance. No live email was generated.
