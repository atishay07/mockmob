// Website oracle for the Dart DU port: runs the site's own src/lib/du code on public/du/2026.
// Regenerate from the repository root (mockmob-next):
//   node flutter_app/test/unit/tools/fixtures/du_oracle_2026.mjs "file:///<absolute repo path, spaces as %20>" > flutter_app/test/unit/tools/fixtures/du_oracle_2026.json
import fs from 'node:fs';
const base = process.argv[2];
const { evaluateAll, suggestUnlocks, explainCombinations, seatStatus } = await import(base + '/src/lib/du/eligibility.js');
const { planCombos } = await import(base + '/src/lib/du/combos.js');
const index = JSON.parse(fs.readFileSync('./public/du/2026/index.json', 'utf8'));
const sel = (l, d, gat=false) => ({ languages: l, domains: d, gat });
const cases = {
  commerce: sel(['english'], ['accountancy','business_studies','economics']),
  commerceMaths: sel(['english'], ['accountancy','business_studies','economics','mathematics'], true),
  pcm: sel(['english'], ['physics','chemistry','mathematics']),
  noAcc: sel(['english'], ['business_studies','economics']),
  humanities: sel(['english','hindi'], ['history','political_science','economics']),
};
const out = {};
for (const [k, s] of Object.entries(cases)) {
  const r = evaluateAll(index.groups, s);
  out[k] = { eligible: r.filter(x => x.eligible).map(x => x.group.id).sort(), unlocks: suggestUnlocks(index.groups, s, index, 4).map(u => [u.id, u.unlocks]) };
}
const bcom = index.groups.find(g => g.name === 'B.Com. (Hons.)');
out.bcomNoAcc = explainCombinations(bcom, cases.noAcc, index).map(r => [r.label, r.ok, r.missing]);
const eco = index.groups.find(g => g.name === 'B.A. (Hons.) Economics');
const pool = [{kind:'language',id:'english'},{kind:'domain',id:'accountancy'},{kind:'domain',id:'business_studies'},{kind:'domain',id:'economics'},{kind:'domain',id:'mathematics'},{kind:'gat',id:'gat'}];
const plan = planCombos({ groups: index.groups, pool, targets: [bcom.id, eco.id], maxPapers: 5 });
out.combo = { ranked: plan.ranked.map(r => [r.items.map(i => i.kind+':'+i.id), r.unlocked, r.met.length, r.missed.map(m=>m.id)]), keep: plan.keep.map(i=>i.kind+':'+i.id) };
const plan3 = planCombos({ groups: index.groups, pool, targets: [bcom.id, eco.id], maxPapers: 3 });
out.combo3 = { ranked: plan3.ranked.map(r => [r.items.map(i => i.kind+':'+i.id), r.unlocked, r.met.length, r.missed.map(m=>[m.id, m.nearest && m.nearest.gaps.map(g=>g.kind+':'+(g.id||g.count))])]), keep: plan3.keep.map(i=>i.kind+':'+i.id) };
const off = JSON.parse(fs.readFileSync('./public/du/2026/offerings/' + bcom.id + '.json', 'utf8'));
out.bcomSeats650 = off.rows.map(r => [r[0], seatStatus(650, r, 0).id]);
out.bcomSeats650OBC = off.rows.map(r => [r[0], seatStatus(650, r, 1).id]);
console.log(JSON.stringify(out));
