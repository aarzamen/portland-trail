# Task 4 report: Portland Pixel typeface

**Status:** DONE

**Commit:** `5a45131` feat: Portland Pixel display typeface built from a text glyph sheet (three files, nothing else staged or touched; not pushed).

## What was built

| File | Role |
|---|---|
| `app/scripts/pixel-font.txt` | The glyph sheet, the single source of truth: 104 blocks (ASCII 32–126 and `· × – — ‘ ’ “ ” …`), `== X ==` then eight rows of `#` and `.`. Pure ASCII, blocks in code-point order, one blank line between blocks. |
| `app/scripts/pixelfont.py` | PEP 723 script and importable module. |
| `app/assets/fonts/portland-pixel.woff2` | The built font: 1,732 bytes, sha256 `26e6ba4909e139f4da9236c661e4a828fb016bd2e9f9f9fab73ea9fa1bf70ddb`. |

Module interface, as the brief specifies:

- `load_glyphs(path) -> dict[str, list[str]]`. Validates the sheet and reports the file line of any problem: unknown name, wrong row count, ragged rows, width outside 1–7, stray characters, a glyph defined twice.
- `text_width(glyphs, text, scale=1) -> int`. One blank column between glyphs; `''` is 0.
- `draw_text(image, xy, text, glyphs, scale, fill) -> None`. `xy` is the top-left corner of the eight-row cell, so capitals start at `y`, the baseline is at `y + 7 * scale`, and row 8 is below it. Hard-edged squares, no anti-aliasing. A character without a glyph raises `KeyError` naming it; a scale that is not a whole number ≥ 1 raises `ValueError`.
- `build_woff2(glyphs, out_path) -> None`. Refuses a sheet that lacks a required character or whose space is not two blank columns.
- Run directly, it builds the font, reads the file back and checks it against the sheet (`check_font`), and writes the specimens.

`load_glyphs`, `text_width` and `draw_text` need only Pillow; fontTools and brotli are imported inside the build and check functions.

How the font is built: each glyph's lit pixels are traced into the outline of their union (outer contours clockwise, true holes counter-clockwise, pixels that touch only at a corner as separate contours), at 100 units per pixel. The brief allows one square per pixel or merged runs; I went one step further so that no two contours share an edge or overlap at all. Abutting squares are a known cause of hairline seams in some renderers; I did not test that here, I simply removed the possibility. Metrics: 800 units per em, ascent 700, descent 100, line gap 0 (hhea, OS/2 typo and OS/2 win all agree, `USE_TYPO_METRICS` set), advance = (columns + 1) × 100, space 300, x-height 500, cap height 700, underline and strike-out one pixel thick on the pixel grid. Name table: family "Portland Pixel", style "Regular". `post` format 3 (no glyph names), Windows-platform names only. `head.created` and `head.modified` are fixed at 2026-10-01T00:00:00Z and timestamps are not recalculated.

## Design decisions for the face

- **Grid.** Capitals and digits on rows 1–7, lowercase bodies on rows 3–7, ascenders to row 1 (`t` starts at row 2, as it does in most text faces), descenders on row 8 only.
- **One stroke weight.** Every stroke is one pixel. A scan finds no 2×2 lit block in any glyph.
- **One round corner.** A round corner is a single missing corner pixel, everywhere: bowls, arches, hooks, tails, digits, `@`, `&`, `?`. Where a curve meets a stem the stem side stays square (`b d p q a u n h m`, `B D P R`).
- **Widths.** Capitals are 5 wide except `I` (3, with serifs) and `M`, `W` (7, with diagonals). Digits are all 5 wide. Lowercase round letters are 5 wide so they share the capitals' proportions and corner treatment; narrow letters are narrow: `i l` 1, `j` 2, `f r t` 3, `c k` 4; `m w` are 7, built as two arches like `n` and `u`.
- **Friendly, not a calculator.** Round-topped `A`, double-storey `a`, curved terminals on `f j t g y`, round `w`, proportional spacing, ring-shaped `%`.
- **Punctuation.** Sits on the baseline (bottom of row 7); comma and semicolon tails use row 8. Hyphen, dashes, middle dot, `+ = < > ~ ×` share one axis, row 5, the middle of the x-height. `×` is a 3×3 mark so it cannot be read as `x`. Curly quotes are three rows tall so opening and closing shapes differ.
- **Confusable pairs.** `I` has serifs, `l` is a plain bar, `1` has a flag and a foot. Zero is slashed. `S` curls at both ends while `5` has a flat top and a corner. `m` is one joined double arch; `rn` keeps the notch and gap of the `r`.

