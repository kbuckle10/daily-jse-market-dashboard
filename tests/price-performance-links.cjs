const { chromium, devices } = require('playwright');
(async () => {
 const browser = await chromium.launch({headless:true});
 const page = await browser.newPage({...devices['Pixel 7'], serviceWorkers:'block'});
 const url='https://kbuckle10.github.io/daily-jse-market-dashboard/';
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
 await page.locator('#cardView a.source-external').first().waitFor({timeout:30000});
 for(const source of ['jse','sa']){
   const link=page.locator('#cardView a.source-external.'+source).first();
   const href=await link.getAttribute('href');
   if(!href?.startsWith('https://'))throw new Error(source+' invalid href: '+href);
   const popupPromise=page.waitForEvent('popup',{timeout:12000});
   await link.click();
   const popup=await popupPromise;
   console.log(source+' new tab opened:',popup.url());
   await popup.close();
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
