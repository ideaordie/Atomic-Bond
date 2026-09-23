# Atomic Bond 0.1.0 foundation baseline

Foundation Task #1. Verification date: 2026-09-21.

## Environment

- Windows, Node.js 24.19.0, pnpm 11.25.0.
- Next.js 16.3.5, React 19.3.0, TypeScript 6.0.3.
- ESLint 9.39.5, Prettier 3.9.8, Vitest 5.0.1, Playwright 1.63.0.
- Exact resolved dependencies are preserved in `pnpm-lock.yaml`.
- No application secrets, backend credentials, or environment files required.

## Verification record

- `pnpm install --frozen-lockfile`: passed.
- `pnpm peers check`: passed, no peer conflicts.
- `pnpm lint`: passed with zero warnings.
- `pnpm typecheck`: passed.
- `pnpm test`: all eight graph tests passed.
- `pnpm build`: passed; `/` is statically prerendered.
- `pnpm dev`: started successfully; HTTP GET `/` returned 200 with expected copy.
- `pnpm check`: passed end-to-end, including formatting and all checks above.
- `pnpm test:e2e`: all three Chromium tests passed against the production build.
- Screenshots visually reviewed at 390 × 844, 768 × 1024, and 1440 × 900:
  readable text, intact layout and footer, no clipping or horizontal overflow.
  Browser tests also verified reduced-motion rendering and no console/page errors.
- `git diff --check`: passed; new-file diff reviewed.

Run `pnpm check` to reproduce formatting, lint, type checking, unit tests,
production build and browser tests. Install Chromium first as described in README.
Screenshots are generated under `test-results/landing-*/landing.png` and the
browser report is available at `playwright-report/index.html` after a local run.

## Fixture regression identity

Mock graph version: 1. Nodes: 1,000. Edges: 4,062. Components: 640/180/180.

SHA-256 of `JSON.stringify(generateMockGraph())`:

```text
e1865e180db4f4c4251315e02e879892e0c7b0e9b6ca821cd7fabf69b1947751
```

## Governance integrity

The approved files remain byte-for-byte unchanged. Original and final SHA-256:

| File                           | SHA-256                                                            |
| ------------------------------ | ------------------------------------------------------------------ |
| `AGENTS.md`                    | `DD7489F605050F84DB2175BB17089F5A778D2AC8B4B4AC6CEE5D16CF464CA588` |
| `docs/MASTER_SPEC_v0.1.md`     | `CE08E7408BA7A4042677FC0E20B7D035B1C782FCDDBB1392D744B42388DF30AD` |
| `docs/BUILD_BLUEPRINT_v0.1.md` | `ADAB67B54B44E97C5C154DBDA7DA85B50A2DA92ABA5E177B464570A03F7BCFC3` |

Next.js initially appended a framework block to AGENTS.md during development
startup. That append was removed after verifying the original bytes, and
`agentRules: false` prevents recurrence. `.gitattributes` preserves approved
document bytes across checkouts.

## Limitations and review status

- ESLint 9 is deprecated upstream but is required by the current Next.js React,
  import, and accessibility lint plugin peer ranges. ESLint 10 was tested and
  failed inside the React plugin. Upgrade this development tool when compatible.
- Browser checks cover Chromium at three sizes; Safari/Firefox are not yet covered.
- GitHub Actions is configured but has not run on a remote repository.
- This Windows agent sandbox blocks worker processes. Test/build/dev commands
  were rerun with approved execution outside the sandbox. Initial large package
  downloads needed a longer timeout; the eventual frozen install succeeded.
- Git was initialized on `main`. No commit, release tag, remote push, merge, or
  deployment was performed. Review this baseline before creating a release tag.
- All future product module directories are placeholders. No authentication,
  Supabase, email, production Atom/Bond workflows, QR, sharing, Pulse, or Living
  Atom rendering is implemented. Foundation Task #2 has not begun.
