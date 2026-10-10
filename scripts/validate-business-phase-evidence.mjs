import fs from 'node:fs';
import assert from 'node:assert/strict';
const text=fs.readFileSync('research/business-phase-evidence-workbook.csv','utf8').trim();
const rows=text.split(/\r?\n/).map(line=>[...line.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g)].map(x=>x[1].replaceAll('""','"')));
const head=rows.shift();
assert.equal(head.length,19,'Audit workbook requires 19 columns');
assert.equal(rows.length,12,'Four stocks × three years required');
const seen=new Set();
for(const row of rows){
 assert.equal(row.length,head.length,'Column mismatch for '+row[0]+' '+row[1]);
 assert.ok(['TJH','SEP','SVL','JSE'].includes(row[0]));
 assert.ok(['2023','2024','2025'].includes(row[1]));
 const key=row[0]+'-'+row[1];assert.ok(!seen.has(key),'Duplicate '+key);seen.add(key);
 const status=row[17];
 assert.ok(['PENDING','PARTIAL','VERIFIED'].includes(status),'Unsupported evidence status');
 if(status==='PARTIAL'){
   assert.ok(row[15].trim(),'Partial rows must include a source URL: '+key);
   for(const col of [3,6])assert.ok(row[col].trim(),'Partial rows must include OCF and FCF: '+key);
   const [ocf,ppe,intang,fcf]=[3,4,5,6].map(col=>row[col].trim()===''?null:Number(row[col]));
   assert.ok(Number.isFinite(ocf)&&Number.isFinite(fcf),'Partial OCF and FCF must be numeric: '+key);
   if(ppe!==null&&intang!==null){
     assert.ok(Number.isFinite(ppe)&&Number.isFinite(intang),'Invalid partial CapEx: '+key);
     assert.ok(Math.abs(ocf-ppe-intang-fcf)<0.011,'Partial issuer FCF arithmetic mismatch: '+key);
   }
 }
 if(status==='VERIFIED'){
   for(const col of [3,6,15,16,18])assert.ok(row[col].trim(),'Verified rows require OCF, FCF, issuer URL, page and reviewer: '+key);
   const ocf=Number(row[3]),fcf=Number(row[6]),ppe=Number(row[4]||0),intang=Number(row[5]||0);
   assert.ok([ocf,fcf,ppe,intang].every(Number.isFinite),'Invalid numeric audit field: '+key);
   assert.ok(Math.abs(ocf-ppe-intang-fcf)<0.011,'FCF mismatch: '+key);
 }
}
console.log('PASS: 12 auditable stock-year rows; partial rows have source and OCF/FCF; verified evidence requires audited amounts, arithmetic, issuer citation and reviewer');
