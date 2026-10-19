// Sticker flights in the den (MOB-BUILD-SPEC-V3 M12, 2.5; BRAND-MOTION-KIT "Sticker send"; MOB-ARENA "Send a sticker").
// Pure rules, shared by the den and its tests:
//   - Stickers are the server's fixed enum (STICKERS in denCopy.mjs). A kind outside it is never drawn: no free text.
//   - A send is spaced 3 s from the one before on this device; a tap inside the gap does nothing (no error, no toast).
//   - At most 3 stickers are on the stage at once; a fourth retires the oldest.
//   - A friend's sticker flies once per browser session, only while it is recent (12 hours), never your own.
//   - Your own send lifts off the key you tapped and flies an arc to the lamp-lit spot over your Fold, then sticks there.
import { STICKERS } from './denCopy.mjs';

export const STICKER_SPACING_MS = 3000;
export const STICKERS_VISIBLE = 3;
export const RECEIVED_WINDOW_MS = 12 * 60 * 60 * 1000;
export const FLIGHT_MS = 620;
export const RISE_MS = 420;
export const HOLD_MS = 1800;
export const FADE_MS = 300;
export const REDUCED_FADE_MS = 120;
// Received stickers wait for the den's own entrance (M1 ends at about 1100 ms), then fly 320 ms apart.
export const RECEIVED_AFTER_MS = 1100;
export const RECEIVED_STEP_MS = 320;

export const isStickerKind = (kind) => typeof kind === 'string' && Object.prototype.hasOwnProperty.call(STICKERS, kind);
export const stickerWords = (kind) => (isStickerKind(kind) ? STICKERS[kind] : null);

/** True when a new send may go: the first one, or 3 s or more after the last one on this device. */
export function canSendSticker(lastSentAt, now) {
  if (!Number.isFinite(lastSentAt)) return true;
  return now - lastSentAt >= STICKER_SPACING_MS;
}

export const reactionKey = (r) => `${r.memberId}:${r.kind}:${r.at}`;

/**
 * The friends' stickers that should fly now: recent, from a member still in the Mob, of a known kind, not yours,
 * not flown before in this session. Oldest first, at most STICKERS_VISIBLE (the newest ones).
 */
export function freshReactions(reactions, { youId = null, now = Date.now(), flown = new Set(), memberIds = null } = {}) {
  const out = [];
  for (const r of Array.isArray(reactions) ? reactions : []) {
    if (!r || typeof r.memberId !== 'string' || !isStickerKind(r.kind)) continue;
    if (youId && r.memberId === youId) continue;
    if (memberIds && !memberIds.has(r.memberId)) continue;
    const at = Date.parse(r.at);
    if (!Number.isFinite(at) || now - at > RECEIVED_WINDOW_MS || at - now > 60_000) continue;
    if (flown.has(reactionKey(r))) continue;
    out.push({ ...r, t: at });
  }
  out.sort((a, b) => a.t - b.t);
  return out.slice(-STICKERS_VISIBLE).map(({ t, ...r }) => r);
}

/** Add a sticker to the stage list, retiring the oldest so no more than `max` show. */
export function pushVisible(list, item, max = STICKERS_VISIBLE) {
  const next = [...list.filter((x) => x.id !== item.id), item];
  return next.length > max ? next.slice(next.length - max) : next;
}

// emphasized (0.2, 0, 0, 1): fast out of the hand, a long soft landing.
function cubic(x1, y1, x2, y2) {
  const bx = (t) => 3 * x1 * t * (1 - t) ** 2 + 3 * x2 * t ** 2 * (1 - t) + t ** 3;
  const by = (t) => 3 * y1 * t * (1 - t) ** 2 + 3 * y2 * t ** 2 * (1 - t) + t ** 3;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (bx(mid) < x) lo = mid; else hi = mid; }
    return by((lo + hi) / 2);
  };
}
export const emphasized = cubic(0.2, 0, 0, 1);

/**
 * The flight from the key (its bottom centre) to the spot over the Fold (bottom centre), as keyframes for the Web
 * Animations API: a quadratic arc that rises above both ends (so the eye sees where it went), a 4 degree lift tilt that
 * settles to the sticker's own tilt, a swell to 1.1 at the top and a small landing (0.9, it sticks small) at the end.
 * Positions are offsets from the start point. `steps` keyframes, eased along the path.
 */
export function flightFrames(from, to, { steps = 16, tilt = 0 } = {}) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  // The control point sits 2 x lift over the higher end, so the path tops out above the spot and drops onto it.
  const lift = Math.max(36, Math.min(90, Math.abs(dx) * 0.2 + Math.abs(dy) * 0.08));
  const cx = dx / 2;
  const cy = Math.min(0, dy) - 2 * lift;
  const frames = [];
  for (let i = 0; i <= steps; i++) {
    const offset = i / steps;
    const p = emphasized(offset);
    const x = 2 * (1 - p) * p * cx + p * p * dx;
    const y = 2 * (1 - p) * p * cy + p * p * dy;
    const swell = Math.sin(Math.PI * Math.min(1, p / 0.9));
    const scale = p < 0.9 ? 1 + 0.1 * swell : 1 - 0.1 * ((p - 0.9) / 0.1);
    const rotate = tilt + 4 * Math.sin(Math.PI * p);
    frames.push({ offset, x: Math.round(x * 10) / 10 || 0, y: Math.round(y * 10) / 10 || 0, scale: Math.round(scale * 1000) / 1000, rotate: Math.round(rotate * 100) / 100 });
  }
  return frames;
}

/** A small fixed tilt per kind (the app's PaperSticker.tiltOf), so a row reads as stuck-on paper, never a button bar. */
const TILTS = Object.freeze({ nice_one: -1.5, so_close: 1.2, teach_me: -0.8, again: 1.6, good_luck: 1.0, lets_go: -1.4, one_sec: 0.8, ready: -1.0 });
export const stickerTilt = (kind) => TILTS[kind] ?? 0;
