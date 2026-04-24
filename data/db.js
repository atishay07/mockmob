/**
 * MockMob — data access layer (Supabase-backed).
 *
 * Preserves the same `Database.*` API the rest of the app already calls.
 * All methods are now async (Supabase is async). Callers use `await`.
 *
 * Row shape in Postgres uses snake_case; we map to the camelCase shape
 * the app has always consumed, so components/routes don't change.
 */

import { supabaseAdmin } from '@/lib/supabase';
import { SEED_QUESTIONS } from './questions';

// ---------- id helpers (match legacy formats) ----------
const rid = () => Math.random().toString(36).substring(2, 9);
const newUserId     = () => `usr_${Date.now()}_${rid()}`;
const newAttemptId  = () => `att_${Date.now()}_${rid()}`;
const newQuestionId = () => `q_${Date.now()}_${rid()}`;

// ---------- row <-> app-shape mappers ----------
const userOut = (r) => r && ({
  id: r.id,
  name: r.name,
  email: r.email,
  image: r.image,
  subjects: Array.isArray(r.subjects) ? r.subjects : [],
  role: r.role,
  creditBalance: r.credit_balance || 0,
  createdAt: new Date(r.created_at).getTime(),
});

const questionOut = (r) => r && ({
  id: r.id,
  subject: r.subject,
  chapter: r.chapter,
  question: r.question,
  options: r.options || [],
  correctIndex: r.correct_index,
  explanation: r.explanation,
  difficulty: r.difficulty,
  source: r.source,
  status: r.status,
  uploadedBy: r.uploaded_by,
});

const attemptOut = (r) => r && ({
  id: r.id,
  userId: r.user_id,
  subject: r.subject,
  score: r.score,
  correct: r.correct,
  wrong: r.wrong,
  unattempted: r.unattempted,
  total: r.total,
  details: r.details || [],
  questionsSnapshot: r.questions_snapshot || [],
  completedAt: new Date(r.completed_at).getTime(),
});

// Re-export seed for any place still importing it directly.
export { SEED_QUESTIONS };

