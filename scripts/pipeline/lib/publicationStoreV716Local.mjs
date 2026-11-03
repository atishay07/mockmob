// Local/staging-rehearsal publication store for V716. It mirrors the public.questions, passage_groups,
// question_content_disputes and recovery_family_holds shapes in SQLite so the signed-row writer,
// receipt recovery, dispute invalidation and read path can be exercised end to end without any
// production client. It is never a default writer: callers construct it with an explicit path.
import { DatabaseSync } from 'node:sqlite';
import { hashJSON } from '../../../data/question_factory_policy.mjs';
const JSON_COLUMNS = new Set(['options','tags','evidence','provenance','mode_visibility','receipt']);
const QUESTION_COLUMNS = ['id','author_id','subject','chapter','body','options','correct_answer','explanation','difficulty','difficulty_weight','tags','status','evidence',
 'family_id','passage_text','passage_group_id','question_type','concept_id','order_index','provenance','ai_tier','verification_state','quality_band','quality_score',
 'exploration_state','exploration_lane','live_at','is_deleted'];
const GROUP_COLUMNS = ['id','subject','chapter','passage_text','passage_type','title','source','difficulty','status','discoverable','mode_visibility'];
const encode = (column, value) => value === undefined || value === null ? null : JSON_COLUMNS.has(column) ? JSON.stringify(value) : typeof value === 'boolean' ? (value ? 1 : 0) : value;
function decode(row, booleans = []) {
 if (!row) return row;
 const out = {};
 for (const [key, value] of Object.entries(row)) out[key] = value === null ? null : JSON_COLUMNS.has(key) ? JSON.parse(value) : booleans.includes(key) ? value === 1 : value;
 return out;
}
export function openLocalPublicationStoreV716(path, { failpoint = () => {} } = {}) {
 if (!path) throw Error('v716_local_store_path_required');
 const db = new DatabaseSync(path);
 db.exec(`PRAGMA journal_mode=WAL;
 CREATE TABLE IF NOT EXISTS questions (id TEXT PRIMARY KEY, author_id TEXT NOT NULL, subject TEXT NOT NULL, chapter TEXT NOT NULL, body TEXT NOT NULL, options TEXT,
  correct_answer TEXT NOT NULL, explanation TEXT, difficulty TEXT NOT NULL CHECK(difficulty IN ('easy','medium','hard')), difficulty_weight INTEGER CHECK(difficulty_weight IS NULL OR difficulty_weight IN (1,2,3)),
  tags TEXT NOT NULL DEFAULT '[]', status TEXT, evidence TEXT, family_id TEXT, passage_text TEXT, passage_group_id TEXT, question_type TEXT, concept_id TEXT, order_index INTEGER, provenance TEXT,
  ai_tier TEXT NOT NULL DEFAULT 'PENDING', verification_state TEXT NOT NULL DEFAULT 'unverified' CHECK(verification_state IN ('unverified','pending_review','verified','rejected','disputed')),
  quality_band TEXT NOT NULL DEFAULT 'unrated' CHECK(quality_band IN ('unrated','useful','strong','exceptional','verified','low_quality')), quality_score REAL NOT NULL DEFAULT 0,
  exploration_state TEXT, exploration_lane TEXT, live_at TEXT, is_deleted INTEGER NOT NULL DEFAULT 0, updated_at TEXT);
 CREATE TABLE IF NOT EXISTS passage_groups (id TEXT PRIMARY KEY, subject TEXT, chapter TEXT, passage_text TEXT, passage_type TEXT, title TEXT, source TEXT, difficulty TEXT,
  status TEXT, discoverable INTEGER, mode_visibility TEXT);
 CREATE TABLE IF NOT EXISTS question_content_disputes (id TEXT PRIMARY KEY, question_id TEXT NOT NULL REFERENCES questions(id), content_hash TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'open', reason TEXT NOT NULL, receipt TEXT NOT NULL, created_at TEXT NOT NULL, resolved_at TEXT);
 CREATE TABLE IF NOT EXISTS recovery_family_holds (family_id TEXT PRIMARY KEY, reason TEXT, created_at TEXT);
 CREATE TABLE IF NOT EXISTS v716_publication_units (unit_key TEXT PRIMARY KEY, content_hash TEXT NOT NULL, payload_hash TEXT NOT NULL, question_ids TEXT NOT NULL,
  group_id TEXT, receipt TEXT NOT NULL, committed_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS v716_write_state (unit_key TEXT PRIMARY KEY, record TEXT NOT NULL, updated_at TEXT NOT NULL);`);
 const liveIds = () => db.prepare(`SELECT id,verification_state,status,is_deleted FROM questions ORDER BY id`).all();
 const holds = () => db.prepare('SELECT family_id FROM recovery_family_holds ORDER BY family_id').all().map(row => row.family_id);
 const inventoryVersion = () => hashJSON({ questions:liveIds(), holds:holds(), disputes:db.prepare(`SELECT id,state FROM question_content_disputes ORDER BY id`).all() });
 // A failure inside the transaction is rolled back here, so the store can state that nothing committed.
 function transaction(work) {
  db.exec('BEGIN IMMEDIATE');
  try { const result = work(); db.exec('COMMIT'); return result; }
  catch (error) { let rolledBack = false; try { db.exec('ROLLBACK'); rolledBack = true; } catch {} if (rolledBack) error.definitive_no_commit = true; throw error; }
 }
 // Read path: live, verified, active, undeleted rows with passage text hydrated from live groups and open disputes flagged.
 function readRows() {
  const rows = db.prepare(`SELECT * FROM questions WHERE is_deleted=0 AND (status='live' OR (verification_state='verified' AND exploration_state='active'))`).all().map(row => decode(row, ['is_deleted']));
  const groups = new Map(db.prepare(`SELECT * FROM passage_groups WHERE status='live' AND discoverable=1`).all().map(row => [row.id, decode(row, ['discoverable'])]));
  const open = new Set(db.prepare(`SELECT question_id FROM question_content_disputes WHERE state='open'`).all().map(row => row.question_id));
  return rows.filter(row => !row.passage_group_id || groups.has(row.passage_group_id)).map(row => {
   const group = row.passage_group_id ? groups.get(row.passage_group_id) : null;
   return { ...row, passage_text:row.passage_text || group?.passage_text || null, open_dispute:open.has(row.id) || undefined, ...(group ? { passage_mode_visibility:group.mode_visibility } : {}) };
  });
 }
 const adapter = {
  path, db, inventoryVersion, readRows,
  async readInventory() { return readRows(); },
  async readFamilyHolds() { return holds(); },
  async getWriteState(unitKey) { const row = db.prepare('SELECT record FROM v716_write_state WHERE unit_key=?').get(unitKey); return row ? JSON.parse(row.record) : null; },
  async saveWriteState(unitKey, record) {
   db.prepare('INSERT INTO v716_write_state(unit_key,record,updated_at) VALUES(?,?,?) ON CONFLICT(unit_key) DO UPDATE SET record=excluded.record,updated_at=excluded.updated_at')
    .run(unitKey, JSON.stringify(record), new Date().toISOString());
  },
  // One transaction: precondition check, all rows (and group), receipt. Either everything commits or nothing does.
  async writeAtomic(prepared) {
   if (!prepared?.unit_key || !Array.isArray(prepared.rows) || !prepared.rows.length) throw Error('v716_prepared_unit_required');
   const receipt = transaction(() => {
    const existing = db.prepare('SELECT receipt FROM v716_publication_units WHERE unit_key=?').get(prepared.unit_key);
    if (existing) return JSON.parse(existing.receipt);
    if (prepared.preconditions?.inventory_version && prepared.preconditions.inventory_version !== inventoryVersion()) throw Error('v716_publication_precondition_changed');
    if (prepared.rows.some(row => holds().includes(row.family_id))) throw Error('v716_family_hold_changed');
    for (const row of prepared.rows) if (db.prepare('SELECT 1 FROM questions WHERE id=?').get(row.id)) throw Error('v716_question_id_already_present');
    if (prepared.group) {
     if (prepared.rows.length < 2 || prepared.rows.some(row => row.passage_group_id !== prepared.group.id || row.passage_text !== prepared.group.passage_text)) throw Error('v716_complete_passage_group_required');
     db.prepare(`INSERT INTO passage_groups(${GROUP_COLUMNS.join(',')}) VALUES(${GROUP_COLUMNS.map(() => '?').join(',')})`).run(...GROUP_COLUMNS.map(column => encode(column, prepared.group[column])));
    } else if (prepared.rows.length !== 1 || prepared.rows[0].passage_group_id) throw Error('v716_single_question_unit_required');
    const insert = db.prepare(`INSERT INTO questions(${QUESTION_COLUMNS.join(',')},updated_at) VALUES(${QUESTION_COLUMNS.map(() => '?').join(',')},?)`);
    const at = new Date().toISOString();
    for (const [index, row] of prepared.rows.entries()) {
     const unknown = Object.keys(row).filter(column => !QUESTION_COLUMNS.includes(column));
     if (unknown.length) throw Error('v716_non_column_field:' + unknown.join(','));
     insert.run(...QUESTION_COLUMNS.map(column => encode(column, row[column])), at);
     failpoint('after_row', index);
    }
    const value = { committed:true, unit_key:prepared.unit_key, content_hash:prepared.content_hash, payload_hash:prepared.payload_hash,
     question_ids:prepared.rows.map(row => row.id), group_id:prepared.group?.id || null, committed_at:at };
    db.prepare('INSERT INTO v716_publication_units(unit_key,content_hash,payload_hash,question_ids,group_id,receipt,committed_at) VALUES(?,?,?,?,?,?,?)')
     .run(value.unit_key, value.content_hash, value.payload_hash, JSON.stringify(value.question_ids), value.group_id, JSON.stringify(value), at);
    failpoint('before_commit');
    return value;
   });
   failpoint('after_commit');
   return receipt;
  },
  // Receipt-only recovery. Absence is definitive only while holding the write lock with no partial unit rows present.
  async readReceipt(unitKey) {
   return transaction(() => {
    const row = db.prepare('SELECT receipt FROM v716_publication_units WHERE unit_key=?').get(unitKey);
    if (row) return JSON.parse(row.receipt);
    return { committed:false, unit_key:unitKey, definitive_absent:true };
   });
  },
  // Mirrors public.record_question_dispute: the row is withheld even if content changed meanwhile.
  recordDispute({ id, questionId, contentHash, receipt, reason = 'ai_key_dispute' }) {
   return transaction(() => {
    if (!db.prepare('SELECT 1 FROM questions WHERE id=?').get(questionId)) return false;
    db.prepare('INSERT INTO question_content_disputes(id,question_id,content_hash,reason,receipt,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING')
     .run(id, questionId, contentHash, reason, JSON.stringify(receipt || {}), new Date().toISOString());
    db.prepare(`UPDATE questions SET status='pending',verification_state='disputed',exploration_state='pending_review',updated_at=? WHERE id=? AND status IS NOT 'rejected'`).run(new Date().toISOString(), questionId);
    return true;
   });
  },
  holdFamily(familyId, reason = 'family_hold') { db.prepare('INSERT INTO recovery_family_holds(family_id,reason,created_at) VALUES(?,?,?) ON CONFLICT(family_id) DO NOTHING').run(familyId, reason, new Date().toISOString()); },
  close() { db.close(); }
 };
 return adapter;
}
