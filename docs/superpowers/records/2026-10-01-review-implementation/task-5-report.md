# Task 5 report: one asset pipeline, WebP scenes and sign repairs

**Status:** DONE_WITH_CONCERNS (the concerns are judgment calls and stale references in files other tasks own; see the end)

**Commit:** `dbe884b` feat: one asset pipeline; WebP scenes, repaired signs, sprites and icons from preserved masters. It holds 151 paths, all of them mine: `app/scripts/prepare-assets.py`, `app/scripts/pixelfont.py` (PEP 723 pins only), the two deleted `.mjs` scripts, and `app/assets/**`. Not pushed.

## What was built

`app/scripts/prepare-assets.py` is now the only asset script. It is a PEP 723 script pinned to `pillow==12.3.0`, `fonttools==4.66.1` and `brotli==1.2.0`. It finds the project root from its own path, so `uv run app/scripts/prepare-assets.py` from the root and `npm run assets` from `app/` behave the same. It sets `sys.dont_write_bytecode = True` before importing `pixelfont` from its own folder. `--only scenes|sprites|icons|font` limits the run; the manifest is rebuilt every time from the files on disk, so a limited run still writes a complete manifest.

What it does, in order:

- **Scenes (27 ids, spec section 7).** It crops the source, applies the sign repairs, then encodes two files with `method=6`: `scenes/<id>.webp` at quality 82, at most 1536 wide and never enlarged, and `scenes/<id>-960.webp` at quality 78, 960 wide, with a narrower source kept at its size (`bike-convoy` is 754 wide in both). Heights are rounded half up. A crop that falls outside its source raises an error instead of padding with black.
- **Repairs as data.** Each `REPAIRS` entry holds `was` (what the sign said), `rect` (left, top, right, bottom in the cropped image, right and bottom exclusive, like a crop box), `fill`, `color`, `lines` (`[{text, scale}]`) and `gap`. The rectangle is painted flat. The lines are set with `pixelfont.draw_text` at whole-number scales and centred as one block, using the glyphs' lit rows. A line that does not fit inside the rectangle with at least 1px to spare raises an error.
- **Sprites.** These use the old script's rectangles, the alpha floor of 35, padding of 8, `ImageOps.contain` with LANCZOS, and centring into cells of 128×128, 64×64 and 256×128. They go to `sprites/portrait-<profession>.png`, `sprites/resource-<item>.png` and `sprites/van.png`, and every one is **byte-identical** to the old copy, so Git records them as renames.
- **Icons.** The same five names and sizes (192, 512, 180, 32, 16, all RGB), resized with Pillow LANCZOS from `docs/handoff/graphics-v2/app-icon.png`.
- **Font.** `pixelfont.build_woff2(load_glyphs(GLYPH_SHEET), FONT_FILE)`, then `pixelfont.check_font` reads the file back against the sheet. The result is byte-identical to the committed font.
- **Manifest.** `manifest.json` has `{version: 2, tools, assets}` with 72 entries sorted by `file`, each holding `file, source, source_sha256, crop, repairs, width, height, bytes, sha256`, plus a trailing newline. `tools` lists pillow, fonttools and brotli (see self-review item 1). The font entry has `width` and `height` set to `null`.
- **Previews.** These go to `app/test-results/assets/`, which Git ignores:
  - `scenes.png`: all 27 scenes as shipped to phones, with both sizes.
  - `repair-<scene>.png`: before and after, whole and at 390px wide.
  - `repair-<scene>-<n>.png`: each sign at 1×, at 390px wide ×4, and enlarged.
  - `sprites.png`: sprites at 1× and 2×, and the icons.

  The "before" images go through the same WebP encoding as the "after" images. The script writes nothing outside `app/assets/` and `app/test-results/assets/`; the old script wrote to `/private/tmp`.
- **Write and report.** A file is written only when its bytes change, and each run prints how many files changed per category. Any file under `app/assets` that the script does not make is listed as a warning.

## Commands and output

First run, before the sign iterations (the old files were still present):

