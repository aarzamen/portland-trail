# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "pillow==12.3.0",
#     "fonttools==4.66.1",
#     "brotli==1.2.0",
# ]
# ///
"""Regenerate every file under app/assets from the preserved originals.

    uv run app/scripts/prepare-assets.py                  everything
    uv run app/scripts/prepare-assets.py --only scenes    or sprites, icons, font

Paths come from this file's location, so it runs from any directory (`npm run assets` starts it in app/).
Sources are only read: the scene JPEGs in images/, the masters in docs/handoff/graphics-v1 through -v4, and the
glyph sheet app/scripts/pixel-font.txt. The versions above are pinned because the output bytes depend on them.

    app/assets/scenes/<id>.webp            crop, sign repairs, WebP quality 82, at most 1536 wide
    app/assets/scenes/<id>-960.webp        the same at 960 wide, quality 78 (a narrower scene is not enlarged)
    app/assets/sprites/<name>.png          portraits, supply icons and the van, cut from the graphics-v1 masters
    app/assets/icons/<name>.png            app icons from graphics-v2/app-icon.png
    app/assets/fonts/portland-pixel.woff2  Portland Pixel, built by pixelfont.py and checked against the sheet
    app/assets/manifest.json               source and its hash, crop, repairs, size, bytes and hash of every file

Preview sheets for checking the results by eye go to app/test-results/assets/, which Git ignores. Nothing is
written anywhere else. The same sources give the same bytes, so a second run changes nothing.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import sys
from pathlib import Path

sys.dont_write_bytecode = True  # importing pixelfont must not leave app/scripts/__pycache__/ behind

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import brotli  # noqa: E402
import fontTools  # noqa: E402
import PIL  # noqa: E402
from PIL import Image, ImageDraw, ImageOps  # noqa: E402

import pixelfont  # noqa: E402

ROOT = HERE.parents[1]
ASSETS = ROOT / 'app' / 'assets'
PREVIEWS = ROOT / 'app' / 'test-results' / 'assets'
CATEGORIES = ('scenes', 'sprites', 'icons', 'font')

SCENE_WIDTH, SCENE_QUALITY = 1536, 82
PHONE_WIDTH, PHONE_QUALITY = 960, 78
WEBP_METHOD = 6  # the slowest and smallest


def original(number: int) -> str:
    return f'images/the_portland_trail_{number:05d}.jpg'


# Scene id: (source, crop as (left, top, right, bottom) or None), as in spec section 7.
SCENES = {
    'title': (original(17), (0, 235, 1024, 965)),
    'travel': (original(8), (0, 340, 1024, 940)),
    'departure': (original(5), None),
    'rest-stop': (original(11), None),
    'motel': (original(12), (0, 195, 1024, 1024)),
    'landmark': (original(18), None),
    'crypto': (original(10), None),
    'food-carts': (original(1), None),
    'victory': (original(16), (0, 175, 1024, 1024)),
    'loss': (original(4), (0, 180, 1024, 865)),
    'breakdown': (original(0), (0, 340, 1024, 1024)),
    'doomscrolling': (original(13), (0, 160, 1024, 1024)),
    'illness': (original(3), None),
    'free-box': (original(15), (0, 125, 1024, 1024)),
    'wifi': (original(2), (0, 105, 1024, 865)),
    'nft': (original(14), None),
    'bike-convoy': (original(6), (287, 250, 1024, 900)),
    'city-street': (original(7), (0, 110, 1024, 1024)),
    'outbreak': (original(9), (0, 70, 1024, 930)),
    **{
        name: (f'docs/handoff/graphics-v2/{name}.png', None)
        for name in ('mushroom-market', 'river-ferry', 'forest-camp', 'bookshop', 'road-forest')
    },
    **{name: (f'docs/handoff/graphics-v3/{name}.png', None) for name in ('road-river', 'road-city', 'heatwave')},
    **{
        name: (f'docs/handoff/graphics-v4/{name}.png', None)
        for name in ('road-pines', 'road-outskirts', 'sasquatch', 'toll-troll', 'brunch-line')
    },
}

# Sign repairs (L7), applied to the cropped scene before it is encoded. `rect` is the part of the sign's interior
# that is painted flat in `fill`: (left, top, right, bottom) in the cropped image, right and bottom exclusive, as
# for a crop. Each line is set in Portland Pixel at a whole-number `scale` in `color`; the lines are centred in
# `rect` as one block with `gap` pixels between them. `was` is what the sign said before. The colours were sampled
# from each sign: the fill is the median of its interior, the lettering the median of the original strokes' cores.
# Two optional keys serve a sign that is not a plain rectangle: `area`, the corners of a polygon (inclusive pixel
# coordinates) painted flat instead of `rect`, which then only places the lines; and `shadow`, a colour and an
# [x, y] offset at which the lines are drawn first, for a sign whose own letters cast one.
REPAIRS = {
    'title': [
        {
            'was': 'GLOBL WARMING',
            'rect': [874, 442, 979, 478],
            'fill': '#8ccb7f',
            'color': '#1e4317',
            'lines': [{'text': 'GLOBAL', 'scale': 2}, {'text': 'WARMING', 'scale': 2}],
            'gap': 2,
        },
    ],
    'victory': [
        {
            'was': 'WHITE STAG over garbled letters',
            'rect': [208, 314, 416, 398],
            'fill': '#9eca84',
            'color': '#23381c',
            'lines': [{'text': 'WHITE STAG', 'scale': 3}, {'text': 'PORTLAND OREGON', 'scale': 2}],
            'gap': 10,
        },
        {
            'was': 'garbled letters on the plate beneath',
            'rect': [222, 413, 389, 434],
            'fill': '#a0c987',
            'color': None,
            'lines': [],
            'gap': 0,
        },
        {
            'was': 'the foot of the first garbled letter, on the lower lip of the plate',
            'rect': [225, 434, 361, 436],
            'fill': '#a0c987',
            'color': None,
            'lines': [],
            'gap': 0,
        },
        {
            'was': "POWELLL'S BOOKS",
            'rect': [738, 324, 887, 390],
            'fill': '#22301c',
            'color': '#acd394',
            'lines': [{'text': "POWELL'S", 'scale': 3}, {'text': 'BOOKS', 'scale': 3}],
            'gap': 9,
        },
    ],
    'loss': [
        {
            'was': 'GAME OVER over garbled letters',
            'rect': [797, 228, 975, 291],
            'fill': '#1c421d',
            'color': '#85b578',
            'lines': [{'text': 'GAME OVER', 'scale': 3}, {'text': 'NO SIGNAL', 'scale': 2}],
            'gap': 8,
        },
    ],
    'breakdown': [
        {
            'was': 'PORTLAND over TRAL on a speckled panel; the small THE above the panel stays as it is',
            'rect': [388, 76, 664, 206],
            # Inside the panel's inner line. The left side keeps the frame's bevel (x 377-387) and the step where
            # it meets the bottom line, the top-left corner is cut clear of its stepped line, and the bottom-right
            # follows the dotted diagonal one pixel short of each dot.
            'area': [
                [398, 76], [656, 76], [659, 79], [663, 79], [663, 146], [659, 150], [652, 158], [648, 163],
                [636, 173], [625, 187], [618, 195], [613, 199], [613, 201], [607, 202], [607, 205], [410, 205],
                [410, 204], [394, 204], [394, 201], [388, 201], [388, 86],
            ],
            'fill': '#3c613d',
            'color': '#c2dcb1',
            'shadow': {'color': '#0e210e', 'offset': [0, 5]},
            'lines': [{'text': 'PORTLAND', 'scale': 5}, {'text': 'TRAIL', 'scale': 5}],
            'gap': 15,
        },
    ],
}

V1 = 'docs/handoff/graphics-v1/'
PORTRAITS = {  # profession: rectangle in the portrait master
    'influencer': (20, 0, 731, 577),
    'dev': (732, 0, 1374, 577),
    'prepper': (25, 580, 682, 1145),
    'barista': (704, 580, 1374, 1145),
}
SUPPLIES = {  # resource id: rectangle in the supply icon master
    'money': (25, 85, 453, 462),
    'food': (470, 30, 870, 460),
    'fuel': (908, 35, 1307, 463),
    'ammo': (1320, 94, 1774, 464),
    'parts': (24, 470, 474, 880),
    'kombucha': (542, 460, 791, 887),
    'nft': (869, 513, 1306, 887),
}
# File: (source, crop or None, cell). The subject is fitted into the cell less the padding and centred.
SPRITES = {
    **{
        f'sprites/portrait-{name}.png': (V1 + 'background-portraits-master.png', box, (128, 128))
        for name, box in PORTRAITS.items()
    },
    **{
        f'sprites/resource-{name}.png': (V1 + 'resource-icons-master.png', box, (64, 64))
        for name, box in SUPPLIES.items()
    },
    'sprites/van.png': (V1 + 'van-side-master.png', None, (256, 128)),
}
SPRITE_PADDING = 8
ALPHA_FLOOR = 35  # alpha at or below this is generator haze, ignored when measuring the subject

ICON_SOURCE = 'docs/handoff/graphics-v2/app-icon.png'
ICONS = {
    'icons/icon-192.png': 192,
    'icons/icon-512.png': 512,
    'icons/apple-touch-icon.png': 180,
    'icons/favicon-32.png': 32,
    'icons/favicon-16.png': 16,
}

FONT = pixelfont.FONT_FILE.relative_to(ASSETS).as_posix()
FONT_SOURCE = pixelfont.GLYPH_SHEET.relative_to(ROOT).as_posix()

Glyphs = dict[str, list[str]]


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def encode(image, format: str, **options) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, format, **options)
    return buffer.getvalue()


def write(file: str, data: bytes) -> bool:
    """Write a file under app/assets unless it already holds these bytes. True when the file changed."""
    path = ASSETS / file
    if path.is_file() and path.read_bytes() == data:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return True


def fit_width(image, width: int):
    """Scale down to `width`, keeping the aspect ratio. Never enlarges."""
    if image.width <= width:
        return image
    height = (2 * image.height * width + image.width) // (2 * image.width)  # rounded half up
    return image.resize((width, height), Image.Resampling.LANCZOS)


# Scenes


def check_box(what: str, box, size: tuple[int, int]) -> None:
    """Refuse a (left, top, right, bottom) box that is empty or reaches outside an image of this size."""
    left, top, right, bottom = box
    if not (0 <= left < right <= size[0] and 0 <= top < bottom <= size[1]):
        raise ValueError(f'{what} {list(box)} is empty or lies outside the {size[0]}x{size[1]} image')


def repair(image, spec: dict, glyphs: Glyphs) -> None:
    """Paint a sign's interior flat and set its lines in the pixel face, centred."""
    check_box('the repair rectangle', spec['rect'], image.size)
    left, top, right, bottom = spec['rect']
    draw = ImageDraw.Draw(image)
    if 'area' in spec:
        corners = [(x, y) for x, y in spec['area']]
        if len(corners) < 3 or not all(0 <= x < image.width and 0 <= y < image.height for x, y in corners):
            size = f'{image.width}x{image.height}'
            raise ValueError(f'the repair area {spec["area"]} is not a polygon inside the {size} image')
        draw.polygon(corners, fill=spec['fill'])
    else:
        draw.rectangle((left, top, right - 1, bottom - 1), fill=spec['fill'])
    lines = [(line['text'], line['scale']) for line in spec['lines']]
    if not lines:
        return
    widths, extents = [], []
    for text, scale in lines:
        widths.append(pixelfont.text_width(glyphs, text, scale))
        lit = [index for char in text for index, row in enumerate(glyphs[char]) if '#' in row]
        extents.append((min(lit), max(lit)))  # capitals light rows 1-7 of the cell, descenders row 8
    heights = [(last - first + 1) * scale for (_, scale), (first, last) in zip(lines, extents)]
    block = sum(heights) + spec['gap'] * (len(lines) - 1)
    shadow = spec.get('shadow')
    offsets = [(0, 0)] + ([tuple(shadow['offset'])] if shadow else [])
    y = top + (bottom - top - block) // 2
    placed = []
    for (text, scale), width, (first, _), height in zip(lines, widths, extents, heights):
        x = left + (right - left - width) // 2
        # The lit pixels of the line, and of its shadow, keep at least one pixel clear of the rectangle's edge.
        if not all(left < x + dx and x + dx + width < right and top < y + dy and y + dy + height < bottom
                   for dx, dy in offsets):
            raise ValueError(f'"{text}" at scale {scale} does not fit inside {spec["rect"]}')
        placed.append((text, scale, x, y - first * scale))
        y += height + spec['gap']
    if shadow:
        dx, dy = shadow['offset']
        for text, scale, x, y in placed:
            pixelfont.draw_text(image, (x + dx, y + dy), text, glyphs, scale, shadow['color'])
    for text, scale, x, y in placed:
        pixelfont.draw_text(image, (x, y), text, glyphs, scale, spec['color'])


