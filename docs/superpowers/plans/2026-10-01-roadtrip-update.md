# Roadtrip update implementation plan

> Use superpowers:subagent-driven-development for the independent engine and UI tasks. The root agent owns artwork, installation metadata, integration, and verification.

**Goal:** Make preparation easier and travel visibly rewarding, with four new illustrated destinations and an app icon.

**Design:** Keep the green terminal identity and existing static architecture. Auto-buy tops up essentials for the route to the next shop, accounts for inventory, and keeps $100 when essentials permit. A brief user-triggered drive animation shows a moving van, scenery, distance and resource changes; reduced motion gets the same information immediately. Four new stops at miles 100, 280, 570 and 870 bring the route to 11 locations. Existing saves must remain readable. Desktop metadata includes favicon, Apple touch icon and manifest icons.

**Constraints:** Preserve evidence/original assets, stable ids, deterministic rules, terminal states and local saves. No publishing, new runtime dependencies, or offline-service-worker claim. Continue on the clean local feature branch serving this project, as authorized by the project's autonomy instructions.

## Tasks

- [x] Engine: `data.js`, `engine.js`, rule tests. Add `recommendSupplies(state)` returning `{cart,cost,remainingCash,complete,nextShopName,travelDays}` and an `autoPurchase` transition that purchases that exact plan atomically. Prioritize enough fuel and food to next shop, then repair parts and one kombucha; never purchase NFTs automatically. Top up rather than repeat purchases. Use actual per-leg travel rounding. Cover all professions, low cash, stocked inventory, repeat clicks, wrong phase, and roundtrip saves. Add mushroom_market (100, shop/talk), river_ferry (280, rest/talk), forest_camp (570, rest/forage/talk), bookshop (870, shop/talk), with corresponding image paths `assets/mushroom-market.jpg`, `river-ferry.jpg`, `forest-camp.jpg`, `bookshop.jpg`. Give new conversations distinctive effects. Preserve valid original v1 saves with explicit migration if required.
- [x] UI: `main.js`, `styles.css`, new browser enhancement test. Show the auto-buy preview, cost and cash left, buy button, useful no-op/low-cash feedback. Animate a single driving action (~900ms), guard duplicate actions, save before visual playback and defer event modal until playback finishes. Show a persistent last-leg summary and arrival message. Change road backdrop by region/day, use new `assets/road-forest.jpg` and existing van cutout. Add route stop markers/list and distinct place artwork; respect reduced motion, keyboard/focus, 390/414/430px widths and desktop. No engine or index edits.
- [x] Artwork and install: Generate each of four places, a forest-road backdrop without a van, and a square van app icon via built-in imagegen. Preserve generated masters, save optimized app copies, record prompts/provenance. Add manifest, favicon and Apple touch icons. Ensure dev server and build serve/copy manifest with correct MIME.
- [x] Verify and review: Rules suite, full winning/losing browser routes, mobile/desktop screenshot inspection, action double-click/reduced-motion/reload tests, asset/manifest checks, scoped independent review. Update handoff, checksums, and save local Git checkpoint.

## Review focus

Low-cash auto-buy must never overspend or starve fuel by buying luxuries. Partly stocked loadouts must not double-buy. Added stops must not invalidate old saves or make route targets unreachable. Travel playback must not execute twice or swallow pending encounters on reload. Icon paths must work in both served source and built output, including a subdirectory deployment.

## Coordination

Engine and UI run in parallel on disjoint files; both share the recommendation interface above. Root owns icon metadata, generated assets, documentation and integration. The user's instructions to make ordinary choices and carry work through override repeated design-approval gates. No other project work is active and the initial tree is clean.

Result: implemented and reviewed; 35 rules tests, 32 existing browser checks, 29 enhancement checks and root/nested icon checks passed. No remaining material review findings. See the update validation record for limits.
