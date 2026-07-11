# App Review notes — Arrival

Paste-ready notes for the App Store Connect "Notes for Review" field, plus our
response playbook for the common location-app rejections. Location apps get
extra scrutiny; the goal is that a reviewer never has to guess.

## What Arrival does (for the reviewer)

Arrival is a **session-scoped group live map**: friends heading to the same
place (a road trip, a mall meetup) join a temporary session via an invite
link and see each other's position, ETA, and route trace until everyone
arrives. It is a coordination layer, not a navigator and not a persistent
people-tracker.

## The tracking model (why background location)

- Location is shared **only while the user has joined an active session with
  sharing on**. There is no ambient or always-on tracking.
- Sessions have a **hard expiry** (2–24 h, shown at join time). At expiry —
  or on leave, or on toggling sharing off — tracking stops immediately.
- Background location keeps a member's position flowing to their group while
  they use their preferred navigation app (Google Maps/Waze/Apple Maps) —
  the core use case is glancing at the convoy while someone else navigates.
- Joining always requires an explicit preview-card confirmation showing who
  is in the session and exactly what sharing means. A link click alone never
  starts sharing.
- Only last-known position is retained; no position history server-side (v1).

## How to review without a second device

The build includes the demo simulation (the same code path our marketing
uses): **Start a session → Mall meetup (or Road trip) → Create**. Simulated
members move on real routes; every feature — live map, floor levels, trails,
stops & votes, arrival recap, archive — is exercisable solo in ~4 minutes.
No account, no second phone, no location permission required for the demo.

## Rejection playbook

| Guideline | Likely complaint | Our response |
|---|---|---|
| 2.5.4 | "App uses background location without persistent visible benefit" | Background location is the product: the user's group is actively watching their position during a session they explicitly joined; sharing hard-stops at session expiry. Video of the disclosure + expiry flow attached. |
| 5.1.1 | "Purpose strings unclear" | `NSLocation*` strings name the exact behavior ("shares your live position with this session's members until the session ends"). In-app disclosure screen precedes any OS prompt. |
| 5.1.2 | "Data shared with third parties?" | Position data goes only to the user's session members via our backend; never sold, never used for ads; App Privacy labels match. |
| 4.2 | "Minimal functionality (demo)" | v1 ships with live multi-device sessions (M1 backend); the simulation is an onboarding/demo mode, not the product. Do not submit before M1 is live. |

## Submission checklist pointers

See `docs/STORE_CHECKLIST.md` for the full pre-submission checklist and
`docs/PRIVACY.md` for the draft policy that backs the App Privacy answers.
