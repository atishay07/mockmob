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
const newUserId = () => `usr_${Date.now()}_${rid()}`;
const newAttemptId = () => `att_${Date.now()}_${rid()}`;
const newQuestionId = () => `q_${Date.now()}_${rid()}`;
const newPaymentId = () => `payrec_${Date.now()}_${rid()}`;

// ---------- row <-> app-shape mappers ----------
const userOut = (r) => r && ({
  id: r.id,
  name: r.name,
  email: r.email,
  image: r.image,
  subjects: Array.isArray(r.subjects) ? r.subjects : [],
  role: r.role,
  creditBalance: r.credit_balance || 0,
  subscriptionStatus: r.subscription_status || 'free',
  isPremium: Boolean(r.is_premium) || r.subscription_status === 'active',
  createdAt: new Date(r.created_at).getTime(),
});

const paymentOut = (r) => r && ({
  id: r.id,
  userId: r.user_id,
  orderId: r.order_id,
  subscriptionId: r.subscription_id,
  paymentId: r.payment_id,
  planId: r.plan_id,
  razorpayPlanId: r.razorpay_plan_id,
  amount: r.amount,
  currency: r.currency,
  status: r.status,
  rawOrder: r.raw_order || {},
  rawSubscription: r.raw_subscription || {},
  rawPayment: r.raw_payment || {},
  createdAt: r.created_at ? new Date(r.created_at).getTime() : null,
  updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : null,
});

const questionOut = (r) => r && ({
  id: r.id,
  subject: r.subject,
  chapter: r.chapter,
  body: r.body ?? r.question,
  question: r.question ?? r.body,   // upload route writes `body`; addPendingQuestion writes `question`
  options: r.options || [],
  correctIndex: Number.isInteger(r.correct_index)
    ? r.correct_index
    : Array.isArray(r.options)
      ? r.options.findIndex((option, index) => (
        option?.key === r.correct_answer || String(index) === String(r.correct_answer)
      ))
      : -1,
  correctAnswer: r.correct_answer,  // upload route writes `correct_answer`
  explanation: r.explanation,
  difficulty: r.difficulty,
  source: r.source,
  status: r.status,
  uploadedBy: r.uploaded_by,
  authorId: r.author_id ?? r.uploaded_by,
  aiTier: r.ai_tier,
  aiScore: r.ai_score,
  verificationState: r.verification_state,
  qualityBand: r.quality_band,
  upvotes: r.upvotes || 0,
  downvotes: r.downvotes || 0,
  score: r.score || 0,
  userVote: r.user_vote || null,
  createdAt: r.created_at ? new Date(r.created_at).getTime() : null,
});

const VISIBLE_QUESTION_FILTER = 'status.eq.live,and(verification_state.eq.verified,exploration_state.eq.active)';
const MOCK_DIFFICULTY_QUOTAS = { easy: 0.10, medium: 0.60, hard: 0.30 };

function isMissingPhase1VoteSchema(error) {
  return error?.code === '42703' ||
    error?.code === '42P01' ||
    /question_votes|score|upvotes|downvotes|schema cache|column .* does not exist/i.test(error?.message || '');
}

function computeDifficultyTargets(total) {
  if (total <= 1) return { easy: 0, medium: total, hard: 0 };

  let easy = Math.max(1, Math.round(total * MOCK_DIFFICULTY_QUOTAS.easy));
  let medium = Math.max(1, Math.round(total * MOCK_DIFFICULTY_QUOTAS.medium));
  let hard = total - easy - medium;

  if (hard < 1 && total >= 3) {
    hard = 1;
  }

  while (easy + medium + hard > total) {
    if (medium > 1) medium--;
    else if (hard > 1) hard--;
    else break;
  }

  while (easy + medium + hard < total) {
    medium++;
  }

  return { easy, medium, hard };
}

