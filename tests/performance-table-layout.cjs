const {chromium}=require('playwright');
const path=require('path');
(async()=>{
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:900},serviceWorkers:'block'});
 await page.goto('file://'+path.resolve(__dirname,'../index.html'),{waitUntil:'load'});
 await page.locator('#stockTableBody tr .ticker').first().waitFor({timeout:20000});
 const result=await page.evaluate(()=>{
 const shell=document.getElementById('tableView'),head=[...shell.querySelectorAll('thead th')],rows=[...shell.querySelectorAll('tbody tr')].filter(r=>r.querySelector('.ticker'));
 const count=head.length;const tolerance=2;
 const invalid=rows.slice(0,5).flatMap((row,i)=>{const cells=[...row.children];return cells.length!==count?[{row:i,headers:count,cells:cells.length}]:cells.flatMap((cell,j)=>Math.abs(cell.getBoundingClientRect().left-head[j].getBoundingClientRect().left)>tolerance?[{row:i,col:j,headerLeft:head[j].getBoundingClientRect().left,cellLeft:cell.getBoundingClientRect().left}]:[])});
 const violations=rows.slice(0,5).flatMap((row,i)=>{const td=row.children[16];if(!td)return [];const a=td.getBoundingClientRect();return [...td.querySelectorAll('small')].filter(e=>e.getBoundingClientRect().right>a.right+2).map(e=>({row:i,text:e.textContent.slice(0,50),right:e.getBoundingClientRect().right,cellRight:a.right}))});
 return{count,rows:rows.length,invalid,violations,scrollLeft:shell.scrollLeft,tableWidth:shell.querySelector('table').getBoundingClientRect().width,viewport:shell.clientWidth};
 });
 console.log(JSON.stringify(result,null,2));
 if(result.rows<1||result.count!==18||result.invalid.length||result.violations.length||result.scrollLeft!==0)throw Error('Performance table geometry regression');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