```
$ time uv run app/scripts/prepare-assets.py
scenes: 54 files, 5,659,132 bytes, 54 changed
sprites: 12 files, 181,952 bytes, 12 changed
icons: 5 files, 296,682 bytes, 5 changed
font: 1 files, 1,732 bytes, 0 changed
fonts/portland-pixel.woff2: sha256 26e6ba4909e139f4da9236c661e4a828fb016bd2e9f9f9fab73ea9fa1bf70ddb, matches the glyph sheet
manifest.json: 72 files, changed
previews in app/test-results/assets: scenes.png, repair-title.png, repair-victory.png, repair-loss.png, sprites.png
87 files under app/assets are not made by this script: bookshop.jpg, breakdown.jpg, crypto.jpg, departure.jpg, … …
uv run app/scripts/prepare-assets.py  6.79s user 0.15s system 65% cpu 10.649 total
```

Two `--only scenes` runs followed for the sign iterations below; each changed only the two files of the scene it touched. Next came `git rm -r` of the old files. I used `:(glob)app/assets/*.jpg` and `:(glob)app/assets/*.png` because a plain `app/assets/*.png` pathspec also matches `icons/*.png`, and I dry-ran it first; it listed exactly 89 paths. `app/assets/` then held only `fonts/ icons/ manifest.json scenes/ sprites/` (1 + 5 + 54 + 12 files). The second full run:

```
$ uv run app/scripts/prepare-assets.py
scenes: 54 files, 5,660,124 bytes, 0 changed
sprites: 12 files, 181,952 bytes, 0 changed
icons: 5 files, 296,682 bytes, 0 changed
font: 1 files, 1,732 bytes, 0 changed
fonts/portland-pixel.woff2: sha256 26e6ba4909e139f4da9236c661e4a828fb016bd2e9f9f9fab73ea9fa1bf70ddb, matches the glyph sheet
manifest.json: 72 files, unchanged
previews in app/test-results/assets: scenes.png, repair-title.png, repair-title-1.png, repair-victory.png, repair-victory-1.png, repair-victory-2.png, repair-victory-3.png, repair-victory-4.png, repair-loss.png, repair-loss-1.png, sprites.png
```

"0 changed" means every freshly encoded file equalled the existing bytes. Further checks, all identical:

- `env -u PYTHONDONTWRITEBYTECODE npm --prefix app run assets` (started in `app/`, with bytecode writing allowed): 0 changed everywhere, and `find app -name __pycache__` found nothing. To show this test was meaningful, I imported a copy of `pixelfont.py` in the scratchpad with the variable unset: without the guard a `__pycache__/` appeared, and with the guard it did not.
- `uv run --python 3.12 app/scripts/prepare-assets.py`: 0 changed everywhere. The other runs used uv's default Python 3.13.
- A sha256 snapshot of all 73 files under `app/assets` taken before these runs matched afterwards (`IDENTICAL`).
- After the commit, one more full run, then `git status --short`: **empty**. That means no change under `images/` or `docs/`, no `__pycache__`, and the font unchanged.
- Font: sha256 `26e6ba4909e139f4da9236c661e4a828fb016bd2e9f9f9fab73ea9fa1bf70ddb`, 1,732 bytes, and `check_font` passed on every run.

Comparison with the old files (scratch scripts, not in the repository):

- **Sprites.** All 12 have identical pixels and identical bytes.
- **Icons.** These are compared with `HEAD`, because they are rewritten in place. Against the old macOS `sips` output, the mean difference is 0.7–4.1 levels and the maximum is 33–67 at edges, as expected from a different resampler. I looked at the 16px and 32px favicons enlarged next to the old ones: they look the same, slightly crisper. The new files are smaller: 512 is 221,569 bytes against 265,481.
- **Scenes.** Each new full-size WebP against its old desktop JPEG gives a mean difference of 0.46–3.73 levels for all 24 old scenes, so the crops are reproduced exactly. The highest is victory, which includes the repairs. The three graphics-v3 scenes were compared after scaling the new 1536-wide files down to the old 1280 width.

