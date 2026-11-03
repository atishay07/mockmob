// Emergency, owner-scoped DB reservation caps for already-running processes whose
// phase accounting is known to be undercounting. Install only after the owner
// verifies each PID and cap; this does not change the global lifetime ceiling.
export function installTemporaryOwnerBudgetCaps(db, caps) {
  if (!Array.isArray(caps) || !caps.length || caps.some(c => !Number.isSafeInteger(c.owner_pid) || c.owner_pid <= 0 || !Number.isSafeInteger(c.cap_micro) || c.cap_micro <= 0)) {
    throw new Error('verified_owner_pid_caps_required');
  }
  db.exec(`CREATE TABLE IF NOT EXISTS temporary_owner_budget_caps (
    owner_pid INTEGER PRIMARY KEY CHECK(owner_pid > 0), cap_micro INTEGER NOT NULL CHECK(cap_micro > 0)
  )`);
  const upsert = db.prepare('INSERT INTO temporary_owner_budget_caps(owner_pid,cap_micro) VALUES(?,?) ON CONFLICT(owner_pid) DO UPDATE SET cap_micro=excluded.cap_micro');
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const { owner_pid, cap_micro } of caps) upsert.run(owner_pid, cap_micro);
    db.exec(`CREATE TRIGGER IF NOT EXISTS temporary_owner_budget_reservation_guard
      BEFORE INSERT ON requests
      WHEN NEW.owner_pid IS NOT NULL AND EXISTS(SELECT 1 FROM temporary_owner_budget_caps WHERE owner_pid=NEW.owner_pid)
      BEGIN
        SELECT CASE WHEN
          COALESCE((SELECT SUM(CASE WHEN state='settled' THEN COALESCE(actual,0) ELSE MAX(reserved,COALESCE(actual,0)) END)
                    FROM requests WHERE owner_pid=NEW.owner_pid),0) + NEW.reserved >
          (SELECT cap_micro FROM temporary_owner_budget_caps WHERE owner_pid=NEW.owner_pid)
        THEN RAISE(ABORT,'campaign_budget_exhausted') END;
      END`);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function removeTemporaryOwnerBudgetCaps(db, ownerPids) {
  if (!Array.isArray(ownerPids) || !ownerPids.length || ownerPids.some(pid => !Number.isSafeInteger(pid) || pid <= 0)) throw new Error('verified_owner_pids_required');
  db.exec('BEGIN IMMEDIATE');
  try {
    const remove = db.prepare('DELETE FROM temporary_owner_budget_caps WHERE owner_pid=?');
    for (const pid of ownerPids) remove.run(pid);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
