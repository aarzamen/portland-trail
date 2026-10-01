import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createGame, transition, serializeGame } from '../src/engine.js';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = process.env.TEST_URL || 'http://127.0.0.1:4173';
const output = fileURLToPath(new URL('../test-results/browser/', import.meta.url));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const key = 'the-portland-trail:v1';
const results = [];
const errors = [];
async function context(width = 1440, saved = null) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 1000 }, reducedMotion: 'reduce' });
  if (saved) await ctx.addInitScript(({key, saved}) => {
    if (!sessionStorage.getItem('fixture-loaded')) {
      localStorage.setItem(key,saved); sessionStorage.setItem('fixture-loaded','yes');
    }
  }, {key, saved});
  const page = await ctx.newPage();
  page.on('pageerror', err => errors.push(err.message));
  page.on('response', response => { if (response.status() >= 400 && !response.url().endsWith('favicon.ico')) errors.push(`${response.status()} ${response.url()}`); });
  await page.goto(url);
  return {ctx, page};
}
async function savedState(page) { return page.evaluate(key => JSON.parse(localStorage.getItem(key)), key); }
async function verifyPage(page, name, screenshot = true) {
  await page.locator('img').evaluateAll(images => Promise.all(images.map(im => im.decode().catch(() => {}))));
  const metrics = await page.evaluate(() => ({
    width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
    badImages: [...document.images].filter(im => !im.complete || !im.naturalWidth).map(im => im.src),
    outside: [...document.querySelectorAll('button,input,select')].filter(el => {
      if (!el.getClientRects().length || el.closest('dialog:not([open])')) return false;
      const rect=el.getBoundingClientRect(); return rect.left < -1 || rect.right > innerWidth+1;
    }).map(el => el.textContent?.trim() || el.getAttribute('aria-label')),
  }));
  assert.ok(metrics.scrollWidth <= metrics.width + 1, `${name}: horizontal overflow ${JSON.stringify(metrics)}`);
  assert.deepEqual(metrics.badImages, [], `${name}: images`);
  assert.deepEqual(metrics.outside, [], `${name}: controls outside screen`);
  if (screenshot) await page.screenshot({path:join(output,`${name}.png`),fullPage:true});
  results.push({name,...metrics});
}
try {
  for (const width of [390,414,430,768,1440]) {
    const {ctx,page}=await context(width);
    await page.getByRole('heading',{name:/The Portland Trail/}).waitFor();
    await verifyPage(page,`title-${width}`);
    await page.getByRole('button',{name:'Start a new journey',exact:true}).click();
    await verifyPage(page,`backgrounds-${width}`);
    const first=page.locator('[data-profession="influencer"]');
    await first.focus(); await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('[data-profession="dev"]').getAttribute('aria-checked'),'true');
    await page.getByRole('button',{name:'Continue to the crew'}).click();
    await page.getByLabel('Traveler 1',{exact:true}).fill('<img src=x onerror=alert(1)>');
    await verifyPage(page,`names-${width}`);
    await page.getByRole('button',{name:'Pack the van',exact:true}).click();
    assert.equal((await savedState(page)).party[0].name,'<img src=x onerror=alert(1)>');
    await verifyPage(page,`shop-${width}`);
    const before=await savedState(page);
    await page.locator('[data-buy="food"]').click();
    const after=await savedState(page);
    assert.equal(after.inventory.food,before.inventory.food+1);
    await page.locator('.primary-action button').click();
    if((await savedState(page)).phase==='location') await page.locator('.primary-action button').click();
    assert.equal((await savedState(page)).phase,'travel');
    await verifyPage(page,`travel-${width}`);
    const primary=await page.locator('.primary-action button').boundingBox();
    assert.ok(primary.y+primary.height <= (width<500?844:1000),`Primary travel control below viewport at ${width}`);
    await page.reload();
    await page.getByRole('button',{name:'Resume journey',exact:true}).click();
    assert.equal((await savedState(page)).party[0].name,'<img src=x onerror=alert(1)>');
    await ctx.close();
  }

  let pending=transition(createGame({profession:'dev',seed:21}),{type:'depart'}).state;
  pending.pendingEvent={id:'good_weather',token:99};
  pending.flags.nextToken=99;
  const {ctx:ec,page:ep}=await context(390,serializeGame(pending));
  await ep.getByRole('button',{name:'Resume journey',exact:true}).click();
  assert.ok(await ep.locator('#event-dialog').evaluate(dialog=>dialog.open));
  assert.ok(await ep.evaluate(()=>document.activeElement.closest('#event-dialog')!==null));
  await ep.keyboard.press('Escape');
  assert.ok(await ep.locator('#event-dialog').evaluate(dialog=>dialog.open));
  await verifyPage(ep,'pending-event-390');
  await ep.reload(); await ep.getByRole('button',{name:'Resume journey',exact:true}).click();
  assert.equal((await savedState(ep)).pendingEvent.token,99);
  await ep.locator('[data-event-choice]').click();
  assert.equal((await savedState(ep)).pendingEvent,null);
  assert.equal((await savedState(ep)).distance,pending.distance+20);
  await ec.close();

  const {ctx:cc,page:cp}=await context(430,'{"version":999}');
  await cp.locator('#notice').waitFor({state:'visible'});
  assert.equal(await cp.evaluate(key=>localStorage.getItem(key),key),'{"version":999}');
  assert.equal(await cp.getByRole('button',{name:'Resume journey',exact:true}).count(),0);
  results.push({name:'invalid-save-preserved'});
  await cc.close();

  const {ctx:sc,page:sp}=await context(430);
  await sp.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('full','QuotaExceededError');};});
  await sp.getByRole('button',{name:'Start a new journey',exact:true}).click();
  await sp.getByRole('button',{name:'Continue to the crew'}).click();
  await sp.getByRole('button',{name:'Pack the van',exact:true}).click();
  assert.match(await sp.locator('#notice').innerText(),/could not save/);
  await verifyPage(sp,'storage-unavailable-430');
  await sc.close();


  // Follow complete seeded journeys through visible controls. Only the starting
  // save fixes the seed; every purchase, stop, encounter, and mile is played.
  async function buyTo(page, item, target) {
    for (let count=0; count<30; count++) {
      const st=await savedState(page);
      const missing=Math.ceil(target-st.inventory[item]);
      if(missing<=0) return;
      const quantity=missing>=10?10:missing>=5?5:1;
      await page.locator(`[data-shop-quantity="${item}"]`).selectOption(String(quantity));
      const buy=page.locator(`[data-buy="${item}"]`);
      if(await buy.isDisabled()) return;
      await buy.click();
    }
    throw new Error(`Too many purchases: ${item}`);
  }
  for(const prudent of [true,false]) {
    const routeName=prudent?'winning-route':'losing-route';
    const {ctx,page}=await context(prudent?1440:390,serializeGame(createGame({profession:'dev',seed:21})));
    await page.getByRole('button',{name:'Resume journey',exact:true}).click();
    if(prudent) { await buyTo(page,'fuel',27); await buyTo(page,'food',55); await buyTo(page,'parts',2); }
    await page.locator('.primary-action button').click();
    const visited=new Set();
    for(let turn=0;turn<120;turn++) {
      const st=await savedState(page);
      if(st.outcome) break;
      if(st.pendingEvent) {
        const id=st.pendingEvent.id;
        let choice=page.locator('[data-event-choice]').first();
        if(id==='nft_auction') choice=page.locator(`[data-event-choice="${st.inventory.nft?'invest':'wait'}"]`);
        if(id==='van_breakdown') choice=page.locator(`[data-event-choice="${st.inventory.parts>=1?'repair':'kick'}"]`);
        await choice.click(); continue;
      }
      if(st.phase==='location') {
        if(prudent && !visited.has(st.locationId) && await page.locator('[data-action="openShop"]').count()) {
          visited.add(st.locationId);
          await page.locator('[data-action="openShop"]').click();
          await buyTo(page,'fuel',35); await buyTo(page,'food',35); await buyTo(page,'parts',2);
          await page.locator('.primary-action button').click();
          assert.equal((await savedState(page)).locationId,st.locationId);
          assert.equal((await savedState(page)).phase,'location');
          continue;
        }
        if(await page.locator('[data-action="talk"]').count()) { await page.locator('[data-action="talk"]').click();continue; }
        await page.locator('.primary-action button').click(); continue;
      }
      if(st.inventory.fuel<4 && st.inventory.fuel>=2 && st.pace!=='slow') {
        await page.getByLabel('Driving pace',{exact:true}).selectOption('slow');continue;
      }
      await page.locator('.primary-action button').click();
    }
    const final=await savedState(page);
    assert.equal(final.outcome,prudent?'won':'lost',`${routeName}: ${JSON.stringify(final)}`);
    await verifyPage(page,routeName);
    results.push({name:routeName,seed:21,distance:final.distance,day:final.day,outcome:final.outcome,survivors:final.party.filter(p=>p.health>0).length});
    await page.reload(); await page.getByRole('button',{name:'View saved ending',exact:true}).click();
    assert.equal((await savedState(page)).outcome,final.outcome);
    await page.locator('.primary-action button').click();
    await page.locator('[data-confirm="replace"]').click();
    await page.getByRole('button',{name:'Continue to the crew'}).click();
    await page.getByRole('button',{name:'Pack the van',exact:true}).click();
    const fresh=await savedState(page);
    assert.equal(fresh.distance,0);assert.equal(fresh.day,1);assert.equal(fresh.outcome,null);
    assert.ok(fresh.party.every(p=>p.health===100));
    await ctx.close();
  }

  assert.deepEqual(errors,[],'Browser errors');
  await writeFile(join(output,'report.json'),JSON.stringify({passed:true,checks:results,errors},null,2));
  console.log(`Browser checks passed: ${results.length}; widths 390/414/430/768/1440; event reload/focus, invalid save, and blocked storage.`);
} finally { await browser.close(); }
