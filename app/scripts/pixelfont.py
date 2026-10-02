# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "fonttools==4.66.1",
#     "brotli==1.2.0",
#     "pillow==12.3.0",
# ]
# ///
"""Portland Pixel: the game's display typeface, built from a text glyph sheet.

`pixel-font.txt`, next to this file, is the single source of truth. Each glyph is a block:

    == A ==         the character: one printable ASCII character, `space`, or `U+2019` for anything outside ASCII
    .###.           then exactly eight rows of `#` (lit) and `.` (blank), all the same width, 1 to 7 columns
    #...#
    #...#           rows 1-7 hold capitals, digits and ascenders; the baseline is the bottom of row 7
    #####           lowercase bodies sit on rows 3-7
    #...#           row 8 is the descender row
    #...#
    #...#
    .....

Blank lines between blocks are ignored. Glyphs are set one blank column apart; the space is two blank columns.

Run it with no other setup; every path it uses is relative to this file:

    uv run app/scripts/pixelfont.py

That builds `app/assets/fonts/portland-pixel.woff2`, reads the file back and checks it against the glyph sheet,
and writes specimen images to `app/test-results/font/`. Other scripts import `load_glyphs`, `text_width`,
`draw_text` and `build_woff2`. Pillow and fontTools are imported only by the functions that need them.
"""

from __future__ import annotations

import calendar
import hashlib
import io
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
GLYPH_SHEET = HERE / 'pixel-font.txt'
FONT_FILE = HERE.parent / 'assets' / 'fonts' / 'portland-pixel.woff2'
SPECIMEN_DIR = HERE.parent / 'test-results' / 'font'

FAMILY = 'Portland Pixel'
STYLE = 'Regular'
VERSION = '1.000'

ROWS = 8  # rows in every glyph block
BASELINE_ROW = 7  # the baseline is the bottom edge of this row
X_HEIGHT_ROWS = 5  # lowercase bodies: rows 3-7
MAX_COLUMNS = 7
GAP = 1  # blank columns between glyphs
SPACE_ADVANCE = 3  # pixels: the two blank columns of the space glyph plus the gap

UNITS_PER_PIXEL = 100
UNITS_PER_EM = ROWS * UNITS_PER_PIXEL  # 800
ASCENT = BASELINE_ROW * UNITS_PER_PIXEL  # 700
DESCENT = (ROWS - BASELINE_ROW) * UNITS_PER_PIXEL  # 100

# The head table counts seconds from 1904. A fixed moment keeps the build byte-for-byte repeatable.
FIXED_TIMESTAMP = calendar.timegm((2026, 10, 1, 0, 0, 0)) - calendar.timegm((1904, 1, 1, 0, 0, 0))

REQUIRED_CHARACTERS = ''.join(chr(code) for code in range(32, 127)) + '‘’“”–—…·×'

# Shown for a character the font does not cover. It is not a character, so it is not in the glyph sheet.
NOTDEF_ROWS = ['#####', '#...#', '#...#', '#...#', '#...#', '#...#', '#####', '.....']

INK = '#07110a'
PAPER = '#e1eacb'
SPECIMEN_SCALES = (2, 3, 4, 6)
SPECIMEN_LINES = [
    'The Portland Trail.',
    'Stock up before departure.',
    'Vehicle “Quirk” (Breakdown)',
    'DeFi Community Node (Gas Station Backroom)',
    'You made it to Portland.',
    '0123456789 $1,200 · 80 mi',
]
CONFUSABLE_LINES = [
    'Il1|! il ij Ll tf',
    'O0QD o0 CG6 cea',
    'S5 Z2 B8 g9q s5',
    'rn m rm nn un vv w',
    'burn barn modern corner',
    '.,:; \'" ‘’ “” -–— ·… x×',
]

_HEADER = re.compile(r'^== (\S+) ==$')
_CODE_POINT = re.compile(r'^U\+[0-9A-F]{4,6}$')


