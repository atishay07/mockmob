import { readFileSync,writeFileSync } from 'node:fs';
import { validateCalibrationManifest } from '../lib/factoryCalibration.mjs';

// Explicit defects injected into authenticated held-out baselines. These are
// negative evaluation fixtures, never authored inventory or publication proof.
const path='data/question-factory-runtime/calibration-fixtures.json',manifest=JSON.parse(readFileSync(path)),registry=JSON.parse(readFileSync('data/question-factory-runtime/source-registry-calibration-draft.json'));
manifest.held_out=manifest.held_out.filter(f=>f.valid);
const conceptual=manifest.held_out.find(f=>f.question.subject==='english' && f.provenance.anchor_id.endsWith('q45'));
const numerical=manifest.held_out.find(f=>f.question.route==='numerical');
const passage=manifest.held_out.find(f=>f.question.route==='passage');
if(!conceptual || !numerical || !passage)throw new Error('three_authentic_held_out_routes_required');
const add=(base,category,edit,note,suffix='')=>{
  const fixture=structuredClone(base);fixture.id=`fault-${category}${suffix}`;fixture.question.id=fixture.id;fixture.valid=false;fixture.category=category;
  fixture.question.provenance.kind='original_practice';fixture.question.provenance.adaptation_type=null;
  edit(fixture.question);fixture.injection={controlled_negative_fixture:true,baseline_anchor:base.provenance.anchor_id,reason:note};manifest.held_out.push(fixture);
};
for(const base of [conceptual,numerical,passage])add(base,'wrong_key',q=>{q.correct_answer='ABCD'[('ABCD'.indexOf(q.correct_answer)+1)%4];},'Proposed key intentionally differs from unchanged officially keyed content.',`-${base.question.route}`);
add(conceptual,'multiple_correct',q=>{q.options[0]=`${q.options[1]}.`;},'Two distinct option strings supply the same grammatically correct pair; punctuation does not remove ambiguity.');
add(numerical,'missing_assumptions',q=>{q.body='A company forfeited equity shares and reissued them at a discount as fully paid-up. What amount is transferred to capital reserve?';},'Share count, face value, amount paid and reissue price are missing; source examples cannot supply candidate facts.');
add(conceptual,'out_of_syllabus',q=>{q.body='Which particle mediates the strong interaction in quantum chromodynamics?';q.options=['Gluon','Photon','Graviton','W boson'];q.correct_answer='A';q.explanation='Gluons mediate the strong interaction.';},'Physics content is outside the English syllabus despite retaining a valid chapter identifier.');
add(conceptual,'false_citation',q=>{q.source_refs[0].support_hash='invented-source-hash';},'A reference receipt deliberately fails its actual source-content hash.');
add(conceptual,'unsupported_explanation',q=>{q.explanation='Option B is correct because a new English grammar rule requires every conditional sentence to use the future perfect tense.';},'The explanation asserts a false unsupported rule rather than the retrieved third-conditional rule.');
add(passage,'orphan_passage',q=>{q.passage_text='';},'The passage question is detached from its required stimulus.');
add(conceptual,'cosmetic_duplicate',q=>{q.provenance.kind='pyq_adapted';q.provenance.adaptation_type='option_reshuffle';const old=q.options.slice();q.options=[old[3],...old.slice(0,3)];q.correct_answer='ABCD'[('ABCD'.indexOf(q.correct_answer)+1)%4];},'An option reshuffle of the authenticated anchor is not new inventory.');
add(conceptual,'option_collision',q=>{q.options[0]=q.options[1];},'Two option strings are exactly identical.');
add(numerical,'solver_boundary',q=>{q.body=q.body.replace('₹ 45 per share','₹ 5 per share');},'Reissue discount exceeds the amount forfeited per share, producing an inadmissible fully paid-up reissue and no valid capital-reserve answer.');
validateCalibrationManifest(manifest,registry);
manifest.limitations=manifest.limitations.filter(s=>!s.includes('must be added'));
manifest.limitations.push('Faults are labelled mutations of authentic baselines; quarantine can result from local or academic gates. They are not an independent real-paper accuracy sample.');
writeFileSync(path,JSON.stringify(manifest,null,2));console.log(JSON.stringify({development:manifest.development.length,held_out_valid:manifest.held_out.filter(f=>f.valid).length,known_bad:manifest.held_out.filter(f=>!f.valid).length,categories:[...new Set(manifest.held_out.map(f=>f.category))],academic_release:false}));
