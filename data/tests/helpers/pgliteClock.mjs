// One clock for the Mob server tests on PGlite (T3, 15 Nov 2026). The service reads the test's fixture clock, but
// PGlite's now() (column defaults, mob_room_ok, any now() a test writes) reads the host clock through Date.now()
// (Emscripten's _emscripten_date_now). Fixtures dated 22 Oct drifted against SQL now() once real time passed them, so
// tests failed on clock skew and could not tell a regression (SV-5, picks hidden until close) from drift.
// pinDbClock makes Date.now(), and so the database's now(), read the fixture clock until db.close(); production
// has one clock for both too (the API passes p_now from the server clock).
export function pinDbClock(db, clock) {
  const real = Date.now;
  Date.now = () => clock.now;
  const close = db.close.bind(db);
  db.close = async () => {
    try { return await close(); } finally { Date.now = real; }
  };
  return db;
}
