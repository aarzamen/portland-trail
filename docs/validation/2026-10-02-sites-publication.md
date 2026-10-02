# Public Sites publication

October 2, 2026. Public game: [The Portland Trail](https://the-portland-trail.annonable.chatgpt.site). The user explicitly authorized public Sites hosting, home-screen icon verification, and committing/pushing all completed work to `main`.

## Publication and source

Sites project `appgprj_6abfa0acc9b88191953f926f6aa70b63` is registered in [.openai/hosting.json](../../.openai/hosting.json). Access mode is `public`, confirmed by Sites and by unauthenticated HTTP/browser access. The [initial deployment receipt](sites-publication/initial-deployment.json) records the first saved version, successful deployment, source SHA `efe815317234349b7229dc47bbc3ca224660a5c0`, and artifact hash. Later housekeeping publications reuse this same project; consult Sites for the current saved version and the visible game stamp for its source commit.

The v4 scene batch and selected v5 splash were fast-forwarded from `codex/scene-art-v4` into `main`, preserving both artwork commits. Source was pushed to GitHub `origin/main` and the Sites source repository before saving the version. The clean committed app was built with its real `main` stamp. The archive contains only `.openai/hosting.json` and the 102 built game files under top-level `dist/`, with 38 shell files precached. Sites requires this supported directory; the local build remains `app/dist/`.

No icon, game rule, CSS, markup or artwork change was required for hosting. Original images and masters remain preserved. Source credentials are short-lived, used in memory for the repository push, and excluded from files and remote URLs.

## Public browser and icon checks

Fresh installed Chrome, without an authenticated profile, opened the public URL directly. [Browser evidence](sites-publication/public-browser.json) records the selected splash at 390×844, 414×896, 430×932 and 1440×900. All title images load at the correct responsive sizes, Start remains visible and at least 44px, and there is no horizontal overflow. Both primary screenshots were visually inspected: [phone](sites-publication/public-title-390x844.png), [desktop](sites-publication/public-title-1440x900.png). Browser console errors: zero.

[Icon evidence](sites-publication/public-icons.json) confirms the public page's 180px `apple-touch-icon` link and the manifest's 192/512px icons. Each returns HTTP 200 as `image/png`, decodes to its declared dimensions, and matches the local built bytes. The manifest parses as `application/manifest+json`, uses relative start/scope URLs and `display: standalone`. These are the icon and launch settings used when saving the web app to a phone's home screen.

[Offline evidence](sites-publication/public-offline.json) confirms the service worker controls the public page, the active cache holds 72 resources after the first complete load, and disabling the browser network then reloading still shows the title and its image. Online connectivity was restored afterwards. The existing full local browser suite also verifies offline play and worker upgrades.

The [public journey smoke check](sites-publication/public-flow.json) used the visible Start, crew, supply, departure and encounter controls. Its fresh browser save reaches 80 miles on day two in the travel phase, with all images loaded and zero console errors. [First-leg screenshot](sites-publication/public-first-leg.png) preserves the result. This is one live hosting check; the full local journey suite supplies the winning and losing-route regression evidence.

## Regression and closeout

- The selected splash passed 211 rules tests, six browser suites with 835 checks, type checking, and 205 focused candidate/integration checks before publication; see [splash validation](2026-10-02-splash-v5.md).
- Local formatting passes. GitHub CI passed on the publication source, including rules tests, checksum manifests, formatting and type checking: [CI run](https://github.com/aarzamen/portland-trail/actions/runs/37006275014).
- Project instructions, setup, README and handoff index identify the public Site and preserved image sources. The [session closeout](../handoff/SESSION_CLOSEOUT.md) records remaining follow-ups.
- Checksum manifests are refreshed before each task-owned commit. Final publication is built from the pushed clean `main` snapshot; final status is checked in Sites and against the public build stamp.

The phone checks are viewport emulation, not a physical iPhone installation. Physical home-screen installation/play, WebKit, and hearing sound on a device remain unverified. No signing/account changes, schedules, private network bindings or custom domains were created.
