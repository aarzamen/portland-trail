# The Portland Trail development handoff

Updated October 1, 2026. The first playable replacement is implemented in [app/](../../app/), with setup, supplies, travel, encounters, save/resume, and distinct endings. Start with [Project setup](../../PROJECT_SETUP.md) for runnable commands and [Validation](../validation/2026-10-01.md) for evidence.

## Read next

1. [Root instructions](../../AGENTS.md) and [latest roadtrip update validation](../validation/2026-10-01-roadtrip-update.md).
2. [Implementation design](../superpowers/specs/2026-10-01-playable-rebuild-design.md) and [completed plan](../superpowers/plans/2026-10-01-playable-rebuild.md).
3. [Illustrated original audit](Portland_Trail_Audit.pdf), [rebuild brief](HANDOFF_TO_CODEX.txt), and [18 original findings](findings.json).
4. [Local image review](LOCAL_IMAGE_REVIEW.md), [deployed inventory](asset_inventory.json), [export inventory](provided_export_asset_inventory.json), and [current app asset manifest](../../app/assets/manifest.json).
5. [Asset brief](ASSET_BRIEF.txt), [graphics notes](graphics-v1/README.txt), [concept manifest](graphics-v1/manifest.json), and [new locations and app icon](graphics-v2/README.md).

## Preservation and placement

The [version 2 archive](../../Portland_Trail_Project_Handoff_v2.zip) has been unpacked into this project. Its extra AGENTS.md was removed at the user's request in the earlier review; the root instructions are unchanged. The two conflicting handoff documents were retained alongside the local versions as [original package index](README.archive-v2.md) and [original pending image review](LOCAL_IMAGE_REVIEW.archive-v2.md). Relative links remain valid from those sibling locations; their status statements describe the earlier staging session.

The [public snapshot](evidence/public-snapshot/) and [provided export](evidence/provided-export/) are unchanged reference evidence. All original local JPEGs and three PNG masters are preserved. The game's images are separate copies with semantic names. Local and exported numbered filenames sometimes depict different subjects; mappings must follow visual contents.

The current Git branch is `feat/playable-rebuild`, with local commits and no remote. The archive remains the historical package; current loose-file checksum manifests describe the reconciled local files. No new archive has been prepared.

## Implemented behavior

- Four backgrounds with actual abilities, five editable names, and clean New Game.
- Eleven locations from the co-op to Portland, including a mushroom market, ferry landing, forest camp and used-book shop with distinct conversation rewards.
- Auto-buy tops up food, fuel, repair supplies and kombucha, accounting for current stock, actual travel legs and cash. Essentials can use the emergency reserve; extra stock leaves $100. Repeated clicks do not buy the same loadout again.
- Nine encounters with stable ids and exactly-once pending tokens. Events resume after loading.
- Permanent death, affordable action checks, nonnegative inventory, and terminal states that stop further play.
- Seed bombs and kombucha have usable actions; parts repair the van; NFTs can be sold in shops or traded at the fair.
- Version 2 local saves validate shape and coherent state; validated original version 1 journeys migrate without resetting progress. The browser storage key remains unchanged. Unreadable saves and storage failures are surfaced visibly.
- Responsive green illustrated interface, real portrait/icon exports, quantity purchases, keyboard background selection, and native event dialogs.
- Travel animates the van, road and mileage for 950ms, then shows the latest leg's distance, supplies and arrival. Reduced motion skips playback. Game state saves before animation; pending encounters appear afterward and survive reload.
- Desktop/home-screen manifest icons, Apple touch icon and favicons are included in both the preview and static build. Root and nested hosting paths were checked.

Balance intentionally differs from the original: prices and travel distances make resupply workable. The original starting cash/food/fuel values are retained. Current exact rules and ability descriptions live in [data.js](../../app/src/data.js). A good-weather event on the open road grants 20 miles; at an arrived stop it grants 2 fuel and preserves the opportunity to resupply. The critical encounter remains a rare losing event. The small seeded simulation is regression evidence, not a measured human-player difficulty study.

## Remaining work

The local build is ready for playtesting. Real-device Safari and native OS installation, user feedback on difficulty and humor, removal of remaining decorative generated lettering in older scenes, and stricter visual consistency between scene vehicles remain. Sites tooling was discoverable, but its local building/hosting skills were unavailable during initial development; no Site was created or published. The static build is portable for a subsequent hosting task. There is no offline cache or audio.

Do not mistake the original audit findings for current test failures. See the validation record for the rebuild's tested behavior and actual limits.