def scene(scene_id: str, glyphs: Glyphs, repaired: bool = True):
    """The cropped scene, with its signs repaired unless `repaired` is false."""
    source, crop = SCENES[scene_id]
    with Image.open(ROOT / source) as opened:
        image = opened.convert('RGB')
    if crop:
        check_box(f'the crop of {scene_id}', crop, image.size)
        image = image.crop(crop)
    if repaired:
        for spec in REPAIRS.get(scene_id, []):
            repair(image, spec, glyphs)
    return image


def scene_files(scene_id: str) -> list[tuple[str, int, int]]:
    """(file, width limit, quality) for both sizes of a scene."""
    return [
        (f'scenes/{scene_id}.webp', SCENE_WIDTH, SCENE_QUALITY),
        (f'scenes/{scene_id}-{PHONE_WIDTH}.webp', PHONE_WIDTH, PHONE_QUALITY),
    ]


def scene_bytes(image, width: int, quality: int) -> bytes:
    return encode(fit_width(image, width), 'WEBP', quality=quality, method=WEBP_METHOD)


def build_scenes(glyphs: Glyphs) -> list[str]:
    changed = []
    for scene_id in SCENES:
        image = scene(scene_id, glyphs)
        for file, width, quality in scene_files(scene_id):
            if write(file, scene_bytes(image, width, quality)):
                changed.append(file)
    return changed