The letterforms are drawn from scratch in this session; no font file was downloaded or copied. They follow the conventions any 5×7 pixel face shares.

## Commands and output

Tool versions resolved by uv today: Python 3.13.11, fonttools 4.66.1, brotli 1.2.0, pillow 12.3.0 (FreeType 2.14.3), uv 0.11.14.

### Build

```
$ uv run app/scripts/pixelfont.py
assets/fonts/portland-pixel.woff2: 104 glyphs, 1732 bytes
sha256 26e6ba4909e139f4da9236c661e4a828fb016bd2e9f9f9fab73ea9fa1bf70ddb
104 characters mapped, 105 glyphs with .notdef
family Portland Pixel, style Regular, units per em 800, ascent 700, descent -100, line gap 0, typo ascender 700, typo descender -100, typo line gap 0, space advance 300
16px from the font file matches draw_text at scale 2: 2x2 squares
24px from the font file matches draw_text at scale 3: 3x3 squares
32px from the font file matches draw_text at scale 4: 4x4 squares
48px from the font file matches draw_text at scale 6: 6x6 squares
specimens in test-results/font: charset-x2.png, lines-x2.png, font-file-16px.png, lines-x3.png, font-file-24px.png, lines-x4.png, font-file-32px.png, lines-x6.png, font-file-48px.png, confusables-x4.png
```

