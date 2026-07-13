# Expo HAS CHANGED

This project is on Expo SDK 54. Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

Before starting work, read `docs/PROJECT_STATE.md` for the current handoff point,
verified baseline, and next planned backend slice.

**Anything inside `<MapView>` — markers, trails, polylines, the camera,
selection — is governed by `.claude/skills/arrival-map/SKILL.md`. Read it
first. It is enforced by `src/map-contract.test.ts`; if that test fails you
have broken the map, and you must not "fix" the test.** The map is the product:
pucks that vanish or flash make everything else irrelevant. Note that marker
bugs CANNOT be reproduced or validated in Expo Go (it forces the New
Architecture, where rn-maps #5911 lives) — use a dev build:
`npx expo run:ios --device`.

Other UI work follows `.claude/skills/arrival-ui/SKILL.md`; the live/Supabase
layer follows `.claude/skills/arrival-live/SKILL.md`.
