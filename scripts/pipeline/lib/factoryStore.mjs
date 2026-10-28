import { createHash, randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { resolve } from 'node:path';
import { assertNoLiveMeasurementLease, releaseCampaignMeasurementLease } from './campaignMeasurementLeaseVNext.mjs';

// Local ownership is process-specific, while the DB identity binds this host to
// its persistent ledger. Restarting safely preserves every provider request ID.
export class FactoryStore {
  constructor(ledger,path,{candidateIds=null}={}) {
    this.ledger=ledger;this.db=ledger.db;this.owner=`${process.pid}:${randomUUID()}`;
    this.candidateIds=candidateIds;
    ledger.db.prepare("INSERT OR IGNORE INTO ledger_metadata VALUES('ledger_identity',?)").run(randomUUID());
    const persistentId=ledger.db.prepare("SELECT value FROM ledger_metadata WHERE id='ledger_identity'").get().value;
    this.identity=createHash('sha256').update(`${hostname()}:${resolve(path)}:${persistentId}`).digest('hex');
    this.db.exec(`CREATE TABLE IF NOT EXISTS factory_worker(id INTEGER PRIMARY KEY CHECK(id=1),owner TEXT,expires INTEGER);
      CREATE TABLE IF NOT EXISTS factory_candidates(id TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS factory_inventory(fingerprint TEXT PRIMARY KEY,question_id TEXT NOT NULL);`);
  }
  claim() {
    return this.ledger.transaction(()=>{
      assertNoLiveMeasurementLease(this.ledger,this.candidateIds);
      const row=this.db.prepare('SELECT * FROM factory_worker WHERE id=1').get();
      if(row && row.owner!==this.owner) {
        const pid=Number(row.owner?.split(':')[0]);let alive=Number.isSafeInteger(pid)&&pid>0;
        if(alive)try { process.kill(pid,0); } catch(error) { alive=error.code==='EPERM'; }
        if(alive) throw new Error('factory_worker_already_running');
      }
      this.db.prepare('INSERT OR REPLACE INTO factory_worker VALUES(1,?,?)').run(this.owner,Date.now()+300000); return true;
    });
  }
  claimMeasurement(lease) {
    if(!lease?.owner||lease.owner_pid&&lease.owner_pid!==process.pid)throw new Error('measurement_lease_owner_mismatch');
    if(this.candidateIds&&JSON.stringify([...this.candidateIds].sort())!==JSON.stringify([...lease.candidateIds].sort()))throw new Error('measurement_lease_candidate_scope_mismatch');
    const row=this.db.prepare(`SELECT * FROM factory_measurement_leases_vnext WHERE campaign_id=? AND owner=? AND owner_pid=? AND state='active'`).get(lease.campaignId,lease.owner,process.pid);
    if(!row||JSON.stringify([...lease.candidateIds].sort())!==row.candidate_ids_json||lease.contractHash!==row.contract_hash)throw new Error('measurement_lease_owner_mismatch');
    this.measurementLease=lease;
    return this.refreshMeasurementLease();
  }
  refreshMeasurementLease() {
    const lease=this.measurementLease;
    if(!lease)throw new Error('measurement_lease_owner_required');
    const updated=this.db.prepare(`UPDATE factory_measurement_leases_vnext SET expires=?,updated_at=?
      WHERE campaign_id=? AND owner=? AND owner_pid=? AND state='active'`).run(Date.now()+300000,Date.now(),lease.campaignId,lease.owner,process.pid);
    if(Number(updated.changes)!==1)throw new Error('measurement_lease_owner_mismatch');
    return true;
  }
  releaseMeasurement() {
    if(!this.measurementLease)return false;
    releaseCampaignMeasurementLease(this.ledger,this.measurementLease);
    this.measurementLease=null;
    return true;
  }
  release() {this.db.prepare('DELETE FROM factory_worker WHERE id=1 AND owner=?').run(this.owner);this.releaseMeasurement();}
  get(id){const row=this.db.prepare('SELECT value FROM factory_candidates WHERE id=?').get(id);return row?JSON.parse(row.value):null;}
  set(id,value){return this.ledger.transaction(()=>{
    if(this.measurementLease){
      if(this.candidateIds&&!this.candidateIds.includes(id))throw new Error('measurement_lease_candidate_scope_violation');
      const row=this.db.prepare(`SELECT candidate_ids_json FROM factory_measurement_leases_vnext WHERE campaign_id=? AND owner=? AND owner_pid=? AND state='active'`).get(this.measurementLease.campaignId,this.measurementLease.owner,process.pid);
      if(!row||!JSON.parse(row.candidate_ids_json).includes(id))throw new Error('measurement_lease_candidate_scope_violation');
    }else{
      assertNoLiveMeasurementLease(this.ledger,this.candidateIds);
      if(this.candidateIds&& !this.candidateIds.includes(id))throw new Error('factory_candidate_scope_violation');
    }
    this.db.prepare('INSERT INTO factory_candidates(id,value) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value').run(id,JSON.stringify(value));
    return true;
  });}
  inventory(rows,fingerprint){for(const row of rows)this.db.prepare('INSERT OR IGNORE INTO factory_inventory VALUES(?,?)').run(fingerprint(row),row.id);}
  duplicate(fingerprint,id){const row=this.db.prepare('SELECT question_id FROM factory_inventory WHERE fingerprint=?').get(fingerprint);return row && row.question_id!==id;}
  remember(fingerprint,id){this.db.prepare('INSERT INTO factory_inventory VALUES(?,?) ON CONFLICT(fingerprint) DO NOTHING').run(fingerprint,id);}
}
