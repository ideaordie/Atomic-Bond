# ATOMIC BOND

## Build Blueprint — v0.1

**Status:** Initial Engineering Blueprint
**Product Authority:** Atomic Bond Master Product Specification v0.1
**Purpose:** Translate the frozen product specification into a modular, testable, agent-friendly software architecture.

---

# 1. ENGINEERING OBJECTIVE

Build Atomic Bond as a mobile-first web application capable of representing, visualizing and expanding a network of mutually confirmed human relationships.

The system must be:

* modular
* testable
* secure
* inexpensive to operate initially
* capable of progressive scaling
* friendly to agent-assisted development
* visually distinctive
* resistant to regression

The application must preserve the principles defined in the frozen Master Product Specification v0.1.

If this blueprint conflicts with the Master Product Specification, the **Master Product Specification takes precedence.**

---

# 2. DEVELOPMENT PHILOSOPHY

Atomic Bond should NOT be developed as one large HTML file.

The application should be divided into independently testable systems.

The central rule is:

> **Separate product logic, graph logic, visualization, data storage and presentation.**

Changing the appearance of the Living Atom should not require modifying the Bond database.

Changing the Bond database should not require rewriting the visualization.

Changing email infrastructure should not affect graph calculations.

---

# 3. INITIAL TECHNOLOGY STACK

## Frontend

Preferred starting architecture:

**React + TypeScript**

Framework:

**Next.js**

Reasons:

* component architecture
* mature ecosystem
* strong Vercel integration
* server/client separation
* routing
* TypeScript support
* agent familiarity
* automated testing support

The architecture should remain sufficiently modular that framework-specific code does not contaminate core graph logic.

---

# 4. BACKEND

Initial backend:

**Supabase**

Services:

* PostgreSQL
* authentication
* Row Level Security
* Realtime where useful
* Edge Functions where justified

The application should communicate with Supabase through a dedicated data-access layer.

UI components should NOT contain arbitrary database queries.

Preferred pattern:

```text
UI
 ↓
Application Services
 ↓
Data Access Layer
 ↓
Supabase
```

---

# 5. DEPLOYMENT

Preferred deployment:

**Vercel**

Edge/DNS/security services where useful:

**Cloudflare**

Development environments:

```text
LOCAL
 ↓
PREVIEW
 ↓
PRODUCTION
```

Production changes should never be the first place new functionality is tested.

---

# 6. REPOSITORY STRUCTURE

Initial repository structure:

```text
atomic-bond/
│
├── docs/
│   ├── MASTER_SPEC_v0.1.md
│   ├── BUILD_BLUEPRINT_v0.1.md
│   ├── CHANGELOG.md
│   └── architecture/
│
├── public/
│   ├── assets/
│   ├── icons/
│   └── references/
│
├── src/
│   │
│   ├── app/
│   │   ├── page
│   │   ├── atom
│   │   ├── bond
│   │   ├── explore
│   │   └── share
│   │
│   ├── components/
│   │
│   ├── living-atom/
│   │   ├── renderer/
│   │   ├── layout/
│   │   ├── animation/
│   │   ├── interaction/
│   │   ├── pulse/
│   │   └── types/
│   │
│   ├── graph/
│   │   ├── traversal/
│   │   ├── degrees/
│   │   ├── propagation/
│   │   ├── bridges/
│   │   └── metrics/
│   │
│   ├── services/
│   │   ├── atoms/
│   │   ├── bonds/
│   │   ├── invitations/
│   │   ├── locations/
│   │   └── notifications/
│   │
│   ├── data/
│   │   ├── supabase/
│   │   └── mock/
│   │
│   ├── types/
│   │
│   └── utils/
│
├── supabase/
│   ├── migrations/
│   ├── functions/
│   ├── policies/
│   ├── seed/
│   └── tests/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── graph/
│   ├── security/
│   └── e2e/
│
├── AGENTS.md
├── README.md
└── package.json
```

Codex may recommend minor structural improvements.

Major architectural changes require approval.

---

# 7. CANONICAL DATA MODEL

All agents must use shared canonical data types.

Do not invent competing representations of Atom or Bond.

## Atom

Conceptual TypeScript representation:

```text
Atom
----
id
publicId
displayName?
region?
countryCode?
createdAt
```

Private identity information must NOT be included in the public Atom object.

---

# 8. PRIVATE ATOM IDENTITY

