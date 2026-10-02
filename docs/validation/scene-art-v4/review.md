# Independent final review: scene art v4

Reviewed October 2, 2026. Scope: the uncommitted `codex/scene-art-v4` changes against `f59f674`, including the review package and new files read directly. No implementation, artwork, tests, commits, or remote state were changed by this reviewer. This report is the only file written.

## Spec compliance verdict: pass

The five required scenes are present and mapped correctly. `prepare-assets.py` adds each graphics-v4 source with crop `None`; `data.js` changes exactly the two region and three encounter scene values. The inspected diff contains no game-rule, number, choice, encounter-weight, save-format, engine, or interface behavior changes.

Independent provenance checks confirmed all five masters are 1536×1024 RGB PNGs, and each master hash matches both its recorded SHA-256 and the original selected image-tool output. The two Sasquatch generation-step hashes also match their source files. Every recorded prompt, including the refinement, contains the brief's complete shared style and exclusion blocks verbatim. The generation records explain the selected refinement without implying that a preserved master was manually edited.

The manifest diff adds exactly ten WebP records, two per scene, with the expected source paths, source hashes, dimensions, no repairs, and null crops. The working diff leaves pre-existing masters and derived art unchanged. Root's separate verification of all 82 manifest source/output hashes was accepted as supplied evidence and was not rerun.

The updated handoff index, asset specification table, project instructions, and production brief agree with the final mappings. The corrected brief accurately describes the current CSS cover crops, including the 32% art column on short landscape screens.

## Visual quality verdict: pass

Viewed all five native masters, the gallery, all five final crop sheets, and existing `road-forest`, `road-river`, and `heatwave` references. Each crop sheet covers 390×664, 414×715, 430×739, 1440×900, and 844×390.

- **Pines:** dark, dense trunks distinguish this region from the more open forest reference. The horizontal road remains clear; the live van is readable against the scenery.
- **Outskirts:** storage units, coffee hut, tire shop, blank signs, power lines, and tower communicate an anonymous town edge. The road stays horizontal and unobstructed. Neither road master contains people or vehicles.
- **Sasquatch:** the obscured shaggy figure and two observing travelers, one holding a phone, survive the portrait, desktop, and narrow landscape crops. The face remains ambiguous; the mist uses visible pixel dithering.
- **Toll troll:** collector, card reader, folding table, and travelers remain readable across the crops. The vest and cone stay within the green palette, and the card-reader display contains no generated lettering.
- **Brunch line:** the queue visibly blocks the roadway. The narrow landscape crop loses most restaurant frontage, as the validation record states, but retains the central line and roadway, so the encounter still reads.

No generated lettering, watermarks, accidental interface elements, vans in encounter illustrations, or blocking composition defects were found. The scenes use stepped pixel edges, layered evergreen scenery, green shading, and deadpan staging consistent with the reference set. They are not exact indexed four-color images; the README and validation note accurately disclose that limitation and report the brief's representative eight-color green check rather than claiming exact pixel equality.

## Findings by severity

No open P0, P1, P2, or P3 findings.

A documentation/evidence discrepancy was found during review: the first toll and brunch fixtures used miles 600 and 800, outside the encounters' normal route ranges. Root and the visual reviewer corrected the fixtures and regenerated the evidence. I read the refreshed durable `checks.json`, which now records toll at mile 300 and brunch at mile 900, and re-inspected all five refreshed crop sheets. The validation prose explicitly describes the correction. This item is resolved.

## Verification evidence and limits

The supplied results and durable summary record 211 passing rules tests, passing typecheck, six passing browser suites totaling 835 checks, and the corrected focused run with 25 cases and 230 checks, zero failures. These suites were not rerun by this reviewer, per assignment. Root owns final checksum refresh and plan completion; those pending finalization steps are not review defects.

This review independently inspected source, metadata, master/source hashes, and images. Browser results are Chrome emulation, not real-device proof. No physical-device browser claim is made.
