import {randomUUID} from 'node:crypto';
export class CampaignController {
 constructor(ledger,{pid=process.pid,alive=pid=>{try{process.kill(pid,0);return true;}catch(e){return e.code==='EPERM';}},now=Date.now}={}){
  this.ledger=ledger;this.owner=pid+':'+randomUUID();this.alive=alive;this.now=now;
  ledger.db.exec('CREATE TABLE IF NOT EXISTS factory_campaign_controller(id INTEGER PRIMARY KEY CHECK(id=1),owner TEXT,expires INTEGER)');
 }
 claim(){return this.ledger.transaction(()=>{
  const row=this.ledger.db.prepare('SELECT * FROM factory_campaign_controller WHERE id=1').get();
  // A live owner keeps exclusive scheduling even during a long provider call.
  if(row&&row.owner!==this.owner&&this.alive(Number(row.owner.split(':')[0])))throw Error('campaign_controller_already_running');
  this.ledger.db.prepare('INSERT OR REPLACE INTO factory_campaign_controller VALUES(1,?,?)').run(this.owner,this.now()+300000);
 });}
 release(){this.ledger.db.prepare('DELETE FROM factory_campaign_controller WHERE id=1 AND owner=?').run(this.owner);}
}