The four "matches" lines are a real comparison: all 104 glyphs plus the six specimen lines are rendered from the WOFF2 by FreeType (through Pillow's `ImageFont.truetype`, anti-aliasing on) and compared pixel for pixel with `draw_text`. It also ran identically from another working directory.

### cmap listing and metrics, with fontTools alone

```
$ uv run --with fonttools --with brotli python -c "from fontTools.ttLib import TTFont; f = TTFont('app/assets/fonts/portland-pixel.woff2'); c = f.getBestCmap(); print(len(c), ''.join(chr(k) for k in sorted(c))); print(f['head'].unitsPerEm, f['hhea'].ascent, f['hhea'].descent, f['hhea'].lineGap, f['hmtx'][c[32]][0], f['name'].getDebugName(1), '/', f['name'].getDebugName(2))"
104  !"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\]^_`abcdefghijklmnopqrstuvwxyz{|}~·×–—‘’“”…
800 700 -100 0 300 Portland Pixel / Regular
```

A fuller listing from a scratch script (not in the repository):

```
cmap: 104 code points; flavor woff2; tables OS/2 cmap glyf head hhea hmtx loca maxp name post
beyond ASCII: U+00B7 · U+00D7 × U+2013 – U+2014 — U+2018 ‘ U+2019 ’ U+201C “ U+201D ” U+2026 …
required and missing: none
mapped but not required: none
name 1/2/4/6: ['Portland Pixel', 'Regular', 'Portland Pixel', 'PortlandPixel-Regular']
unitsPerEm 800; hhea ascent 700 descent -100 lineGap 0
OS/2 typo 700/-100/0 win 700/100 xHeight 500 capHeight 700 fsSelection 0x00c0 weight 400
head created 3873657600 modified 3873657600 (2026-10-01T00:00:00Z = 3873657600) bbox 0,-100,700,700
advance 200: !'.:il|·
advance 300:  (),;[]`j‘’
advance 400: "-/<>I\^frt{}×
advance 500: ck
advance 600: #$&*+0123456789=?ABCDEFGHJKLNOPQRSTUVXYZ_abdeghnopqsuvxyz~–“”…
advance 800: %@MWmw—
.notdef advance 600 ; glyphs 105
```

### Determinism

```
$ shasum -a 256 app/assets/fonts/portland-pixel.woff2      (then rebuild, hash, rebuild, hash)
26e6ba4909e139f4da9236c661e4a828fb016bd2e9f9f9fab73ea9fa1bf70ddb  app/assets/fonts/portland-pixel.woff2
26e6ba4909e139f4da9236c661e4a828fb016bd2e9f9f9fab73ea9fa1bf70ddb  app/assets/fonts/portland-pixel.woff2
26e6ba4909e139f4da9236c661e4a828fb016bd2e9f9f9fab73ea9fa1bf70ddb  app/assets/fonts/portland-pixel.woff2
```

The same hash came out with `PYTHONHASHSEED=1` and `PYTHONHASHSEED=987654`, and under `uv run --python 3.10`, `3.12` and `3.14`. After the commit, rebuilding leaves `git status` clean for the three files, and `git hash-object` of the working files equals the committed blobs.

### Further checks (scratch scripts, not in the repository)

```
negative test ok: the font rendered at 16px differs from draw_text at scale 2      (one glyph changed in memory)
negative test ok: the advance of 'i' is 200                                        (one glyph widened in memory)
.notdef at 16px / 24px / 32px / 48px matches the box: True
16px: 2 colours [(7, 17, 10), (225, 234, 203)]      (same at 24, 32 and 48px: no anti-aliased edge pixel anywhere)
20px (not a multiple of 8): 8 colours                (so the test can tell)
FreeType name: ('Portland Pixel', 'Regular') | metrics (ascent, descent) at 32px: (28, 4)
# areas [-210000.0, 10000.0]    .notdef areas [-350000.0, 150000.0]     (outer clockwise, hole counter-clockwise)
contours 355 points 1738
all outline points on the pixel grid; outline area equals lit pixels for every glyph
glyphs with a 2x2 lit block: []
capitals rows: {(1, 7)}   digits rows: {(1, 7)} widths: {5}   row 8 used by: ,;_gjpqy|
draw_text: bounding box = text_width x 7 rows for capitals, two colours only, in RGB, RGBA and L
```

### In a browser

Beyond the brief, I loaded the WOFF2 in Chromium 152 (the desktop app's browser pane, macOS, from a scratch page outside the repository):

- `document.fonts.check('32px "Portland Pixel"')` is `true`; the face reports `loaded`.
- "The Portland Trail." at 64px measures 688px = 85 font pixels plus the trailing gap, × 8.
- Rendered as HTML text with `font-weight: 400` and `-webkit-font-smoothing: antialiased` (through an SVG `foreignObject` drawn onto a canvas so the pixels could be read back, at 1× scale), all 104 glyphs and the six lines match the glyph sheet exactly at 16, 24, 32, 48, 64 and 96px: 42 runs, zero grey pixels, zero wrong pixels.
- With the default smoothing, macOS thickens glyphs slightly: grey fringes at every size and 36 / 368 / 552 wrong pixels in the title at 24 / 32 / 48px.
- With `font-weight: 700` the browser fakes a bold: 1,606 wrong pixels in the title at 32px.

Not checked: Safari or any WebKit build, Windows, Android. No real device.

## Specimens

In `app/test-results/font/` (ignored by Git), paper `#e1eacb` on ink `#07110a`:

- `charset-x2.png`: every glyph in the sheet at scale 2.
- `lines-x2.png`, `lines-x3.png`, `lines-x4.png`, `lines-x6.png`: the six lines from the brief.
- `font-file-16px.png`, `font-file-24px.png`, `font-file-32px.png`, `font-file-48px.png`: the same six lines rendered from the WOFF2. Each has the same sha256 as the `lines` image of the matching scale.
- `confusables-x4.png`: `Il1|!`, `O0QD`, `S5 Z2 B8`, `rn m`, punctuation pairs.

I looked at every one of them in its final state, and while drawing at larger scratch renders (scale 5 to 12) of the alphabet, pangrams, the game's real location and encounter titles, the sign texts and punctuation in context. The six lines read cleanly at scales 2, 3, 4 and 6.

Glyphs revised after looking:

| Glyph | What I saw | Change |
|---|---|---|
| `V` | Read as `U` in "Vehicle" | Taper now takes three rows instead of two |
| `v` | Same family | Taper 2-2-1 |
| `N` | Diagonal sat high, top-heavy | Diagonal centred on rows 3–5 |
| `r` | Four columns left a hole after every `r` ("Por tland") | Three columns |
| `f`, `t` | Same loose rhythm ("of  five", "St ock") | Three columns. For `t` I compared four shapes and kept the one-pixel curved toe, which follows the corner rule |
| `%` | Two 2×2 blocks, the only heavy strokes in the face | Seven columns with one-pixel rings |
| `(` `)` | Tried three columns: at 48px and larger they read as angle brackets | Back to two columns |

Compared side by side and left as first drawn: 5-column against 4-column lowercase; slashed zero against a dotted zero and a pointed oval (the dot is faint at 16px, the oval reads as a diamond); round against pointed `A`; 7-column against 5-column `M W m w`; round against angular `w`; 5- against 4-column `s z`; plain against footed `l`; colon dots on rows 4 and 7 against 3/7 and 3/6; bowl against v-shaped `y`; three-row against two-row curly quotes; the `e` terminal.

## Files changed

- `app/scripts/pixel-font.txt` (new, 1,039 lines)
- `app/scripts/pixelfont.py` (new, 441 lines, none over 120 characters)
- `app/assets/fonts/portland-pixel.woff2` (new, 1,732 bytes)

Nothing else was edited, staged or committed. Scratch work stayed in the session scratchpad; the scratch web server and browser tab are closed.

## Self-review

Checked against the brief, requirement by requirement: PEP 723 block first, paths relative to the script (1); sheet format, row use and widths (2); all 104 characters, proportional, one stroke weight, one x-height, one corner rule (3); metrics, names, Unicode mapping, deterministic bytes (4); the five required specimens (5); specimens inspected, confusable pairs compared, the font file rendered at 16, 24, 32 and 48px and matched (6).

Decisions a reviewer may want to weigh:

1. **Outlines are the union of the pixels**, not one square per pixel or per run. It meets "no overlaps that render with holes" and is more robust, but it is not literally either construction the brief names.
2. **`.notdef` is drawn in code** (`NOTDEF_ROWS`, a hollow 5×7 box), not in the sheet, because it is not a character and `load_glyphs` returns characters.
3. **`t` starts at row 2**, not row 1. Deliberate.
4. **`|` and `_` use row 8.** The bar spans all eight rows so it differs from `l`; the underscore sits below the baseline.
5. **Dependencies are not pinned.** The bytes are stable for a given fontTools and brotli; a future release of either could change the compressed bytes without changing the font. Task 5 rebuilds through `build_woff2` and gets the committed bytes as long as uv resolves the versions listed above.
6. **No no-break space.** The brief's character list has none, so U+00A0 is not mapped; a heading containing `&nbsp;` would take that one space from the fallback font.
7. **No kerning.** Pairs such as "Tr" and "LA" are as open as in any pixel face.
8. Taste calls I would not be surprised to see questioned: the slashed zero, the round `A`, the wide `M W m w`.

## Notes for later tasks

**Task 5 (signs).** The module exports the paths it uses, so the rebuild is `pixelfont.build_woff2(pixelfont.load_glyphs(pixelfont.GLYPH_SHEET), pixelfont.FONT_FILE)`, and `pixelfont.check_font(pixelfont.FONT_FILE, glyphs)` repeats the read-back check. For all-capital text the lit area is `text_width(glyphs, text, scale)` wide and `7 * scale` tall, starting exactly at `xy`. To centre in a rectangle: `x = left + (width - text_width(...)) // 2`, `y = top + (height - 7 * scale) // 2`. Widths at scale 1: GLOBAL WARMING 82 (GLOBAL 35, WARMING 43), WHITE STAG 56, PORTLAND OREGON 86 (47, 35), POWELL'S BOOKS 78 (45, 29), GAME OVER 52, NO SIGNAL 48. Both `'` and `’` exist.

One trap when importing the module: this Mac has `PYTHONDONTWRITEBYTECODE=1` set, so nothing appeared here, but on a machine without it `import pixelfont` writes `app/scripts/__pycache__/`, which `.gitignore` does not cover and the checksum script would then list. Setting `sys.dont_write_bytecode = True` before the import in `prepare-assets.py`, or ignoring `__pycache__/`, avoids it. Neither file is mine, so I left them alone.

**Task 9 (styles).** The first two points were measured in Chromium (see "In a browser"); the rest follow from the metrics and were not tested:

- Set `font-weight: 400` wherever the face is used. `h1`–`h3` are bold by default and the browser then fakes a bold that destroys the pixels. `font-synthesis: none` should be a second guard.
- Set `-webkit-font-smoothing: antialiased` on the same elements. On macOS the default smoothing fattens every edge. Firefox's equivalent is `-moz-osx-font-smoothing: grayscale`.
- Sizes in whole multiples of 8px, as the spec says. Letter-spacing and line-height in multiples of 0.125em keep everything on the pixel grid; with `line-height: 1` descenders touch the capitals of the next line, 1.25 or 1.5 leaves room.
- Centred text can start on a half pixel on 1× screens and blur there; left-aligned text starts on a whole pixel.
- Coverage is ASCII and nine punctuation marks. A traveler name with an accent or another script falls back to the next font one character at a time, so headings that show typed names may be better left in the system face.
- "The Portland Trail." is 85 font pixels: 340px at 32px, 680px at 64px, 1,020px at 96px. "The Portland" alone is 60.
