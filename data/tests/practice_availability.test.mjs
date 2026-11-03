import test from 'node:test';
import assert from 'node:assert/strict';
import {legacyPracticeVisible} from '../practice_availability.js';
import {contentHash} from '../content_evidence.js';

const legacy=()=>({id:'legacy-existing',subject:'economics',body:'Which is a stock?',options:['Wealth','Income','Saving','Investment'],correct_answer:'A',status:'live'});
test('existing unscreened live and verified active library rows preserve their reading contract',()=>{
 assert.equal(legacyPracticeVisible(legacy()),true);
 assert.equal(legacyPracticeVisible({...legacy(),status:'draft',verification_state:'verified',exploration_state:'active'}),true);
 assert.equal(legacyPracticeVisible({...legacy(),status:'draft'}),false);
});
test('existing holds and modern factory provenance cannot use legacy compatibility',()=>{
 for(const change of [{is_deleted:true},{verification_state:'disputed'},{status:'quarantined'},{status:'rejected'},{status:'invalid'},{evidence:{}},{provenance:{kind:'original_practice'}}]){
  assert.equal(legacyPracticeVisible({...legacy(),...change}),false,JSON.stringify(change));
 }
});
test('screened legacy content remains withheld when a receipt fails or content changes',()=>{
 const row=legacy();row.legacy_screening={verdict:'no_issue_found',content_hash:contentHash(row),question_id:row.id,review_version:'subscription-screen-v1',reviewed_at:'2026-10-07T00:00:00Z',scope:'local_mechanical',local_findings:[]};
 assert.equal(legacyPracticeVisible(row),true);
 assert.equal(legacyPracticeVisible({...row,correct_answer:'B'}),false);
 assert.equal(legacyPracticeVisible({...row,legacy_screening:{...row.legacy_screening,verdict:'quarantined'}}),false);
 assert.equal(legacyPracticeVisible({...row,legacy_screening:{}}),false);
});