def _character(name: str) -> str:
    """Turn a block name from the glyph sheet into the character it stands for."""
    if name == 'space':
        return ' '
    if _CODE_POINT.match(name):
        return chr(int(name[2:], 16))
    if len(name) == 1 and 33 <= ord(name) <= 126:
        return name
    raise ValueError(f'unknown glyph name "{name}": use one ASCII character, "space", or "U+2019" style')


def load_glyphs(path: str | Path) -> dict[str, list[str]]:
    """Read a glyph sheet: character -> eight rows of `#` and `.`, in the order of the file."""
    path = Path(path)
    glyphs: dict[str, list[str]] = {}
    char, rows, start = '', None, 0

    def finish() -> None:
        if rows is None:
            return
        where = f'{path.name}:{start}: glyph {char!r}'
        if len(rows) != ROWS:
            raise ValueError(f'{where} has {len(rows)} rows, expected {ROWS}')
        width = len(rows[0])
        if not 1 <= width <= MAX_COLUMNS:
            raise ValueError(f'{where} is {width} columns wide, expected 1 to {MAX_COLUMNS}')
        if any(len(row) != width for row in rows):
            raise ValueError(f'{where} has rows of different widths')
        glyphs[char] = rows

    for number, line in enumerate(path.read_text(encoding='utf-8').splitlines(), start=1):
        line = line.rstrip()
        if not line:
            continue
        header = _HEADER.match(line)
        if header:
            finish()
            try:
                char = _character(header.group(1))
            except ValueError as error:
                raise ValueError(f'{path.name}:{number}: {error}') from None
            if char in glyphs:
                raise ValueError(f'{path.name}:{number}: glyph {char!r} is defined twice')
            rows, start = [], number
        elif rows is not None and set(line) <= {'#', '.'}:
            rows.append(line)
        else:
            raise ValueError(f'{path.name}:{number}: expected "== X ==" or a row of # and ., found {line!r}')
    finish()
    return glyphs


def _rows(glyphs: dict[str, list[str]], char: str) -> list[str]:
    try:
        return glyphs[char]
    except KeyError:
        raise KeyError(f'{FAMILY} has no glyph for {char!r} (U+{ord(char):04X})') from None


def text_width(glyphs: dict[str, list[str]], text: str, scale: int = 1) -> int:
    """Width of one line of text in pixels, with one blank column between glyphs."""
    if not text:
        return 0
    return (sum(len(_rows(glyphs, char)[0]) for char in text) + GAP * (len(text) - 1)) * scale


def draw_text(image, xy, text: str, glyphs: dict[str, list[str]], scale: int, fill) -> None:
    """Draw one line of text onto a Pillow image with square pixels of `scale` by `scale` and no anti-aliasing.

    `xy` is the top-left corner of the eight-row glyph cell: capitals start at `y`, the baseline is at
    `y + 7 * scale`, and descenders use the one row below it. `fill` is any colour Pillow accepts for the image.
    """
    from PIL import ImageDraw

    if not isinstance(scale, int) or scale < 1:
        raise ValueError(f'scale must be a whole number of at least 1, got {scale!r}')
    draw = ImageDraw.Draw(image)
    x, top = round(xy[0]), round(xy[1])
    for char in text:
        rows = _rows(glyphs, char)
        for index, row in enumerate(rows):
            y = top + index * scale
            for run in re.finditer('#+', row):
                draw.rectangle((x + run.start() * scale, y, x + run.end() * scale - 1, y + scale - 1), fill=fill)
        x += (len(rows[0]) + GAP) * scale


