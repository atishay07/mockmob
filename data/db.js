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
import {
  effectivePremiumFromRow,
  REFUND_REVOKED_PREMIUM_ACTION,
  refundRevocationMatchesPayment,
} from '@/lib/payments/entitlements';
import { SEED_QUESTIONS } from './questions';
import { toPublicSubjectId } from './cuet_controls';
import { getMode } from './test_modes';
import { rankCandidates, pickWithConstraints, buildSelectionUsageMeta } from './mock_question_selector';
import { NTA_DURATION_MINUTES, NTA_QUESTION_COUNT, isPassageLinkedQuestion, selectNtaQuestionSetWithAnswerVerification } from './nta_question_selector';

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
  isPremium: effectivePremiumFromRow(r),
  premiumUntil: r.premium_until || null,
  razorpaySubscriptionId: r.razorpay_subscription_id || null,
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
  amountPaid: r.amount_paid ?? null,
  accessUntil: r.access_until || null,
  currency: r.currency,
  status: r.status,
  creatorCode: r.creator_code || null,
  creatorId: r.creator_id || null,
  offerId: r.offer_id || null,
  creatorEarning: r.creator_earning ?? null,
  payoutId: r.payout_id || null,
  rawOrder: r.raw_order || {},
  rawSubscription: r.raw_subscription || {},
  rawPayment: r.raw_payment || {},
  createdAt: r.created_at ? new Date(r.created_at).getTime() : null,
  updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : null,
});

const payoutOut = (r) => r && ({
  id: r.id,
  creatorId: r.creator_id,
  amount: r.amount,
  paymentCount: r.payment_count,
  status: r.status,
  notes: r.notes || null,
  createdAt: r.created_at ? new Date(r.created_at).getTime() : null,
  paidAt: r.paid_at ? new Date(r.paid_at).getTime() : null,
  markedPaidBy: r.marked_paid_by || null,
});

const creatorOut = (r) => r && ({
  id: r.id,
  userId: r.user_id || null,
  name: r.name,
  email: r.email || null,
  code: r.code,
  offerId: r.offer_id || null,
  commissionRate: typeof r.commission_rate === 'string' ? Number(r.commission_rate) : r.commission_rate,
  payoutPerSale: r.payout_per_sale ?? 2000,
  isActive: Boolean(r.is_active),
  notes: r.notes || null,
  createdAt: r.created_at ? new Date(r.created_at).getTime() : null,
  updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : null,
});

const ANSWER_KEY_INDEX = new Map([
  ['A', 0],
  ['B', 1],
  ['C', 2],
  ['D', 3],
  ['E', 4],
]);
const OPTION_KEYS = ['A', 'B', 'C', 'D', 'E'];

function optionLabel(option) {
  if (typeof option === 'string') return option;
  return option?.text ?? option?.label ?? option?.value ?? option?.body ?? option?.option ?? '';
}

function optionKeyAt(question, index) {
  if (!Number.isInteger(index) || index < 0) return null;
  const option = Array.isArray(question?.options) ? question.options[index] : null;
  if (option && typeof option === 'object' && option.key != null) return String(option.key);
  return OPTION_KEYS[index] || String(index);
}

function resolveCorrectIndex(r) {
  if (Number.isInteger(r?.correct_index) && r.correct_index >= 0) return r.correct_index;

  const options = Array.isArray(r?.options) ? r.options : [];
  const rawAnswer = String(r?.correct_answer ?? '').trim();
  if (!options.length || !rawAnswer) return -1;

  const upperAnswer = rawAnswer.toUpperCase().replace(/^OPTION[_\s-]*/, '').replace(/[).:]+$/, '');
  const keyedIndex = options.findIndex((option) => {
    const key = String(option?.key ?? option?.id ?? '').trim().toUpperCase();
    return key && key === upperAnswer;
  });
  if (keyedIndex >= 0) return keyedIndex;

  if (ANSWER_KEY_INDEX.has(upperAnswer) && ANSWER_KEY_INDEX.get(upperAnswer) < options.length) {
    return ANSWER_KEY_INDEX.get(upperAnswer);
  }

  if (/^\d+$/.test(rawAnswer)) {
    const numeric = Number(rawAnswer);
    if (numeric === 0 && options.length > 0) return 0;
    if (numeric >= 1 && numeric <= options.length) return numeric - 1;
  }

  const textAnswer = rawAnswer.toLowerCase();
  return options.findIndex((option) => String(optionLabel(option)).trim().toLowerCase() === textAnswer);
}

