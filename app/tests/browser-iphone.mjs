import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createGame, transition, serializeGame } from '../src/engine.js';
import { LOCATIONS } from '../src/data.js';

const require = createRequire(import.meta.url);
const playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const engine = process.env.BROWSER || 'webkit';
const baseline = process.env.BASELINE === '1';
const output = fileURLToPath(new URL(`../test-results/iphone/${baseline ? 'baseline' : engine}/`, import.meta.url));
const url = process.env.TEST_URL || 'http://127.0.0.1:4173';
const key = 'the-portland-trail:v1';
const checks = [], failures = [], errors = [];
await mkdir(output, { recursive: true });
const browser = await playwright[engine].launch({ headless: true, ...(engine === 'chromium' ? { channel: 'chrome' } : {}) });
const sizes = [[320,568], [375,548], [390,664], [402,681], [414,715], [430,739], [440,763], [756,352], [844,390], [874,402], [1440,900]];
function check(ok, name, evidence) {
  checks.push({ name, passed: Boolean(ok), ...(evidence === undefined ? {} : { evidence }) });
  if (!ok) failures.push(name);
}
async function open(width, height, fixture, motion = 'reduce', scale = 1) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale, isMobile: width < 1000, hasTouch: width < 1000, reducedMotion: motion });
  if (fixture) await context.addInitScript(({ saved, key }) => {
    localStorage.setItem(key, saved);
  }, { saved: serializeGame(fixture), key });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  await page.goto(url);
  if (fixture) await page.getByRole('button', { name: 'Resume journey', exact: true }).click();
  return { context, page };
}
async function inspect(page, name, screenshot = true) {
  await page.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode().catch(() => {}))));
  const result = await page.evaluate(() => {
    const visible = el => Boolean(el.getClientRects().length) && !el.closest('dialog:not([open])');
    const rect = el => { if (!el) return null; const b = el.getBoundingClientRect(); return { x:b.x, y:b.y, width:b.width, height:b.height, bottom:b.bottom }; };
    const targets = [...document.querySelectorAll('button, input, select, summary, .brand')].filter(visible);
    const smallTargets = targets.filter(el => { const b=el.getBoundingClientRect(); return b.height < 43.5 || b.width < 43.5; }).map(el => ({ text: el.textContent.trim().slice(0,60), ...rect(el) }));
    const smallControls = [...document.querySelectorAll('input,select')].filter(visible).filter(el => parseFloat(getComputedStyle(el).fontSize) < 16).map(el => ({ name: el.getAttribute('aria-label') || el.name, font: getComputedStyle(el).fontSize }));
    const criticalText = [...document.querySelectorAll('.trip-numbers span,.trip-numbers small,.resource-name,.resources-compact strong,.mobile-traveler strong,.mobile-traveler > span,.activity p,.scene-text > p:last-child')].filter(visible).filter(el => parseFloat(getComputedStyle(el).fontSize) < 11).map(el => ({ text:el.textContent.trim(), font:getComputedStyle(el).fontSize }));
    return { viewport: {width:innerWidth,height:innerHeight}, scrollWidth:document.documentElement.scrollWidth,
      smallTargets, smallControls, criticalText,
      broken:[...document.images].filter(image => !image.complete || !image.naturalWidth).map(image => image.src),
      scene:rect(document.querySelector('.scene-image-wrap')), drive:rect(document.querySelector('.primary-action button')),
      van:rect(document.querySelector('.van-cutout')),
      sceneSource:document.querySelector('.road-backdrop,.scene-image')?.currentSrc,
      facts:rect(document.querySelector('.trip-numbers')), autoBuy:rect(document.querySelector('[data-action="autoPurchase"]')),
      dialog:rect(document.querySelector('#event-dialog[open]')),
      choices:[...document.querySelectorAll('#event-dialog[open] [data-event-choice]')].map(rect),
      modalFocus:document.activeElement.closest('#event-dialog') !== null,
    };
  });
  check(result.scrollWidth <= result.viewport.width + 1, `${name}: no horizontal overflow`, result.scrollWidth);
  check(result.broken.length === 0, `${name}: images loaded`, result.broken);
  if (result.viewport.width < 1000) {
    check(result.smallTargets.length === 0, `${name}: 44px touch targets`, result.smallTargets);
    check(result.smallControls.length === 0, `${name}: 16px editable controls`, result.smallControls);
    check(result.criticalText.length === 0, `${name}: readable trip text`, result.criticalText);
  }
  if (screenshot) await page.screenshot({ path:join(output,`${name}.png`),fullPage:false });
  return result;
}
try {
  for (const [width,height] of sizes) {
    const size=`${width}x${height}`;
    const travel=transition(createGame({profession:'dev',seed:21}),{type:'depart'}).state;
    const {page,context}=await open(width,height,travel);
    const metrics=await inspect(page,`travel-${size}`);
    check(metrics.drive.bottom <= height && metrics.drive.y >= 0, `travel-${size}: Drive visible without scrolling`, metrics.drive);
    check(metrics.facts.bottom <= height, `travel-${size}: trip facts visible without scrolling`, metrics.facts);
    check(metrics.van.x >= metrics.scene.x && metrics.van.x + metrics.van.width <= metrics.scene.x + metrics.scene.width && metrics.van.y >= metrics.scene.y && metrics.van.bottom <= metrics.scene.bottom, `travel-${size}: whole van visible`,metrics.van);
    if (width<500) check(metrics.scene.height >= 160 && metrics.scene.height <= 235, `travel-${size}: useful scene height`, metrics.scene);
    if (!baseline && width<500) check(/-640\.jpg$/.test(metrics.sceneSource),`travel-${size}: phone image delivered`,metrics.sceneSource);
    if (width===390) await page.screenshot({ path:join(output,'travel-390-full.png'),fullPage:true });
    await page.locator('.route-details summary').click();
    check(await page.locator('.route-stop').count() === LOCATIONS.length,`travel-${size}: route remains available`);
    await inspect(page,`route-${size}`,false);
    await context.close();

    const {page:sp,context:sc}=await open(width,height,createGame({profession:'dev',seed:21}));
    const shop=await inspect(sp,`shop-${size}`);
    check(width<500 ? shop.autoBuy.bottom <= height : shop.autoBuy.y < height + 120,`shop-${size}: auto-buy discoverable`,shop.autoBuy);
    await sp.locator('[data-action="autoPurchase"]').click();
    check(await sp.getByRole('button',{name:'Essentials packed',exact:true}).isDisabled(),`shop-${size}: auto-buy works`);
    await sc.close();

    const pending=structuredClone(travel);
    pending.pendingEvent={id:'van_breakdown',token:99}; pending.flags.nextToken=99;
    pending.inventory.parts=2;
    const {page:ep,context:ec}=await open(width,height,pending);
    const event=await inspect(ep,`event-${size}`);
    check(event.choices.every(choice => choice.y >= 0 && choice.bottom <= height), `event-${size}: all choices visible`,event.choices);
    check(event.modalFocus,`event-${size}: focus enters dialog`);
    await ep.keyboard.press('Escape');
    check(await ep.locator('#event-dialog').evaluate(dialog=>dialog.open),`event-${size}: Escape preserves pending event`);
    await ep.locator('[data-event-choice="repair"]').click();
    check(await ep.locator('#event-dialog').evaluate(dialog=>!dialog.open),`event-${size}: choice resolves`);
    await ec.close();
  }

  for (const [width,height] of [[320,568],[390,664]]) {
    const {page,context}=await open(width,height,null);
    await inspect(page,`title-${width}x${height}`);
    await page.getByRole('button',{name:'Start a new journey',exact:true}).click();
    await inspect(page,`backgrounds-${width}x${height}`,false);
    await page.getByRole('button',{name:'Continue to the crew'}).click();
    await page.getByLabel('Traveler 1',{exact:true}).fill('AlexandertheTravelerWithLongName');
    await inspect(page,`names-${width}x${height}`);
    await page.getByRole('button',{name:'Pack the van',exact:true}).click();
    await page.locator('.primary-action button').click();
    await inspect(page,`long-name-${width}x${height}`,false);
    await context.close();
  }
  const fixture=createGame({profession:'dev',seed:21});
  const longStop=LOCATIONS.find(place=>place.id==='viral_landmark');
  Object.assign(fixture,{distance:longStop.miles,phase:'location',locationId:longStop.id});
  const {page:lp,context:lc}=await open(390,664,fixture);
  await inspect(lp,'long-location-390x664'); await lc.close();

  // Observe the rendered animation and its saved state. Reduced motion still
  // reports mileage and resources, without requiring visual playback.
  if (!baseline) {
    const travel=transition(createGame({profession:'dev',seed:21}),{type:'depart'}).state;
    const {page:dp,context:dc}=await open(402,681,travel,'reduce',3);
    await dp.locator('.road-backdrop').evaluate(image=>image.decode());
    check(/-960\.jpg$/.test(await dp.locator('.road-backdrop').evaluate(image=>image.currentSrc)),'iPhone pixel density: 960px image selected');
    await dc.close();
    const {page:mp,context:mc}=await open(390,664,travel,'no-preference');
    await mp.locator('.primary-action button').click();
    check(await mp.locator('.is-driving').count()===1,'motion: driving begins');
    const movement=await mp.locator('.road-clouds,.road-dust,.road-speed-lines').evaluateAll(layers=>layers.map(layer=>({name:layer.className,running:layer.getAnimations().some(animation=>animation.playState==='running')})));
    check(movement.length===3 && movement.every(layer=>layer.running),'motion: atmosphere responds to Drive',movement);
    check((await mp.evaluate(key=>JSON.parse(localStorage.getItem(key)),key)).distance===80,'motion: miles saved before playback ends');
    await mp.screenshot({path:join(output,'driving-390x664.png')});
    await mp.locator('#event-dialog[open]').waitFor();
    await mp.locator('[data-event-choice="wait"]').click();
    check(await mp.locator('.last-leg').count()===1,'motion: visible receipt follows playback');
    await mc.close();

    const {page:rp,context:rc}=await open(390,664,travel,'reduce');
    await rp.locator('.primary-action button').click();
    check(await rp.locator('.is-driving').count()===0,'reduced motion: skips travel animation');
    await rp.locator('[data-event-choice="wait"]').click();
    check(/80 mi/.test(await rp.locator('.last-leg').innerText()),'reduced motion: retains mileage feedback');
    const reducedAnimations=await rp.evaluate(()=>document.getAnimations().filter(animation=>animation.playState==='running').map(animation=>animation.animationName || animation.transitionProperty));
    check(reducedAnimations.length===0,'reduced motion: no running animations',reducedAnimations);
    await rc.close();

    const camp=LOCATIONS.find(place=>place.id==='forest_camp');
    const approaching=structuredClone(travel);
    Object.assign(approaching,{distance:camp.miles-30,locationId:'viral_landmark'});
    approaching.inventory.fuel=30; approaching.inventory.food=50;
    const {page:ap,context:ac}=await open(390,664,approaching,'no-preference');
    await ap.locator('.primary-action button').click();
    await ap.waitForFunction(()=>!document.querySelector('.is-driving'));
    if(await ap.locator('#event-dialog').evaluate(dialog=>dialog.open)) {
      const choices=ap.locator('[data-event-choice]:not(:disabled)');
      await choices.last().click();
    }
    const settling=await ap.locator('.scene-atmosphere.is-active span').evaluateAll(particles=>particles.map(particle=>({running:particle.getAnimations().some(animation=>animation.playState==='running'),iteration:getComputedStyle(particle).animationIterationCount})));
    check(settling.length===6 && settling.some(particle=>particle.running),'arrival: scene responds to reaching campground',settling);
    await ap.screenshot({path:join(output,'campground-arrival-390x664.png')});
    await ap.waitForTimeout(3000);
    check((await ap.evaluate(()=>document.getAnimations().filter(animation=>animation.playState==='running').length))===0,'arrival: all effects settle within three seconds');
    await ac.close();
  }
  check(errors.length===0,'no browser errors',errors);
  await writeFile(join(output,'report.json'),JSON.stringify({engine,baseline,passed:failures.length===0,checks,failures,errors},null,2));
  console.log(JSON.stringify({engine,baseline,checks:checks.length,failed:failures.length,failures},null,2));
  if (!baseline) assert.deepEqual(failures,[],'iPhone browser checks');
} finally { await browser.close(); }
