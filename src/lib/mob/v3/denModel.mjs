// The web den's decisions, pure so node tests hold them (MOB-BUILD-SPEC-V3 5.3 D1 to D6, J1, K1 to K5).
// Every number the den draws comes from a server field (house rule); this file only chooses which state to show,
// which game the card carries, and the order the moments play in. Nothing here counts non-players (F2, spec 6.2).
import { normalizeCode } from '../model.mjs';

export const FOLD_POSES = Object.freeze(['idle', 'cheer', 'think']); // shipped stills (FINAL-ART.md); shrug and wave fall back to idle
export const FOLD_KEYS_WEB = Object.freeze(['dart', 'dogear', 'hexa', 'kandil', 'hop', 'crane', 'stamp', 'naav', 'tally', 'patang', 'sticky', 'cutting']);
export const STARTER_FOLDS = Object.freeze(['dart', 'dogear', 'hexa', 'kandil']);
export const COLOUR_COUNT_V3 = 8;

/** The still for a Fold and a pose: a missing pose falls back to idle; an unknown Fold has no art (the caller draws the initial disc). */
export function foldSrc(key, pose = 'idle', size = 256) {
  if (!FOLD_KEYS_WEB.includes(key)) return null;
  const p = FOLD_POSES.includes(pose) ? pose : 'idle';
  const s = size >= 512 && (p === 'idle' || p === 'cheer') ? 512 : 256;
  return `/mob/folds/fold-${key}-${p}@${s}.webp`;
}
export const foldBlinkSrc = (key) => (FOLD_KEYS_WEB.includes(key) ? `/mob/folds/fold-${key}-idle-blink@256.webp` : null);
export const foldHeadSrc = (key, size = 128) => (FOLD_KEYS_WEB.includes(key) ? `/mob/folds/fold-${key}-head@${size >= 256 ? 256 : 128}.webp` : null);

const ms = (iso) => { const t = Date.parse(iso); return Number.isFinite(t) ? t : Infinity; };

/** The games still open, closing soonest first. */
export function openGames(v3) {
  return (v3?.games || []).filter((g) => g && !g.closed).sort((a, b) => ms(a.closesAt) - ms(b.closesAt));
}

/**
 * Which den state to draw and the game its card carries.
 *   kind: 'live' (D4, a room in its lobby) | 'room_running' (D4, the room started: play it as an async run)
 *         | 'open' (D2, a game you have not finished) | 'played' (D3, you finished, the game is still open)
 *         | 'quiet' (D1, nothing open, you can start) | 'ask' (D1, nothing open and your start is used)
 *   one: true for a Mob of one (D5): the invite card leads, the card below still follows the rules above.
 *   more: how many other open games there are (the "2 more games are open" link).
 */
export function denState(v3) {
  const games = openGames(v3);
  const one = (v3?.members || []).length <= 1;
  const room = games.find((g) => g.room && (g.room.state === 'lobby' || g.room.state === 'running'));
  const unplayed = games.find((g) => g.yourRun !== 'finished');
  const pick = room || unplayed || games[0] || null;
  const more = pick ? games.length - 1 : 0;
  if (!pick) return { kind: v3?.starts && v3.starts.can === false ? 'ask' : 'quiet', game: null, more: 0, one };
  if (pick === room && pick.yourRun !== 'finished') return { kind: room.room.state === 'lobby' ? 'live' : 'room_running', game: pick, more, one };
  return { kind: pick.yourRun === 'finished' ? 'played' : 'open', game: pick, more, one };
}

/** Your finished run's time in a game, from the runs row (finished runs only). */
export function yourRunAt(game, youId) {
  return (game?.runs || []).find((r) => r.memberId === youId)?.at || null;
}

/** The order moments play in (spec 5.6): quest done, week stitched, reveal, milestone. Unknown keys are dropped. */
const MOMENT_RANK = { quest_done: 0, stitch: 1, reveal: 2, chain: 3 };
export function momentQueue(keys) {
  const out = [];
  for (const [i, key] of (keys || []).entries()) {
    if (typeof key !== 'string') continue;
    const kind = key.split(':')[0];
    if (!(kind in MOMENT_RANK)) continue;
    const parts = key.split(':');
    const m = { key, kind, i };
    if (kind === 'reveal') m.fold = parts[1];
    if (kind === 'chain') m.days = Number(parts[1]) || 0;
    if (kind === 'quest_done' || kind === 'stitch') m.week = parts[parts.length - 1];
    out.push(m);
  }
  return out.sort((a, b) => MOMENT_RANK[a.kind] - MOMENT_RANK[b.kind] || a.i - b.i);
}

/**
 * A join code from what was typed or pasted: a 6 or 8-character code, spaced or hyphenated, or a whole invite link.
 * Returns { code, chars } where chars is the cleaned characters so far (for the boxes) and code is the full valid code
 * or null.
 */
export function parseJoinInput(raw) {
  let s = String(raw || '').trim();
  const link = /\/join\/([0-9A-Za-z\s-]{4,16})/.exec(s);
  if (link) s = link[1];
  const chars = s.toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1').slice(0, 8);
  return { chars, code: normalizeCode(chars) };
}

/** How many boxes the join code shows: 6, growing to 8 for an old code. */
export const joinBoxes = (chars) => (String(chars || '').length > 6 ? 8 : 6);

/** The quest bar's 12 segments: full ones, and the fraction of the next. Past the goal the bar is full (F8). */
export function questSegments(quest, n = 12) {
  const target = Math.max(1, Number(quest?.target) || 0);
  const answered = Math.max(0, Number(quest?.answered) || 0);
  const exact = Math.min(n, (answered / target) * n);
  return { full: Math.floor(exact), part: exact - Math.floor(exact), n };
}

/** Each member's share of the quest, as the C2 line says it ("Sized for 4 of you: 15 each"). */
export const questEach = (quest) => Math.max(1, Math.round((Number(quest?.target) || 0) / Math.max(1, Number(quest?.sizedFor) || 1)));

/** The WhatsApp share link for an invite message (no number: the student picks the chat). */
export const whatsAppHref = (text) => `https://wa.me/?text=${encodeURIComponent(text)}`;

/** The K5 pass notice still to show: the newest "rested" notice not yet seen, at most one a day. */
export function passNotice(chain, seen = []) {
  if (!chain || chain.hidden) return null;
  const list = (chain.notices || []).filter((n) => n && n.kind === 'rested' && !seen.includes(n.key));
  return list.length ? list[list.length - 1] : null;
}

/** The six names on show: page 0 is the first six, and so on, wrapping. */
export function namePage(names, page, size = 6) {
  const pages = Math.max(1, Math.ceil(names.length / size));
  const p = ((page % pages) + pages) % pages;
  return { names: names.slice(p * size, p * size + size).map((text, i) => ({ key: p * size + i, text })), page: p, pages };
}

/** The Folds a student can sit as at start or join: the four starters plus any owned (from the shelf), starters first. */
export function pickableFolds(shelf) {
  const owned = (shelf?.folds || []).filter((f) => f.owned).map((f) => f.key);
  return [...STARTER_FOLDS, ...owned.filter((k) => !STARTER_FOLDS.includes(k))];
}

/** Live is offered only when the server says it is on (spec 5.3 P2); outside hours it shows the hours line instead. */
export function liveOffer(v3) {
  const on = Boolean(v3?.live?.enabled) && (v3?.starts?.modes || []).includes('live');
  return { show: Boolean(v3?.live?.enabled), can: on && v3.live.hoursOk !== false, hoursOk: v3?.live?.hoursOk !== false };
}
