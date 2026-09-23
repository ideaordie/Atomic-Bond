# ATOMIC BOND — AGENT INSTRUCTIONS

## 1. AUTHORITY

Before performing substantial work in this repository, read:

1. `docs/MASTER_SPEC_v0.1.md`
2. `docs/BUILD_BLUEPRINT_v0.1.md`

The Master Product Specification defines what Atomic Bond is.

The Master Product Specification v0.1 is FROZEN.

Do not modify, reinterpret, replace, or silently contradict the Master Product Specification.

The Build Blueprint defines the current engineering architecture. It may be refined when implementation reveals a better technical approach, but material architectural changes must be proposed before implementation.

If the Master Product Specification and Build Blueprint conflict, the Master Product Specification takes precedence.

---

## 2. PRODUCT PRINCIPLE

Atomic Bond exists to reveal human interconnectedness through mutually confirmed relationships.

Core model:

* Person = Atom
* Confirmed relationship = Bond
* Extended connected network = Molecule
* Connection between network regions = Bridge
* Self-sustaining downstream growth = Chain Reaction
* Visual propagation through Bonds = Pulse
* Combined human network = Global Bond

Working principle:

> See how connected we already are.

Do not transform Atomic Bond into a conventional social network.

---

## 3. PROTECTED PRODUCT RULES

Do not introduce or assume:

* followers
* public popularity scores
* conventional Likes
* comments
* engagement feeds
* influencer rankings
* public email addresses
* precise public locations
* financial rewards for Bonds
* daily streak mechanics
* compulsive notification systems

These require an explicit product-specification revision.

---

## 4. TRUST RULE

A direct Bond represents a mutually affirmed relationship.

Indirect connection does NOT imply transferred trust.

If:

A is Bonded to B

and

B is Bonded to C

the system may say:

"A is connected to C through B."

It must NOT imply:

"A trusts C."

Never calculate or display inferred trustworthiness from indirect Bonds.

---

## 5. PRIVACY

Collect and expose the minimum information necessary.

Public information may include:

* Atom public ID
* optional display name or alias
* confirmed Bonds
* coarse geographic information
* network statistics
* propagation statistics

Private information includes:

* email
* authentication data
* security metadata
* notification preferences
* precise location information

Private information must never appear in public API responses or visualization data.

Never expose authentication tokens.

---

## 6. BOND INTEGRITY

A Bond must be mutually confirmed.

Never create an authoritative Bond solely because one participant requested it.

Production Bond creation must eventually include:

* server-side validation
* duplicate prevention
* invitation expiration
* authorization
* confirmation state
* abuse controls

Only confirmed Bonds participate in the public connection graph.

---

## 7. ARCHITECTURAL SEPARATION

Maintain separation between:

* UI
* Living Atom visualization
* graph algorithms
* application services
* data access
* authentication
* notifications
* database infrastructure

Do not place arbitrary database operations directly inside presentation components.

Do not place product/business logic inside the visualization renderer.

---

## 8. LIVING ATOM

The Living Atom is a dedicated visualization subsystem.

It consumes generic graph data.

It should not care whether that data came from:

* mock fixtures
* Supabase
* tests
* APIs
* cached data

The Living Atom owns:

* rendering
* node positioning
* Bond visualization
* motion
* particles
* Pulse animation
* zoom
* pan
* recentering
* clustering
* transitions

It does NOT own:

* authentication
* authoritative Bond creation
* email
* database security
* invitation validation

---

## 9. GRAPH LOGIC

Graph calculations must be deterministic.

Do not use AI or probabilistic reasoning to determine:

* Bond validity
* degrees of separation
* shortest paths
* reachable Atom counts
* Bridge detection
* propagation counts

These must use deterministic software algorithms and database logic.

---

## 10. DEVELOPMENT METHOD

For every substantial task:

1. Read the relevant specification.
2. Inspect the existing implementation.
3. Identify the smallest appropriate change.
4. Implement modularly.
5. Add or update tests.
6. Run relevant tests.
7. Run regression tests.
8. Review the resulting diff.
9. Verify responsive behavior when UI is affected.
10. Report exactly what changed and what was tested.

Do not declare a task complete merely because the application compiles.

---

## 11. STABLE CODE

Treat working functionality as valuable.

