# Roadtrip update validation

Verified October 1, 2026 on the MacBook Pro. This supersedes the route counts and static-travel limits in the [first-build record](2026-10-01.md).

## Delivered

- Auto-buy essentials shows the cart, cost and cash remaining before purchase. It tops up existing stock to at least 40 food, 24 fuel, 2 parts and 1 kombucha, increasing food/fuel targets for longer travel to the next shop. Essential fuel/food can use the $100 reserve; extra stock preserves it. Budget-limited and already-stocked states are visible. Nothing buys NFTs automatically.
- A 950ms drive sequence moves scenery and the van, animates mileage, then shows a leg summary. Regions, daylight treatment and weather vary the scene. Saves commit before playback; duplicate actions are blocked. Reduced-motion users receive the same result immediately.
- Four new places at miles 100, 280, 570 and 870 have their own illustrations, activities and one-time conversation rewards. The route has 11 locations total, including departure and Portland.
- Six generated masters are preserved in [graphics-v2](../handoff/graphics-v2/README.md), with exact prompts and source hashes. Five scene copies and five icon sizes are exported for the app.
- Desktop/home-screen icon metadata and a standalone web manifest use relative paths. Existing version 1 saves migrate to version 2 without losing progress.

## Checks

- Rules: **35/35 passed**, including all four backgrounds completing an auto-buy route, cash limits, repeated purchase protection, actual per-stop travel rounding, new location rewards and legacy-save migration.
- Original browser suite: **32 checks passed**, widths 390/414/430/768/1440, keyboard/dialog focus, saves, blocked storage, winning and losing routes. Full visible-control win: developer seed 21, mile 1000, day 18, five survivors. Full loss: same seed, unstocked, mile 280, day 6. These routes use the expanded map.
- Enhancement browser suite: **29 checks passed**, widths 390/414/430/1440. Auto-buy fits the initial phone viewport. Checks cover normal and reduced motion, duplicate clicks, deferred encounters, reload during playback, summary reset/binding, storage failure feedback and all new place images.
- Icon browser checks: root and nested `/games/portland/` hosting both passed. All 16/32/180/192/512px images decode at the declared sizes. Chrome parses the manifest without errors. Start URL and scope resolve within the deployment folder. Manifest MIME is correct.
- Static build passed. Generated production image dimensions and SHA-256 hashes are recorded in [the asset manifest](../../app/assets/generated-manifest.json).
- Independent code review and scoped re-review found no remaining material issues. Original evidence and artwork remain unchanged.

Reports: [original browser suite](roadtrip/browser-report.json), [enhancements](roadtrip/enhancements-report.json), [icons](roadtrip/icons-report.json).

Screenshots inspected: [phone auto-buy](roadtrip/auto-buy-preview-390.png), [phone travel](roadtrip/road-390.png), [driving sequence](roadtrip/driving-1440.png), [mushroom arrival](roadtrip/mushroom-market-430.png), and the new ferry/camp/bookshop scenes. All generated masters and the 192px app icon were visually inspected.

## Limits

Browser evidence uses desktop Chrome with simulated widths. Physical iPhone/Safari and native OS installation are untested. The app has not been published and requires the local server to remain running. Icon metadata does not add offline caching. The retained artwork includes some decorative generated lettering; new images intentionally avoid lettering. Travel uses CSS motion of a single van sprite, not frame-by-frame character animation.