const questionOut = (r) => r && ({
  id: r.id,
  subject: toPublicSubjectId(r.subject),
  internalSubject: r.subject,
  chapter: r.chapter,
  body: r.body ?? r.question,
  question: r.question ?? r.body,   // upload route writes `body`; addPendingQuestion writes `question`
  options: r.options || [],
  correctIndex: resolveCorrectIndex(r),
  correctAnswer: r.correct_answer,  // upload route writes `correct_answer`
  explanation: r.explanation,
  difficulty: r.difficulty,
  difficultyWeight: r.difficulty_weight || null,
  topic: r.topic || null,
  concept: r.concept || null,
  conceptId: r.concept_id || null,
  pyqAnchorId: r.pyq_anchor_id || null,
  questionType: r.question_type || null,
  passageGroupId: r.passage_group_id || r.group_id || null,
  passageId: r.passage_id || null,
  passageType: r.passage_type || null,
  passageText: r.passage_text || r.passageText || null,
  passageTitle: r.passage_title || r.passageTitle || r.title || null,
  orderIndex: r.order_index || null,
  anchorTier: r.anchor_tier ?? null,
  qualityScore: r.quality_score ?? null,
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
const PAID_SALE_STATUSES = new Set(['captured', 'completed', 'paid']);

function isMissingPhase1VoteSchema(error) {
  return error?.code === '42703' ||
    error?.code === '42P01' ||
    /question_votes|score|upvotes|downvotes|schema cache|column .* does not exist/i.test(error?.message || '');
}

function isMissingReferralSchema(error) {
  return error?.code === '42703' ||
    error?.code === '42P01' ||
    /creators|payouts|creator_id|creator_code|offer_id|amount_paid|creator_earning|payout_id|payout_per_sale|schema cache|column .* does not exist|relation .* does not exist/i.test(error?.message || '');
}

function isMissingEntitlementSchema(error) {
  return error?.code === '42703' ||
    /premium_until|razorpay_subscription_id|access_until|schema cache|column .* does not exist/i.test(error?.message || '');
}

function isMissingAuditSchema(error) {
  return error?.code === '42P01' ||
    /audit_logs|schema cache|relation .* does not exist/i.test(error?.message || '');
}

function isMissingAttemptSelectionSchema(error) {
  const message = String(error?.message || '');
  const details = String(error?.details || '');
  const text = `${message} ${details}`;
  return ['42703', 'PGRST204'].includes(error?.code) &&
    /selection_meta/i.test(text);
}

function isMissingLearningProgressSchema(error) {
  return error?.code === '42P01' ||
    /user_question_progress|schema cache|relation .* does not exist/i.test(error?.message || '');
}

function isMissingInteractionsSchema(error) {
  return error?.code === '42P01' ||
    /question_interactions|schema cache|relation .* does not exist/i.test(error?.message || '');
}

function isPaidSaleRow(row) {
  return Boolean(row?.payment_id) &&
    PAID_SALE_STATUSES.has(row?.status) &&
    Number(row?.amount_paid) > 0;
}

function getDifficultyWeight(difficulty) {
  return { easy: 1, medium: 2, hard: 3 }[String(difficulty || '').toLowerCase()] || 2;
}

function validateMockSet(rows, count) {
  if (!rows.length) return { ok: false, reason: 'empty_pool' };
  const ids = new Set(rows.map((r) => r.id));
  if (ids.size !== rows.length) return { ok: false, reason: 'duplicate_ids' };
  const subjects = new Set(rows.map((r) => r.subject));
  if (subjects.size > 1) return { ok: false, reason: 'mixed_subjects' };
  if (rows.length < Math.ceil(count * 0.7)) return { ok: false, reason: 'pool_too_thin' };
  return { ok: true };
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
  selectionMeta: r.selection_meta || {},
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
    if ('premiumUntil' in updates) patch.premium_until = updates.premiumUntil;
    if ('razorpaySubscriptionId' in updates) patch.razorpay_subscription_id = updates.razorpaySubscriptionId;

    let { data, error } = await supabaseAdmin()
      .from('users').update(patch).eq('id', id).select('*').maybeSingle();
    if (error && isMissingEntitlementSchema(error)) {
      delete patch.premium_until;
      delete patch.razorpay_subscription_id;
      ({ data, error } = await supabaseAdmin()
        .from('users').update(patch).eq('id', id).select('*').maybeSingle());
    }
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
      amount_paid: payment.amountPaid ?? null,
      currency: payment.currency || 'INR',
      status: payment.status || 'created',
      creator_code: payment.creatorCode || null,
      creator_id: payment.creatorId || null,
      offer_id: payment.offerId || null,
      raw_order: payment.rawOrder || {},
      raw_subscription: payment.rawSubscription || {},
      raw_payment: payment.rawPayment || {},
    };
    if (payment.accessUntil !== undefined) row.access_until = payment.accessUntil || null;

    let { data, error } = await supabaseAdmin()
      .from('payments')
      .insert(row)
      .select('*')
      .single();
    if (error && isMissingEntitlementSchema(error)) {
      delete row.access_until;
      ({ data, error } = await supabaseAdmin()
        .from('payments')
        .insert(row)
        .select('*')
        .single());
    }
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
    if (updates.amountPaid !== undefined) patch.amount_paid = updates.amountPaid;
    if (updates.accessUntil !== undefined) patch.access_until = updates.accessUntil;
    if (updates.rawOrder !== undefined) patch.raw_order = updates.rawOrder || {};
    if (updates.rawPayment !== undefined) patch.raw_payment = updates.rawPayment || {};
    if (updates.rawSubscription !== undefined) patch.raw_subscription = updates.rawSubscription || {};

    let { data, error } = await supabaseAdmin()
      .from('payments')
      .update(patch)
      .eq('order_id', orderId)
      .select('*')
      .maybeSingle();
    if (error && isMissingEntitlementSchema(error)) {
      delete patch.access_until;
      ({ data, error } = await supabaseAdmin()
        .from('payments')
        .update(patch)
        .eq('order_id', orderId)
        .select('*')
        .maybeSingle());
    }
    if (error) throw error;
    return paymentOut(data);
  },

  async updatePaymentBySubscriptionId(subscriptionId, updates) {
    const patch = { updated_at: new Date().toISOString() };
    if (updates.paymentId !== undefined) patch.payment_id = updates.paymentId;
    if (updates.status !== undefined) patch.status = updates.status;
    if (updates.amountPaid !== undefined) patch.amount_paid = updates.amountPaid;
    if (updates.accessUntil !== undefined) patch.access_until = updates.accessUntil;
    if (updates.rawPayment !== undefined) patch.raw_payment = updates.rawPayment || {};
    if (updates.rawSubscription !== undefined) patch.raw_subscription = updates.rawSubscription || {};

    let { data, error } = await supabaseAdmin()
      .from('payments')
      .update(patch)
      .eq('subscription_id', subscriptionId)
      .select('*')
      .maybeSingle();
    if (error && isMissingEntitlementSchema(error)) {
      delete patch.access_until;
      ({ data, error } = await supabaseAdmin()
        .from('payments')
        .update(patch)
        .eq('subscription_id', subscriptionId)
        .select('*')
        .maybeSingle());
    }
    if (error) throw error;
    return paymentOut(data);
  },

  async hasOtherPaidSubscriptionEvidence({ userId, excludingSubscriptionId = null, excludingPaymentId = null } = {}) {
    if (!userId) return false;
    const { data, error } = await supabaseAdmin()
      .from('payments')
      .select('id, subscription_id, payment_id, status, amount_paid')
      .eq('user_id', userId)
      .not('payment_id', 'is', null)
      .gt('amount_paid', 0)
      .in('status', ['captured', 'completed', 'paid'])
      .limit(20);
    if (error) throw error;

    return (data || []).some((row) => {
      if (excludingSubscriptionId && row.subscription_id === excludingSubscriptionId) return false;
      if (excludingPaymentId && row.payment_id === excludingPaymentId) return false;
      return true;
    });
  },

  async hasRefundPremiumRevocation({ userId, subscriptionId = null, paymentId = null } = {}) {
    if (!userId || (!subscriptionId && !paymentId)) return false;
    const { data, error } = await supabaseAdmin()
      .from('audit_logs')
      .select('metadata')
      .eq('action', REFUND_REVOKED_PREMIUM_ACTION)
      .eq('target_type', 'user')
      .eq('target_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) {
      if (isMissingAuditSchema(error)) return false;
      throw error;
    }

    return (data || []).some((row) => refundRevocationMatchesPayment(row.metadata, { subscriptionId, paymentId }));
  },

  // =====================================================================
  // CREATORS / PAYOUTS / ATTRIBUTION
  // =====================================================================

  async listCreators({ activeOnly = false } = {}) {
    let query = supabaseAdmin().from('creators').select('*').order('created_at', { ascending: false });
    if (activeOnly) query = query.eq('is_active', true);
    const { data, error } = await query;
    if (error) {
      if (isMissingReferralSchema(error)) {
        console.error('[db] listCreators skipped because referral schema is missing:', error.message);
        return [];
      }
      throw error;
    }
    return (data || []).map(creatorOut);
  },

  async createCreator(input) {
    const row = {
      name: input.name,
      email: input.email || null,
      code: String(input.code || '').trim().toLowerCase(),
      offer_id: input.offerId || null,
      payout_per_sale: Number.isFinite(input.payoutPerSale) ? Math.round(input.payoutPerSale) : 2000,
      is_active: input.isActive !== false,
      notes: input.notes || null,
    };
    if (input.id) row.id = input.id;
    if (input.userId) row.user_id = input.userId;
    if (input.commissionRate != null) row.commission_rate = input.commissionRate;

    const { data, error } = await supabaseAdmin()
      .from('creators').insert(row).select('*').single();
    if (error) throw error;

    // Backfill the link if a user with this email already exists.
    // (Triggers cover the future direction — user signs up after the
    // creator row is created — but not this one.)
    if (data.email && !data.user_id) {
      const existingUser = await this.getUserByEmail(data.email);
      if (existingUser) {
        const { data: linked } = await supabaseAdmin()
          .from('creators').update({ user_id: existingUser.id })
          .eq('id', data.id).select('*').maybeSingle();
        if (existingUser.role !== 'admin' && existingUser.role !== 'moderator') {
          await supabaseAdmin().from('users')
            .update({ role: 'creator' })
            .eq('id', existingUser.id);
        }
        return creatorOut(linked || data);
      }
    }

    return creatorOut(data);
  },

  async updateCreator(id, updates) {
    const patch = {};
    if ('name' in updates) patch.name = updates.name;
    if ('email' in updates) patch.email = updates.email || null;
    if ('code' in updates) patch.code = String(updates.code || '').trim().toLowerCase();
    if ('offerId' in updates) patch.offer_id = updates.offerId || null;
    if ('payoutPerSale' in updates) patch.payout_per_sale = Math.round(Number(updates.payoutPerSale) || 0);
    if ('isActive' in updates) patch.is_active = Boolean(updates.isActive);
    if ('notes' in updates) patch.notes = updates.notes || null;
    if ('userId' in updates) patch.user_id = updates.userId || null;
    if (Object.keys(patch).length === 0) return await this.getCreatorById(id);

    const { data, error } = await supabaseAdmin()
      .from('creators').update(patch).eq('id', id).select('*').maybeSingle();
    if (error) throw error;
    return creatorOut(data);
  },

  async deleteCreator(id) {
    // Soft-delete by deactivating; never hard-delete because payouts FK.
    return this.updateCreator(id, { isActive: false });
  },

  async getCreatorByCode(code) {
    if (!code) return null;
    const trimmed = String(code).trim().toLowerCase();
    if (!trimmed) return null;
    const { data, error } = await supabaseAdmin()
      .from('creators')
      .select('*')
      .ilike('code', trimmed)
      .limit(1)
      .maybeSingle();
    if (error) {
      // Table may not exist yet — caller can fall back.
      if (isMissingReferralSchema(error)) return null;
      throw error;
    }
    return creatorOut(data);
  },

  async getCreatorById(id) {
    if (!id) return null;
    const { data, error } = await supabaseAdmin()
      .from('creators').select('*').eq('id', id).maybeSingle();
    if (error) {
      if (isMissingReferralSchema(error)) return null;
      throw error;
    }
    return creatorOut(data);
  },

  async getCreatorByUserId(userId) {
    if (!userId) return null;
    const { data, error } = await supabaseAdmin()
      .from('creators').select('*').eq('user_id', userId).maybeSingle();
    if (error) {
      if (isMissingReferralSchema(error)) return null;
      throw error;
    }
    return creatorOut(data);
  },

  async getCreatorByEmail(email) {
    if (!email) return null;
    const trimmed = String(email).trim().toLowerCase();
    if (!trimmed) return null;
    const { data, error } = await supabaseAdmin()
      .from('creators').select('*').ilike('email', trimmed).maybeSingle();
    if (error) {
      if (isMissingReferralSchema(error)) return null;
      throw error;
    }
    return creatorOut(data);
  },

  /**
   * Set or update creator_earning on a payment. Used by the earnings
   * helper after a payment becomes successful. Idempotent: if the
   * earning is already recorded, the function still updates (in case
   * payout_per_sale changed before the payout was bundled).
   */
  async setPaymentEarning(paymentId, earningPaise) {
    if (!paymentId) return null;
    const { data, error } = await supabaseAdmin()
      .from('payments')
      .update({ creator_earning: Math.max(0, Math.round(Number(earningPaise) || 0)) })
      .eq('id', paymentId)
      .is('payout_id', null)            // never touch already-paid-out rows
      .select('*')
      .maybeSingle();
    if (error) {
      if (isMissingReferralSchema(error)) return null;
      throw error;
    }
    return paymentOut(data);
  },

  async clearUnpaidEarningsForUnpaidPayments() {
    const { data, error } = await supabaseAdmin()
      .from('payments')
      .select('id, status, amount_paid, payment_id, creator_earning')
      .not('creator_earning', 'is', null);
    if (error) {
      if (isMissingReferralSchema(error)) return false;
      throw error;
    }

    const ids = (data || [])
      .filter((row) => !isPaidSaleRow(row))
      .map((row) => row.id);
    if (ids.length === 0) return true;

    const { error: updateError } = await supabaseAdmin()
      .from('payments')
      .update({ creator_earning: null })
      .in('id', ids)
      .is('payout_id', null);
    if (updateError) {
      if (isMissingReferralSchema(updateError)) return false;
      throw updateError;
    }
    return true;
  },

  async listOrders({ limit = 100, offset = 0, creatorId = null } = {}) {
    let query = supabaseAdmin()
      .from('payments')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (creatorId) query = query.eq('creator_id', creatorId);
    const { data, error } = await query;
    if (error) {
      if (isMissingReferralSchema(error)) {
        console.error('[db] listOrders skipped because referral schema is missing:', error.message);
        return [];
      }
      throw error;
    }
    return (data || []).map(paymentOut);
  },

  /**
   * Sum live KPIs by creator. One row per creator with at least one
   * successful payment. Used by both the admin dashboard "Creators"
   * table and the per-creator stats card.
   */
  async getCreatorStats(creatorId = null) {
    let query = supabaseAdmin()
      .from('payments')
      .select('creator_id, status, amount_paid, amount, creator_earning, payout_id, payment_id')
      .not('creator_id', 'is', null);
    if (creatorId) query = query.eq('creator_id', creatorId);
    const { data, error } = await query;
    if (error) {
      if (isMissingReferralSchema(error)) {
        console.error('[db] getCreatorStats skipped because referral schema is missing:', error.message);
        return [];
      }
      throw error;
    }

    const stats = new Map();
    for (const row of data || []) {
      const id = row.creator_id;
      if (!stats.has(id)) {
        stats.set(id, {
          creatorId: id,
          totalSales: 0,
          totalRevenuePaise: 0,
          totalEarningsPaise: 0,
          pendingPayoutPaise: 0,
          paidPayoutPaise: 0,
        });
      }
      const s = stats.get(id);
      if (!isPaidSaleRow(row)) continue;

      s.totalSales += 1;
      s.totalRevenuePaise += Number(row.amount_paid) || 0;
      const earning = Number(row.creator_earning) || 0;
      s.totalEarningsPaise += earning;
      if (row.payout_id) {
        s.paidPayoutPaise += earning;
      } else {
        s.pendingPayoutPaise += earning;
      }
    }
    return Array.from(stats.values());
  },

  /**
   * Aggregate platform-wide overview — one query for admin home cards.
   */
  async getPlatformOverview() {
    const { data: payments, error: pe } = await supabaseAdmin()
      .from('payments')
      .select('status, amount_paid, amount, creator_earning, payout_id, creator_id, payment_id');
    if (pe) {
      if (isMissingReferralSchema(pe)) {
        console.error('[db] getPlatformOverview using empty payment stats because schema is missing:', pe.message);
        return {
          totalRevenuePaise: 0,
          totalSales: 0,
          totalCreators: 0,
          activeCreators: 0,
          pendingPayoutPaise: 0,
          paidPayoutPaise: 0,
        };
      }
      throw pe;
    }

    const { data: creatorRows, error: ce } = await supabaseAdmin()
      .from('creators')
      .select('id, is_active');
    if (ce && !isMissingReferralSchema(ce)) throw ce;

    let totalRevenuePaise = 0;
    let totalSales = 0;
    let pendingPayoutPaise = 0;
    let paidPayoutPaise = 0;

    for (const row of payments || []) {
      if (!isPaidSaleRow(row)) continue;
      totalSales += 1;
      totalRevenuePaise += Number(row.amount_paid) || 0;
      const earning = Number(row.creator_earning) || 0;
      if (row.payout_id) paidPayoutPaise += earning;
      else pendingPayoutPaise += earning;
    }

    const totalCreators = (creatorRows || []).length;
    const activeCreators = (creatorRows || []).filter((c) => c.is_active).length;

    return {
      totalRevenuePaise,
      totalSales,
      totalCreators,
      activeCreators,
      pendingPayoutPaise,
      paidPayoutPaise,
    };
  },

  async listPayouts({ creatorId = null, limit = 100 } = {}) {
    let query = supabaseAdmin()
      .from('payouts').select('*')
      .order('created_at', { ascending: false }).limit(limit);
    if (creatorId) query = query.eq('creator_id', creatorId);
    const { data, error } = await query;
    if (error) {
      if (isMissingReferralSchema(error)) {
        console.error('[db] listPayouts skipped because payout schema is missing:', error.message);
        return [];
      }
      throw error;
    }
    return (data || []).map(payoutOut);
  },

  async createPayoutForCreator(creatorId, actorId) {
    await this.clearUnpaidEarningsForUnpaidPayments();
    const { data, error } = await supabaseAdmin().rpc('create_pending_payout', {
      p_creator_id: creatorId,
      p_actor_id: actorId || null,
    });
    if (error) throw error;
    return data; // payout id
  },

  // =====================================================================
  // WEBHOOK EVENTS (idempotency)
  // =====================================================================
  /**
   * Insert a webhook event row keyed by event_id. Returns true if this is
   * the first time we've seen this event_id (caller should process), false
   * if it's a duplicate (caller should no-op).
   */
  async claimWebhookEvent({ eventId, eventType, payload, provider = 'razorpay' }) {
    if (!eventId) throw new Error('eventId required');
    const { error } = await supabaseAdmin()
      .from('webhook_events')
      .insert({
        event_id: eventId,
        provider,
        event_type: eventType,
        payload: payload || {},
      });
    if (!error) return true;
    if (error.code === '23505') {
      const { data, error: readError } = await supabaseAdmin()
        .from('webhook_events')
        .select('processed_at, error_message')
        .eq('event_id', eventId)
        .maybeSingle();
      if (readError) throw readError;

      if (data?.error_message) {
        const { error: resetError } = await supabaseAdmin()
          .from('webhook_events')
          .update({
            event_type: eventType,
            payload: payload || {},
            processed_at: null,
            error_message: null,
          })
          .eq('event_id', eventId);
        if (resetError) throw resetError;
        return true;
      }

      return !data?.processed_at;
    }
    if (error.code === '42P01') return true;  // table not yet migrated — don't block prod
    throw error;
  },

  async markWebhookEventProcessed(eventId, errorMessage = null) {
    if (!eventId) return;
    const patch = { processed_at: new Date().toISOString() };
    patch.error_message = errorMessage;
    const { error } = await supabaseAdmin()
      .from('webhook_events')
      .update(patch)
      .eq('event_id', eventId);
    if (error && error.code !== '42P01') {
      console.error('[webhook] failed to mark event processed:', error.message);
    }
  },

  async markWebhookEventFailed(eventId, errorMessage = null) {
    if (!eventId) return;
    const { error } = await supabaseAdmin()
      .from('webhook_events')
      .update({
        processed_at: null,
        error_message: errorMessage || 'unknown error',
      })
      .eq('event_id', eventId);
    if (error && error.code !== '42P01') {
      console.error('[webhook] failed to mark event failed:', error.message);
    }
  },

  // =====================================================================
  // CREDITS (Atomic RPC calls)
  // =====================================================================
  async spendCredits(userId, action, reference) {
    // Allowed actions match the SQL CASE in spend_credits():
    //   'generate'     -> 10 credits (question generation)
    //   'attempt'      -> 10 credits (Quick Practice)
    //   'attempt_full' -> 50 credits (Full Mock)
    if (!['generate', 'attempt', 'attempt_full'].includes(action)) {
      throw new Error('Invalid credit spend action');
    }
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
    const mode = getMode(opts.mode || 'quick');
    const originalRequestedCount = Math.max(1, Math.min(100, Number(opts.requestedCount || count || mode.fixedCount || mode.defaultCount || 10)));
    const targetCount = mode.id === 'nta'
      ? NTA_QUESTION_COUNT
      : Math.max(1, Math.min(100, count || mode.fixedCount || mode.defaultCount || 10));
    const returnMeta = opts.returnMeta === true;

    const formatResult = async (rows, meta = {}) => {
      const selectedRows = Array.isArray(rows) ? rows : [];
      let rowsWithVotes = selectedRows;
      if (opts.userId && selectedRows.length > 0) {
        const voteMap = await this.getUserVotes(opts.userId, selectedRows.map((row) => row.id));
        rowsWithVotes = selectedRows.map((row) => ({ ...row, user_vote: voteMap.get(row.id) || null }));
      }
      const questions = rowsWithVotes.map(questionOut);
      if (!returnMeta) return questions;
      return {
        questions,
        meta: {
          mode: mode.id,
          requestedCount: originalRequestedCount,
          finalCount: mode.id === 'nta' && questions.length === targetCount ? NTA_QUESTION_COUNT : questions.length,
          selectedCount: questions.length,
          durationMinutes: mode.id === 'nta' ? NTA_DURATION_MINUTES : undefined,
          ...meta,
        },
      };
    };

    // Pull a generous candidate pool — enough to survive recency + concept caps.
    const poolSize = mode.id === 'nta' ? 5000 : Math.max(60, targetCount * 6);

    const fetchNtaPool = async () => {
      const pageSize = 1000;
      const rows = [];
      let useDeletedFilter = true;

      for (let offset = 0; offset < poolSize; offset += pageSize) {
        const end = Math.min(offset + pageSize - 1, poolSize - 1);
        let query = supabaseAdmin()
          .from('questions')
          .select('*')
          .eq('subject', subjectId)
          .order('created_at', { ascending: false })
          .range(offset, end);

        if (useDeletedFilter) query = query.eq('is_deleted', false);

        let { data, error } = await query;
        if (error && useDeletedFilter && error.code === '42703') {
          useDeletedFilter = false;
          ({ data, error } = await supabaseAdmin()
            .from('questions')
            .select('*')
            .eq('subject', subjectId)
            .order('created_at', { ascending: false })
            .range(offset, end));
        }
        if (error) throw error;

        const page = Array.isArray(data) ? data : [];
        rows.push(...page);
        if (page.length < pageSize) break;
      }

      return rows;
    };

    const buildQuery = (withScore) => {
      let query = supabaseAdmin()
        .from('questions')
        .select('*')
        .eq('subject', subjectId)
        .eq('is_deleted', false)
        .or(VISIBLE_QUESTION_FILTER);
      if (Array.isArray(opts.chapters) && opts.chapters.length > 0) query = query.in('chapter', opts.chapters);
      else if (opts.chapter) query = query.eq('chapter', opts.chapter);
      if (mode.allowDifficultyOverride && ['easy', 'medium', 'hard'].includes(opts.difficulty)) {
        query = query.eq('difficulty', opts.difficulty);
      }
      if (withScore) {
        query = query.gte('score', -2);
      }
      return query
        .order('created_at', { ascending: false })
        .order('score', { ascending: false })
        .limit(poolSize);
    };

    let pool = [];
    if (mode.id === 'nta') {
      pool = await fetchNtaPool();
    } else {
      let { data, error } = await buildQuery(true);
      if (error && isMissingPhase1VoteSchema(error)) {
        ({ data, error } = await buildQuery(false));
      }
      if (error) throw error;
      pool = Array.isArray(data) ? data : [];
    }
    if (mode.id === 'quick') {
      pool = pool.filter((row) => !isPassageLinkedQuestion(row));
    }
    if (mode.id === 'nta') {
      pool = await this._attachPassageMetadata(pool);
    }

    // Recency: drop questions seen in the user's last N attempts for this subject.
    let recencyFilteredCount = 0;
    if (opts.userId && mode.recencyLimit > 0) {
      const recentIds = await this._recentQuestionIds(opts.userId, subjectId, mode.recencyLimit);
      if (recentIds.size) {
        const trimmed = pool.filter((row) => !recentIds.has(row.id));
        // Only honour recency if we still have a viable pool afterwards.
        const minimumAfterRecency = mode.id === 'nta' ? targetCount : Math.ceil(targetCount * 0.7);
        if (trimmed.length >= minimumAfterRecency) {
          recencyFilteredCount = pool.length - trimmed.length;
          pool = trimmed;
        }
      }
    }

    if (pool.length === 0) {
      return formatResult([], {
        totalCandidates: 0,
        acceptedCandidates: 0,
        rejectedByReason: {},
        message: mode.id === 'nta'
          ? 'The database has fewer than 50 usable NTA questions for this subject.'
          : undefined,
      });
    }

    // Per-user signals for the priority stack.
    const progress = opts.userId
      ? await this._userProgress(opts.userId, pool.map((row) => row.id))
      : new Map();
    const weakConcepts = (mode.useWeakTopics && opts.userId)
      ? await this._weakConcepts(opts.userId, subjectId, mode.weakAccuracyThreshold || 0.6)
      : new Set();

    const ranked = rankCandidates(pool, { mode, progress, weakConcepts });
    if (mode.id === 'nta') {
      const { selectedRows, diagnostics } = await selectNtaQuestionSetWithAnswerVerification(ranked, targetCount, {
        subjectId,
        seed: opts.generationKey || opts.seed || '',
      });

      if (process.env.NODE_ENV !== 'production') {
        console.info('[nta-selector]', diagnostics);
      }

      return formatResult(selectedRows, {
        ...diagnostics,
      });
    }

    const selected = pickWithConstraints(ranked, targetCount, mode);
    const selectionUsage = buildSelectionUsageMeta({
      selectedRows: selected,
      candidatePool: pool,
      progress,
      mode,
      targetCount,
      recencyFilteredCount,
    });

    const validation = validateMockSet(selected, targetCount);
    if (!validation.ok && validation.reason === 'pool_too_thin') {
      console.warn('[mock] pool thin', { subject: subjectId, mode: mode.id, requested: targetCount, got: selected.length });
    }

    return formatResult(selected, {
      validation,
      selectionUsage,
    });
  },

  async _attachPassageMetadata(rows) {
    const list = Array.isArray(rows) ? rows : [];
    const groupIds = Array.from(new Set(
      list
        .map((row) => row.passage_group_id || row.group_id || null)
        .filter(Boolean)
    ));
    if (groupIds.length === 0) return list;

    const { data, error } = await supabaseAdmin()
      .from('passage_groups')
      .select('id, subject, chapter, title, passage_text, passage_type, status, discoverable')
      .in('id', groupIds);

    if (error) {
      if (error.code === '42P01' || error.code === '42703' || /passage_groups|schema cache|does not exist/i.test(error.message || '')) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[nta-selector] passage metadata unavailable:', error.message);
        }
        return list;
      }
      throw error;
    }

    const byId = new Map((data || [])
      .filter((group) => group?.status === 'live' && group?.discoverable !== false)
      .map((group) => [group.id, group]));

    return list.map((row) => {
      const group = byId.get(row.passage_group_id || row.group_id);
      if (!group) return row;
      return {
        ...row,
        passage_group_id: row.passage_group_id || group.id,
        passage_id: row.passage_id || group.id,
        passage_text: row.passage_text || group.passage_text,
        passage_title: row.passage_title || group.title,
        passage_type: row.passage_type || group.passage_type,
      };
    });
  },

  async _recentQuestionIds(userId, subjectId, lastN) {
    if (!userId || !lastN) return new Set();
    const { data, error } = await supabaseAdmin()
      .from('attempts')
      .select('questions_snapshot')
      .eq('user_id', userId)
      .eq('subject', subjectId)
      .order('completed_at', { ascending: false })
      .limit(lastN);
    if (error) {
      console.warn('[mock] recency lookup failed:', error.message);
      return new Set();
    }
    const ids = new Set();
    for (const row of data || []) {
      for (const q of row.questions_snapshot || []) {
        if (q && q.id) ids.add(q.id);
      }
    }
    return ids;
  },

  async _userProgress(userId, questionIds) {
    if (!userId || !Array.isArray(questionIds) || questionIds.length === 0) return new Map();
    const { data, error } = await supabaseAdmin()
      .from('user_question_progress')
      .select('question_id, attempt_count, correct_count, last_attempted_at')
      .eq('user_id', userId)
      .in('question_id', questionIds);
    if (error) {
      // Schema may not be present in older envs — degrade gracefully.
      return new Map();
    }
    return new Map((data || []).map((row) => [row.question_id, row]));
  },

  async _weakConcepts(userId, subjectId, threshold) {
    // Cheap aggregate. STEP 3 mandates JS-layer logic — no new SQL function.
    // 1. Pull this user's per-question progress rows for the subject.
    // 2. Look up concept_id for each question_id in a single batched query.
    // 3. Bucket by concept and flag those with >=3 attempts and accuracy < threshold.
    const { data: progressRows, error } = await supabaseAdmin()
      .from('user_question_progress')
      .select('question_id, attempt_count, correct_count')
      .eq('user_id', userId)
      .eq('subject', subjectId)
      .gt('attempt_count', 0);
    if (error || !progressRows?.length) return new Set();

    const ids = progressRows.map((row) => row.question_id);
    const { data: qRows, error: qError } = await supabaseAdmin()
      .from('questions')
      .select('id, concept_id')
      .in('id', ids);
    if (qError) return new Set();
    const conceptByQid = new Map((qRows || []).map((row) => [row.id, row.concept_id]));

    const buckets = new Map(); // concept_id -> { attempts, correct }
    for (const row of progressRows) {
      const concept = conceptByQid.get(row.question_id);
      if (!concept) continue;
      const bucket = buckets.get(concept) || { attempts: 0, correct: 0 };
      bucket.attempts += row.attempt_count || 0;
      bucket.correct += row.correct_count || 0;
      buckets.set(concept, bucket);
    }
    const weak = new Set();
    for (const [concept, b] of buckets.entries()) {
      if (b.attempts >= 3 && (b.correct / b.attempts) < threshold) weak.add(concept);
    }
    return weak;
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
    return this._attachQuestionReportMetadata(data.map(questionOut));
  },

  async _attachQuestionReportMetadata(questions) {
    const list = Array.isArray(questions) ? questions : [];
    const ids = list.map((question) => question?.id).filter(Boolean);
    if (ids.length === 0) return list;

    const { data, error } = await supabaseAdmin()
      .from('question_interactions')
      .select('question_id, user_id, interaction_type, created_at, metadata')
      .in('question_id', ids)
      .in('interaction_type', ['report', 'report_resolved'])
      .order('created_at', { ascending: false })
      .limit(1000);
    if (error) {
      if (isMissingInteractionsSchema(error)) return list;
      throw error;
    }

    const byQuestion = new Map();
    for (const event of data || []) {
      const bucket = byQuestion.get(event.question_id) || [];
      bucket.push(event);
      byQuestion.set(event.question_id, bucket);
    }

    return list.map((question) => {
      const events = byQuestion.get(question.id) || [];
      const latestResolvedAt = events
        .filter((event) => event.interaction_type === 'report_resolved')
        .reduce((latest, event) => Math.max(latest, new Date(event.created_at).getTime()), 0);
      const activeReports = events.filter((event) => (
        event.interaction_type === 'report' &&
        new Date(event.created_at).getTime() > latestResolvedAt
      ));
      if (activeReports.length === 0) return question;
      const latestReport = activeReports[0];
      return {
        ...question,
        reportCount: activeReports.length,
        latestReport: {
          userId: latestReport.user_id || null,
          createdAt: latestReport.created_at || null,
          metadata: latestReport.metadata || {},
        },
      };
    });
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
      difficulty_weight: getDifficultyWeight(q.difficulty || 'medium'),
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
      selection_meta: a.selectionMeta || {},
    };
    let { data, error } = await supabaseAdmin()
      .from('attempts').insert(row).select('*').single();
    if (error && isMissingAttemptSelectionSchema(error)) {
      delete row.selection_meta;
      ({ data, error } = await supabaseAdmin()
        .from('attempts').insert(row).select('*').single());
    }
    if (error) throw error;
    try {
      await this._recordAttemptProgress({
        userId: a.userId,
        subject: a.subject,
        details: a.details || [],
        questionsSnapshot: a.questionsSnapshot || [],
      });
    } catch (progressError) {
      console.warn('[attempts] progress update skipped:', progressError.message);
    }
    return attemptOut(data);
  },

  async _recordAttemptProgress({ userId, subject, details, questionsSnapshot }) {
    if (!userId || !Array.isArray(questionsSnapshot) || questionsSnapshot.length === 0) return;

    const detailsById = new Map((Array.isArray(details) ? details : [])
      .filter((detail) => detail?.qid)
      .map((detail) => [detail.qid, detail]));
    const questionsById = new Map();
    for (const question of questionsSnapshot) {
      if (question?.id && !questionsById.has(question.id)) questionsById.set(question.id, question);
    }
    const questionIds = [...questionsById.keys()];
    if (questionIds.length === 0) return;

    const { data: existingRows, error: readError } = await supabaseAdmin()
      .from('user_question_progress')
      .select('question_id, seen_count, attempt_count, correct_count, skip_count, last_selected_key, last_correct, best_dwell_ms, last_seen_at, last_attempted_at')
      .eq('user_id', userId)
      .in('question_id', questionIds);
    if (readError) {
      if (isMissingLearningProgressSchema(readError)) return;
      throw readError;
    }

    const existingById = new Map((existingRows || []).map((row) => [row.question_id, row]));
    const nowIso = new Date().toISOString();
    const rows = questionIds.map((questionId) => {
      const question = questionsById.get(questionId);
      const detail = detailsById.get(questionId);
      const answered = Number.isInteger(detail?.givenIndex);
      const existing = existingById.get(questionId) || {};
      return {
        user_id: userId,
        question_id: questionId,
        subject: question?.internalSubject || question?.subject || subject || null,
        chapter: question?.chapter || null,
        seen_count: Number(existing.seen_count || 0) + 1,
        attempt_count: Number(existing.attempt_count || 0) + (answered ? 1 : 0),
        correct_count: Number(existing.correct_count || 0) + (detail?.isCorrect === true ? 1 : 0),
        skip_count: Number(existing.skip_count || 0) + (answered ? 0 : 1),
        last_selected_key: answered ? optionKeyAt(question, detail.givenIndex) : existing.last_selected_key || null,
        last_correct: answered ? detail?.isCorrect === true : existing.last_correct ?? null,
        best_dwell_ms: existing.best_dwell_ms || null,
        last_seen_at: nowIso,
        last_attempted_at: answered ? nowIso : existing.last_attempted_at || null,
        updated_at: nowIso,
      };
    });

    const { error: writeError } = await supabaseAdmin()
      .from('user_question_progress')
      .upsert(rows, { onConflict: 'user_id,question_id' });
    if (writeError) {
      if (isMissingLearningProgressSchema(writeError)) return;
      throw writeError;
    }
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
