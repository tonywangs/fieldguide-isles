import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { campaign } from './helpers.mjs';
import { SPECIES,NODES,STARTERS } from '../src/data.js';
import { SAVE_KEY,encode } from '../src/saves.js';

const started=performance.now();
const server=spawn(process.execPath,['scripts/serve.mjs'],{env:{...process.env,PORT:'0'},stdio:['ignore','pipe','pipe']});
let browser;
const metrics={node:process.version,playwright:JSON.parse(await readFile('node_modules/@playwright/test/package.json','utf8')).version,platform:process.platform,campaigns:[],checks:[],externalRequests:[],pageErrors:[],consoleErrors:[]};
const check = name => { metrics.checks.push(name);console.log(`PASS ${name}`); };
try {
  const base=await new Promise((resolve,reject)=>{let out='';const timer=setTimeout(()=>reject(new Error('Server startup timed out')),10000);server.stdout.on('data',d=>{out+=d;const match=out.match(/http:\/\/127\.0\.0\.1:\d+/);if(match){clearTimeout(timer);resolve(match[0]);}});server.on('error',reject);server.on('exit',code=>{if(code)reject(new Error(`Server exited ${code}`));});});
  metrics.serverReadyMs=Math.round((performance.now()-started)*100)/100;
  browser=await chromium.launch({headless:true});metrics.chromium=browser.version();
  async function context(options={}) {
    const ctx=await browser.newContext({viewport:{width:1280,height:900},...options});
    await ctx.route('**/*',route=>{
      if(new URL(route.request().url()).origin === base) return route.continue();
      metrics.externalRequests.push(route.request().url());return route.abort();
    });
    ctx.on('page',p=>{p.on('pageerror',e=>metrics.pageErrors.push(e.message));p.on('console',m=>{if(m.type()==='error')metrics.consoleErrors.push(m.text());});});
    return ctx;
  }
  const ctx=await context(), page=await ctx.newPage();
  const navStart=performance.now();await page.goto(base);await page.getByRole('button',{name:'Choose Spriglet',exact:true}).waitFor();
  metrics.firstInteractiveMs=Math.round((performance.now()-navStart)*100)/100;
  await mkdir('results',{recursive:true});
  await page.screenshot({path:'results/starter-desktop.png',fullPage:true});
  metrics.starterElements=await page.locator('*').count();
  const stateOf=p=>p.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE_KEY);
  const click=async(name,p=page)=>p.getByRole('button',{name,exact:true}).click();
  async function start(starter,seed,p=page) {
    await click('New journey',p);await p.getByLabel('Journey seed (1–4294967295)').fill(String(seed));await click('Begin new journey',p);await click(`Choose ${SPECIES[starter].name}`,p);
  }
  async function doAction(action,p=page) {
    switch(action.type) {
      case 'choose':return click(`Choose ${SPECIES[action.id].name}`,p);
      case 'move': {
        const regular=p.getByRole('button',{name:`Travel to ${NODES[action.to].name}`,exact:true});
        if(await regular.count()) return regular.click();
        return click(`Cross bridge to ${NODES[action.to].name}`,p);
      }
      case 'rest':return click('Rest at shelter',p);
      case 'encounter':return p.getByRole('button',{name:/^(Approach |Enter the final encounter)/}).click();
      case 'strike':return p.getByRole('button',{name:/^Strike ·/}).click();
      case 'burst':return p.getByRole('button',{name:/^Burst ·/}).click();
      case 'guard':return click('Guard · recover 2 energy',p);
      case 'befriend':return p.getByRole('button',{name:/^Befriend ·/}).click();
      default:throw new Error(`No UI adapter for ${action.type}`);
    }
  }
  // Exercise a modal, keyboard focus trap, visible focus and a starter without mouse input.
  await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Skip to your journey');
  await page.keyboard.press('Tab');await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'help-open');
  const focusStyle=await page.evaluate(()=>getComputedStyle(document.activeElement).outlineStyle);assert.equal(focusStyle,'solid');
  await page.keyboard.press('Enter');assert.equal(await page.locator('#help').evaluate(e=>e.open),true);
  await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement === document.body || document.activeElement.closest('dialog')?.id === 'help'),true);
  await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'help-close');
  await page.keyboard.press('Escape');assert.equal(await page.locator('#help').evaluate(e=>e.open),false);
  await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Choose Spriglet');await page.keyboard.press('Enter');
  await page.getByRole('button',{name:'Travel to Clover patch',exact:true}).focus();await page.keyboard.press('Enter');assert.equal((await stateOf(page)).location,'clover');
  check('keyboard navigation, visible focus, modal and map activation');

  for(const [index,starter] of STARTERS.entries()) {
    const seed=[1,42,100][index], expected=campaign(starter,seed);
    if(index===2) await page.setViewportSize({width:360,height:800});
    await start(starter,seed);
    if(index===0) await page.screenshot({path:'results/exploration-desktop.png',fullPage:true});
    let steps=0;
    for(const action of expected.actions.slice(1)) {
      await doAction(action);steps++;
      if(action.type==='encounter' && steps<5) {
        metrics.battleElements=await page.locator('*').count();
        await page.screenshot({path:`results/battle-${index===2?'mobile':starter}.png`,fullPage:true});
        const before=await stateOf(page);await page.reload();await page.getByRole('heading',{name:`Round ${before.battle.round}`,exact:true}).waitFor();assert.deepEqual(await stateOf(page),before);
      }
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No horizontal overflow');
    }
    assert.equal(await page.getByRole('heading',{name:'A light to find each other.',exact:true}).count(),1);
    const actual=await stateOf(page);assert.deepEqual(actual,expected.state);
    metrics.campaigns.push({starter,seed,interfaceActions:steps+1,finalHash:createHash('sha256').update(JSON.stringify(actual)).digest('hex'),viewport:page.viewportSize()});
    check(`complete campaign via interface: ${starter}, seed ${seed}`);
  }
  await page.screenshot({path:'results/ending-mobile.png',fullPage:true});
  metrics.endingElements=await page.locator('*').count();

  // Export through the actual download button, transfer into a clean browser context.
  const downloadEvent=page.waitForEvent('download');await click('Export save');const download=await downloadEvent;
  const exported=await readFile(await download.path(),'utf8');const ending=await stateOf(page);
  const ctx2=await context({viewport:{width:390,height:844}}),p2=await ctx2.newPage();await p2.goto(base);
  const upload=async(raw,p=p2)=>p.locator('#import').setInputFiles({name:'journey.json',mimeType:'application/json',buffer:Buffer.from(raw)});
  await upload(exported);await p2.getByRole('heading',{name:'A light to find each other.',exact:true}).waitFor();assert.deepEqual(await stateOf(p2),ending);
  check('JSON download and transfer into a separate browser context');
  for(const raw of ['{','x'.repeat(32769),JSON.stringify({...ending,version:99}),JSON.stringify({...ending,party:['bogus']})]) {
    await upload(raw);await p2.locator('#transfer-status').filter({hasText:/not changed|Unsupported/}).waitFor();assert.deepEqual(await stateOf(p2),ending);
  }
  check('malformed, oversized, unsupported and inconsistent file imports preserve progress');

  await start('spriglet',7,p2);await doAction({type:'move',to:'clover'},p2);await doAction({type:'encounter'},p2);await doAction({type:'strike'},p2);
  const mid=await stateOf(p2);mid.journal.push('<img src=x onerror="window.pwned=1"><script>window.pwned=1</script>');
  await upload(encode(mid));await p2.getByText(mid.journal.at(-1),{exact:true}).waitFor();assert.equal(await p2.evaluate(()=>window.pwned),undefined);assert.equal(await p2.locator('.journal img, .journal script').count(),0);
  // Save transfer includes active battle/RNG, then play the same legal suffix in both contexts.
  await upload(encode(mid),page);await page.getByRole('heading',{name:'Round 2',exact:true}).waitFor();
  await doAction({type:'strike'},page);await doAction({type:'strike'},p2);assert.deepEqual(await stateOf(page),await stateOf(p2));
  await doAction({type:'befriend'},page);await doAction({type:'befriend'},p2);assert.deepEqual(await stateOf(page),await stateOf(p2));
  check('hostile imported text is inert; active battle save transfer continues deterministically');

  await start('pebblefin',4,p2);await doAction({type:'move',to:'clover'},p2);await doAction({type:'encounter'},p2);
  let guardCount=0;
  while((await stateOf(p2)).phase==='battle' && guardCount++<100) await doAction({type:'guard'},p2);
  const recovered=await stateOf(p2);assert.equal(recovered.defeats,1);assert.equal(recovered.location,'quay');assert.equal(recovered.roster[0].hp,52);
  await doAction({type:'move',to:'clover'},p2);await doAction({type:'encounter'},p2);await doAction({type:'strike'},p2);await doAction({type:'strike'},p2);await doAction({type:'befriend'},p2);assert.equal((await stateOf(p2)).party.length,2);
  check('defeat recovery and successful recruitment retry through interface');

  // Fill the party and recruit a fourth friend, then use the reserve and switch controls.
  async function win(p) {
    let limit=40;
    while((await stateOf(p)).phase==='battle' && limit-->0) {
      const current=await stateOf(p), active=current.roster.find(c=>c.id===current.active);
      await doAction({type:active.energy>=2?'burst':'strike'},p);
    }
    assert.ok(limit>0);assert.equal((await stateOf(p)).phase,'explore');
  }
  for(const to of ['quay']) await doAction({type:'move',to},p2);
  await doAction({type:'rest'},p2);
  for(const to of ['clover','grove']) await doAction({type:'move',to},p2);
  await doAction({type:'encounter'},p2);await win(p2);
  await doAction({type:'move',to:'hearth'},p2);await doAction({type:'rest'},p2);
  await doAction({type:'move',to:'kiln'},p2);await doAction({type:'encounter'},p2);
  await doAction({type:'strike'},p2);await doAction({type:'strike'},p2);await doAction({type:'befriend'},p2);
  await doAction({type:'move',to:'hearth'},p2);await doAction({type:'rest'},p2);
  await doAction({type:'move',to:'lantern'},p2);await doAction({type:'encounter'},p2);
  await doAction({type:'strike'},p2);await doAction({type:'strike'},p2);await doAction({type:'befriend'},p2);
  assert.equal((await stateOf(p2)).roster.length,4);assert.equal((await stateOf(p2)).party.length,3);
  await p2.getByLabel('Companion to replace with Cindermoth').selectOption('pebblefin');await click('Bring Cindermoth',p2);
  assert.equal((await stateOf(p2)).active,'cindermoth');await doAction({type:'encounter'},p2);
  await click('Switch to Fernwhorl',p2);assert.equal((await stateOf(p2)).active,'fernwhorl');await click('Retreat safely',p2);
  await click('Lead with Kilnkit',p2);assert.equal((await stateOf(p2)).active,'kilnkit');
  check('full party recruitment, reserve exchange, battle switch, retreat and leader controls');

  // Block storage APIs before app startup. Export must still work.
  const ctx3=await context();await ctx3.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Unavailable','SecurityError');}});});
  const p3=await ctx3.newPage();await p3.goto(base);assert.match(await p3.locator('#storage-status').textContent(),/Device saving unavailable/);await click('Choose Spriglet',p3);
  assert.match(await p3.locator('#storage-status').textContent(),/Device saving unavailable/);
  const manualDownload=p3.waitForEvent('download');await click('Export save',p3);assert.ok(JSON.parse(await readFile(await (await manualDownload).path(),'utf8')).party.includes('spriglet'));
  check('unavailable storage is reported and export still works');
  const ctx4=await context();await ctx4.addInitScript(key=>{if(location.protocol==='http:')localStorage.setItem(key,'corrupt data');},SAVE_KEY);const p4=await ctx4.newPage();await p4.goto(base);await click('Choose Spriglet',p4);
  assert.equal(await p4.evaluate(key=>localStorage.getItem(key),SAVE_KEY),'corrupt data');assert.match(await p4.locator('#storage-status').textContent(),/left untouched/);
  check('invalid stored data is preserved until an explicit new journey or import');
  for(const p of [page,p2,p3,p4]) {
    for(const control of await p.locator('button,input,select').all()) {
      const named=await control.evaluate(e=>!!(e.textContent.trim()||e.getAttribute('aria-label')||(e.labels && e.labels.length)));
      assert.ok(named,'Every HTML control has a text label');
    }
  }
  assert.deepEqual(metrics.externalRequests,[]);assert.deepEqual(metrics.pageErrors,[]);assert.deepEqual(metrics.consoleErrors,[]);
  check('labeled HTML controls; no external requests, page errors or console errors');
  // Runtime files and basic server security are exercised over HTTP.
  for(const url of ['/package.json','/.git/config','/src/../package.json','/%2e%2e/package.json']) assert.equal((await fetch(base+url)).status,404);
  assert.equal((await fetch(base,{method:'POST'})).status,405);
  check('offline server only exposes runtime allowlist');
  metrics.elapsedMs=Math.round(performance.now()-started);
  await writeFile('results/browser.json',JSON.stringify(metrics,null,2)+'\n');console.log(JSON.stringify(metrics,null,2));
} finally {if(browser)await browser.close();server.kill();}
