// Class leagues' switch (src/lib/classLeague/model.mjs). Off unless CLASS_LEAGUES_ENABLED is exactly 'true': its migration
// (supabase/migrations/20261116150000_class_leagues.sql) must be applied first. Off, every /api/class route answers 404
// CLASS_OFF before it reads a session or a table, /class/<code> is a 404 page, and every surface draws nothing. Read on every
// request. Server only (env).
export const classLeaguesEnabled = () => process.env.CLASS_LEAGUES_ENABLED === 'true';
