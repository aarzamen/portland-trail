# The Portland Trail development handoff

Updated October 2, 2026. Version 0.2.0 of the game is implemented in [app/](../../app/), with setup, supplies, travel, encounters, deaths and epitaphs, scored endings, save/resume and offline play. Start with [Project setup](../../PROJECT_SETUP.md) for runnable commands and the [0.2 validation record](../validation/2026-10-01-review-implementation.md) for evidence.

## Read next

1. [Root instructions](../../AGENTS.md), [0.2 validation](../validation/2026-10-01-review-implementation.md), [balance measurement](../validation/2026-10-01-balance.md), and the earlier [iPhone validation](../validation/2026-10-01-iphone-polish.md) and [roadtrip update validation](../validation/2026-10-01-roadtrip-update.md).
2. [Code and architecture review](../reviews/2026-10-01-code-and-architecture-review.md) with its status table, the [0.2 design](../superpowers/specs/2026-10-01-review-implementation-design.md) and [0.2 plan](../superpowers/plans/2026-10-01-review-implementation.md); the first rebuild's [design](../superpowers/specs/2026-10-01-playable-rebuild-design.md) and [plan](../superpowers/plans/2026-10-01-playable-rebuild.md).
3. [Illustrated original audit](Portland_Trail_Audit.pdf), [rebuild brief](HANDOFF_TO_CODEX.txt), and [18 original findings](findings.json).
4. [Local image review](LOCAL_IMAGE_REVIEW.md), [deployed inventory](asset_inventory.json), [export inventory](provided_export_asset_inventory.json), and [current app asset manifest](../../app/assets/manifest.json).
5. [Asset brief](ASSET_BRIEF.txt), [graphics notes](graphics-v1/README.txt), [concept manifest](graphics-v1/manifest.json), [new locations and app icon](graphics-v2/README.md), and [new road scenes](graphics-v3/README.md). The last two describe exports and scripts that 0.2 replaced with one script, [prepare-assets.py](../../app/scripts/prepare-assets.py), and one [asset manifest](../../app/assets/manifest.json).

## Preservation and placement

The [version 2 archive](../../Portland_Trail_Project_Handoff_v2.zip) has been unpacked into this project. Its extra AGENTS.md was removed at the user's request in the earlier review; the root instructions are unchanged. The two conflicting handoff documents were retained alongside the local versions as [original package index](README.archive-v2.md) and [original pending image review](LOCAL_IMAGE_REVIEW.archive-v2.md). Relative links remain valid from those sibling locations; their status statements describe the earlier staging session.

The [public snapshot](evidence/public-snapshot/) and [provided export](evidence/provided-export/) are unchanged reference evidence. All original local JPEGs and the generated PNG masters are preserved. The game's images are derived copies with semantic names, written only by the asset script. Local and exported numbered filenames sometimes depict different subjects; mappings must follow visual contents.

The current Git branch is `main`, published in [aarzamen/portland-trail](https://github.com/aarzamen/portland-trail) with the full local commit history. The `origin` remote uses SSH. The separate private `aarzamen/The-Portland-Trail` repository remains unchanged. The archive remains the historical package; current loose-file checksum manifests, written by `app/scripts/checksums.mjs`, describe the reconciled local files. No new archive has been prepared.

## Implemented behavior

- Four backgrounds with structured abilities whose descriptions are built from their numbers, five editable names with Shuffle, and a road choice: a random seed, today's seed or a typed one.
- Eleven stops from the co-op to Portland and six road regions. Stops differ: a paid motel night, a free camp rest, a meal at the food carts, conversations with rewards, forage yields by region. A stop's activities are enforced by the engine.
- Fuel follows miles. The forecast under Drive shows today's miles, fuel and health change, the range and the next fuel stop, and warns of a shortfall. A dry tank never ends the journey: push the van, walk for fuel or trade the roof luggage.
- Auto-buy plans for the stretch to the next shop, leg by leg, and respects each item's maximum; the shop has steppers, Max and Buy. Seed bombs are a food gamble; kombucha heals and cures.
- Fourteen encounters defined as data, picked by weight and mile range, five with a response only one background can take. Each resolves exactly once and resumes after loading. The outbreak is answerable (kombucha, quarantine or drive through).
- Weather lasts and clears; sickness costs health daily until treated. Every death records its cause, writes a line and opens a memorial with an editable epitaph. The journey is lost only when nobody is left.
- Endings with a score, a rank, days of Portland rent, headstones, the whole journal, Copy result and Share, best journeys and Replay this seed. Moving a journey between devices with a code or a save file.
- Save version 3 in one record; versions 1 and 2 migrate. Unreadable saves are kept and reported; storage problems show in a banner, everything else in toasts.
- The interface draws only what the engine reports and redraws only changed regions. Encounters cannot be dismissed by Escape; after a choice the dialog shows what happened.
- Green token-based look, Portland Pixel headings, banded health bars, a labelled route map with a moving van, console touches and optional generated sound. Controls are at least 44px on phones, editable text 16px, nothing below 12px, no horizontal scrolling from 320 to 1440px, and all motion stops under reduced motion.
- 27 WebP scenes at two sizes, with the title, victory, loss and breakdown signs repaired. A stamped build with versioned URLs and a service worker for offline play.

Exact rules and numbers live in [data.js](../../app/src/data.js) and the [0.2 design](../superpowers/specs/2026-10-01-review-implementation-design.md). Balance is measured with three bots in the [balance note](../validation/2026-10-01-balance.md): never shopping always loses, Auto-buy alone wins about 45%, careful play wins every journey. That measurement is a regression yardstick, not a study of human players.

## Remaining work

Version 0.2 was checked in installed Chrome at twelve viewports from 320×568 to 1440×900; see the validation record. Physical iPhone play, the installed home-screen app on a device, a WebKit run and hearing the sound on a device remain. CI has not yet passed on GitHub for this version. User feedback on difficulty and humor is still needed: careful play almost never loses a traveler. Garbled decorative lettering remains in six older scenes, and several regions and encounters reuse road scenes until new art is made through the process in [AGENTS.md](../../AGENTS.md). No Site was created or published; the static build is portable for a hosting task. Moving this archive to a GitHub release is the owner's decision.

Do not mistake the original audit findings for current test failures. See the validation record for the tested behavior and actual limits.