def _contours(rows: list[str]) -> list[list[tuple[int, int]]]:
    """Trace the lit pixels of a glyph into closed outlines, in font units.

    The result is the outline of the union of the pixels: neighbouring pixels share no edges and nothing
    overlaps, so no renderer can open seams or holes between them. Outer outlines run clockwise and holes
    counter-clockwise, as TrueType expects. Pixels that touch only at a corner get separate outlines.
    """
    lit = {(r, c) for r, row in enumerate(rows) for c, cell in enumerate(row) if cell == '#'}
    # Directed edges between grid corners (x right, y down), each with its lit pixel on the right-hand side.
    edges: dict[tuple[int, int], list[tuple[int, int]]] = {}
    for r, c in sorted(lit):
        if (r - 1, c) not in lit:
            edges.setdefault((c, r), []).append((c + 1, r))
        if (r, c + 1) not in lit:
            edges.setdefault((c + 1, r), []).append((c + 1, r + 1))
        if (r + 1, c) not in lit:
            edges.setdefault((c + 1, r + 1), []).append((c, r + 1))
        if (r, c - 1) not in lit:
            edges.setdefault((c, r + 1), []).append((c, r))

    contours = []
    while edges:
        first = min(edges)
        loop = [first]
        here, heading = first, (0, 0)
        while True:
            choices = edges[here]
            # Where two pixels meet corner to corner there are two ways on: turn right to stay on this pixel.
            turn_right = (here[0] - heading[1], here[1] + heading[0])
            after = turn_right if turn_right in choices else choices[0]
            choices.remove(after)
            if not choices:
                del edges[here]
            heading = (after[0] - here[0], after[1] - here[1])
            here = after
            if here == first:
                break
            loop.append(here)
        corners = []
        for index, (x, y) in enumerate(loop):
            (before_x, before_y), (after_x, after_y) = loop[index - 1], loop[(index + 1) % len(loop)]
            if (x - before_x, y - before_y) != (after_x - x, after_y - y):
                corners.append((x * UNITS_PER_PIXEL, (BASELINE_ROW - y) * UNITS_PER_PIXEL))
        contours.append(corners)
    return contours


def _outline(rows: list[str]):
    from fontTools.pens.ttGlyphPen import TTGlyphPen

    pen = TTGlyphPen(None)
    for contour in _contours(rows):
        pen.moveTo(contour[0])
        for point in contour[1:]:
            pen.lineTo(point)
        pen.closePath()
    return pen.glyph()


def _font_bytes(glyphs: dict[str, list[str]]) -> bytes:
    from fontTools.fontBuilder import FontBuilder

    missing = [char for char in REQUIRED_CHARACTERS if char not in glyphs]
    if missing:
        raise ValueError(f'the glyph sheet is missing {", ".join(f"U+{ord(char):04X}" for char in missing)}')
    if len(glyphs[' '][0]) + GAP != SPACE_ADVANCE or any('#' in row for row in glyphs[' ']):
        raise ValueError(f'the space must be {SPACE_ADVANCE - GAP} blank columns, for an advance of {SPACE_ADVANCE}')

    names = {char: f'uni{ord(char):04X}' for char in sorted(glyphs)}
    pixels = {'.notdef': NOTDEF_ROWS, **{name: glyphs[char] for char, name in names.items()}}
    metrics = {}
    for name, rows in pixels.items():
        lit_columns = [column for column in range(len(rows[0])) if any(row[column] == '#' for row in rows)]
        left_bearing = min(lit_columns, default=0) * UNITS_PER_PIXEL
        metrics[name] = ((len(rows[0]) + GAP) * UNITS_PER_PIXEL, left_bearing)

    builder = FontBuilder(UNITS_PER_EM, isTTF=True)
    builder.setupGlyphOrder(list(pixels))
    builder.setupCharacterMap({ord(char): name for char, name in names.items()})
    builder.setupGlyf({name: _outline(rows) for name, rows in pixels.items()})
    builder.setupHorizontalMetrics(metrics)
    builder.setupHorizontalHeader(ascent=ASCENT, descent=-DESCENT, lineGap=0)
    builder.setupNameTable(
        {
            'familyName': FAMILY,
            'styleName': STYLE,
            'uniqueFontIdentifier': f'{FAMILY} {STYLE} {VERSION}',
            'fullName': FAMILY,
            'version': f'Version {VERSION}',
            'psName': f'{FAMILY.replace(" ", "")}-{STYLE}',
        },
        mac=False,
    )
    builder.setupOS2(
        version=4,
        usWeightClass=400,
        usWidthClass=5,
        fsType=0,
        fsSelection=0x40 | 0x80,  # regular; take line spacing from the typographic metrics
        sTypoAscender=ASCENT,
        sTypoDescender=-DESCENT,
        sTypoLineGap=0,
        usWinAscent=ASCENT,
        usWinDescent=DESCENT,
        sxHeight=X_HEIGHT_ROWS * UNITS_PER_PIXEL,
        sCapHeight=ASCENT,
        yStrikeoutSize=UNITS_PER_PIXEL,
        yStrikeoutPosition=3 * UNITS_PER_PIXEL,
        ulCodePageRange1=1,
    )
    builder.setupPost(keepGlyphNames=False, underlinePosition=-DESCENT, underlineThickness=UNITS_PER_PIXEL)
    builder.updateHead(
        created=FIXED_TIMESTAMP, modified=FIXED_TIMESTAMP, fontRevision=float(VERSION), lowestRecPPEM=ROWS
    )

    font = builder.font
    font['OS/2'].recalcAvgCharWidth(font)
    font['OS/2'].recalcUnicodeRanges(font)
    font.recalcTimestamp = False
    font.flavor = 'woff2'
    buffer = io.BytesIO()
    font.save(buffer)
    return buffer.getvalue()