Private identity data should be separated logically from public Atom data.

Conceptually:

```text
AtomIdentity
------------
atomId
email
emailVerified
ownerUserId
notificationPreferences
createdAt
```

Public API responses must never accidentally serialize this object.

---

# 9. BOND

Canonical Bond:

```text
Bond
----
id
atomAId
atomBId
createdAt
status
locationId?
originInviteId?
```

Bond status may include:

```text
pending
confirmed
revoked
```

Only confirmed Bonds participate in the public connection graph.

---

# 10. BOND INVITATION

```text
BondInvite
----------
id
creatorAtomId
token
createdAt
expiresAt
status
```

Potential states:

```text
active
accepted
expired
cancelled
```

Tokens must be cryptographically unpredictable.

---

# 11. LOCATION

Location should intentionally contain coarse information.

```text
Location
--------
id
city?
region?
countryCode
```

Precise coordinates should not become part of the default permanent public data model.

---

# 12. GRAPH CONTRACT

The Living Atom renderer should consume a generic graph representation.

Example:

```text
GraphNode
---------
id
publicId
degree
displayName?
metadata?

GraphEdge
---------
id
source
target
createdAt?
metadata?
```

Visualization components should NOT need to know whether graph data originated from:

* mock data
* Supabase
* cached API
* test fixtures

This is critical.

---

# 13. LIVING ATOM ENGINE

The Living Atom must be implemented as an independent visualization subsystem.

Responsibilities:

* node positioning
* Bond rendering
* orbital/shell organization
* animation
* particles
* zoom
* pan
* recentering
* Pulse animation
* cluster representation
* transitions
* responsive behavior

It must NOT be responsible for:

* authentication
* email
* database writes
* invitation security
* Bond confirmation
* privacy rules

---

# 14. VISUALIZATION TECHNOLOGY

The initial renderer may use:

**Canvas 2D**

or another justified rendering technology.

The architecture should allow migration to:

**WebGL**

if network density or visual complexity later requires it.

Renderer-specific implementation must remain behind a stable Living Atom interface.

Conceptually:

```text
LivingAtom
   ↓
Renderer Interface
   ↓
Canvas Renderer
```

Future:

```text
LivingAtom
   ↓
Renderer Interface
   ↓
WebGL Renderer
```

without rewriting Atomic Bond.

---

# 15. GRAPH ENGINE

Graph calculations must be deterministic software.

AI must NOT determine:

* whether two Atoms are connected
* degree of separation
* shortest paths
* Bridge status
* Bond validity
* propagation counts

These should be calculated using deterministic graph/database algorithms.

---

# 16. GRAPH FUNCTIONS

Initial graph engine should support:

```text
getDirectBonds(atomId)

getConnectionsByDegree(atomId, depth)

getShortestPath(atomA, atomB)

getReachableAtomCount(atomId)

getDegreeDistribution(atomId)

detectBridge(bondId)

calculatePropagation(atomId)
```

Functions should be independently testable.

---

# 17. SCALE STRATEGY

Do not prematurely introduce specialized graph infrastructure.

Initial strategy:

**PostgreSQL recursive queries + application graph algorithms**

Evaluate specialized graph databases only when real scale/performance measurements justify them.

Do not optimize for billions of Atoms before the first thousand exist.

---

# 18. MOCK NETWORK

Development must include a deterministic synthetic network.

Initial target:

**1,000 simulated Atoms**

Approximately:

**3,000–5,000 Bonds**

The test graph should include:

* dense clusters
* sparse clusters
* isolated network components
* known Bridges
* long paths
* multiple geographic regions
* predictable shortest paths

This dataset becomes a permanent regression fixture.

---

# 19. LIVING ATOM PERFORMANCE

The visualization should not attempt to draw every reachable Atom individually when networks become enormous.

Use progressive representation.

Example:

```text
DIRECT CONNECTIONS
individual nodes

NEARBY NETWORK
individual / clustered nodes

DISTANT NETWORK
aggregated clusters

GLOBAL NETWORK
density / particle representation
```

A user connected to 10 million Atoms should not require rendering 10 million DOM elements.

---

# 20. PRIMARY APPLICATION STATES

The application must support:

```text
PUBLIC VIEWER

ATOM OWNER

BOND INVITEE
```

Capabilities must differ appropriately.

A public viewer may explore.

An owner may modify their Atom and create Bonds.