Prefer targeted modifications over broad rewrites.

Do not replace stable modules merely because another implementation appears cleaner.

Refactoring should have a concrete reason such as:

* correctness
* security
* performance
* maintainability
* testability
* required architectural separation

Preserve behavior through tests before significant refactoring.

---

## 12. SCOPE CONTROL

Stay within the requested task.

Do not opportunistically redesign unrelated systems.

If you discover an unrelated improvement:

1. document it,
2. explain why it may be useful,
3. leave it unchanged unless required for the current task.

---

## 13. ARCHITECTURAL CHANGES

Minor implementation choices may be made autonomously.

Before making a material architectural change:

1. explain the limitation of the current architecture,
2. describe the proposed change,
3. explain benefits,
4. explain tradeoffs,
5. identify affected modules,
6. wait for approval.

Do not silently replace major technologies or architectural patterns.

---

## 14. DATABASE CHANGES

Database changes must be represented through migrations.

Do not rely on undocumented manual production database modifications.

Schema changes should include appropriate tests.

Security-sensitive tables must use Row Level Security where appropriate.

---

## 15. TESTING

Testing is part of implementation.

Maintain:

* unit tests
* graph tests
* integration tests
* security tests
* end-to-end tests
* visual regression tests where appropriate

Bug fixes should include a regression test whenever practical.

---

## 16. MOCK NETWORK

Maintain a deterministic synthetic network for development and regression testing.

The mock graph should eventually contain approximately:

* 1,000 Atoms
* 3,000–5,000 Bonds
* multiple clusters
* disconnected components
* known Bridges
* long paths
* multiple geographic regions

Because the dataset is deterministic, known graph calculations must produce repeatable results.

---

## 17. RESPONSIVE DESIGN

Atomic Bond is mobile-first.

Any significant UI change should be checked at representative mobile, tablet, and desktop dimensions.

Primary reference sizes:

* 390 × 844
* 768 × 1024
* 1440 × 900

Do not optimize desktop at the expense of mobile usability.

---

## 18. ACCESSIBILITY

Interactive controls should be keyboard accessible where applicable.

Maintain readable contrast.

Use semantic controls.

Support screen readers for important actions and metrics.

Respect `prefers-reduced-motion`.

Important information must not exist exclusively as animation.

---

## 19. PERFORMANCE

Do not render enormous graphs naïvely.

Use progressive representation.

Nearby connections may appear individually.

Distant network regions may become clusters, aggregates, density fields, or other scalable representations.

Do not create millions of DOM elements to represent millions of reachable Atoms.

Optimize based on measurement rather than speculation.

---

## 20. SECURITY

Security regressions are release blockers.

Pay particular attention to:

* private email exposure
* authentication bypass
* unauthorized Atom modification
* duplicate Bond creation
* invitation replay
* expired invitations
* public/private data boundaries
* injection risks
* rate limiting
* RLS behavior

Never weaken a security rule merely to simplify implementation.

---

## 21. VERSIONING

Maintain explicit application versions.

Record accepted functional changes in `docs/CHANGELOG.md`.

Do not overwrite historical release meaning.

Stable milestones should be identifiable.

---

## 22. DOCUMENTATION

Update documentation when behavior or architecture materially changes.

Code and documentation should not knowingly contradict each other.

Avoid unnecessary documentation churn for trivial implementation details.

---

## 23. TASK COMPLETION REPORT

When finishing a substantial task, report:

### Implemented

What changed.

### Files Changed

Important files created or modified.

### Tests

What was run and whether it passed.

### Visual Verification

For UI work, what viewport sizes or screenshots were checked.

### Known Issues

Anything incomplete or uncertain.

### Suggested Next Step

The logical next task without automatically implementing it.

---

## 24. DEFINITION OF DONE

A feature is done only when:

* required behavior works,
* appropriate tests pass,
* existing functionality has not regressed,
* security/privacy requirements remain satisfied,
* relevant responsive behavior is verified,
* documentation is updated where necessary,
* the implementation follows the Master Product Specification.

---

## 25. HUMAN AUTHORITY

Agents implement Atomic Bond.

Humans determine what Atomic Bond becomes.

When product intent is ambiguous, preserve the existing product specification rather than inventing a new direction.