def build_woff2(glyphs: dict[str, list[str]], out_path: str | Path) -> None:
    """Build the web font from the glyphs. The same glyphs always give the same bytes."""
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(_font_bytes(glyphs))


def _sheet(lines: list[str], scale: int, measure, draw_line):
    """Lay lines out, paper on ink: `measure(line)` gives a width, `draw_line(image, (x, y), line)` sets it."""
    from PIL import Image

    margin, pitch = 4 * scale, 12 * scale
    width = max(measure(line) for line in lines) + 2 * margin
    image = Image.new('RGB', (width, pitch * (len(lines) - 1) + ROWS * scale + 2 * margin), INK)
    for index, line in enumerate(lines):
        draw_line(image, (margin, margin + index * pitch), line)
    return image


def specimen(glyphs: dict[str, list[str]], lines: list[str], scale: int):
    """An image of the lines set with `draw_text`."""
    return _sheet(
        lines,
        scale,
        lambda line: text_width(glyphs, line, scale),
        lambda image, xy, line: draw_text(image, xy, line, glyphs, scale, PAPER),
    )


def font_specimen(font_path: str | Path, lines: list[str], size: int):
    """The same layout as `specimen`, rendered by FreeType from the font file at `size` pixels."""
    from PIL import ImageDraw, ImageFont

    scale = size // ROWS
    font = ImageFont.truetype(str(font_path), size, layout_engine=ImageFont.Layout.BASIC)
    return _sheet(
        lines,
        scale,
        lambda line: round(font.getlength(line)) - GAP * scale,  # the last advance ends with the gap
        lambda image, xy, line: ImageDraw.Draw(image).text(xy, line, font=font, fill=PAPER),
    )


def charset_lines(glyphs: dict[str, list[str]]) -> list[str]:
    """Every glyph of the sheet, grouped: capitals, lowercase, digits, ASCII punctuation, everything else."""
    chars = sorted(char for char in glyphs if char != ' ')
    lines = []
    for belongs in (str.isupper, str.islower, str.isdigit, str.isascii, lambda char: True):
        lines.append(''.join(char for char in chars if belongs(char)))
        chars = [char for char in chars if not belongs(char)]
    return [line for line in lines if line]