A Bond invitee may accept or reject a valid invitation.

---

# 21. CORE ROUTES

Conceptually:

```text
/
```

Atomic Bond introduction / entry.

```text
/a/[publicId]
```

Public Atom.

```text
/bond/[token]
```

Bond invitation.

```text
/owner/[secure mechanism]
```

Owner access should preferably rely on authenticated session handling rather than long-lived secrets embedded permanently in URLs.

Exact authentication implementation should follow current Supabase security best practices.

---

# 22. CREATE BOND WORKFLOW

Expected flow:

```text
Owner selects CREATE BOND

↓

Server generates temporary invitation

↓

QR / URL / code displayed

↓

Second participant opens invitation

↓

Participant identifies or creates Atom

↓

Participant confirms

↓

Server validates invitation

↓

Duplicate Bond check

↓

Bond created

↓

Graph recalculated

↓

Living Atom receives updated graph

↓

Bond animation occurs
```

The UI must never create authoritative Bonds directly.

Server-side validation is required.

---

# 23. PULSE

Pulse is a visualization of graph traversal.

The animation should propagate according to actual graph distance.

Example:

```text
T0
YOU

T1
degree 1

T2
degree 2

T3
degree 3
```

Pulse must therefore consume graph data rather than merely display a decorative expanding circle.

---

# 24. BRIDGE DETECTION

When a new Bond materially connects previously disconnected or distant network regions, the system should be able to identify the event.

The first implementation should prioritize correctness over sophisticated scoring.

Bridge calculations must be deterministic and testable.

---

# 25. EMAIL

Email must be abstracted behind a notification service.

Example:

```text
NotificationService

sendMagicLink()

sendBondRequest()

sendGrowthMilestone()

sendBridgeNotification()

sendNetworkGrowthSummary()
```

The application should not scatter vendor-specific email calls throughout the codebase.

---

# 26. SECURITY

Security is part of the architecture, not a later feature.

Minimum requirements:

* Row Level Security
* server-side Bond validation
* expiring invitation tokens
* rate limiting where appropriate
* private email separation
* secure authentication
* sanitized user-generated display information
* authorization testing
* no private fields in public responses

---

# 27. AUTOMATED TESTING

Every major system must have automated tests.

Required categories:

### UNIT TESTS

Graph functions.

Data transformations.

Utilities.

### INTEGRATION TESTS

Supabase operations.

Bond creation.

Atom ownership.

Invitation lifecycle.

### SECURITY TESTS

Unauthorized modifications.

Email exposure.

RLS behavior.

Expired invitations.

Duplicate Bonds.

### END-TO-END TESTS

Create Atom.

Create Bond.

Confirm Bond.

Explore network.

Pulse.

Share.

---

# 28. VISUAL REGRESSION

The Living Atom is visually important enough to justify screenshot regression testing.

Maintain reference screenshots for key viewport sizes.

At minimum:

```text
390 × 844
mobile

768 × 1024
tablet

1440 × 900
desktop
```

Agents modifying visualization code should compare results against known-good references.

---

# 29. ACCESSIBILITY

Atomic Bond should not depend exclusively on visual effects.

Minimum requirements:

* keyboard-accessible controls
* readable contrast
* semantic controls
* reduced-motion support
* text equivalents for important network metrics
* screen-reader labels

Pulse animation should respect:

```text
prefers-reduced-motion
```

---

# 30. VERSIONING

Atomic Bond must maintain explicit versions.

Examples:

```text
0.1.0
0.1.1
0.2.0
```

Stable builds should be tagged.

Agents should not overwrite the conceptual meaning of previous versions.

---

# 31. CHANGELOG

Every accepted functional change must be recorded.

Example:

```text
v0.2.3

Added:
- degree-aware Pulse

Fixed:
- mobile recenter animation

Changed:
- cluster opacity

Tests:
- 184 passed
```

---

# 32. AGENT AUTHORITY

Agents may autonomously:

* write implementation code
* write tests
* refactor within modules
* fix bugs
* improve performance
* improve accessibility
* document code

Agents may NOT autonomously:

* change Atomic Bond's core product philosophy
* expose additional personal information
* introduce followers
* introduce Likes
* introduce public rankings
* change mutual Bond confirmation
* replace the canonical data model
* remove security requirements
* materially change architecture without documenting the proposal

---

# 33. AGENT CHANGE PROCESS

