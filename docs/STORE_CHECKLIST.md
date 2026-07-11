# Store submission checklist

Condensed from SPEC §7 + the roadmap's App Store epic. Ordered roughly by
lead time — start the starred items well before the build is ready.

## iOS

- [ ] ★ `NSLocationWhenInUseUsageDescription` + `NSLocationAlwaysAndWhenInUseUsageDescription`
      strings that name the exact behavior (see `docs/REVIEW_NOTES.md`)
- [ ] ★ UIBackgroundModes `location`; verify tracking survives backgrounding on a dev build
- [ ] ★ In-app disclosure screen shown BEFORE any OS location prompt
- [ ] ★ App Privacy questionnaire: precise location (app functionality, linked),
      name/photo (linked), no tracking. Answers must match `docs/PRIVACY.md`
- [ ] Sign in with Apple present alongside any third-party login (once auth ships)
- [ ] Account deletion reachable in-app (once accounts ship)
- [ ] Hosted privacy policy URL in App Store Connect + in-app settings
- [ ] Screenshots 6.9" + 6.5" (+ 12.9" iPad while `supportsTablet: true`) showing
      real UI: live map, rail, trails, floor chips, recap
- [ ] ≤30 s preview video: invite → converge → arrive
- [ ] Notes for Review pasted from `docs/REVIEW_NOTES.md` + demo path
- [ ] TestFlight internal → external beta before submission

## Android / Play

- [ ] ★ `ACCESS_BACKGROUND_LOCATION` declaration in Play Console + demo video
      of the disclosure flow (their reviewers require the video)
- [ ] ★ Prominent disclosure dialog before runtime permission (Play policy wording)
- [ ] Foreground service with visible notification during active sessions
- [ ] Data Safety form matching `docs/PRIVACY.md`
- [ ] Store listing assets (feature graphic, screenshots)

## Build & release infra

- [x] `eas.json` profiles: development (dev client), preview (internal), production
- [ ] EAS credentials + first TestFlight/Play-internal builds
- [ ] Crash reporting (Sentry) wired with symbolication before external beta
- [ ] EAS Update channel per profile

## Gate

Do **not** submit before the M1 live backend: a simulation-only build risks a
4.2 minimal-functionality rejection (noted in the review playbook).