export const Database = {
  // =====================================================================
  // USERS
  // =====================================================================
  async getUsers() {
    const { data, error } = await supabaseAdmin().from('users').select('*');
    if (error) throw error;
    return data.map(userOut);
  },

  async getUserById(id) {
    if (!id) return null;
    const { data, error } = await supabaseAdmin()
      .from('users').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return userOut(data);
  },

  async getUserByName(name) {
    if (!name) return null;
    const { data, error } = await supabaseAdmin()
      .from('users').select('*').ilike('name', name).maybeSingle();
    if (error) throw error;
    return userOut(data);
  },

  async getUserByEmail(email) {
    if (!email) return null;
    const { data, error } = await supabaseAdmin()
      .from('users').select('*').eq('email', email).maybeSingle();
    if (error) throw error;
    return userOut(data);
  },

  async createUser(user) {
    const row = {
      id: user.id || newUserId(),
      name: user.name,
      email: user.email || null,
      image: user.image || null,
      subjects: user.subjects || [],
      role: user.role || 'student',
    };
    const { data, error } = await supabaseAdmin()
      .from('users').insert(row).select('*').single();
    if (error) throw error;
    return userOut(data);
  },

  async updateUser(id, updates) {
    const patch = {};
    if ('name'     in updates) patch.name     = updates.name;
    if ('email'    in updates) patch.email    = updates.email;
    if ('image'    in updates) patch.image    = updates.image;
    if ('subjects' in updates) patch.subjects = updates.subjects;
    if ('role'     in updates) patch.role     = updates.role;

    const { data, error } = await supabaseAdmin()
      .from('users').update(patch).eq('id', id).select('*').maybeSingle();
    if (error) throw error;
    return userOut(data);
  },

  // =====================================================================
  // CREDITS (Atomic RPC calls)
  // =====================================================================
  async spendCredits(userId, amount, reference) {
    if (amount <= 0) throw new Error("Amount must be positive");
    const { data, error } = await supabaseAdmin().rpc('spend_credits', {
      p_user_id: userId,
      p_amount: amount,
      p_reference: reference
    });
    if (error) throw error;
    return data === true; // Returns true if sufficient balance, false otherwise
  },

  async grantCredits(userId, amount, reference) {
    if (amount <= 0) throw new Error("Amount must be positive");
    const { error } = await supabaseAdmin().rpc('grant_credits', {
      p_user_id: userId,
      p_amount: amount,
      p_reference: reference
    });
    if (error) throw error;
    return true;
  },

  // =====================================================================
  // CHAPTERS
  // =====================================================================
  /**
   * Returns chapters for a subject from the DB if the table exists and has
   * rows, else null (caller should fall back to static SUBJECTS list).
   */
  async getChapters(subjectId) {
    try {
      const { data, error } = await supabaseAdmin()
        .from('chapters')
        .select('id, subject_id, name, sort_order')
        .eq('subject_id', subjectId)
        .order('sort_order', { ascending: true });
      if (error) {
        // Table may not exist yet (migration not applied) — signal fallback.
        if (error.code === '42P01' || /chapters/.test(error.message || '')) return null;
        throw error;
      }
      if (!data || !data.length) return null;
      return data.map(r => ({ id: r.id, subjectId: r.subject_id, name: r.name, sortOrder: r.sort_order }));
    } catch (e) {
      // Any unexpected failure — fall back instead of breaking the UI.
      console.warn('[db.getChapters] falling back to static list:', e?.message);
      return null;
    }
  },

  async upsertChapters(rows) {
    // Bulk upsert helper used by the seeder.
    const { data, error } = await supabaseAdmin()
      .from('chapters')
      .upsert(rows, { onConflict: 'id' })
      .select('id');
    if (error) throw error;
    return data;
  },

  // =====================================================================
  // QUESTIONS
  // =====================================================================
  async getQuestions(subjectId, count, opts = {}) {
    let q = supabaseAdmin()
      .from('questions')
      .select('*')
      .eq('subject', subjectId)
      .eq('status', 'live');
    if (opts.chapter) q = q.eq('chapter', opts.chapter);
    const { data, error } = await q;
    if (error) throw error;
    const shuffled = [...data].sort(() => Math.random() - 0.5);
    const limit = count ? Math.min(count, shuffled.length) : shuffled.length;
    return shuffled.slice(0, limit).map(questionOut);
  },

  async getAllQuestions() {
    const { data, error } = await supabaseAdmin().from('questions').select('*');
    if (error) throw error;
    return data.map(questionOut);
  },

  async getPendingQuestions() {
    const { data, error } = await supabaseAdmin()
      .from('questions').select('*').eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data.map(questionOut);
  },

  async addPendingQuestion(q) {
    const row = {
      id: q.id || newQuestionId(),
      subject: q.subject,
      chapter: q.chapter,
      question: q.question,
      options: q.options || [],
      correct_index: q.correctIndex,
      explanation: q.explanation || null,
      difficulty: q.difficulty || null,
      source: q.source || null,
      status: 'pending',
      uploaded_by: q.uploadedBy || null,
    };
    const { data, error } = await supabaseAdmin()
      .from('questions').insert(row).select('*').single();
    if (error) throw error;
    return questionOut(data);
  },

  async moderateQuestion(id, action) {
    const nextStatus =
      action === 'approve' ? 'live' :
      action === 'reject'  ? 'rejected' :
      null;
    if (!nextStatus) return null;

    const { data, error } = await supabaseAdmin()
      .from('questions').update({ status: nextStatus })
      .eq('id', id).eq('status', 'pending')
      .select('*').maybeSingle();
    if (error) throw error;
    return questionOut(data);
  },

  /** List rejected questions — useful for the moderation "rejected" tab. */
  async getRejectedQuestions() {
    const { data, error } = await supabaseAdmin()
      .from('questions').select('*').eq('status', 'rejected')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data.map(questionOut);
  },

  // =====================================================================
  // ATTEMPTS
  // =====================================================================
  async getAttempts(userId) {
    const q = supabaseAdmin().from('attempts').select('*')
      .order('completed_at', { ascending: false });
    const { data, error } = userId ? await q.eq('user_id', userId) : await q;
    if (error) throw error;
    return data.map(attemptOut);
  },

  async getAttemptById(id) {
    const { data, error } = await supabaseAdmin()
      .from('attempts').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return attemptOut(data);
  },

  async addAttempt(a) {
    const row = {
      id: a.id || newAttemptId(),
      user_id: a.userId,
      subject: a.subject,
      score: a.score,
      correct: a.correct,
      wrong: a.wrong,
      unattempted: a.unattempted,
      total: a.total,
      details: a.details || [],
      questions_snapshot: a.questionsSnapshot || [],
    };
    const { data, error } = await supabaseAdmin()
      .from('attempts').insert(row).select('*').single();
    if (error) throw error;
    return attemptOut(data);
  },

  // =====================================================================
  // LEADERBOARD
  // =====================================================================
  async getLeaderboard() {
    // Denormalized aggregate: one row per user with >= 1 attempt.
    const { data: attempts, error: ae } = await supabaseAdmin()
      .from('attempts').select('user_id, score');
    if (ae) throw ae;

    const stats = new Map();
    for (const a of attempts) {
      const s = stats.get(a.user_id) || { tests: 0, totalScore: 0 };
      s.tests++;
      s.totalScore += a.score;
      stats.set(a.user_id, s);
    }

    if (stats.size === 0) return [];

    const userIds = [...stats.keys()];
    const { data: users, error: ue } = await supabaseAdmin()
      .from('users').select('id, name, image').in('id', userIds);
    if (ue) throw ue;
    const byId = new Map(users.map(u => [u.id, u]));

    const rows = userIds.map(uid => {
      const s = stats.get(uid);
      const u = byId.get(uid);
      return {
        userId: uid,
        name: u?.name || 'Unknown User',
        image: u?.image || null,
        tests: s.tests,
        totalScore: s.totalScore,
        avg: Math.round(s.totalScore / s.tests),
      };
    });

    return rows.sort((a, b) => b.totalScore - a.totalScore);
  },
};
