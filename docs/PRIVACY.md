# Arrival privacy policy — DRAFT

> Status: working draft for the v1 (M1 backend) release. Needs legal review
> before the store listing links to a hosted copy. The demo build collects
> nothing (everything is on-device); this drafts the policy for live sessions.

## The short version

Arrival shows your live position to the people in a session you chose to
join, for as long as that session runs, and then stops. That's the product,
and it's also the whole data story.

## What we collect, and why

| Data | When | Why | Retention |
|---|---|---|---|
| Precise location, heading, speed | Only while you're in an active session with sharing on | So your session members can see you on the shared map | Last-known position only; no server-side movement history in v1. Session traces (trails) live on your device. |
| Floor/altitude signals (barometer, `CLLocation.floor`) | Same window as location | The "which floor?" feature | Same as location |
| Display name + profile photo | Account creation | Identify you to your group | Until you delete your account |
| Step estimate | Derived on device from distance walked | Session stats | On your device |
| Push token | If you enable notifications | Stop/arrival/expiry alerts | Until sign-out |

## What we never do

- No selling or sharing data with third parties for advertising.
- No tracking outside an active session — leaving a session, toggling
  sharing off, or session expiry stops location collection immediately and
  server-side (the session channel closes at expiry regardless of client
  state).
- No background collection for users who haven't joined a session.

## Your controls

- **Session expiry** is shown before you join; nobody can be tracked past it.
- **Leave / stop sharing** any time; effect is immediate.
- **Archived sessions** (your own traces) are stored on your device; delete
  them by deleting the archive entry or the app.
- **Account deletion** is available in Settings and removes your profile,
  memberships, and media without contacting support.

## Contact

privacy@arrival.app (to be stood up before submission).
