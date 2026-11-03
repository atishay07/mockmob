import { readFileSync,writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { canonicalStudyJSON } from '../../data/study_content.js';
const content=JSON.parse(readFileSync('data/study/pilot.json','utf8'));
const registry=JSON.parse(readFileSync('data/study/sources/registry.json','utf8'));
const unit=content.units.find(u=>u.conceptId==='sacrificing_gaining');
const cards=content.cards.filter(c=>c.unitId===unit.id);
const digest=x=>createHash('sha256').update(canonicalStudyJSON(x)).digest('hex');
const source=registry.sources;
assert.equal(source['ncert-admission'].formulaExcerpt,'Old Share of Profit – New Share of Profit');
assert.equal(source['ncert-retirement'].formulaExcerpt,'new profit share minus old profit share');
assert.equal(source['ncert-retirement'].sha256,createHash('sha256').update(readFileSync('data/study/sources/ncert-retirement.pdf')).digest('hex'));
assert.equal(unit.blocks[0].body,'For each partner, sacrifice = old share − new share. Gain = new share − old share. Use a common denominator before subtracting. A positive sacrifice means the share fell; a negative sacrifice means it rose.');
assert.equal(unit.blocks[2].body,'The old ratio describes the starting shares. The new ratio describes the final shares. Neither automatically describes the change. When a new ratio is given, compare the shares. Use the old ratio as the sacrificing ratio when the incoming share is taken in that ratio.');
// Independent exact arithmetic: cross-products, rather than the prose author's decimal steps.
const gcd=(a,b)=>b?gcd(b,a%b):a;
const subtract=([a,b],[c,d])=>{const n=a*d-c*b,den=b*d,g=gcd(Math.abs(n),den);return [n/g,den/g];};
assert.deepEqual(subtract([3,5],[5,10]),[1,10]);
assert.deepEqual(subtract([2,5],[3,10]),[1,10]);
assert.deepEqual(subtract([3,5],[1,2]),[1,10]);
assert.equal(unit.blocks[1].body,'A and B used to share 3:2. C joins, and the new ratio A:B:C is 5:3:2. A: 3/5 − 5/10 = 1/10. B: 2/5 − 3/10 = 1/10. A and B sacrifice equally, so the sacrificing ratio is 1:1.');
assert.equal(unit.blocks[3].prompt,'A partner’s old share is 3/5 and new share is 1/2. What did the partner sacrifice?');
assert.equal(unit.blocks[3].explanation,'3/5 − 1/2 = 6/10 − 5/10 = 1/10. This is an unscored learning check.');
assert.equal(unit.blocks[3].options[unit.blocks[3].answer],'1/10');
assert.deepEqual(unit.blocks[1].rows,[['Partner','Old share','New share','Sacrifice'],['A','6/10','5/10','1/10'],['B','4/10','3/10','1/10']]);
assert.equal(cards[0].answer,'old share minus new share');
assert.equal(cards[1].answer,'new share minus old share');
assert.equal(cards[2].answer,'Each partner’s old share and new share');
for(const card of cards){
  assert.equal(card.explanation,'Use a common denominator and calculate the change for each continuing partner.');
  assert.equal(card.cue,'Sacrifice looks back: old minus new. Gain looks forward: new minus old.');
  assert.deepEqual(card.sourceRefs,unit.sourceRefs);
}
const report={at:new Date().toISOString(),scope:'Primary-source reconciliation and exact arithmetic for teaching only. Not independent academic calibration, exam fit, mastery or recovery certification.',unitId:unit.id,unitHash:digest(unit),cards:Object.fromEntries(cards.map(c=>[c.id,digest(c)])),sources:unit.sourceRefs.map(s=>registry.sources[s.id]),claimChecks:['sacrifice and gain directions','sign of share change','old/new/change ratio distinction','old-ratio condition','worked example table','unscored calculation key','three recall keys'],state:'passed',paidCalls:0};
writeFileSync('data/study/sources/ratio-validation.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({state:'passed',scope:report.scope,claimChecks:report.claimChecks.length}));
