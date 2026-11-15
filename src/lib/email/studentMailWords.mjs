// The words and the look of the welcome and day-2 emails, and of the unsubscribe page. PURE: strings in, strings out.
//
// Copy rules (the owner's): plain, warm, short, sentence case; no exclamation marks, emoji, hype or arrows; one button; a
// 16 year old understands every word at first read; nothing the code cannot back:
//   "10 questions, about 10 minutes": the first set is a Quick set of 10 (src/lib/firstSet.mjs), timed at 60 s a question
//     (data/test_modes.js).
//   "You can stop any time": the runner's Leave is on every question and keeps every answer (firstSetNote says the same).
//   "Each one is explained on your result": the result explains every question lost (Today's Last paper says the same).
//   "N questions wrong or blank": counted from the set's own answers, less the ones already repaired.
// The look follows the sign-in email (src/app/api/auth/email-login/route.js): black on white, which survives Gmail's dark-mode
// colour inversion on Android, and a dark version from prefers-color-scheme for the mail apps that honour it.
import { FIRST_SET_COUNT, FIRST_SET_HREF, FIRST_SET_LABEL, firstSetHref } from '../firstSet.mjs';

export const SITE_NAME = 'www.mockmob.in';
const FIRST_SET_MINUTES = FIRST_SET_COUNT; // 60 s a question
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const setKey = (subjectName) => (subjectName ? `Start ${FIRST_SET_COUNT} ${subjectName} questions` : FIRST_SET_LABEL);
const setSize = `${FIRST_SET_COUNT} questions, about ${FIRST_SET_MINUTES} minutes`;
const STOP = 'You can stop any time.';

/** The result page, opened at the first open question (src/components/result/questionParam.mjs: ?q=N, counted from 1). */
export function resultPath(attemptId, position) {
  const q = Number.isInteger(position) && position > 0 && position < 10000 ? `?q=${position}` : '';
  return `/result/${encodeURIComponent(String(attemptId))}${q}`;
}

/**
 * The words of one email.
 *   kind 'welcome'                  no state
 *   kind 'day2'   state.kind 'first'   { subject (id), subjectName }
 *                 state.kind 'repair'  { attemptId, subjectName, open, position }
 *                 state.kind 'next'    { subject (id), subjectName }
 * -> { subject, preheader, heading, paras: [..], button, path, note, why }
 */
export function studentEmailWords(kind, state = {}) {
  if (kind === 'welcome') {
    return {
      subject: 'Welcome to MockMob',
      preheader: `Your first step: ${setSize}.`,
      heading: 'Welcome to MockMob',
      paras: [
        'Your account is ready. The best first step is one short set of CUET questions.',
        `It is ${setSize}. When you finish, your result explains every question you got wrong.`,
      ],
      button: FIRST_SET_LABEL,
      path: FIRST_SET_HREF,
      note: STOP,
      why: 'You are getting this because you just made a MockMob account with this email address.',
    };
  }
  if (kind !== 'day2') throw new Error('unknown_email_kind');
  const why = 'You are getting this because you made a MockMob account with this email address yesterday.';
  const name = typeof state.subjectName === 'string' && state.subjectName.trim() ? state.subjectName.trim() : '';
  if (state.kind === 'repair') {
    const n = Math.max(1, Math.trunc(Number(state.open)) || 1);
    const what = plural(n, 'question', 'questions');
    return {
      subject: `${what} from yesterday to fix`,
      preheader: `${n === 1 ? 'It is' : 'Each one is'} explained on your result.`,
      heading: `${what} left to fix`,
      paras: [
        `Your ${name ? `${name} ` : ''}set yesterday left ${what} wrong or blank. ${n === 1 ? 'It is' : 'Each one is'} explained on your result.`,
      ],
      button: n === 1 ? 'Go over your mistake' : 'Go over your mistakes',
      path: resultPath(state.attemptId, state.position),
      note: '',
      why,
    };
  }
  if (state.kind === 'next') {
    return {
      subject: 'Ready for today’s set?',
      preheader: `${setSize}.`,
      heading: 'Ready for today’s set?',
      paras: [
        'You finished a set yesterday and left nothing open.',
        `A set today counts toward your week: ${setSize}.`,
      ],
      button: setKey(name),
      path: firstSetHref(state.subject),
      note: STOP,
      why,
    };
  }
  return {
    subject: 'Your first set is ready when you are',
    preheader: `${setSize}. ${STOP}`,
    heading: 'Ready for your first set?',
    paras: [
      'You made your MockMob account yesterday. One short set shows you where you stand.',
      `It is ${setSize}, and your result explains every question you got wrong.`,
    ],
    button: setKey(name),
    path: firstSetHref(state.subject),
    note: STOP,
    why,
  };
}

