import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({headless:true});
try {
  for (const viewport of [{width:1365,height:900},{width:390,height:844}]) {
    const page = await browser.newPage({viewport});
    const errors=[];
    page.on('pageerror', e=>errors.push(e.message));
    const home=await page.goto('http://127.0.0.1:8765/index.html',{waitUntil:'domcontentloaded'});
    assert.equal(home.status(),200,'homepage must load');
    assert.equal(await page.locator('#businessPhaseResearchPreview').count(),1,'homepage must expose research preview');
    assert.equal(await page.locator('#freshCapitalSection').count(),1,'Fresh Capital must remain intact');
    assert.equal(await page.locator('#businessPhaseResearchPreview a').getAttribute('href'),'business-phase-four-stock-pilot.html');
    await page.locator('#businessPhaseResearchPreview a').click();
    await page.waitForURL('**/business-phase-four-stock-pilot.html');
    await page.waitForFunction(()=>document.querySelectorAll('#cards .card').length===4,{timeout:15000});
    const body=await page.locator('body').innerText();
    for(const ticker of ['TJH','SEP','SVL','JSE']) assert.ok(body.includes(ticker),'Missing '+ticker);
    assert.ok(body.includes('Not classified'),'Phase status missing');
    assert.ok(body.includes('Return on invested capital'),'Friendly ROIC label missing');
    assert.ok(!body.includes('returnOnInvestedCapital'),'Raw metric key must not appear');
    assert.equal(await page.locator('#cards .card table').count(),4,'Four financial tables expected');
    assert.deepEqual(errors,[],'Browser JavaScript errors');
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2);
    assert.equal(overflow,false,'Page-wide horizontal overflow');
    console.log('PASS: '+viewport.width+'px homepage navigation, 4 research cards, tables, labels and browser errors');
    await page.close();
  }
} finally {await browser.close();}
