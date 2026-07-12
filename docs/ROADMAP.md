# Arrival roadmap

The slice ladder the PRs are cut from. **This file is the source of truth** — put
new slices here, and reference the slice ID in the PR title/body.

> ## Why this file exists
>
> The original roadmap was never committed. Every PR cites it — "Roadmap **B1**",
> "Roadmap item `feat/nav-deeplinks` (size S)", "the roadmap's App Store epic",
> "Closes roadmap `store/review-notes`" — but it lived outside the repo and is not
> recoverable from git, any branch, the reflog, or unreachable objects.
>
> This is reconstructed from the fossil record: 21 PR bodies, the branch names
> (which are the roadmap's own slugs), `SPEC.md`, and `docs/PROJECT_STATE.md`.
> Slice IDs and sizes are **quoted from the PRs where they exist**; anything
> inferred is marked `(inferred)`. Don't let it drift out of the repo again.

## The gate

**Do not submit to the App Store before the live backend ships.** A
simulation-only build reads as *minimal functionality* and is rejected under
guideline **4.2** (see `docs/REVIEW_NOTES.md`). This makes **B6** the critical
path for both the product and the store — not any piece of store paperwork.

---

## Epic B — Live backend

Demo → real multi-device sessions.

| Slice | What | Status | PR |
|---|---|---|---|
| **B1** | Supabase schema layer: migrations, RLS, RPCs, client scaffold | Shipped | #16 |
| **B2** | Live session create/join, wired to the RPCs behind the config gate | Shipped | #17 |
| **B3** | **Universal & deferred invite links** | **Skipped** | — |
| **B4** | Realtime positions: private `trip:{id}` channel, 3 s publish, 30 s snapshot | Shipped | #19 |
| **B5** | Background & adaptive tracking (SPEC §5.4 lifecycle) | Open | — |
| **B6** | Live stops, votes & reactions | **Next** | — |

**B3 was silently skipped.** PR #17 says *"Android's enter-code UI arrives with
B3's universal links."* It never landed, so join-by-code is still an iOS-only
prompt and **Android cannot join a session at all**. This hole is invisible in
the code — nothing is broken, the UI simply doesn't exist.

**Do not infer B5/B6 order from the numbers.** PR #19 explicitly chose B6 next.

### B6 — the next slice

Live mode currently returns empty stops and surfaces *"Live stops & votes arrive
with the next backend PR."* The tables (`stops`, `stop_participants`,
`stop_votes`, `trip_events.reactions`) already exist.

1. Define and test pure row-to-domain, vote, participant and reaction helpers.
2. Load and subscribe to stops, participants, votes and relevant events for the
   active trip, under the existing RLS.
3. Implement live announce/suggest/join/vote/react mutations without changing
   demo behavior.
4. Extend `scripts/verify-backend.mjs` with two-member stop/vote/reaction round trips.
5. Validate typecheck, lint, unit tests, schema CI, and a real two-device flow.

Keep the `Simulation` adapter boundary intact and preserve the Supabase-off demo
fallback. Do **not** fold background tracking, universal links or Places search
into this change unless the scope is explicitly revised.

---

## Epic A — Accounts

Named in PR #19: *"live members are photo-less until real profiles (A epic)."*

| Slice | What | Status |
|---|---|---|
| **A1** | Real auth & profiles (inferred) | Open |

Anonymous sign-in only today. This blocks real avatars, Sign in with Apple, and
in-app account deletion — the last two are **store requirements**, not features.

---

## Epic D — Demo & delight

The solo-reviewable path. A reviewer must be able to exercise every feature on
one device in ~4 minutes, with no account and no location permission.

| Slice | What | Status | PR |
|---|---|---|---|
| **D2** | Shareable arrival recap card | Shipped | #12 |
| **D3** | Reactions on the activity timeline | Shipped | #13 |
| **F15** | Session archive + per-member retrace, locked viewport | Shipped | #8, #21 |

---

## Epic S — Stability

