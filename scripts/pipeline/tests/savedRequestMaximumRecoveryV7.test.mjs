import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { applySavedRequestMaximumRecovery, buildSavedRequestMaximumProof, planSavedRequestMaximumRecovery } from '../lib/savedRequestMaximumRecoveryV7.mjs';

function fixture() {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE requests(id TEXT PRIMARY KEY,model TEXT,reserved INTEGER,actual INTEGER,state TEXT,owner_pid INTEGER,receipt_json TEXT);
    CREATE TABLE provider_requests(id TEXT PRIMARY KEY,reservation_id TEXT,provider TEXT,state TEXT,request_json TEXT,response_json TEXT);
    CREATE TABLE provider_batches(id TEXT PRIMARY KEY,provider TEXT,provider_id TEXT,reservation_id TEXT,state TEXT,request_json TEXT,response_json TEXT);
    CREATE TABLE conservative_holds(reservation_id TEXT PRIMARY KEY,maximum_micro INTEGER,proof_json TEXT);
    CREATE TABLE budget(id INTEGER PRIMARY KEY,limit_micro INTEGER); INSERT INTO budget VALUES(1,50000000);`);
  return db;
}
function savedRow({ provider, model, reserved, output, inputRate, outputRate, cacheWrite = null, key, id, response = null, ownerPid = 35812 }) {
  const host = provider === 'openai' ? 'api.openai.com' : 'generativelanguage.googleapis.com';
  const price = { provider_host: host, max_input_tokens: 33024, input_per_million: inputRate, output_per_million: outputRate };
  if (cacheWrite !== null) price.cache_write_per_million = cacheWrite;
  const body = provider === 'openai'
    ? { model, max_output_tokens: output, input: [{ role: 'user', content: 'bounded fixture' }] }
    : { generationConfig: { maxOutputTokens: output }, contents: [{ parts: [{ text: 'bounded fixture' }] }] };
  const config = { provider, model, execution_mode: 'realtime', key, reserved, toolCalls: 0, rates: { ...price }, pricing: { source_url: 'https://developers.openai.com/api/docs/pricing', models: { [model]: price } } };
  return {
    request: { id, model, reserved, actual: null, state: 'reserved', owner_pid: ownerPid, receipt_json: null },
    native: { id: key, reservation_id: id, provider, state: 'dispatching', request_json: JSON.stringify({ body, config }), response_json: response },
    table: 'provider_requests'
  };
}
function insert(db, row) {
  db.prepare('INSERT INTO requests VALUES(?,?,?,?,?,?,?)').run(row.request.id,row.request.model,row.request.reserved,row.request.actual,row.request.state,row.request.owner_pid,row.request.receipt_json);
  db.prepare('INSERT INTO provider_requests VALUES(?,?,?,?,?,?)').run(row.native.id,row.native.reservation_id,row.native.provider,row.native.state,row.native.request_json,row.native.response_json);
}
const dead = pid => pid !== 35812;

test('saved OpenAI and Gemini native contracts prove their exact unresolved maximum and no usage', () => {
  const openai = savedRow({ provider:'openai',model:'gpt-6-luna',reserved:11628,output:15000,inputRate:.1,outputRate:.5,cacheWrite:.125,key:'key-openai',id:'reservation-openai' });
  const gemini = savedRow({ provider:'gemini',model:'gemini-3.8-flash',reserved:41643,output:4500,inputRate:.75,outputRate:3.75,key:'key-gemini',id:'reservation-gemini' });
  const a = buildSavedRequestMaximumProof({ request:openai.request,native:openai.native,nativeTable:openai.table,expectedOwnerPid:35812,isPidAlive:dead });
  const b = buildSavedRequestMaximumProof({ request:gemini.request,native:gemini.native,nativeTable:gemini.table,expectedOwnerPid:35812,isPidAlive:dead });
  assert.equal(a.maximum_micro,11628);
  assert.equal(b.maximum_micro,41643);
  assert.equal(a.maximum_micro+b.maximum_micro,53271);
  assert.equal(a.proof.provider_request_id,'unconfirmed-client-key:key-openai');
  assert.equal(b.proof.provider_request_id,'unconfirmed-client-key:key-gemini');
  assert.equal(a.proof.basis.includes('Usage is unknown'),true);
  assert.equal(JSON.stringify(a.proof).includes('bounded fixture'),false);
});

test('atomic proof-only application preserves all other holds and never changes request, response, or actual rows', () => {
  const db=fixture();
  const openai=savedRow({provider:'openai',model:'gpt-6-luna',reserved:11628,output:15000,inputRate:.1,outputRate:.5,cacheWrite:.125,key:'key-openai',id:'reservation-openai'});
  const gemini=savedRow({provider:'gemini',model:'gemini-3.8-flash',reserved:41643,output:4500,inputRate:.75,outputRate:3.75,key:'key-gemini',id:'reservation-gemini'});
  insert(db,openai);insert(db,gemini);
  db.prepare('INSERT INTO requests VALUES(?,?,?,?,?,?,?)').run('settled-existing','gpt-6-luna',900,300,'settled',7,JSON.stringify({receipt:'kept'}));
  db.prepare('INSERT INTO conservative_holds VALUES(?,?,?)').run('settled-existing',700,JSON.stringify({historic:true}));
  const beforeRequests=db.prepare('SELECT * FROM requests ORDER BY id').all();
  const beforeNative=db.prepare('SELECT * FROM provider_requests ORDER BY id').all();
  const beforeHold=db.prepare('SELECT * FROM conservative_holds').get();
  try {
    const plan=planSavedRequestMaximumRecovery(db,{reservationIds:['reservation-openai','reservation-gemini'],expectedOwnerPid:35812,isPidAlive:dead});
    const applied=applySavedRequestMaximumRecovery(db,plan,{isPidAlive:dead});
    assert.equal(applied.recovered.reduce((n,r)=>n+r.maximum_micro,0),53271);
    assert.equal(applied.preserved_existing_holds,1);
    assert.deepEqual(db.prepare('SELECT * FROM requests ORDER BY id').all(),beforeRequests);
    assert.deepEqual(db.prepare('SELECT * FROM provider_requests ORDER BY id').all(),beforeNative);
    assert.deepEqual(db.prepare('SELECT * FROM conservative_holds WHERE reservation_id=?').get('settled-existing'),beforeHold);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM conservative_holds').get().n,3);
    assert.equal(db.prepare('SELECT limit_micro FROM budget WHERE id=1').get().limit_micro,50000000);
    assert.throws(()=>planSavedRequestMaximumRecovery(db,{reservationIds:['reservation-openai'],expectedOwnerPid:35812,isPidAlive:dead}),/saved_request_hold_already_exists/);
  } finally { db.close(); }
});

test('live owners, mismatched price/config bounds, preexisting usage, and ambiguous native rows fail closed', () => {
  const good=savedRow({provider:'openai',model:'gpt-6-luna',reserved:11628,output:15000,inputRate:.1,outputRate:.5,cacheWrite:.125,key:'key-a',id:'r-a'});
  assert.throws(()=>buildSavedRequestMaximumProof({request:good.request,native:good.native,nativeTable:good.table,expectedOwnerPid:35812,isPidAlive:()=>true}),/owner_not_proven_dead/);
  const wrongReservation=structuredClone(good);wrongReservation.native.request_json=wrongReservation.native.request_json.replace('11628','11627');
  assert.throws(()=>buildSavedRequestMaximumProof({request:wrongReservation.request,native:wrongReservation.native,nativeTable:wrongReservation.table,expectedOwnerPid:35812,isPidAlive:dead}),/identity_or_config_mismatch|maximum_does_not_match/);
  const changedRate=structuredClone(good);const config=JSON.parse(changedRate.native.request_json);config.config.rates.output_per_million=.49;changedRate.native.request_json=JSON.stringify(config);
  assert.throws(()=>buildSavedRequestMaximumProof({request:changedRate.request,native:changedRate.native,nativeTable:changedRate.table,expectedOwnerPid:35812,isPidAlive:dead}),/bound_rates_unproven/);
  const withReceipt=structuredClone(good);withReceipt.native.response_json='{}';
  assert.throws(()=>buildSavedRequestMaximumProof({request:withReceipt.request,native:withReceipt.native,nativeTable:withReceipt.table,expectedOwnerPid:35812,isPidAlive:dead}),/receipt_or_state_mismatch/);
  const db=fixture();insert(db,good);db.prepare('INSERT INTO provider_requests VALUES(?,?,?,?,?,?)').run('duplicate','r-a','openai','dispatching',good.native.request_json,null);
  assert.throws(()=>planSavedRequestMaximumRecovery(db,{reservationIds:['r-a'],expectedOwnerPid:35812,isPidAlive:dead}),/native_row_not_unique/);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM conservative_holds').get().n,0);db.close();
});

test('apply re-proves the exact native body/config and rejects forged plans atomically', () => {
  const makeDb=()=>{
    const db=fixture();
    const row=savedRow({provider:'openai',model:'gpt-6-luna',reserved:11628,output:15000,inputRate:.1,outputRate:.5,cacheWrite:.125,key:'key-a',id:'r-a'});
    insert(db,row);
    return db;
  };
  {
    const db=makeDb();
    try {
      const plan=planSavedRequestMaximumRecovery(db,{reservationIds:['r-a'],expectedOwnerPid:35812,isPidAlive:dead});
      const saved=db.prepare('SELECT request_json FROM provider_requests WHERE reservation_id=?').get('r-a').request_json;
      db.prepare('UPDATE provider_requests SET request_json=? WHERE reservation_id=?').run(saved.replace('bounded fixture','changed body'), 'r-a');
      assert.throws(()=>applySavedRequestMaximumRecovery(db,plan,{isPidAlive:dead}),/native_contract_changed_after_proof/);
      assert.equal(db.prepare('SELECT COUNT(*) n FROM conservative_holds').get().n,0);
      assert.equal(db.prepare('SELECT state FROM requests WHERE id=?').get('r-a').state,'reserved');
    } finally { db.close(); }
  }
  {
    const db=makeDb();
    try {
      const plan=planSavedRequestMaximumRecovery(db,{reservationIds:['r-a'],expectedOwnerPid:35812,isPidAlive:dead});
      plan.plans[0].proof.provider_request_id='provider-id-invented';
      assert.throws(()=>applySavedRequestMaximumRecovery(db,plan,{isPidAlive:dead}),/plan_proof_mismatch|native_contract_changed_after_proof/);
      assert.equal(db.prepare('SELECT COUNT(*) n FROM conservative_holds').get().n,0);
      assert.equal(db.prepare('SELECT actual FROM requests WHERE id=?').get('r-a').actual,null);
    } finally { db.close(); }
  }
});
