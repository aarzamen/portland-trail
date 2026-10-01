# The Portland Trail handoff

Prepared October 1, 2026 for the next project session.

The handoff package is present as [Portland_Trail_Project_Handoff_v2.zip](../../Portland_Trail_Project_Handoff_v2.zip). It contains the earlier audit, original source snapshots, image inventories, screenshots, and three concept masters. The project root also contains [AGENTS.md](../../AGENTS.md) and [19 local images](../../images/). No replacement app has been built in this session.

## Completed this session

- Reviewed the full root AGENTS.md and the archive's setup document, handoff index, rebuild brief, asset brief, graphics production notes and manifest, local-image status, and 18 structured findings.
- At the user's request, removed `The-Portland-Trail/AGENTS.md` from the ZIP. It was byte-identical to the root AGENTS.md, which remains unchanged.
- Removed the deleted file's entry from the archive's root `checksums.json`. Both archive checksum manifests pass verification, as does the ZIP integrity check. All other member contents remain unchanged; the archive now contains 100 files.
- Reviewed all 19 local images and recorded dimensions, hashes, proposed uses, and limitations in [Local image review](LOCAL_IMAGE_REVIEW.md).

An initial folder inspection occurred before the ZIP appeared in the directory listing. The package is now verified present; earlier missing-package observations are superseded by this document.

## Current layout and evidence

The project root is `/Users/ama/The Portland Trail`. It is a local folder without Git metadata. There is no active app structure outside the ZIP. The archive's vanilla HTML/CSS/JavaScript snapshots are reference evidence for a future rebuild.

The ZIP has a `The-Portland-Trail/` prefix. Its contents remain compressed; no archive files have been extracted into the project. The local `docs/handoff/README.md` and `LOCAL_IMAGE_REVIEW.md` are this session's new documents. When unpacking later, preserve the archived versions separately and reconcile deliberately instead of overwriting these local reviews.

Key paths inside the archive, beneath `The-Portland-Trail/`:

| Path | Role |
|---|---|
| `PROJECT_SETUP.md` | Historical staging and placement status |
| `docs/handoff/README.md` | Original package index and evidence scope |
| `docs/handoff/Portland_Trail_Audit.pdf` | Illustrated evaluation; present and hash-verified, not read in this session |
| `docs/handoff/HANDOFF_TO_CODEX.txt` | Rebuild priorities and 12 acceptance checks |
| `docs/handoff/ASSET_BRIEF.txt` | Style and production contract |
| `docs/handoff/findings.json` | 18 findings: five P0, ten P1, three P2 |
| `docs/handoff/asset_inventory.json` and `provided_export_asset_inventory.json` | Original image inventories; present and hash-verified |
| `docs/handoff/evidence/` | Source snapshots, runtime observations, and screenshots |
| `docs/handoff/graphics-v1/` | Three PNG concept masters, production notes, prompts, and manifest |

The archive's old instructions to merge its AGENTS.md are superseded by the user's removal request. Use the project-root AGENTS.md. Historical archive documents otherwise remain unchanged.

## Review of the instructions

AGENTS.md clearly defines the premise, original preservation rules, game-rule priorities, and verification requirements. Its referenced materials are available inside the ZIP, although most referenced paths are not yet populated as loose files. Its use of “checkout” should not be taken as evidence of a Git repository.

Preserve the funny road trip to Portland, five named travelers, four satirical backgrounds, scruffy loaded van, scarce resources, and green handheld-game / terminal identity. Keep interface text live and accessible. Resource ids are `money`, `food`, `fuel`, `ammo`, `parts`, `kombucha`, and `nft`; profession ids are `influencer`, `dev`, `prepper`, and `barista`. Here `ammo` means seed bombs and `parts` means repair supplies.

The supplied brief proposes Sites for a later replacement and hosting. This session authorizes document preparation and archive cleanup; no implementation or deployment was performed.

## Important image distinction

The available local collection is `images/`. All 19 files are distinct 1024 × 1024 RGB JPEGs. None matches an exported image byte for byte. Some identical filenames describe different subjects: local 00003 is an illness character and local 00018 is a checkpoint scene, while the archived review identifies export 00003 as a rest stop and export 00018 as a departure bedroom. Never copy mappings by filename alone.

The separately named “the Portland Trail images” folder has not been independently identified. This review covers the local `images/` folder. The archive additionally supplies three transparent concept masters; its production notes explicitly say they are not finished sprite cells or animation. Their visual quality was not evaluated in this session.

## Next steps when implementation is requested

1. Unpack and reconcile the handoff package into the expected project paths while preserving the root instructions, local reviews, and original evidence. Read the illustrated audit and inspect source and graphics directly.
2. Resolve artwork by actual contents using both inventories and the local review. Confirm whether another image folder or source layers exist. Choose one consistent van design before making frames.
3. Recheck for new user work, establish appropriate version control, and use `app/` if no implementation has appeared. Keep evidence snapshots unchanged.
4. Prioritize F01–F07: critical event outcomes, clean New Game, synchronized display/save updates, restored pending events, permanent death, affordable travel costs, and terminal transitions. Then correct image mappings, location actions, profession behavior, and route balance.
5. Use versioned serializable saves and stable ids; keep rules separate from rendering. The supplied brief requires no backend or live model.
6. Verify every acceptance check in HANDOFF_TO_CODEX.txt, including one seeded successful route and one seeded losing route, coherent saves, replay, nonnegative resources, keyboard controls, and dialog focus. Inspect widths 390, 414, 430, 768, and 1440px. Record whether real-phone Safari was available.

## Verification limits

The archive findings are prior audit evidence, not defects independently reproduced here. This session checked archive integrity, both checksum manifests, original-file preservation, image metadata, and local document links. It did not run the game, inspect the PDF pages, test a browser or physical device, install dependencies, initialize Git, or publish a site.
