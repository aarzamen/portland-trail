THE PORTLAND TRAIL — GRAPHICS BATCH 1
Prepared 2026-10-01. Included in Codex handoff package version 2.

WHAT IS READY
Three original high-resolution PNG concept masters generated with OpenAI image
generation using the exported title illustration as the visual reference:
  ../evidence/provided-export/images/static_start_screen.jpeg

The muted green palette, heavy outlines, expressive people and loaded vintage
van extend the existing game's visual identity. These are proposed designs for
the rebuild, not evidence that a final art direction has been approved.

All three images contain true alpha transparency. The exact generator output
bytes are preserved. No resizing, recoloring, cropping, palette quantization or
sprite cleanup was performed. The visual style is pixel-like; a strict pixel
grid and exact four-color palette have not been validated.

FILES AND MAPPING

resource-icons-master.png — 1774 x 887 RGBA PNG
Conceptual four-column, two-row arrangement. The lower-right space is empty.
These positions identify the objects; they are not final crop rectangles.

Position     Original id  Subject                         Proposed final file
Row 1 col 1  money        Banded banknotes                 resource-money.png
Row 1 col 2  food         Kale-chip bag                    resource-food.png
Row 1 col 3  fuel         Leaf-marked jerrycan             resource-fuel.png
Row 1 col 4  ammo         Seed-bomb pouch and sprout       resource-ammo.png
Row 2 col 1  parts        Washi tape and screwdriver       resource-parts.png
Row 2 col 2  kombucha     Capped kombucha bottle           resource-kombucha.png
Row 2 col 3  nft          Sasquatch collectible and USB    resource-nft.png

The final files above have NOT yet been exported. The source code calls seed
bombs ammo and repair supplies parts. Retain these mappings until any deliberate
data-model migration. money is an inventory value; the other six ids are ITEMS.
Target individual 32x32 cells; optional cleaned 64x64 detailed variants. Review
24px and 32px display sizes, with live labels. Small secondary props will likely
need simplification rather than uniform downscaling of every detail.

background-portraits-master.png — 1374 x 1145 RGBA PNG
Conceptual two-column, two-row arrangement:

Position      Original profession id  Subject
Top left      influencer              Bob, glasses, phone and ring-light cue
Top right     dev                     Tired developer, hoodie, laptop and coffee
Bottom left   prepper                 Practical kit, cap and sprouting plant
Bottom right  barista                 Mustache, apron and pour-over equipment

Target four individual 64x64 transparent busts with matching head scale, eye line
and margins. Proposed final names: portrait-influencer.png, portrait-dev.png,
portrait-prepper.png, portrait-barista.png. These files do not yet exist. Preserve
the props when separating portraits; do not blindly slice the full image at its
midpoint. Clean any incidental brand-like marks in a production edit. These four
portraits represent background selection, not the five-person companion party.

van-side-master.png — 1774 x 887 RGBA PNG
One parked vehicle facing right in side view. Fixed roof arrangement: large rear
case, rolled mat, smaller case and duffel, held by straps. Preserve this luggage
order, windows, body proportions and wheel placement in subsequent states.
Target a 128x64 cell with transparent margins and a common ground baseline.
This master has not been converted to that size. It is not an animation sheet.

PRODUCTION WORK STILL REQUIRED
1. Choose a final base grid and palette. Simplify shapes at the target sizes;
   inspect dark outlines against both the dark game background and a light QA
   surface. Avoid light fringes at alpha edges.
2. Separate the seven icons and four portraits, clean them, align optical size
   and padding, and export the individual files listed above. Preserve masters.
3. Produce the van's parked, rolling A, rolling B, hood-open breakdown and arrival
   states from one consistent silhouette. Keep all five 128x64 frames on the same
   baseline. Export individual frames and a 640x64 sheet only when frames exist.
4. Build a production sprite manifest with exact pixel rectangles, pivots,
   animation names and timing. Current manifest.json explicitly omits rectangles
   because it describes concept images, not completed sprite cells.
5. Preview in the intended UI with readable live labels and quantities. Inspect
   1x and integer-scaled assets, keyboard/focus states, and phone layouts. Do not
   use a beautiful master image as evidence that a 24px icon is readable.

ADDITIONAL WORK FROM THE AUDIT
Correct original scene assignments using asset_inventory.json and
provided_export_asset_inventory.json. Existing art can cover several broken
slots. New status symbols, a coherent travel background, missing event art and
final sprite animation remain on the original ASSET_BRIEF.txt backlog.

TRACEABILITY
manifest.json records actual dimensions, byte sizes, SHA-256 hashes, alpha
statistics, original ids and conceptual placement. prompts.json records exact
generation prompts and the style-reference path. Package checksums.json covers
every delivered file except itself. No game source was changed for this batch.
