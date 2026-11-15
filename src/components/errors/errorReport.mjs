// Tells the app's own error log (POST /api/app/errors, src/lib/server/appErrors.js) that a screen crashed, once per error,
// from the error pages. The collector was built for the Android app; this is its web sender.
//
// What leaves the browser: the error's type and message with every quoted part taken out (a message can quote the text it
// failed to read, and that can be a student's own words), the stack's frame lines only (code locations), the page's path
// without its query, Next's digest, the release and a coarse device class. Never an answer, a question, a name or an id.
// The server then checks sign-in and the usage-data consent, scrubs every field again and keeps no user id; a guest's report
// is refused there (401), which is fine.
//
// It never throws, never retries, never reports the same error twice and sends at most MAX_REPORTS_PER_LOAD per page load,
// so a page that keeps crashing cannot flood the log or loop.
import { referenceOf } from './errorCopy.mjs';

export const ERROR_ENDPOINT = '/api/app/errors';
export const MAX_REPORTS_PER_LOAD = 5;
const MAX_MESSAGE_CHARS = 300;
const MAX_FRAMES = 12;
const MAX_STACK_CHARS = 3000;

function text(value) {
  return typeof value === 'string' ? value : '';
}

// "Unexpected token 'T', "The answer is..." is not valid JSON" keeps its shape and loses the quoted words.
export function cleanMessage(error) {
  let name = '';
  let message = '';
  try {
    name = text(error?.name).slice(0, 40) || 'Error';
    message = text(error?.message) || (typeof error === 'string' ? error : '');
  } catch {
    name = 'Error';
  }
  const unquoted = message
    .slice(0, 2000)
    .replace(/"(?:[^"\\\n]|\\.)*"?/g, '"…"')
    .replace(/`(?:[^`\\]|\\.)*`?/g, '`…`')
    .replace(/'(?:[^'\\\n]|\\.){25,}'?/g, "'…'")
    .replace(/\s+/g, ' ')
    .trim();
  const line = unquoted ? `${name}: ${unquoted}` : name;
  return Array.from(line).slice(0, MAX_MESSAGE_CHARS).join('');
}

// Only the lines that are frames ("at fn (file:1:2)" in Chrome, "fn@file:1:2" in Firefox and Safari); the first line of a
// Chrome stack repeats the message and is dropped with everything else that is not a frame.
export function stackFrames(stack) {
  const frames = [];
  for (const raw of text(stack).split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (/^at\s/.test(line) || /@\S*:\d+:\d+\)?$/.test(line)) {
      frames.push(line.replace(/\?[^\s):]*/g, ''));
      if (frames.length >= MAX_FRAMES) break;
    }
  }
  return frames.join('\n').slice(0, MAX_STACK_CHARS);
}

// The path only: a query or a fragment can carry a paper's key.
export function screenOf(pathname) {
  const path = text(pathname).split(/[?#]/)[0];
  return path.startsWith('/') ? path.slice(0, 120) : null;
}

export function deviceClassOf({ coarse = false, shortSide = 0 } = {}) {
  if (!coarse) return 'other';
  return shortSide > 0 && shortSide < 600 ? 'phone' : 'tablet';
}

const BUILD = /^[0-9A-Za-z._+-]{1,16}$/;

/** One report in the collector's shape (normalizeError in src/lib/server/appErrors.js). */
export function buildReport(error, { pathname = '', where = 'page', coarse = false, shortSide = 0, build = '' } = {}) {
  const reference = referenceOf(error);
  // The digest is written as one word ("digest_123"), so the server's scrubber does not take a long number for a phone number.
  const message = `${cleanMessage(error)} [web ${where}${reference ? ` digest_${reference}` : ''}]`;
  const frames = (() => { try { return stackFrames(error?.stack); } catch { return ''; } })();
  const report = {
    kind: 'other',
    platform: 'web',
    message,
    screen: screenOf(pathname),
    device_class: deviceClassOf({ coarse, shortSide }),
    count: 1,
  };
  if (frames) report.stack = frames;
  if (BUILD.test(text(build))) report.build = build;
  return report;
}

/**
 * A reporter with its own memory: `send(body)` does the request and may throw or reject; the reporter swallows both.
 * Returns report(error, context) -> true when a report was handed to send, false when it was skipped.
 */
export function createReporter({ send, limit = MAX_REPORTS_PER_LOAD } = {}) {
  const seenErrors = new WeakSet();
  const seenSignatures = new Set();
  let sent = 0;
  return function report(error, context = {}) {
    try {
      if (typeof send !== 'function' || sent >= limit) return false;
      if (error && typeof error === 'object') {
        if (seenErrors.has(error)) return false;
        seenErrors.add(error);
      }
      const body = buildReport(error, context);
      const signature = `${body.screen}|${body.message}|${(body.stack || '').split('\n')[0]}`;
      if (seenSignatures.has(signature)) return false;
      seenSignatures.add(signature);
      sent += 1;
      const pending = send({ errors: [body] });
      if (pending && typeof pending.catch === 'function') pending.catch(() => {});
      return true;
    } catch {
      return false;
    }
  };
}

function browserSend(body) {
  return fetch(ERROR_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    keepalive: true,
    body: JSON.stringify(body),
  }).then(() => undefined, () => undefined);
}

let browserReporter = null;

/** For the error pages: report this error once. `where` names the boundary: root, app, paper or global. */
export function reportError(error, where = 'page') {
  try {
    if (typeof window === 'undefined' || typeof fetch !== 'function') return false;
    browserReporter ||= createReporter({ send: browserSend });
    let coarse = false;
    let shortSide = 0;
    try { coarse = window.matchMedia('(pointer: coarse)').matches; } catch { coarse = false; }
    try { shortSide = Math.min(window.screen.width, window.screen.height) || 0; } catch { shortSide = 0; }
    return browserReporter(error, {
      pathname: window.location.pathname,
      where,
      coarse,
      shortSide,
      build: (process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || '').slice(0, 12),
    });
  } catch {
    return false;
  }
}
