import { createHash, randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { resolve } from 'node:path';

// Local ownership is process-specific, while the DB identity binds this host to
// its persistent ledger. Restarting safely preserves every provider request ID.
export class FactoryStore {
  constructor(ledger,path) {
    this.ledger=ledger;this.db=ledger.db;this.owner=`${process.pid}:${randomUUID()}`;
    ledger.db.prepare("INSERT OR IGNORE INTO ledger_metadata VALUES('ledger_identity',?)").run(randomUUID());
    const persistentId=ledger.db.prepare("SELECT value FROM ledger_metadata WHERE id='ledger_identity'").get().value;
    this.identity=createHash('sha256').update(`${hostname()}:${resolve(path)}:${persistentId}`).digest('hex');
    this.db.exec(`CREATE TABLE IF NOT EXISTS factory_worker(id INTEGER PRIMARY KEY CHECK(id=1),owner TEXT,expires INTEGER);
      CREATE TABLE IF NOT EXISTS factory_candidates(id TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS factory_inventory(fingerprint TEXT PRIMARY KEY,question_id TEXT NOT NULL);`);
  }
  claim() {
    return this.ledger.transaction(()=>{
      const row=this.db.prepare('SELECT * FROM factory_worker WHERE id=1').get();
      if(row && row.owner!==this.owner && row.expires>Date.now()) {
        const pid=Number(row.owner?.split(':')[0]);let alive=true;
        try { process.kill(pid,0); } catch(error) { alive=error.code==='EPERM'; }
        if(alive) throw new Error('factory_worker_already_running');
      }
      this.db.prepare('INSERT OR REPLACE INTO factory_worker VALUES(1,?,?)').run(this.owner,Date.now()+300000); return true;
    });
  }
  release() {this.db.prepare('DELETE FROM factory_worker WHERE id=1 AND owner=?').run(this.owner);}
  get(id){const row=this.db.prepare('SELECT value FROM factory_candidates WHERE id=?').get(id);return row?JSON.parse(row.value):null;}
  set(id,value){this.db.prepare('INSERT OR REPLACE INTO factory_candidates VALUES(?,?)').run(id,JSON.stringify(value));}
  inventory(rows,fingerprint){for(const row of rows)this.db.prepare('INSERT OR IGNORE INTO factory_inventory VALUES(?,?)').run(fingerprint(row),row.id);}
  duplicate(fingerprint,id){const row=this.db.prepare('SELECT question_id FROM factory_inventory WHERE fingerprint=?').get(fingerprint);return row && row.question_id!==id;}
  remember(fingerprint,id){this.db.prepare('INSERT INTO factory_inventory VALUES(?,?) ON CONFLICT(fingerprint) DO NOTHING').run(fingerprint,id);}
}