## Bytes: old scene files against new

| | files | bytes |
|---|---:|---:|
| old desktop JPEG (`app/assets/*.jpg`) | 24 | 7,543,500 |
| old phone JPEG, 640 wide | 24 | 2,114,187 |
| old phone JPEG, 960 wide | 24 | 4,239,399 |
| **old total** | 72 | **13,897,086** |
| new full-size WebP | 27 | 3,586,262 |
| new 960 WebP | 27 | 2,073,862 |
| **new total** | 54 | **5,660,124** |
| new, the same 24 scenes only: full size / 960 | 24 + 24 | 3,397,842 / 1,922,986 |

For the same 24 scenes, desktop files are 55% smaller: 7.54 MB down to 3.40 MB. That holds even though the three graphics-v3 scenes are now 1536 wide instead of 1280, as the spec asks. Phone files at 960 against 960 are also 55% smaller: 4.24 MB down to 1.92 MB. Overall the set goes from 13.9 MB to 5.66 MB (−59%), even though it gains three scenes and drops the 640 copies.

## Sign repairs

Here is how the rectangles and colours were found. I made character maps and runs of fill-like pixels per row and column (scratch scripts), which gave each sign's interior and the extent of the old lettering. Each rectangle is the largest one whose own outermost rows and columns are all sign fill, which keeps it clear of stepped corners, rims and borders, and which still contains all the old lettering. Colours were sampled from the cropped original:

- **Fill:** the per-channel median of the rectangle's pixels within 24 levels of the rectangle's overall median.
- **Lettering:** the per-channel median of the 15% of old-stroke pixels farthest from the fill, so the stroke cores rather than the anti-aliased edges.

Every repair was compared before and after at 1×, enlarged, and at 390px wide (taken from the 960 file, as a phone shows it). No repair was dropped.

| sign | rect (crop px) | fill / lettering | lines (scale), gap | placement |
|---|---|---|---|---|
| title "GLOBL WARMING" | 874,442,979,478 (105×36) in 1024×730 | `#8ccb7f` / `#1e4317` | GLOBAL (2), WARMING (2), gap 2 | 70×14 at 891–960, 445–458; 86×14 at 883–968, 461–474; 3px above and below |
| victory White Stag | 208,314,416,398 (208×84) in 1024×849 | `#9eca84` / `#23381c` | WHITE STAG (3), PORTLAND OREGON (2), gap 10 | 168×21 at 228–395, 333–353; 172×14 at 226–397, 364–377 |
| victory plate | 222,413,389,434 (167×21) | `#a0c987` / none | blank | n/a |
| victory plate, lower lip | 225,434,361,436 (136×2) | `#a0c987` / none | blank | n/a |
| victory Powell's | 738,324,887,390 (149×66) | `#22301c` / `#acd394` | POWELL'S (3), BOOKS (3), gap 9 | 135×21 at 745–879, 331–351; 87×21 at 769–855, 361–381 |
| loss Game Over | 797,228,975,291 (178×63) in 1024×685 | `#1c421d` / `#85b578` | GAME OVER (3), NO SIGNAL (2), gap 8 | 156×21 at 808–963, 238–258; 96×14 at 838–933, 267–280 |

