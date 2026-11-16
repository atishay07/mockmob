// Class leagues' reads and writes on the three tables of supabase/migrations/20261116150000_class_leagues.sql (the rules are in
// ./model.mjs; ./service.js decides). Service-role client only. No 'server-only' and no alias imports, so node:test runs it on
// PGlite with the real migration (data/tests/class_league_routes.test.mjs). The Sunday Mock's attempts are read through the
// Sunday store (src/lib/server/sunday/store.js membersSittings and findMine), never here.
const UNIQUE_VIOLATION = '23505';
const LEAGUE_COLUMNS = 'id,code,name,subjects,created_by,created_at,closed_at';

const iso = (ms) => new Date(ms).toISOString();
const leagueOut = (r) => (r ? {
  id: r.id, code: r.code, name: r.name, subjects: Array.isArray(r.subjects) ? r.subjects : [], createdBy: r.created_by || null,
  createdAt: Date.parse(r.created_at), closedAt: r.closed_at ? Date.parse(r.closed_at) : null,
} : null);

export function createClassStore(db) {
  const c = () => (typeof db === 'function' ? db() : db);
  const fail = (error) => { throw Object.assign(new Error('CLASS_STORE_FAILED'), { cause: error }); };

  return {
    /** This student's open membership: { leagueId, joinedAt } or null. */
    async openMembership(userId) {
      const { data, error } = await c().from('class_league_members').select('league_id,joined_at').eq('user_id', userId).is('left_at', null).limit(1);
      if (error) fail(error);
      const row = (data || [])[0];
      return row ? { leagueId: row.league_id, joinedAt: Date.parse(row.joined_at) } : null;
    },

    async league(id) {
      const { data, error } = await c().from('class_leagues').select(LEAGUE_COLUMNS).eq('id', id).maybeSingle();
      if (error) fail(error);
      return leagueOut(data);
    },

    async leagueByCode(code) {
      const { data, error } = await c().from('class_leagues').select(LEAGUE_COLUMNS).eq('code', code).maybeSingle();
      if (error) fail(error);
      return leagueOut(data);
    },

    /** How many students are in the class now. */
    async openCount(leagueId) {
      const { count, error } = await c().from('class_league_members').select('id', { count: 'exact', head: true }).eq('league_id', leagueId).is('left_at', null);
      if (error) fail(error);
      return Number.isInteger(count) ? count : 0;
    },

    /** Every membership row of a class, open or ended: [{ userId, joinedAt, leftAt }] (a week's figure picks its own). */
    async memberRows(leagueId) {
      const { data, error } = await c().from('class_league_members').select('user_id,joined_at,left_at').eq('league_id', leagueId)
        .order('id', { ascending: true }).limit(1000);
      if (error) fail(error);
      return (data || []).map((r) => ({ userId: r.user_id, joinedAt: Date.parse(r.joined_at), leftAt: r.left_at ? Date.parse(r.left_at) : null }));
    },

    /** The new class row, or 'code_taken' when its code already exists (the caller draws another). */
    async insertLeague({ code, name, subjects, createdBy, at }) {
      const { data, error } = await c().from('class_leagues').insert({ code, name, subjects, created_by: createdBy, created_at: iso(at) }).select(LEAGUE_COLUMNS);
      if (error) return String(error.code) === UNIQUE_VIOLATION ? 'code_taken' : fail(error);
      return leagueOut((data || [])[0]);
    },

    /** { id } of the new membership row, or 'exists' when the student already has an open membership (the partial unique index). */
    async insertMember(leagueId, userId, at) {
      const { data, error } = await c().from('class_league_members').insert({ league_id: leagueId, user_id: userId, joined_at: iso(at) }).select('id');
      if (!error) return { id: Number((data || [])[0]?.id) };
      if (String(error.code) === UNIQUE_VIOLATION) return 'exists';
      return fail(error);
    },

    /** How many open memberships of a class were taken before this row (the cap's re-check after a join). */
    async openBefore(leagueId, rowId) {
      const { count, error } = await c().from('class_league_members').select('id', { count: 'exact', head: true }).eq('league_id', leagueId).is('left_at', null).lt('id', rowId);
      if (error) fail(error);
      return Number.isInteger(count) ? count : 0;
    },

    /** Takes back a membership row that went past the cap (it never counted for anything). */
    async removeMember(rowId) {
      const { error } = await c().from('class_league_members').delete().eq('id', rowId);
      if (error) fail(error);
    },

    /** A closed week's stored figure: { sat, average } (both null under the floor), or null when none is stored yet. */
    async readWeek(leagueId, week, subject) {
      const { data, error } = await c().from('class_league_weeks').select('sat,average').eq('league_id', leagueId).eq('week', week).eq('subject', subject).maybeSingle();
      if (error) fail(error);
      return data ? { sat: data.sat === null ? null : Number(data.sat), average: data.average === null ? null : Number(data.average) } : null;
    },

    /** Stores a closed week's figure once: 'stored', or 'exists' when another read stored it first (the first one stands). */
    async storeWeek({ leagueId, week, subject, sat, average, at }) {
      const { error } = await c().from('class_league_weeks').insert({ league_id: leagueId, week, subject, sat, average, computed_at: iso(at) });
      if (!error) return 'stored';
      if (String(error.code) === UNIQUE_VIOLATION) return 'exists';
      return fail(error);
    },

    /** Best effort: a class whose creator could not take their seat is removed again (nobody else can be in it yet). */
    async deleteLeague(id) {
      try { await c().from('class_leagues').delete().eq('id', id); } catch { /* the create's own error is what matters */ }
    },

    /** Ends this student's open membership of a class. */
    async endMembership(leagueId, userId, at) {
      const { error } = await c().from('class_league_members').update({ left_at: iso(at) }).eq('league_id', leagueId).eq('user_id', userId).is('left_at', null);
      if (error) fail(error);
    },

    /** Closes a class its creator started: true when this call closed it. */
    async closeLeague(id, userId, at) {
      const { data, error } = await c().from('class_leagues').update({ closed_at: iso(at) }).eq('id', id).eq('created_by', userId).is('closed_at', null).select('id');
      if (error) fail(error);
      return (data || []).length > 0;
    },

    /** Ends every open membership of a closed class, so each student is free to join another. */
    async endAll(leagueId, at) {
      const { error } = await c().from('class_league_members').update({ left_at: iso(at) }).eq('league_id', leagueId).is('left_at', null);
      if (error) fail(error);
    },
  };
}