function pickQuestionsForMock(rows, count) {
  const buckets = {
    easy: rows.filter((row) => row.difficulty === 'easy'),
    medium: rows.filter((row) => row.difficulty === 'medium'),
    hard: rows.filter((row) => row.difficulty === 'hard'),
    other: rows.filter((row) => !['easy', 'medium', 'hard'].includes(row.difficulty)),
  };

  const targets = computeDifficultyTargets(count);
  const selected = [];

  for (const difficulty of ['easy', 'medium', 'hard']) {
    for (let i = 0; i < targets[difficulty] && buckets[difficulty].length > 0; i += 1) {
      selected.push(buckets[difficulty].shift());
    }
  }

  for (const difficulty of ['medium', 'hard', 'easy', 'other']) {
    while (selected.length < count && buckets[difficulty].length > 0) {
      selected.push(buckets[difficulty].shift());
    }
  }

  return selected.slice(0, count);
}

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
      credit_balance: 100,
    };
    const { data, error } = await supabaseAdmin()
      .from('users').insert(row).select('*').single();
    if (error) throw error;
    return userOut(data);
  },

  async updateUser(id, updates) {
    const patch = {};
    if ('name' in updates) patch.name = updates.name;
    if ('email' in updates) patch.email = updates.email;
    if ('image' in updates) patch.image = updates.image;
    if ('subjects' in updates) patch.subjects = updates.subjects;
    if ('role' in updates) patch.role = updates.role;
    if ('subscriptionStatus' in updates) patch.subscription_status = updates.subscriptionStatus;
    if ('isPremium' in updates) patch.is_premium = updates.isPremium;

    const { data, error } = await supabaseAdmin()
      .from('users').update(patch).eq('id', id).select('*').maybeSingle();
    if (error) throw error;
    return userOut(data);
  },

  // =====================================================================
  // PAYMENTS
  // =====================================================================
  async createPayment(payment) {
    const row = {
      id: payment.id || newPaymentId(),
      user_id: payment.userId,
      order_id: payment.orderId || null,
      subscription_id: payment.subscriptionId || null,
      payment_id: payment.paymentId || null,
      plan_id: payment.planId,
      razorpay_plan_id: payment.razorpayPlanId || null,
      amount: payment.amount,
      currency: payment.currency || 'INR',
      status: payment.status || 'created',
      raw_order: payment.rawOrder || {},
      raw_subscription: payment.rawSubscription || {},
      raw_payment: payment.rawPayment || {},
    };

    const { data, error } = await supabaseAdmin()
      .from('payments')
      .insert(row)
      .select('*')
      .single();
    if (error) throw error;
    return paymentOut(data);
  },

  async getPaymentByOrderId(orderId) {
    if (!orderId) return null;
    const { data, error } = await supabaseAdmin()
      .from('payments')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle();
    if (error) throw error;
    return paymentOut(data);
  },

  async getPaymentBySubscriptionId(subscriptionId) {
    if (!subscriptionId) return null;
    const { data, error } = await supabaseAdmin()
      .from('payments')
      .select('*')
      .eq('subscription_id', subscriptionId)
      .maybeSingle();
    if (error) throw error;
    return paymentOut(data);
  },

  async updatePaymentByOrderId(orderId, updates) {
    const patch = { updated_at: new Date().toISOString() };
    if (updates.paymentId !== undefined) patch.payment_id = updates.paymentId;
    if (updates.status !== undefined) patch.status = updates.status;
    if (updates.rawPayment !== undefined) patch.raw_payment = updates.rawPayment;
    if (updates.rawSubscription !== undefined) patch.raw_subscription = updates.rawSubscription;

    const { data, error } = await supabaseAdmin()
      .from('payments')
      .update(patch)
      .eq('order_id', orderId)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return paymentOut(data);
  },

  async updatePaymentBySubscriptionId(subscriptionId, updates) {
    const patch = { updated_at: new Date().toISOString() };
    if (updates.paymentId !== undefined) patch.payment_id = updates.paymentId;
    if (updates.status !== undefined) patch.status = updates.status;
    if (updates.rawPayment !== undefined) patch.raw_payment = updates.rawPayment;
    if (updates.rawSubscription !== undefined) patch.raw_subscription = updates.rawSubscription;

    const { data, error } = await supabaseAdmin()
      .from('payments')
      .update(patch)
      .eq('subscription_id', subscriptionId)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return paymentOut(data);
  },

  // =====================================================================
  // CREDITS (Atomic RPC calls)
  // =====================================================================
  async spendCredits(userId, action, reference) {
    if (!['generate', 'attempt'].includes(action)) throw new Error('Invalid credit spend action');
    const { data, error } = await supabaseAdmin().rpc('spend_credits', {
      p_user_id: userId,
      p_action: action,
      p_reference: reference
    });
    if (error) throw error;
    return data === true; // Returns true if sufficient balance, false otherwise
  },

  async grantContributionCredits(userId, reference) {
    const { data, error } = await supabaseAdmin().rpc('grant_contribution_credits', {
      p_user_id: userId,
      p_action: 'contribute',
      p_reference: reference
    });
    if (error) throw error;
    return data === true;
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
    const buildQuery = (withScore) => {
      let query = supabaseAdmin()
        .from('questions')
        .select('*')
        .eq('subject', subjectId)
        .eq('is_deleted', false)
        .or(VISIBLE_QUESTION_FILTER);
      if (Array.isArray(opts.chapters) && opts.chapters.length > 0) query = query.in('chapter', opts.chapters);
      else if (opts.chapter) query = query.eq('chapter', opts.chapter);
      if (['easy', 'medium', 'hard'].includes(opts.difficulty)) query = query.eq('difficulty', opts.difficulty);
      if (withScore) {
        query = query
          .gte('score', -2)
          .order('score', { ascending: false });
      }
      return query.order('created_at', { ascending: false });
    };

    let { data, error } = await buildQuery(true);
    if (error && isMissingPhase1VoteSchema(error)) {
      ({ data, error } = await buildQuery(false));
    }
    if (error) throw error;
    const visibleRows = Array.isArray(data) ? data : [];
    const limit = count ? Math.min(count, visibleRows.length) : visibleRows.length;
    const selected = pickQuestionsForMock(visibleRows, limit);

    if (opts.userId && selected.length > 0) {
      const voteMap = await this.getUserVotes(opts.userId, selected.map((row) => row.id));
      return selected.map((row) => questionOut({ ...row, user_vote: voteMap.get(row.id) || null }));
    }

    return selected.map(questionOut);
  },

  async getUserVotes(userId, questionIds) {
    if (!userId || !Array.isArray(questionIds) || questionIds.length === 0) return new Map();
    const { data, error } = await supabaseAdmin()
      .from('question_votes')
      .select('question_id, vote_type')
      .eq('user_id', userId)
      .in('question_id', questionIds);
    if (error && isMissingPhase1VoteSchema(error)) return new Map();
    if (error) throw error;
    return new Map((data || []).map((row) => [row.question_id, row.vote_type]));
  },

  async voteQuestion(userId, questionId, voteType) {
    if (!userId) throw new Error('User is required');
    if (!questionId) throw new Error('Question is required');
    if (![null, 'up', 'down'].includes(voteType)) throw new Error('Invalid vote type');

    const supabase = supabaseAdmin();

    // 1. Check existing vote
    const { data: existing } = await supabase
      .from("question_votes")
      .select("*")
      .eq("user_id", userId)
      .eq("question_id", questionId)
      .maybeSingle();

    // 2. Insert / update / delete
    if (voteType === null) {
      await supabase
        .from("question_votes")
        .delete()
        .eq("user_id", userId)
        .eq("question_id", questionId);
    } else if (existing) {
      await supabase
        .from("question_votes")
        .update({ vote_type: voteType })
        .eq("user_id", userId)
        .eq("question_id", questionId);
    } else {
      await supabase.from("question_votes").insert({
        user_id: userId,
        question_id: questionId,
        vote_type: voteType,
      });
    }

    // 3. Fetch all votes for this question
    const { data: votes } = await supabase
      .from("question_votes")
      .select("vote_type")
      .eq("question_id", questionId);

    const upvotes = votes.filter(v => v.vote_type === "up").length;
    const downvotes = votes.filter(v => v.vote_type === "down").length;
    const score = upvotes - downvotes;

    // 4. Update question table
    await supabase
      .from("questions")
      .update({ upvotes, downvotes, score })
      .eq("id", questionId);

    const result = {
      questionId,
      upvotes,
      downvotes,
      score,
      userVote: voteType,
    };

    console.log('Vote saved', questionId, result);
    return result;
  },

  async getAllQuestions() {
    const { data, error } = await supabaseAdmin().from('questions').select('*');
    if (error) throw error;
    return data.map(questionOut);
  },

  async getPendingQuestions() {
    const { data, error } = await supabaseAdmin()
      .from('questions').select('*')
      .eq('status', 'pending')
      .eq('is_deleted', false)
      .in('verification_state', ['unverified', 'pending_review', 'disputed'])
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
    if (!['approve', 'reject'].includes(action)) return null;

    const { data, error } = await supabaseAdmin().rpc('moderate_question_with_credit', {
      p_question_id: id,
      p_action: action,
    });
    if (error) throw error;

    return questionOut(data);
  },

  /** List rejected questions — useful for the moderation "rejected" tab. */
  async getRejectedQuestions() {
    const { data, error } = await supabaseAdmin()
      .from('questions').select('*')
      .eq('is_deleted', false)
      .or('status.eq.rejected,verification_state.eq.rejected')
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