def check_font(font_path: str | Path, glyphs: dict[str, list[str]]) -> list[str]:
    """Read the built file back and compare it with the glyph sheet. Returns the lines of a short report."""
    from fontTools.ttLib import TTFont
    from PIL import ImageChops

    font = TTFont(str(font_path))
    cmap = font.getBestCmap()
    missing = [char for char in REQUIRED_CHARACTERS if ord(char) not in cmap]
    if missing:
        raise AssertionError(f'the font has no mapping for {missing}')
    expected = {
        'family': FAMILY,
        'style': STYLE,
        'units per em': UNITS_PER_EM,
        'ascent': ASCENT,
        'descent': -DESCENT,
        'line gap': 0,
        'typo ascender': ASCENT,
        'typo descender': -DESCENT,
        'typo line gap': 0,
        'space advance': SPACE_ADVANCE * UNITS_PER_PIXEL,
    }
    found = {
        'family': font['name'].getDebugName(1),
        'style': font['name'].getDebugName(2),
        'units per em': font['head'].unitsPerEm,
        'ascent': font['hhea'].ascent,
        'descent': font['hhea'].descent,
        'line gap': font['hhea'].lineGap,
        'typo ascender': font['OS/2'].sTypoAscender,
        'typo descender': font['OS/2'].sTypoDescender,
        'typo line gap': font['OS/2'].sTypoLineGap,
        'space advance': font['hmtx'][cmap[ord(' ')]][0],
    }
    if found != expected:
        raise AssertionError(f'font metrics {found} differ from {expected}')
    for char, rows in glyphs.items():
        advance = font['hmtx'][cmap[ord(char)]][0]
        if advance != (len(rows[0]) + GAP) * UNITS_PER_PIXEL:
            raise AssertionError(f'the advance of {char!r} is {advance}')

    report = [
        f'{len(cmap)} characters mapped, {len(font.getGlyphOrder())} glyphs with .notdef',
        ', '.join(f'{key} {value}' for key, value in found.items()),
    ]
    # Every glyph, rendered from the file by FreeType with anti-aliasing on, must match `draw_text` pixel for
    # pixel. That holds only if each font pixel is a square of the whole-number scale with hard edges.
    lines = [''.join(sorted(glyphs))] + SPECIMEN_LINES
    for scale in SPECIMEN_SCALES:
        size = ROWS * scale
        drawn, rendered = specimen(glyphs, lines, scale), font_specimen(font_path, lines, size)
        if drawn.size != rendered.size or ImageChops.difference(drawn, rendered).getbbox():
            raise AssertionError(f'the font rendered at {size}px differs from draw_text at scale {scale}')
        report.append(f'{size}px from the font file matches draw_text at scale {scale}: {scale}x{scale} squares')
    return report


def main() -> int:
    glyphs = load_glyphs(GLYPH_SHEET)
    build_woff2(glyphs, FONT_FILE)
    data = FONT_FILE.read_bytes()
    app = HERE.parent
    print(f'{FONT_FILE.relative_to(app)}: {len(glyphs)} glyphs, {len(data)} bytes')
    print(f'sha256 {hashlib.sha256(data).hexdigest()}')
    for line in check_font(FONT_FILE, glyphs):
        print(line)

    SPECIMEN_DIR.mkdir(parents=True, exist_ok=True)
    images = {'charset-x2.png': specimen(glyphs, charset_lines(glyphs), 2)}
    for scale in SPECIMEN_SCALES:
        images[f'lines-x{scale}.png'] = specimen(glyphs, SPECIMEN_LINES, scale)
        images[f'font-file-{ROWS * scale}px.png'] = font_specimen(FONT_FILE, SPECIMEN_LINES, ROWS * scale)
    images['confusables-x4.png'] = specimen(glyphs, CONFUSABLE_LINES, 4)
    for name, image in images.items():
        image.save(SPECIMEN_DIR / name)
    print(f'specimens in {SPECIMEN_DIR.relative_to(app)}: {", ".join(images)}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