| Slice | What | Status | PR |
|---|---|---|---|
| — | Error boundary + global error toast | Shipped | #5, #18 |
| — | `infra/crash-telemetry` — Sentry (`componentDidCatch` is the marked hook point) | Open | — |
| — | Maestro E2E lane (deferred in #9: "needs a simulator lane") | Open | — |

---

## Epic: App Store

Ordered by lead time. Full detail in `docs/STORE_CHECKLIST.md`; reviewer-facing
language in `docs/REVIEW_NOTES.md`; the data story in `docs/PRIVACY.md`.

### Blocked on product

- [ ] **B6** — live stops/votes (the 4.2 gate)
- [ ] **B3** — universal links (Android can't join today)
- [ ] **A1** — real auth & profiles
- [ ] **B5** — background tracking (it *is* the core use case)
- [ ] Live arrival order + server-side archives
- [ ] Stale-member UI & channel lifecycle on expiry
- [ ] Leave / stop-sharing controls

### iOS (★ = long lead time)

- [ ] ★ Location purpose strings naming the exact behavior
- [ ] ★ `UIBackgroundModes: location`, verified on a dev build (not Expo Go)
- [ ] ★ In-app disclosure screen shown **before** any OS prompt
- [ ] ★ App Privacy questionnaire, matching `docs/PRIVACY.md`
- [ ] Sign in with Apple · in-app account deletion
- [ ] Screenshots, ≤30 s preview video, Notes for Review
- [ ] TestFlight internal → external

### Play (★ = long lead time)

- [ ] ★ `ACCESS_BACKGROUND_LOCATION` declaration + demo video of the disclosure flow
- [ ] ★ Prominent disclosure dialog (Play's policy wording)
- [ ] Foreground service with a visible notification during sessions
- [ ] Data Safety form
- [ ] Store listing assets

### Legal & infra

- [x] `eas.json` profiles — development / preview / production
- [ ] ★ Privacy policy out of draft → legal review → hosted URL
- [ ] ★ Stand up `privacy@arrival.app` — **it does not exist yet**, and it blocks
      the privacy policy, which blocks the App Privacy answers
- [ ] EAS credentials + first TestFlight/Play-internal builds
- [ ] Sentry with symbolication, before external beta
- [ ] EAS Update channel per profile

---

## F16 — Family mode: finding a kid, safely

Arrival already has every primitive this needs: the **mall scenario**, **vertical
awareness** (which floor someone is on), **clustering**, **arrival detection**,
and **retrace**. "Where is my kid?" at a mall, theme park, festival or airport is
this product pointed at the highest-stakes version of its own use case — and the
floor signal is the part no mall map can give you.

**What it is**

- **Outing sessions, not a tracker.** A guardian starts a session for the venue;
  it expires like any other session.
- **Find mode**: bearing + distance + floor — *"Maya · 40 m NE · Level 2"*.
- **Reunite**: retrace pointed forward — a live path *to* them, not just a dot.
- **Stay-in-zone**: a geofence around the venue; a nudge if a child leaves it.
- **Help button** on the child's device — pings every guardian with position and floor.
- **Last-seen** that survives a dead battery or lost signal.

**What keeps it safe**

- **Session-scoped, never ambient** — the same hard expiry as every other session.
- **The child sees who can see them**, always, on their own screen. No invisible watcher.
- **Guardian pairing is explicit** and device-to-device — not a link anyone can forward.
- **Data minimization**: last-known only, no server-side movement history.
- **Age gate + verifiable parental consent** — COPPA / GDPR-K are not optional here.

> ### Read this before building it
>
> Arrival's entire privacy thesis — the one that answers the 2.5.4 rejection — is
> *"a coordination layer, not a persistent people-tracker."* A child-finding
> feature strains that sentence harder than anything else we could build, and it
> changes the store posture materially: family/child data pulls in COPPA, GDPR-K,
> and a much harsher App Privacy review.
>
> It is worth doing. It is **not** worth doing as an always-on tracker bolted onto
> the side. Ship it as *outing mode* — bounded, consensual, visible to the child —
> or the thesis breaks and the rejection playbook in `docs/REVIEW_NOTES.md` stops
> working.

---

## Worth building next

Ranked by leverage per unit of work.

| Feature | Size | Why |
|---|---|---|
| **Live Activity / Dynamic Island** | M | Convoy status while the user is in Google Maps/Waze. Already a SPEC v1.1 candidate — and it *is* the answer to a 2.5.4 rejection: visible, persistent benefit. |
| **Reunite navigation** | S | Retrace, inverted: a live path *to* a member. The geometry already exists. Cheapest big win on the list. |
| **Android enter-code UI** | S | The B3 fallout. Not a feature — a hole. Android literally cannot join a session. |
| **Trip memories** | S | The archive holds every trace; add photos pinned where they were taken. The retrace screen is the best thing in the app and it's currently a dead end. |
| **Real ETAs (Routes API)** | M | Straight-line ETA is the biggest lie the app tells. Every convergence claim in the UI depends on this number being true. Decisions D2/D5 still open. |
| **Battery saver + stale handling** | M | M3 exit criteria. A wrong dot is worse than a grey one. |
| **Leader mode** | M | Follow one car's route; ETAs measured against the leader, not the destination. SPEC v2 candidate. |
| **Waypoint planning** | L | A shared itinerary agreed before the trip — stops become a plan, not interruptions. SPEC v1.1. |

---

Sources: 21 PR bodies · branch names · `SPEC.md` · `docs/PROJECT_STATE.md` ·
`docs/STORE_CHECKLIST.md` · `docs/REVIEW_NOTES.md` · git log through `f82bf25`.
