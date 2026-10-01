# iPhone playback and visual polish

Verified October 1, 2026 on the MacBook Pro. This extends the [roadtrip update](2026-10-01-roadtrip-update.md); game rules and save schema are unchanged.

## Findings and changes

The first WebKit measurement found 122 failed assertions across 302 checks. Repeated issues included native selects rendering only 18–20px tall, 11–12px editable text, a clipped narrow trip row, and travel/encounter actions below short landscape viewports. At 390×664, Auto-buy ended at y836. Resume could scroll the page down before the player saw the scene.

The revised layout has real 44px controls, 16px editable text, compact portrait scenes, and a landscape scene/action row. Auto-buy fits the initial viewport at every tested portrait size. Resume focuses the screen without scrolling it out of view. Scrolling remains available for the crew, activities, shops and journal. Zoom remains enabled.

### Measured WebKit layout

CSS pixels; heights deliberately allow for Safari's browser controls. Measurements use the initial developer journey, before notices or longer later-stop descriptions.

| Viewport | Scene height | Drive bottom | Trip facts bottom | Auto-buy bottom |
| --- | ---: | ---: | ---: | ---: |
| 320×568 | 180 | 411 | 489 | 559 |
| 375×548 | 180 | 382 | 458 | 516 |
| 390×664 | 199 | 402 | 477 | 529 |
| 402×681 | 204 | 407 | 482 | 516 |
| 414×715 | 215 | 417 | 493 | 521 |
| 430×739 | 222 | 424 | 500 | 495 |
| 440×763 | 229 | 431 | 507 | 499 |

At 756×352 landscape, the scene is 156px high, Drive ends at y197 and trip facts at y272. Supplies are farther down the page in landscape. The full van remains inside the scene in every tested viewport.

## Added graphics and motion

- Three [new illustrated masters](../handoff/graphics-v3/README.md): river gorge, Portland approach, and heatwave encounter.
- Brief clouds, road dust and passing marks during travel; leaves, rain, steam and embers at selected stops.
- Actual inventory and health changes briefly highlight. Closing an arrival encounter reveals its scene effects, including after resuming a saved encounter.
- Reduced motion disables animations and transitions; the same journey result and receipt remain available.
- All 24 scene JPEGs have 640px/960px phone variants. DPR3 selection and image decoding were checked. The forest-road 960px file is 64% smaller than its desktop source; the mushroom-market file is 66% smaller.

## Verification

- **WebKit: 388/388 assertions passed. Chrome: 388/388 passed.** Eleven viewports: 320×568, 375×548, 390×664, 402×681, 414×715, 430×739, 440×763, 756×352, 844×390, 874×402 and 1440×900. No browser errors or image-load failures.
- Checks include overflow, complete van visibility, primary action placement, all encounter choices, 44px targets, editable font size, keyboard/dialog focus, responsive image selection, actual animation playback, saved state before playback, persistent receipts, reduced motion, and arrival effects stopping within three seconds.
- **35 rule tests passed**, plus **29 enhancement browser checks**. New enhancement assertions cover changed-supply feedback and mobile versus desktop image selection.
- The final static build passed **32 original browser checks**, including a successful route to mile 1000/day 18 with five survivors and a losing route at mile 280/day 6, event reload/focus, invalid saves and blocked storage.
- Independent review found no actionable defects. All 48 phone image hashes and byte counts matched their manifest. Build copies include the mobile directory.

Reports: [WebKit](iphone/webkit-report.json), [Chrome](iphone/chromium-report.json), [baseline](iphone/baseline-report.json), [static-build gameplay](iphone/browser-report.json), [enhancements](iphone/enhancements-report.json).

Inspected screenshots: [390px travel](iphone/travel-390x664.png), [small encounter](iphone/event-320x568.png), [375px supplies](iphone/shop-375x548.png), [landscape](iphone/travel-844x390.png), [desktop](iphone/travel-1440x900.png), [campground arrival](iphone/campground-arrival-390x664.png).

## Native iOS Simulator

Safari in an existing iPhone 17 Pro simulator running iOS 26.5 was checked directly. The walkthrough covered setup, the crew form, Auto-buy, departure, travel playback, its completed receipt, rotation, and arrival at Mushroom Market. The portrait scene, Drive button and trip facts fit together. Landscape placed the scene beside its primary action without clipping the van. The simulator was returned to its original powered-off state afterward.

Native screenshots: [supplies](iphone/native-safari-shop.png), [portrait travel](iphone/native-safari-travel.png), [landscape travel](iphone/native-safari-landscape.png).

This is simulator evidence, not physical-phone performance evidence. Battery use, thermal behavior, physical touch interaction and native home-screen installation were not measured. No public deployment was made; the localhost preview needs its server running.

## Repeat the viewport checks

With the local preview already running, the Mac's bundled Playwright and installed Chrome can run:

```bash
cd "/Users/ama/The Portland Trail"
PLAYWRIGHT_MODULE="/Users/ama/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright" BROWSER=chromium node app/tests/browser-iphone.mjs
```

For this session, Playwright's official WebKit runtime was installed into `/private/tmp/portland-playwright` rather than globally. While that temporary runtime exists:

```bash
cd "/Users/ama/The Portland Trail"
PLAYWRIGHT_BROWSERS_PATH="/private/tmp/portland-playwright" PLAYWRIGHT_MODULE="/Users/ama/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright" BROWSER=webkit node app/tests/browser-iphone.mjs
```

Both scripts accept `TEST_URL` to target another local preview or the static build.