// The tokens of the sign-in email: one ink, one quiet ink, one rule; the button is the only accent (volt in dark).
const DARK_CSS = `
      @media (prefers-color-scheme: dark) {
        .em-page { background:#10120d !important; }
        .em-ink { color:#f4f5ef !important; }
        .em-ink2 { color:#b9bdb0 !important; }
        .em-ink3 { color:#9a9e91 !important; }
        .em-rule { border-color:#2c3026 !important; }
        .em-btn { background:#d2f000 !important; color:#0b0c09 !important; }
        .em-link { color:#d9dccf !important; }
      }`;

/** The dark version for a preview: the same rules applied without the media query. */
export function forceDark(html) {
  return String(html).replace('@media (prefers-color-scheme: dark)', '@media all');
}

function shell({ title, preheader = '', body, lang = 'en' }) {
  return `<!doctype html>
<html lang="${lang}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <meta name="supported-color-schemes" content="light dark" />
    <title>${escapeHtml(title)}</title>
    <style>${DARK_CSS}
    </style>
  </head>
  <body class="em-page" style="margin:0;padding:0;background:#ffffff;">
    ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>` : ''}
    <table role="presentation" class="em-page" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
      <tr>
        <td align="center" style="padding:28px 16px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;font-family:Arial,Helvetica,sans-serif;">
            <tr>
              <td>
${body}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

const P = (cls, style, html) => `                <p class="${cls}" style="${style}">${html}</p>`;
const WORDMARK = P('em-ink', 'margin:0 0 24px;color:#111311;font-size:17px;font-weight:800;letter-spacing:-0.01em;', 'MockMob');
const H1 = (text) => `                <h1 class="em-ink" style="margin:0 0 14px;color:#111311;font-size:24px;line-height:1.25;font-weight:800;letter-spacing:-0.01em;">${escapeHtml(text)}</h1>`;
const BODY_P = (text, first) => P('em-ink2', `margin:${first ? '0' : '12px'} 0 0;color:#3f433a;font-size:16px;line-height:1.6;`, escapeHtml(text));
const BUTTON = (href, label) => `                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 0;">
                  <tr>
                    <td>
                      <a class="em-btn" href="${escapeHtml(href)}" style="display:inline-block;border-radius:999px;background:#111311;color:#ffffff;font-size:16px;font-weight:700;line-height:20px;text-decoration:none;padding:14px 24px;">${escapeHtml(label)}</a>
                    </td>
                  </tr>
                </table>`;
const RULE = `                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:32px 0 0;">
                  <tr><td class="em-rule" style="border-top:1px solid #e3e5dc;font-size:0;line-height:0;">&nbsp;</td></tr>
                </table>`;
const SMALL = (html, top = 10) => P('em-ink3', `margin:${top}px 0 0;color:#6b6f64;font-size:13px;line-height:1.6;`, html);

/**
 * One email, ready for the provider: { subject, html, text }.
 *   origin: the site's origin (links are absolute); unsubscribe: the signed one-click address.
 */
