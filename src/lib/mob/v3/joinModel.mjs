// The public invite page for Mob v3 (/join/<code>): what it knows, what it says and which seat picture it draws.
// Pure: no I/O, no React. The page (components/mob/JoinMob.jsx and components/mob/join/) draws from this file, and
// data/tests/mob_join_v3_1020.test.mjs holds the copy lint over it.
//
// Privacy (SOCIAL-SPEC P1, P3, judge F7): the preview is the Mob's name, its subject and how many seats are taken. Never a
// member name, never a Fold someone sits as. The seats that are taken are drawn as neutral silhouettes for that reason.
import { MAX_MEMBERS } from '../model.mjs';
import { DenCopy } from './denCopy.mjs';
import { parseJoinInput } from './denModel.mjs';

export const SEATS = MAX_MEMBERS;
// Decorative silhouettes for taken seats: the four starters and Hop's outline, so the row reads as a group, not as people.
export const SILHOUETTE_FOLDS = Object.freeze(['dart', 'hexa', 'dogear', 'kandil', 'hop']);

/** A code from the link or the box: a 6 or 8-character code, spaced, hyphenated or lower case, or a whole invite link. */
export const codeFromParam = (raw) => parseJoinInput(raw).code;

/**
 * The page state from the lookup and the session.
 * status: loading | valid | invalid | expired | full | paused | error.
 * Returns one of: loading, out (a valid invite, signed out), in (a valid invite, signed in), or the failure state itself.
 */
export function joinView({ status, signedIn, authLoading = false }) {
  if (status !== 'valid') return status;
  if (authLoading) return 'loading-auth';
  return signedIn ? 'in' : 'out';
}

/** An invite the server answered with the Mob's name is a Mob v3 invite; without one the weekly-paper page stays. */
export const isV3Invite = (info) => Boolean(info && typeof info.name === 'string' && info.name.trim());

/** The seats taken, from the server's `size` (or `seatsLeft`), kept between 0 and 5. */
export function takenSeats(info) {
  const n = Number.isFinite(info?.size) ? info.size : SEATS - (Number(info?.seatsLeft) || 0);
  return Math.max(0, Math.min(SEATS, Math.round(n)));
}

/**
 * Five seats, left to right. mode: 'invite' (taken seats, then yours, then open ones), 'full' (all taken), 'empty' (no seats drawn).
 * Your seat is `you` when a signed-in student sits there as the Fold they picked, `yours` (dashed, named "Your seat") when signed out.
 */
export function seatPlan({ taken = 0, signedIn = false, mode = 'invite' } = {}) {
  if (mode === 'empty') return [];
  if (mode === 'full') return Array.from({ length: SEATS }, (_, i) => ({ kind: 'taken', i }));
  const n = Math.max(0, Math.min(SEATS - 1, taken));
  return Array.from({ length: SEATS }, (_, i) => ({ kind: i < n ? 'taken' : i === n ? (signedIn ? 'you' : 'yours') : 'open', i }));
}

export const JoinCopy = Object.freeze({
  title: 'You are invited to a Mob',
  // The valid invite
  outTitle: (name) => `A friend saved you a seat in ${name}.`,
  inTitle: (name, inviter) => (inviter ? `${inviter} saved you a seat in ${name}.` : `You are invited to ${name}.`),
  lede: DenCopy.d0Lead,
  seatsLine: (subjectName, taken) => `${subjectName}, ${DenCopy.seatsTaken(taken)}`,
  stepFirst: 'First',
  stepFirstLine: 'Create your free account with Google or an email code. It takes about a minute.',
  stepThen: 'Then',
  stepThenLine: 'Pick your Fold and take your seat. You land in the den with your Mob.',
  signUpKey: (name) => `Sign up to join ${name}`,
  opening: 'Opening sign-up',
  haveAccount: 'Already have an account?',
  signIn: 'Sign in',
  tryFirst: 'Not ready yet? Try 5 CUET questions first.',
  yourSeat: 'Your seat',
  you: DenCopy.you,
  pickWho: DenCopy.pickWho,
  nameLabel: DenCopy.joinYourName,
  nameHint: DenCopy.nameHint,
  nameNote: DenCopy.nameNote,
  nameRule: DenCopy.nameRule,
  fineOut: 'MockMob never asks for your contacts. Only your Mob sees your name, and you can leave any time.',
  fineIn: 'One switch in Mob settings keeps your marks private. MockMob never asks for your contacts, and you can leave any time.',
  joinKey: DenCopy.joinKey,
  joining: DenCopy.joining,
  checking: 'Checking the invite',
  // The states that are not an invite, each with its own words and one way forward
  invalidTitle: 'This invite does not look right.',
  invalidLine: 'The code may have a typo, or the link may have been cut short when it was shared. Check it with your friend, or type the code below.',
  expiredTitle: 'This invite has expired.',
  expiredLine: 'An invite lasts 7 days, and a newer link replaces an older one. Ask your friend to send a new link from their Mob.',
  fullTitle: 'This Mob is full.',
  fullLine: 'It has 5 members, the most a Mob can have. Ask your friend to tell you if a seat opens, or start a Mob of your own and invite your friends to it.',
  pausedTitle: 'Joining is paused for now.',
  pausedLine: 'New members cannot join a Mob by link just now. Keep this link and try it again later.',
  errorTitle: 'The invite did not load.',
  tryAgain: 'Try again',
  codeLabel: 'Have a different code?',
  codeCheck: 'Check the code',
  codeBad: 'A code has 6 characters, or 8 on an older invite. Letters and numbers only.',
  startOwn: DenCopy.joinStartOwn,
  openMobs: 'Open your Mobs',
  home: 'Go to MockMob',
});
