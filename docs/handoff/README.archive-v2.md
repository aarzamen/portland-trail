# The Portland Trail: Codex handoff

Package version 2 adds the first generated graphics batch. Read `graphics-v1/README.txt` for production status and `graphics-v1/manifest.json` for exact file metadata and original-code id mappings. The three transparent PNGs are concept masters: seven resource icons, four background portraits, and one parked van. Individual fixed-cell exports and animation remain to be produced. The illustrated audit records the app before this graphics batch.

Inspected 1 October 2026. Source: https://heuxnwuv.gensparkspace.com/

Intended project root: `/Users/ama/The Portland Trail` on ama's MacBook Pro. This handoff belongs at `docs/handoff/` within that project. References in this index and the two text briefs are relative to this handoff directory. Root instructions are in `../../AGENTS.md`; placement status is in `../../PROJECT_SETUP.md`.

The MacBook Pro was offline during package preparation. Existing documents on that Mac and its separate “the Portland Trail images” folder remain to be inspected. See `LOCAL_IMAGE_REVIEW.md`; the export-art audit is already complete and is a separate source of evidence.

The premise and visual identity are worth keeping. The rebuild needs coherent event and save rules, correctly assigned illustrations, and a compact phone layout.

Start with `Portland_Trail_Audit.pdf`, then read `HANDOFF_TO_CODEX.txt` and `ASSET_BRIEF.txt`. The original export supplied during the audit matches the deployed HTML, CSS and both JavaScript files byte for byte. It also contains four unused, additional illustrations worth salvaging. The text handoff is ready to paste into a new Codex session when you decide to begin the rebuild. Its recommendations are a proposed brief, not a claim that a new product design has already been approved.

## Package contents

| File / folder | Purpose |
|---|---|
| Portland_Trail_Audit.pdf | Illustrated evaluation and proposed next steps |
| HANDOFF_TO_CODEX.txt | Future rebuild context, priorities, and acceptance criteria |
| ASSET_BRIEF.txt | Graphic production specifications and reusable image prompts |
| graphics-v1/ | Three transparent concept masters, production notes, exact prompts, and asset/id manifest |
| LOCAL_IMAGE_REVIEW.md | Pending review of the separate image folder on the MacBook Pro |
| findings.json | 18 findings with severity, method, observed behavior, and source references |
| asset_inventory.json | All 18 original image files, semantic review, dimensions, hashes, and duplicates |
| provided_export_asset_inventory.json | All 34 exported image files; 20 unique contents and four additional reuse candidates |
| evidence/observations.json | Actual runtime / DOM probe output and HTTP image checks |
| evidence/export_comparison.json | Byte comparison of the supplied 39-file archive against the deployed snapshot |
| evidence/provided-export/ | Exact supplied export, including README, numbered original art, and unused loss image |
| evidence/public-snapshot/ | Published HTML, CSS, two JavaScript files, and all referenced images |
| evidence/screenshots/ | 14 settled desktop / mobile screenshots |
| visuals/ | Published-art contact sheet and selected-screen contact sheet |

## Scope and evidence

The public app was tested with ordinary UI clicks and deterministic event / resource state setup in a separate browser session. Diagnostic setup was used to reach rare events and terminal screens without an unbounded playthrough. The original site was not edited. Both the published snapshot and the supplied original export are included unchanged; no repository history or GenSpark editor was inspected.

Desktop: 1440 x 1000. Phone viewports: 390 x 844 and 430 x 932, in a Chromium browser. These are viewport checks, not physical-device Safari validation. All 18 referenced image URLs returned HTTP 200; 16 image contents are unique. Screenshots wait for the screen fade to finish and visible images to decode. No representative win-rate simulation or exhaustive test of every event branch was performed.

The published snapshot keeps its relative file structure and can be served locally for reference:

```bash
python -m http.server 8000 --directory evidence/public-snapshot
```

Keep the evidence folders separate from the replacement app. The supplied archive confirms a static vanilla JavaScript project, not a React/TypeScript app. Two erroneous live images are screenshots of a different-looking source-file browser; those screenshots are not the architecture of this export. The export's README must not be treated as a verified feature specification. See page 9 of the audit for the comparison and salvage candidates.

`checksums.json` contains SHA-256 hashes for every other file in this package. Original source files and runtime evidence are retained unchanged. Graphics are proposals for the rebuild; no replacement app has been implemented or published.
