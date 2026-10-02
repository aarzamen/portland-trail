# The Portland Trail

Five travelers, one unreliable van, and a thousand miles to Portland.

An Oregon Trail-style road trip in the browser, with a green handheld-console look. Pick a background (influencer, gig-economy developer, doomsday prepper or artisanal barista), name your crew, stock the van and drive. Eleven stops, fourteen roadside encounters, sickness, weather, permanent death and a scored ending with headstones. Saves stay in your browser; a built copy plays offline.

## Play

Open [The Portland Trail](https://the-portland-trail.annonable.chatgpt.site) — public, no sign-in required. The game includes a phone home-screen icon and standalone web-app manifest. A completed first load caches the game for offline play; saves stay in that browser and origin.

The selected Road Ahead splash and five dedicated region/encounter scenes are integrated. All three splash alternatives and their prompts are preserved in [graphics-v5](docs/handoff/graphics-v5/README.md).

## Play it locally

Node 22 or newer. No install is needed to play.

```bash
cd "/Users/ama/The Portland Trail/app"
npm run dev
```

Open http://127.0.0.1:4173. `npm start` builds a stamped copy into `app/dist/` and serves that instead.

## Develop

```bash
cd "/Users/ama/The Portland Trail/app"
npm test               # rules, fuzz and balance tests
npm ci                 # once, for Playwright, Prettier and TypeScript
npm run test:browser   # browser suites in installed Chrome
```

- Rules and content: [app/src/data.js](app/src/data.js) and [app/src/engine/](app/src/engine/).
- Interface: [app/src/main.js](app/src/main.js) and [app/src/ui/](app/src/ui/).
- Art: [app/scripts/prepare-assets.py](app/scripts/prepare-assets.py) regenerates every file in `app/assets/` from the preserved originals.

Instructions for coding agents, including how to add new scenes, are in [AGENTS.md](AGENTS.md). Setup notes and known limits are in [PROJECT_SETUP.md](PROJECT_SETUP.md). The design behind version 0.2 is in [the design spec](docs/superpowers/specs/2026-10-01-review-implementation-design.md), and the review it implements is in [docs/reviews/](docs/reviews/).

## Status

Version 0.2.0 implements the October 1 code review, item by item (see the status table at the top of the review). The [implementation validation](docs/validation/2026-10-01-review-implementation.md), [scene validation](docs/validation/2026-10-02-scene-art-v4.md), [splash validation](docs/validation/2026-10-02-splash-v5.md), and [public hosting validation](docs/validation/2026-10-02-sites-publication.md) list the checks and their limits. GitHub CI passes. On October 2, the user confirmed that the game works on their physical iPhone 15 Pro.