# Sprites, icons and the typeface


def sprite(source: str, crop, cell: tuple[int, int]):
    """Cut a subject from a master, trim the haze around it, fit it into the cell and centre it."""
    with Image.open(ROOT / source) as opened:
        image = opened.convert('RGBA')
    if crop:
        check_box(f'the crop of {source}', crop, image.size)
        image = image.crop(crop)
    bounds = image.getchannel('A').point(lambda alpha: 255 if alpha > ALPHA_FLOOR else 0).getbbox()
    if bounds:
        image = image.crop(bounds)
    image = ImageOps.contain(image, (cell[0] - SPRITE_PADDING, cell[1] - SPRITE_PADDING), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', cell, (0, 0, 0, 0))
    canvas.alpha_composite(image, ((cell[0] - image.width) // 2, (cell[1] - image.height) // 2))
    return canvas


def build_sprites(glyphs: Glyphs) -> list[str]:
    changed = []
    for file, (source, crop, cell) in SPRITES.items():
        if write(file, encode(sprite(source, crop, cell), 'PNG', optimize=True)):
            changed.append(file)
    return changed


def build_icons(glyphs: Glyphs) -> list[str]:
    with Image.open(ROOT / ICON_SOURCE) as opened:
        master = opened.convert('RGB')
    changed = []
    for file, size in ICONS.items():
        if write(file, encode(master.resize((size, size), Image.Resampling.LANCZOS), 'PNG', optimize=True)):
            changed.append(file)
    return changed


def build_font(glyphs: Glyphs) -> list[str]:
    """Rebuild the web font through pixelfont and read it back against the glyph sheet."""
    path = ASSETS / FONT
    before = path.read_bytes() if path.is_file() else None
    pixelfont.build_woff2(glyphs, path)
    pixelfont.check_font(path, glyphs)
    return [FONT] if path.read_bytes() != before else []


BUILDERS = {'scenes': build_scenes, 'sprites': build_sprites, 'icons': build_icons, 'font': build_font}


# Manifest


def outputs():
    """Every file this script makes: (category, file, source, crop, repairs)."""
    for scene_id, (source, crop) in SCENES.items():
        for file, _, _ in scene_files(scene_id):
            yield 'scenes', file, source, crop, REPAIRS.get(scene_id, [])
    for file, (source, crop, _) in SPRITES.items():
        yield 'sprites', file, source, crop, []
    for file in ICONS:
        yield 'icons', file, ICON_SOURCE, None, []
    yield 'font', FONT, FONT_SOURCE, None, []


def write_manifest() -> bool:
    """Describe every output as it is on disk, so that a run limited by --only still writes a whole manifest."""
    source_hashes: dict[str, str] = {}
    assets = []
    for _, file, source, crop, repairs in outputs():
        path = ASSETS / file
        if not path.is_file():
            raise SystemExit(f'{path.relative_to(ROOT)} is missing: run the script without --only to make it.')
        data = path.read_bytes()
        width = height = None
        if path.suffix in ('.webp', '.png'):
            with Image.open(path) as image:
                width, height = image.size
        if source not in source_hashes:
            source_hashes[source] = sha256((ROOT / source).read_bytes())
        assets.append(
            {
                'file': file,
                'source': source,
                'source_sha256': source_hashes[source],
                'crop': list(crop) if crop else None,
                'repairs': repairs,
                'width': width,
                'height': height,
                'bytes': len(data),
                'sha256': sha256(data),
            }
        )
    assets.sort(key=lambda asset: asset['file'])
    tools = {'pillow': PIL.__version__, 'fonttools': fontTools.version, 'brotli': brotli.__version__}
    manifest = {'version': 2, 'tools': tools, 'assets': assets}
    return write('manifest.json', (json.dumps(manifest, indent=2) + '\n').encode())


def strays() -> list[str]:
    """Files under app/assets that this script does not make."""
    made = {file for _, file, *_ in outputs()} | {'manifest.json'}
    found = (path.relative_to(ASSETS).as_posix() for path in ASSETS.rglob('*') if path.is_file())
    return sorted(name for name in found if name not in made and not name.endswith('.DS_Store'))


# Preview sheets, in the game's colours


INK, PAPER, QUIET = '#07110a', '#e1eacb', '#92a588'
LABEL_SCALE = 2
LABEL_HEIGHT = 7 * LABEL_SCALE


def label(image, xy, text: str, glyphs: Glyphs, fill: str = PAPER) -> None:
    pixelfont.draw_text(image, xy, text, glyphs, LABEL_SCALE, fill)


def decoded(data: bytes):
    with Image.open(io.BytesIO(data)) as opened:
        return opened.convert('RGB')


def shown(file: str, factor: int = 1):
    """An asset as it looks on the game's ink, enlarged without smoothing."""
    with Image.open(ASSETS / file) as opened:
        image = opened.convert('RGBA')
    canvas = Image.new('RGBA', image.size, INK)
    canvas.alpha_composite(image)
    return zoom(canvas.convert('RGB'), factor)


def zoom(image, factor: int):
    if factor == 1:
        return image
    return image.resize((image.width * factor, image.height * factor), Image.Resampling.NEAREST)


def stack(rows: list[list[tuple[str, object]]], glyphs: Glyphs, pad: int = 12):
    """Lay out captioned images in rows: [[(caption, image), ...], ...]."""

    def cell_width(caption: str, image) -> int:
        return max(image.width, pixelfont.text_width(glyphs, caption, LABEL_SCALE))

    widths = [sum(cell_width(*cell) for cell in row) + pad * (len(row) - 1) for row in rows]
    heights = [max(image.height for _, image in row) + LABEL_HEIGHT + pad // 2 for row in rows]
    sheet = Image.new('RGB', (max(widths) + 2 * pad, sum(heights) + pad * (len(rows) + 1)), INK)
    y = pad
    for row, height in zip(rows, heights):
        x = pad
        for caption, image in row:
            label(sheet, (x, y), caption, glyphs)
            sheet.paste(image, (x, y + LABEL_HEIGHT + pad // 2))
            x += cell_width(caption, image) + pad
        y += height + pad
    return sheet


def scene_sheet(glyphs: Glyphs) -> str:
    """Every scene as phones get it, with its id and both sizes."""
    columns, thumb, pad = 5, (320, 214), 12
    cell_w, cell_h = thumb[0] + pad, thumb[1] + 2 * LABEL_HEIGHT + 3 * pad
    rows = -(-len(SCENES) // columns)
    sheet = Image.new('RGB', (columns * cell_w + pad, rows * cell_h + pad), INK)
    for index, scene_id in enumerate(SCENES):
        x, y = pad + index % columns * cell_w, pad + index // columns * cell_h
        (full, _, _), (phone, _, _) = scene_files(scene_id)
        with Image.open(ASSETS / full) as opened:
            full_size = opened.size
        image = decoded((ASSETS / phone).read_bytes())
        sheet.paste(ImageOps.contain(image, thumb, Image.Resampling.LANCZOS), (x, y))
        label(sheet, (x, y + thumb[1] + pad // 2), scene_id, glyphs)
        sizes = f'{full_size[0]}x{full_size[1]} · {image.width}x{image.height}'
        label(sheet, (x, y + thumb[1] + LABEL_HEIGHT + pad), sizes, glyphs, QUIET)
    sheet.save(PREVIEWS / 'scenes.png')
    return 'scenes.png'


def repair_sheets(glyphs: Glyphs) -> list[str]:
    """Before and after for each repaired scene, whole and at 390 pixels wide, then each sign at 1x and enlarged.

    Both states go through the same WebP encoding, so the comparison shows what ships. A phone 390 pixels wide
    shows the 960 copy scaled down.
    """
    names = []
    for scene_id, specs in REPAIRS.items():
        unrepaired = scene(scene_id, glyphs, repaired=False)
        files = scene_files(scene_id)
        shipped = {
            'before': [decoded(scene_bytes(unrepaired, width, quality)) for _, width, quality in files],
            'after': [decoded((ASSETS / file).read_bytes()) for file, _, _ in files],
        }
        phone = {state: fit_width(images[1], 390) for state, images in shipped.items()}
        full_width, full_height = shipped['after'][0].size
        to_phone = 390 / full_width
        whole = [
            [
                (f'{scene_id} before', fit_width(shipped['before'][0], 640)),
                ('after', fit_width(shipped['after'][0], 640)),
            ],
            [('390 wide before', phone['before']), ('390 wide after', phone['after'])],
        ]
        names.append(f'repair-{scene_id}.png')
        stack(whole, glyphs).save(PREVIEWS / names[-1])
        for number, spec in enumerate(specs, start=1):
            left, top, right, bottom = spec['rect']
            box = (max(0, left - 12), max(0, top - 12), min(full_width, right + 12), min(full_height, bottom + 12))
            factor = max(2, min(6, 900 // (box[2] - box[0])))
            crops = {state: images[0].crop(box) for state, images in shipped.items()}
            small = tuple(round(value * to_phone) for value in box)
            rows = [
                [
                    ('before', crops['before']),
                    ('after', crops['after']),
                    ('390 wide 4x', zoom(phone['before'].crop(small), 4)),
                    ('after', zoom(phone['after'].crop(small), 4)),
                ],
                [(f'before {factor}x', zoom(crops['before'], factor))],
                [(f'after {factor}x', zoom(crops['after'], factor))],
            ]
            names.append(f'repair-{scene_id}-{number}.png')
            stack(rows, glyphs).save(PREVIEWS / names[-1])
    return names


def sprite_sheet(glyphs: Glyphs) -> str:
    """Sprites at 1x and 2x on the game's ink, and the icons at their sizes."""
    portraits = [(name, f'sprites/portrait-{name}.png') for name in PORTRAITS]
    supplies = [(name, f'sprites/resource-{name}.png') for name in SUPPLIES]
    rows = [
        [(name, shown(file)) for name, file in portraits],
        [(f'{name} 2x', shown(file, 2)) for name, file in portraits],
        [(name, shown(file)) for name, file in supplies],
        [(f'{name} 2x', shown(file, 2)) for name, file in supplies],
        [('van', shown('sprites/van.png')), ('van 2x', shown('sprites/van.png', 2))],
        [(str(size), shown(file)) for file, size in ICONS.items()],
    ]
    stack(rows, glyphs).save(PREVIEWS / 'sprites.png')
    return 'sprites.png'


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description='Regenerate app/assets from the preserved originals.')
    parser.add_argument('--only', choices=CATEGORIES, help='make only these files; the manifest is always rewritten')
    only = parser.parse_args(argv).only
    chosen = [only] if only else list(CATEGORIES)
    glyphs = pixelfont.load_glyphs(pixelfont.GLYPH_SHEET)

    for category in chosen:
        changed = BUILDERS[category](glyphs)
        files = [file for kind, file, *_ in outputs() if kind == category]
        size = sum((ASSETS / file).stat().st_size for file in files)
        print(f'{category}: {len(files)} files, {size:,} bytes, {len(changed)} changed')
    if 'font' in chosen:
        print(f'{FONT}: sha256 {sha256((ASSETS / FONT).read_bytes())}, matches the glyph sheet')
    print(f'manifest.json: {len(list(outputs()))} files, {"changed" if write_manifest() else "unchanged"}')

    PREVIEWS.mkdir(parents=True, exist_ok=True)
    sheets = []
    if 'scenes' in chosen:
        sheets += [scene_sheet(glyphs), *repair_sheets(glyphs)]
    if 'sprites' in chosen or 'icons' in chosen:
        sheets.append(sprite_sheet(glyphs))
    print(f'previews in {PREVIEWS.relative_to(ROOT)}: {", ".join(sheets)}')

    extra = strays()
    if extra:
        print(f'{len(extra)} files under app/assets are not made by this script: {", ".join(extra[:8])}', end='')
        print(' …' if len(extra) > 8 else '')
    return 0


if __name__ == '__main__':
    sys.exit(main())
