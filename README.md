# The Portland Trail

<!-- intro: Mike writes this -->
(Mike: one paragraph on why this exists.)

Five travelers, one unreliable van, and a thousand miles to Portland: an Oregon Trail-style road trip in the browser, with a green handheld-console look, for anyone who wants a short, funny survival game on a phone or a desktop.

Pick a background (influencer, gig-economy developer, doomsday prepper or artisanal barista), name your crew, stock the van and drive. Eleven stops, fourteen roadside encounters, sickness, weather, permanent death and a scored ending with headstones. Saves stay in your browser; a built copy plays offline.

## Play

Open [The Portland Trail](https://the-portland-trail.annonable.chatgpt.site) — public, no sign-in required. The game includes a phone home-screen icon and standalone web-app manifest. A completed first load caches the game for offline play; saves stay in that browser and origin.

## Screenshots

<!-- screenshots: placeholder. There is no docs/screenshots/ folder yet; add PNGs there and embed them here. -->
_Placeholder: no `docs/screenshots/` folder exists yet._ Real captures from the validation runs are in [docs/validation/sites-publication/](docs/validation/sites-publication/) (the public title screen at 390, 414, 430 and 1440 pixels wide, and the first leg of a journey), [docs/validation/review-implementation/](docs/validation/review-implementation/) (title, road, shop, encounter, journal, memorial and both endings on phone and desktop) and [docs/validation/iphone/](docs/validation/iphone/) (phone viewports and Safari in the iOS Simulator).

## What the game does

- Four satirical backgrounds (Social Media Influencer, Gig Economy Developer, Doomsday Prepper, Artisanal Barista), each with its own ability: run a collab, salvage parts, scout for food or brew coffee. Five travelers, named by you.
- Eleven stops over a thousand miles, from a parents' guest room to Portland, through six road regions. Six stops sell supplies; the others offer rest, foraging, a meal or a talk. Pace and rations set how fast the van moves and how fast the food goes, and the weather (clear, perfect drizzle, heatwave) changes both.
- Fourteen roadside encounters, from doomscrolling and an NFT auction to a Sasquatch, a toll troll and a brunch line, most with a choice that costs or pays.
- Seven scarce supplies: cash, kale chips, bio-diesel, seed bombs, washi tape and vintage screwdrivers for repairs, kombucha and a pixelated Sasquatch JPEG. Auto-buy plans a shop run for the stretch ahead and shows the bill before it buys.
- Hunger, sickness and the road wear travelers down. Death is permanent, and every traveler who dies gets an epitaph and a headstone. An empty tank is not the end: push the van or hitchhike for fuel, at a price.
- Scored endings with ranks from Technically Arrived up to Portland Royalty (Roadside Legend or Cautionary Tale when the road wins), and a records list of your ten best runs.
- Saves are versioned and stay in the browser; saves from earlier versions still load. Copy a save code or download a save file to move a journey to another device. The daily seed, or a seed of your own, gives a repeatable road.
- A built copy registers a service worker and plays offline, with a home-screen icon and web manifest. Optional sound from Web Audio tones, keyboard operation with visible focus, and all motion stops under reduced motion.

## Run it locally

Node 22 or newer. Playing needs no install: the game is static, with no runtime dependencies and no backend.

```bash
git clone https://github.com/aarzamen/portland-trail.git
cd portland-trail
npm run dev
```

Open http://127.0.0.1:4173 and keep that terminal running. The other root scripts:

```bash
npm run build      # stamped, versioned build in app/dist/
npm run preview    # build, then serve the build (with the offline worker) on http://127.0.0.1:4173
npm test           # rules, encounters, saves, fuzz, balance and tooling tests; no install needed
```

The root `package.json` only delegates to [app/](app/), where the game's own package lives. `PORT=0` picks a free port when 4173 is taken.

## Develop

```bash
cd app
npm ci                 # once, for Playwright, Prettier and TypeScript
npm run test:browser   # browser suites in installed Chrome
npm run format:check   # Prettier
npm run typecheck      # TypeScript over JSDoc
npm run checksums      # refresh checksums.json and docs/handoff/checksums.json before a merge to main
npm run assets         # regenerate app/assets from the preserved originals (needs uv)
```

- Rules and content: [app/src/data.js](app/src/data.js) and [app/src/engine/](app/src/engine/).
- Interface: [app/src/main.js](app/src/main.js) and [app/src/ui/](app/src/ui/).
- Art: [app/scripts/prepare-assets.py](app/scripts/prepare-assets.py) regenerates every file in `app/assets/` from the preserved originals.

Instructions for coding agents, including how to add new scenes, are in [AGENTS.md](AGENTS.md). Setup notes and known limits are in [PROJECT_SETUP.md](PROJECT_SETUP.md). The design behind version 0.2 is in [the design spec](docs/superpowers/specs/2026-10-01-review-implementation-design.md), and the review it implements is in [docs/reviews/](docs/reviews/).

## Status and limits

Version 0.2.0 implements the October 1 code review, item by item (see the status table at the top of the review). The [implementation validation](docs/validation/2026-10-01-review-implementation.md), [scene validation](docs/validation/2026-10-02-scene-art-v4.md), [splash validation](docs/validation/2026-10-02-splash-v5.md), and [public hosting validation](docs/validation/2026-10-02-sites-publication.md) list the checks and their limits. GitHub CI runs the tests, the checksum check, formatting and types on every push and pull request. On October 2, the user confirmed that the game works on their physical iPhone 15 Pro.

The selected Road Ahead splash and five dedicated region/encounter scenes are integrated. All three splash alternatives and their prompts are preserved in [graphics-v5](docs/handoff/graphics-v5/README.md).

The scope of a 1.0 is undecided. Known limits:

- Careful play almost never loses a traveler; more risk would need rule changes, listed in the [balance note](docs/validation/2026-10-01-balance.md).
- Six older scenes carry garbled decorative lettering, some regions and encounters reuse road scenes, and one ending line is still open (review item B18).
- Browser tests run in installed Chrome; there is no automated WebKit or Safari run. Phone play was confirmed by hand on an iPhone 15 Pro.
- In a short phone landscape viewport the Start screen scrolls; it stays operable.
- The 14 MB handoff archive at the repository root stays until the owner decides on a GitHub release (review item E6).
- The asset pipeline needs [uv](https://docs.astral.sh/uv/); everything else needs only Node 22.

## Licence

MIT, Copyright (c) 2026 Aaron Arzamendi. See [LICENSE](LICENSE).

The game ships no third-party code or assets: the runtime has no dependencies, the Portland Pixel typeface is drawn in-house from the glyph sheet in [app/scripts/pixel-font.txt](app/scripts/pixel-font.txt), and the artwork is the project's own (the owner's scene collection in [images/](images/) and the generated masters, with their prompts, under [docs/handoff/](docs/handoff/README.md) graphics-v1 to v5). Development tools are fetched at development time under their own permissive licences and are not part of the game: Playwright and TypeScript (Apache-2.0), Prettier and @types/node (MIT), and the asset pipeline's Pillow, fontTools and Brotli (MIT-style).
