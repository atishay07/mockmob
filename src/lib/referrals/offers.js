import 'server-only';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * Resolve a user-entered creator code to a Razorpay offer_id and creator id.
 *
 * Lookup strategy:
 *   1. `creators` table (DB-managed; Phase B admin UI populates this).
 *   2. STATIC_OFFER_MAP — temporary fallback so the system works
 *      immediately without depending on an admin dashboard. To onboard
 *      a creator without DB access, add an entry here. Once a creator
 *      lands in the `creators` table, remove the static entry — DB wins.
 *
 * Always returns either a populated object or `null` — never throws on
 * invalid input. Callers can attach the offer_id to the subscription
 * payload conditionally:
 *
 *     const creator = await resolveCreatorCode(rawCode);
 *     razorpay.subscriptions.create({
 *       plan_id, total_count, customer_notify,
 *       ...(creator?.offerId ? { offer_id: creator.offerId } : {}),
 *     });
 */

const FLASH_69_OFFER_ID = 'offer_Sl0iH8LNWcFE7Y';

// Hardcoded fallback. Codes are matched case-insensitively (key is lowercase).
const STATIC_OFFER_MAP = {
  rahul: { offerId: 'offer_SjGiVehyf7X33K', creatorId: null },
  hey30: { offerId: FLASH_69_OFFER_ID, creatorId: null },
  flash68: { offerId: FLASH_69_OFFER_ID, creatorId: null },
  flash69: { offerId: FLASH_69_OFFER_ID, creatorId: null },
};

const CODE_PATTERN = /^[a-z0-9._-]{1,64}$/;
const OFFER_ID_PATTERN = /^offer_[A-Za-z0-9]{6,64}$/;
const DIRECT_OFFER_IDS = new Set([FLASH_69_OFFER_ID]);

export function normalizeCode(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (OFFER_ID_PATTERN.test(trimmed)) return trimmed;

  const code = trimmed.toLowerCase().replace(/\s+/g, '');
  if (!CODE_PATTERN.test(code)) return null;
  return code;
}

/**
 * @param {string|null|undefined} rawCode
 * @returns {Promise<{ code: string, offerId: string, creatorId: string|null } | null>}
 */
export async function resolveCreatorCode(rawCode) {
  const code = normalizeCode(rawCode);
  if (!code) return null;

  if (DIRECT_OFFER_IDS.has(code)) {
    return {
      code: 'flash69',
      offerId: code,
      creatorId: null,
      status: 'offer_attached',
      reason: 'Razorpay flash discount offer attached',
    };
  }

  // 1) DB lookup — case-insensitive on the trimmed code.
  try {
    const { data, error } = await supabaseAdmin()
      .from('creators')
      .select('id, code, offer_id, is_active')
      .ilike('code', code)
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      if (!data.is_active) {
        return {
          code,
          offerId: null,
          creatorId: null,
          status: 'inactive',
          reason: 'Creator code exists but is inactive',
        };
      }

      const fallbackOffer = STATIC_OFFER_MAP[code]?.offerId || null;
      const offerId = data.offer_id || fallbackOffer;

      return {
        code: data.code.trim().toLowerCase(),
        offerId,
        creatorId: data.id,
        status: offerId ? 'offer_attached' : 'tracked_no_offer',
        reason: offerId
          ? 'Razorpay discount offer attached'
          : 'Referral tracked without Razorpay discount offer',
      };
    }
  } catch (e) {
    // Table might not exist on first deploy (pre-0032). Fall back silently.
    console.warn('[offers] DB lookup failed, falling back to static map:', e?.message);
  }

  // 2) Static fallback.
  const staticHit = STATIC_OFFER_MAP[code];
  if (staticHit?.offerId) {
    return {
      code,
      offerId: staticHit.offerId,
      creatorId: staticHit.creatorId,
      status: 'offer_attached',
      reason: 'Static Razorpay discount offer attached',
    };
  }

  return {
    code,
    offerId: null,
    creatorId: null,
    status: 'unknown',
    reason: 'Referral code was not found',
  };
}