Every substantial task should follow:

```text
READ SPEC

↓

UNDERSTAND TASK

↓

INSPECT CURRENT CODE

↓

IMPLEMENT

↓

TEST

↓

RUN REGRESSION TESTS

↓

REVIEW DIFF

↓

PRODUCE PREVIEW

↓

HUMAN APPROVAL

↓

MERGE
```

Agents should not declare success simply because code compiled.

---

# 34. CODING TASK FORMAT

Agent assignments should contain:

```text
OBJECTIVE

FILES / MODULES IN SCOPE

REQUIREMENTS

OUT OF SCOPE

ACCEPTANCE TESTS

REGRESSION REQUIREMENTS
```

Example:

```text
OBJECTIVE

Implement Pulse in the Living Atom engine.

REQUIREMENTS

Pulse must travel according to actual graph degree.

OUT OF SCOPE

Do not modify authentication or Supabase schema.

ACCEPTANCE

Degree 1 activates before degree 2.
Degree 2 activates before degree 3.
Animation respects reduced-motion settings.

REGRESSION

Existing zoom, pan and recenter functionality must continue working.
```

---

# 35. INITIAL DEVELOPMENT PHASES

## PHASE 0 — FOUNDATION

Repository.

Tooling.

TypeScript.

Testing.

Documentation.

Mock data.

CI.

Known-good baseline.

---

## PHASE 1 — LIVING ATOM

Build the visualization engine using synthetic graph data.

Required:

* central Atom
* Bonds
* degree shells
* animation
* zoom
* recenter
* Pulse
* cluster representation
* responsive layout

No production backend dependency.

---

## PHASE 2 — ATOMS

Implement:

* Atom creation
* public Atom IDs
* public Atom pages
* ownership

---

## PHASE 3 — BONDS

Implement:

* invitations
* mutual confirmation
* duplicate prevention
* expiration
* graph updates

---

## PHASE 4 — GRAPH

Implement:

* degrees
* reach
* shortest paths
* propagation
* Bridge detection
* network statistics

---

## PHASE 5 — SHARING

Implement:

* public sharing
* invitation links
* QR
* growth attribution

---

## PHASE 6 — EMAIL

Implement:

* ownership links
* Bond notifications
* growth milestones
* notification preferences

---

## PHASE 7 — HARDENING

Security.

Performance.

Accessibility.

Abuse controls.

Monitoring.

Production deployment.

---

# 36. FIRST CODEX ASSIGNMENT

Codex should NOT begin by building Atomic Bond features.

Initial assignment:

> Initialize the Atomic Bond repository according to Build Blueprint v0.1.
>
> Add the frozen Master Product Specification v0.1 and Build Blueprint v0.1 under `/docs`.
>
> Establish the application framework, TypeScript configuration, linting, formatting, unit testing, end-to-end testing and CI.
>
> Create the proposed module structure without prematurely implementing product functionality.
>
> Create a deterministic mock graph generator capable of producing the initial 1,000-Atom development network.
>
> Establish a minimal application that builds and runs successfully.
>
> Establish a known-good baseline.
>
> Do not implement Supabase, authentication, email or production Bond creation yet.
>
> Do not alter the product specification.

---

# 37. SECOND CODEX ASSIGNMENT

After the foundation passes review:

> Build the first modular Living Atom visualization engine using the synthetic graph dataset and the approved Atomic Bond concept artwork as the visual target.

This task should receive its own detailed acceptance criteria before implementation begins.

---

# 38. DEFINITION OF DONE

A feature is not complete when it merely appears to work.

A feature is complete when:

**It works.**

**It is tested.**

**It does not break existing functionality.**

**It follows the Master Product Specification.**

**It respects security/privacy requirements.**

**It works on intended viewport sizes.**

**The change is documented.**

---

# 39. ENGINEERING NORTH STAR

Atomic Bond's architecture should allow us to continuously improve the experience without continuously rebuilding the application.

The system should become easier—not harder—to modify as it matures.

The ultimate development loop should be:

```text
IDEA
 ↓
SPEC
 ↓
AGENT TASK
 ↓
IMPLEMENTATION
 ↓
AUTOMATED VERIFICATION
 ↓
PREVIEW
 ↓
HUMAN JUDGMENT
 ↓
MERGE
```

Human beings determine **what Atomic Bond should become.**

Agents accelerate **building it correctly.**