export function buildStudentEmail({ kind, state = {}, origin, unsubscribe }) {
  const w = studentEmailWords(kind, state);
  const base = String(origin || `https://${SITE_NAME}`).replace(/\/+$/, '');
  const link = `${base}${w.path}`;
  const off = `<a class="em-link" href="${escapeHtml(unsubscribe)}" style="color:#4a4e44;text-decoration:underline;">Turn off these emails</a>`;
  const body = [
    WORDMARK,
    H1(w.heading),
    ...w.paras.map((text, i) => BODY_P(text, i === 0)),
    BUTTON(link, w.button),
    w.note ? SMALL(escapeHtml(w.note), 12) : '',
    RULE,
    SMALL(`${escapeHtml(w.why)} This email is from MockMob, ${SITE_NAME}.`, 20),
    SMALL(`${off}. Sign-in codes still come when you ask for one.`, 8),
  ].filter(Boolean).join('\n');
  const html = shell({ title: w.subject, preheader: w.preheader, body });
  const text = [
    'MockMob',
    '',
    w.heading,
    '',
    ...w.paras.flatMap((p) => [p, '']),
    `${w.button}:`,
    link,
    ...(w.note ? ['', w.note] : []),
    '',
    '--',
    `${w.why} This email is from MockMob, ${SITE_NAME}.`,
    `Turn off these emails: ${unsubscribe}`,
    'Sign-in codes still come when you ask for one.',
  ].join('\n');
  return { subject: w.subject, html, text };
}

// --------------------------------------------------------------------------------------------------- the unsubscribe page
// The form's one button: the email button's look, as a real <button> that posts.
const SUBMIT = (action, label) => `                <form method="post" action="${escapeHtml(action)}" style="margin:26px 0 0;">
                  <input type="hidden" name="page" value="1" />
                  <button type="submit" class="em-btn" style="display:inline-block;border:0;border-radius:999px;background:#111311;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;line-height:20px;padding:14px 24px;cursor:pointer;">${escapeHtml(label)}</button>
                </form>`;

/**
 * The pages of the unsubscribe link. state:
 *   'confirm'  what opening the link shows: nothing is changed until the one button posts `action` (the same signed address),
 *              because mail scanners open links on their own
 *   'done' | 'invalid' | 'error'   after the post (or a bad link); `retry` is the signed link again (for 'error')
 */
export function unsubscribePage(state, { retry = '', origin = `https://${SITE_NAME}`, action = '' } = {}) {
  const home = String(origin || `https://${SITE_NAME}`).replace(/\/+$/, '');
  const pages = {
    confirm: {
      title: 'Turn off these emails?',
      paras: [
        'You will stop getting MockMob’s welcome and reminder emails.',
        'Sign-in codes still come when you ask for one.',
      ],
      submit: ['Turn off these emails', action],
    },
    done: {
      title: 'These emails are off',
      paras: [
        'You will not get MockMob’s welcome or reminder emails again.',
        'Sign-in codes still come when you ask for one.',
      ],
      button: ['Go to MockMob', home],
    },
    invalid: {
      title: 'This link did not work',
      paras: [
        'It may have been cut short when it was copied. Open the link from the email again.',
        'Or write to support@mockmob.in from the same address, and we will turn the emails off for you.',
      ],
      button: ['Go to MockMob', home],
    },
    error: {
      title: 'We could not turn these emails off just now',
      paras: ['Nothing changed yet. Try again in a minute.'],
      button: ['Try again', retry || home],
    },
  };
  const page = (state === 'confirm' && !action ? null : pages[state]) || pages.invalid;
  const body = [
    WORDMARK,
    H1(page.title),
    ...page.paras.map((text, i) => BODY_P(text, i === 0)),
    page.submit ? SUBMIT(page.submit[1], page.submit[0]) : BUTTON(page.button[1], page.button[0]),
  ].join('\n');
  return shell({ title: page.title, body })
    .replace('<meta name="viewport"', '<meta name="robots" content="noindex" />\n    <meta name="viewport"');
}
