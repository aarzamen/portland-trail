# The Portland Trail — agent instructions

## Project and intent

The user-designated project root is `/Users/ama/The Portland Trail` on ama's MacBook Pro. Use this checkout as the working project. Derive paths from the actual project root when running elsewhere; do not hard-code cloud scratch paths into the app or documentation.

Preserve the premise: a funny Oregon Trail-inspired road trip to Portland, five named travelers, four satirical backgrounds, a scruffy loaded van, scarce resources and absurd Pacific Northwest encounters. Preserve the green handheld-game / terminal visual identity. The delivered audit and artwork provide a starting point, not a requirement to reproduce every defect or accept every proposal.

The current handoff covers evaluation, art preparation and project organization. A future request to build, fix, continue an approved implementation, or publish authorizes the work necessary to complete that request. Do not infer a deployment request from the mere presence of this file.

## Work autonomously within the user's task

- Carry an authorized task through inspection, implementation, relevant verification, documentation and a usable result. Do not stop after a plan or ask whether to continue routine work.
- Make ordinary reversible choices yourself: file organization, small refactors, bug fixes, local previews, targeted tests, dependency changes needed by the task, art inventory and document maintenance. Use the existing project conventions and prefer the smallest sound solution.
- Resolve routine implementation details from the brief and source. State reasonable assumptions and keep moving. Ask only when missing information materially changes scope or an action is destructive, costly, externally consequential, or outside the authorization already given.
- An explicit request to deploy or publish is authorization for that deployment subject to the available Sites workflow. Prepare and verify the concrete result before any genuinely required final approval. Do not ask again for approval already given.
- Inspect the working tree first. Preserve unrelated user edits and original artwork. Use an isolated branch or worktree where it helps. Do not reset, force-push, delete original assets, or overwrite unrelated work as a shortcut.
- Report progress briefly and regularly. Finish with what changed, what was checked and any actual remaining blocker. Do not claim a file was inspected, an image was integrated, or a test passed without evidence.
- These instructions do not override system/tool restrictions or authorize access to unrelated private data, secrets, paid services, or messages to other people.

## Read and maintain these documents

All paths below are relative to this project root:

| Path | Role |
|---|---|
| `PROJECT_SETUP.md` | Placement, known state and pending device-access work |
| `docs/handoff/README.md` | Handoff index and evidence scope |
| `docs/handoff/Portland_Trail_Audit.pdf` | Illustrated evaluation of the original app |
| `docs/handoff/HANDOFF_TO_CODEX.txt` | Proposed rebuild priorities and acceptance criteria |
| `docs/handoff/ASSET_BRIEF.txt` | Style and graphic-production contract |
| `docs/handoff/findings.json` | 18 findings with evidence and proposed checks |
| `docs/handoff/asset_inventory.json` | Deployed image inventory and semantic review |
| `docs/handoff/provided_export_asset_inventory.json` | Exported originals and salvage candidates |
| `docs/handoff/graphics-v1/README.txt` | New graphic masters and remaining production work |
| `docs/handoff/graphics-v1/manifest.json` | File metadata and original-code id mappings |
| `docs/handoff/LOCAL_IMAGE_REVIEW.md` | Status and workflow for the separate local image folder |

Keep links relative within the project. Whenever a document or asset moves, update all affected links, manifests and code references. Preserve historical evidence paths and original filenames unless making a clearly recorded copy. Refresh the package checksum manifest when preparing a new handoff archive.

## Source and image preservation

`docs/handoff/evidence/public-snapshot/` and `docs/handoff/evidence/provided-export/` are reference evidence. Keep these originals unchanged and build the replacement in the project's existing app structure, or a separate `app/` directory if none exists. Check the actual folder before choosing a structure; do not overwrite an existing implementation with the legacy export.

Find and inspect the user's folder called “the Portland Trail images” on this Mac. Resolve its actual spelling and location before recording paths. Inventory files and dimensions, hash duplicates, visually review every distinct image, and identify gems by what the pictures contain. Prioritize reusable scenes, van designs, portraits, icons and usable source layers. Record candidate filenames, proposed event/location roles, required edits and any limitations in `docs/handoff/LOCAL_IMAGE_REVIEW.md`. Keep originals and copy selected assets into the implementation. Do not claim that this separate folder was reviewed based only on the old exported-image inventory.

The three new PNGs in `docs/handoff/graphics-v1/` are high-resolution transparent concept masters. They are not fixed-grid atlases, final 32/64/128px sprites or animation. Separate, simplify, align and inspect assets at their intended display sizes before integration. Derive van frames from one consistent silhouette and luggage arrangement. Use an image-generation/editing tool for requested generative image work; use appropriate production tools for explicitly requested extraction, sizing and cleanup.

Preserve original data ids until a deliberate migration: resources `money`, `food`, `fuel`, `ammo`, `parts`, `kombucha`, `nft`; professions `influencer`, `dev`, `prepper`, `barista`. Here `ammo` means seed bombs and `parts` means repair supplies.

## Rebuild priorities and verification

Use the Sites building and hosting capabilities available in the implementation session when the user requests the replacement. Prefer a small maintainable frontend and versioned serializable saves. No live model or backend is required by the original game. Keep rule transitions separate from rendering; save stable ids rather than functions.

Fix fresh-game/reset behavior, save/load coherence, event resolution, terminal states, permanent death and resource affordability before cosmetic expansion. Preserve concrete humor. Correct image mappings before regenerating all scenes. Keep interface text live and accessible.

Run checks relevant to the change, with particular attention to the acceptance criteria in the handoff. Verify one successful route and one losing route when changing the game loop. For UI work, inspect 390/414/430px phone widths and a desktop viewport, keyboard operation and dialog focus. State when a real-device browser was unavailable. Use meaningful tests for behavioral changes; do not invent tests that merely restate markup or over-test simple documentation edits.