Before and after images are in `app/test-results/assets/`. Each scene has a whole view before and after, at full size and at 390px wide, in `repair-title.png`, `repair-victory.png` and `repair-loss.png`. Each sign has its own close-up: `repair-title-1.png`, `repair-victory-1.png` (White Stag), `-2` (plate), `-3` (plate lip), `-4` (Powell's) and `repair-loss-1.png`.

### Title: GLOBAL WARMING

The interior is x 871–984 by y 442–478, with stepped corners, a shaded left rim and a textured bottom bevel. The old lettering covered x 876–977 by y 453–471, including a stray tail under the G, and was about 14px tall with 2px strokes.

I tried three layouts:

- **One line at scale 1** (82×7). It reads on a desktop, but its 1px strokes are finer than anything else in the picture, it looks like small print on a big sign, and at 390px wide it almost disappears.
- **One line at scale 2.** This would be 164px wide, but the sign is 105px wide inside, so it does not fit.
- **Two lines at scale 2** (chosen), compared at gaps of 2 and 4. Gap 4 left only 2px below.

With two lines the letters have the same height (14px) and the same 2px stroke as the original. The sign reads "GLOBAL WARMING" at full size and is still legible at 390px.

**Judgment:** it looks native and reads as a real two-line sign. It is fuller than the original, with 3px of margin above and below. The spec names the words, not the line break, so I took the two-line layout as within the spec.

### Victory: White Stag

The interior is x 200–424 by y 310–400 with stepped corners. The old lettering covered x 210–412 by y 318–393 in heavy block letters about 36px tall with strokes of about 8px. "WHITE STAG" at scale 4 would be 224px, the entire interior, so scale 3 is the largest that fits. "PORTLAND OREGON" has to be scale 2: at scale 3 it would be 258px. I compared gaps of 8, 10 and 12 and kept 10.

**Judgment:** it looks native. It is clean, centred and legible at full size and at 390px, and it now uses the same face at the same size as the Powell's sign beside it. It is visibly **lighter** than the original's heavy lettering, and the sign has more empty fill around the text. This is the repair I would expect a reviewer to question; see concerns.

### Victory: the plate beneath

The plate is two overlapping light shapes. The left one hangs to y 437 and the right one ends at y 433, with a notch where they meet. The first rectangle (222,413,389,434) blanked the garbled text, but at 9× a 4px foot of the first glyph was still visible at x 233–236, y 434. One rectangle cannot reach it without painting over the right half's bottom border. I added a second blank strip, 225,434,361,436, over the left half's lower lip, all plate fill apart from that remnant, and checked again at 9×: it is clean.

**Judgment:** the plate reads as a plain blank plate. Its border, notch and lighter lip are intact.

### Victory: Powell's

The rectangle is the inner panel inside its black outline, which runs at x 735–736 and 887–890 and at y 321–323 and 390–392. The old letters were 22px tall at y 332–353 and 362–384; the new ones are 21px tall at y 331–351 and 361–381.

**Judgment:** native, and the best of the set. It has the same size, weight, colour and position, and now reads POWELL'S BOOKS. The panel's faint texture is now flat; the spec asks for a flat interior.

### Loss: Game Over

The rectangle sits inside the sign's black inner line. The old lettering covered x 799–959 by y 236–287. The old first line was 27px tall; scale 4 would be 208px, wider than the 178px interior, so it is scale 3 with the smaller second line at scale 2, as in the original.

**Judgment:** native. "GAME OVER / NO SIGNAL" reads as the original layout did, in the original colours, and is legible at 390px. The strokes are slightly lighter than the original's 4px.

## Files

Changed:

- `app/scripts/prepare-assets.py`: rewritten.
- `app/scripts/pixelfont.py`: PEP 723 block only, now `fonttools==4.66.1`, `brotli==1.2.0`, `pillow==12.3.0`.
- `app/assets/icons/*.png`: 5 files, regenerated.
- `app/assets/manifest.json`: new format.

Added:

- `app/assets/scenes/*.webp`: 54 files.
- `app/assets/sprites/*.png`: 12 files, renamed from `app/assets/*.png` with identical bytes.

Unchanged: `app/assets/fonts/portland-pixel.woff2`, rebuilt byte-identical.

Removed:

- `app/assets/*.jpg`: 24 files.
- `app/assets/mobile/`: 48 files.
- `app/assets/generated-manifest.json`, `app/assets/mobile-art-manifest.json`, `app/assets/mobile-images.json`.
- `app/scripts/prepare-generated-assets.mjs`, `app/scripts/prepare-mobile-art.mjs`.

Scratch analysis scripts and images stayed in the session scratchpad, outside the project.

## Self-review findings and open points

1. **The `tools` field lists more than the brief's example.** The brief shows `{ "pillow": … }`. I added `fonttools` and `brotli` because the font is listed in the manifest and is built with them.
2. **The repair data has three extra fields.** `scale` is per line, because White Stag and Game Over keep the original's larger first line. `gap` is the line spacing. `was` records the old text.
3. **The plate is two rectangles**, as two blank repairs, for the reason given above.
4. **The title sign layout changed from one line to two.** One line in the face cannot fit at a size that matches the picture.
5. **White Stag and Game Over are lighter than the originals.** Both mix scale 3 over scale 2 in one sign. That echoes the originals' smaller second lines, but it does mix two pixel sizes. The only way to add weight would be to embolden the face, which would no longer be the pixel typeface, so I did not.
6. **The icons are not byte-identical** to the old `sips` output, because the resampler differs. Names, sizes and RGB mode are unchanged.
7. **Stale references in files I do not own**, left alone:
   - `app/src/main.js` and `app/tests/browser-enhancements.mjs` still use the old `.jpg`, `mobile/` and sprite paths. This was expected.
   - `checksums.json` at the root still lists 75 removed asset paths and none of the new ones, so `node app/scripts/checksums.mjs --check` (the CI step) fails until someone runs `node app/scripts/checksums.mjs`.
   - `docs/handoff/graphics-v2/README.md` and `docs/handoff/graphics-v3/README.md` link to `generated-manifest.json`, `mobile-art-manifest.json`, `app/assets/mobile/` and `prepare-mobile-art.mjs`. Spec section 2 makes `docs/handoff/` read-only, so those links stay broken unless the owner decides otherwise. Some files under `docs/superpowers/` and `docs/validation/` also mention the old files as history.
8. **The WebP bytes depend on the libwebp version bundled in the pinned Pillow wheel.** A Pillow built from source against another libwebp could give different bytes. Identical bytes were confirmed under Python 3.12 and 3.13.
9. **No browser has displayed the new WebP files in this task**, because the interface still points at the JPEGs. All inspection used Pillow-decoded previews.

---

## Fix round 1

**Status:** DONE

**Commit:** `6d156a5` fix: recropped bike-convoy, motel and wifi; breakdown sign reads THE PORTLAND TRAIL; checked repair and crop bounds. It holds 10 paths: `app/scripts/prepare-assets.py`, `app/assets/manifest.json` and both sizes of `bike-convoy`, `breakdown`, `motel` and `wifi` under `app/assets/scenes/`. Committed by path; not amended, not pushed.

### 1. Crops

All three kept the values in the amended spec. At 8× nothing called for a nudge.

| scene | final crop | size (full / 960) | what I checked |
|---|---|---|---|
| `bike-convoy` | 287, 250, 1024, 900 | 737×650 / 737×650 (not enlarged) | See below. |
| `motel` | 0, 195, 1024, 1024 | 1024×829 / 960×777 | See below. |
| `wifi` | 0, 105, 1024, 865 | 1024×760 / 960×713 | See below. |

**bike-convoy.**
- In the source, within the crop's rows 250–899, the boy's rightmost pixels are his hand outline at x 278. His shoe extends further right, but it lies below row 900, outside the crop.
- The car's front bumper outline starts at x 290, 3px inside the new edge.
- In the shipped file at 8×, the bumper is whole. The only thing the edge cuts is a grass tuft at crop rows 604–640 (source x 278–305); nothing of the boy remains.

**motel.**
- "TRAIL" ends at source row 182, leaving 12 rows of plain sky above the edge.
- In the shipped file, rows 0–12 over x 540–1000, where the title was, have a maximum luminance of 25.
- The MOTEL sign (top at about source row 283) and the lamp (about row 395) are whole. The edge cuts only the top of a cloud on the left.

**wifi.**
- The baked caption starts at source row 897, the crossed-signal icon at 899 and the speech-bubble icon below that, all at least 30 rows under the edge. At 8× the shipped bottom rows show only the curb and the dithered road edge.
- Observation, not applied: 865 cuts off the shoes of the woman with the speech bubble (source rows 866–885) and the man at the left at the thighs. A bottom edge near 890 would keep her shoes and still clear the caption and icons. The man stays cut either way. That is a 25px change and not needed to remove the caption, so I left the spec's value.

Preview paths:
- Contact sheet: `app/test-results/assets/scenes.png`.
- Full-size, 390px and 8× edge views: session scratchpad only, outside the project, `…/scratchpad/recrop/{bike-convoy,motel,wifi}-{full,390,edge-N}.png`.
- Source zooms: `…/scratchpad/zoom/bike-*.png`, `motel-trail.png`, `wifi-*.png`.

### 2. Breakdown sign: "THE PORTLAND TRAIL"

**Structure.** In crop coordinates the sign is built as follows:

- **"THE".** It floats above the panel and is already correct, so it was left untouched. The crop does not cut the sign; its top is about 70 rows below the crop edge.
- **Frame.** A light outer band, then a black inner line:
  - top: dashed, rows 72–74;
  - left: x 373–376;
  - right: x 664–667;
  - bottom: dashed, rows 205/206–208.
  The bottom-right corner is cut diagonally from about (664, 150) to (607, 206). There the inner line is a row of dark dots, stepping roughly 0.9px left per row.
- **Left bevel.** On the left only, a light strip (x 377–383) and a dark strip (x 384–387) run the full height. The dark strip meets the bottom line through a step at (388–393, 202–205).
- **Interior.** Speckled mid-green, carrying "PORTLAND" over "TRAL". The letters are about 45px tall with 8px strokes and cast a straight-down shadow of about 4–5px (measured on the T).

**Repair.**
- **`area`.** A 21-corner polygon is painted flat instead of a rectangle, because the interior is not one:
  - it starts at x 388 so the bevel and its step survive;
  - its top-left corner is cut on x + y = 474, clear of that corner's stepped line;
  - it follows the diagonal one pixel short of each dot;
  - its bottom is row 205 from x 410, row 204 for x 394–409 and row 201 for x 388–393.
- **`rect`.** 388,76,664,206: the polygon's bounding box, used to centre the lines.
- **Colours.** Fill `#3c613d` is the median of the interior. Lettering `#c2dcb1` is the brightest 15% of the pale pixels. Shadow `#0e210e` is the median of the dark pixels. All were sampled inside the polygon.
- **Lines.** PORTLAND / TRAIL at scale 5 with gap 15. PORTLAND is 235×35 at x 408–642, y 98–132; TRAIL is 135×35 at x 458–592, y 148–182.
- **`shadow`.** Colour `#0e210e`, offset [0, 5]: one font pixel straight down, matching the original letters.
- **Scale.** Scale 6 would make PORTLAND 282px, wider than the 276px flat area.

**How the outline was checked.** A scratch script compared the polygon mask with the source:

- Dark pixels (luminance under 50) within 4px of the outline that get painted: **none**.
- Pale pixels (over 105) on the interior side that stay unpainted: **none**, apart from the corner's own light band.
- 8× zooms of the encoded file confirmed it: every diagonal dot, the dashed lines, the bevel and its step, and the band are intact, and no speckle remains inside.

**Alternatives tried.**
- **No shadow:** flat and unlike the original.
- **Shadow (3, 3):** good, but diagonal.
- **Scale 4:** small.
- **First polygon:** clipped the corner step and the diagonal dots, and painted over the bevel, leaving a stub. Fixed as described above.

**Judgment:** native. The sign reads "THE / PORTLAND / TRAIL" at full size and at 390px wide, and keeps its layout, frame and colours. What differs from the original:
- The interior is flat where the original was speckled; the rule asks for flat.
- The letters are smaller and lighter: 35px tall with 5px strokes, against 45px with about 8px.
- A few pale squares on the frame stay as drawn, because they are on the frame rather than the interior: three on the bottom line (x 440, 569, 586) and one on the bevel (x 384–387, rows 101–105). They now read as studs.
- Where the bottom line's top row sat at row 205 rather than 206, that row is painted from x 410 on (it was irregular). The line is now uniformly rows 206–208 there, while the joint with the bevel is kept.

Previews:
- `app/test-results/assets/repair-breakdown.png`: whole scene before and after, full size and 390px wide.
- `app/test-results/assets/repair-breakdown-1.png`: the sign at 1×, at 390px wide ×4, and at 2×.
- Scratch zooms of the edges: `…/scratchpad/zoom/shipped-{diagonal,topleft,bottomleft,bottom}.png`.

### 3. Hardening

- A new `check_box(what, box, size)` refuses an empty box or one that reaches outside the image. `scene()` uses it for crops (it replaces the inline check), `sprite()` now uses it for sprite crops, and `repair()` uses it for the rectangle.
- `repair()` also refuses an `area` with fewer than 3 corners or a corner outside the image.
- It refuses any line whose lit pixels, or whose shadow's, would not keep 1px clear of the rectangle on every side. This replaces the old aggregate width/height check.
- Shadows are drawn before all lines.

The existing repairs pass the stricter check, and their output is byte-identical.

Scratch check (`hardening_check.py`), every case raising `ValueError`:
- rectangle past the right edge;
- rectangle past the bottom edge;
- negative corner;
- empty rectangle;
- area corner outside;
- line wider than its rectangle;
- shadow below its rectangle;
- sprite crop outside the master;
- sprite crop with top below bottom;
- scene crop outside its source.

Every committed repair and sprite crop still passes.

### Commands and output

```
$ uv run app/scripts/prepare-assets.py          # first run of the round (crops, polygon v1)
scenes: 54 files, 5,625,530 bytes, 8 changed
sprites: 12 files, 181,952 bytes, 0 changed
icons: 5 files, 296,682 bytes, 0 changed
font: 1 files, 1,732 bytes, 0 changed
fonts/portland-pixel.woff2: sha256 26e6ba4909e139f4da9236c661e4a828fb016bd2e9f9f9fab73ea9fa1bf70ddb, matches the glyph sheet
manifest.json: 72 files, changed
$ uv run app/scripts/prepare-assets.py --only scenes   # polygon v2, keeping the bevel
scenes: 54 files, 5,625,548 bytes, 2 changed
manifest.json: 72 files, changed
$ uv run app/scripts/prepare-assets.py          # full run, then again
scenes: 54 files, 5,625,548 bytes, 0 changed
sprites: 12 files, 181,952 bytes, 0 changed
icons: 5 files, 296,682 bytes, 0 changed
font: 1 files, 1,732 bytes, 0 changed
fonts/portland-pixel.woff2: sha256 26e6ba4909e139f4da9236c661e4a828fb016bd2e9f9f9fab73ea9fa1bf70ddb, matches the glyph sheet
manifest.json: 72 files, unchanged
(second full run: identical output, 0 changed everywhere, manifest unchanged)
$ python3 hashes.py compare fix-before          # snapshot of the round's starting commit
73 files; changed ['manifest.json', 'scenes/bike-convoy-960.webp', 'scenes/bike-convoy.webp',
  'scenes/breakdown-960.webp', 'scenes/breakdown.webp', 'scenes/motel-960.webp', 'scenes/motel.webp',
  'scenes/wifi-960.webp', 'scenes/wifi.webp']; added []; removed []
$ git status --short                            # after the commit
(empty)
```

So title, victory and loss (including the refactored `repair()`), the sprites, the icons and the font are byte-identical to `dbe884b`. The font hash is unchanged at `26e6ba49…`. Scene bytes are now 5,625,548: 3,565,936 full size and 2,059,612 for the 960 copies, against 5,660,124 before this round.

### Open points

- **`area` and `shadow` extend the repair data.** The brief describes repairs by rectangle; these two keys exist because this panel has a cut corner and its lettering casts a shadow. Only the breakdown repair uses them, so the other repairs' manifest records are unchanged.
- **The breakdown lettering is lighter than the original**, the same trade-off as White Stag.
- **The wifi 890 option** is noted above and not applied.
