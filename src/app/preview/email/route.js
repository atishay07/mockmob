import { buildStudentEmail, escapeHtml, forceDark, unsubscribePage } from '@/lib/email/studentMailWords.mjs';
import { unsubscribeUrl } from '@/lib/email/studentMailModel.mjs';

export const dynamic = 'force-dynamic';

// Development only: the welcome and day-2 emails, and the unsubscribe page, as a mail app shows them. Nothing is sent and
// nothing is read or written: fixed sample data, a sample secret.
//   /preview/email                                   an index of every view
//   ?kind=welcome
//   ?kind=day2&state=first|repair|next&subject=accountancy&n=4
//   ?kind=unsubscribe&state=done|invalid|error
//   &theme=dark   the dark version (as a mail app that honours prefers-color-scheme shows it)
//   &part=text    the plain-text part
const ORIGIN = 'https://www.mockmob.in';
const SAMPLE_USER = '00000000-0000-4000-8000-000000000000';
const NAMES = { accountancy: 'Accountancy', economics: 'Economics', business_studies: 'Business Studies', english: 'English' };

const VIEWS = [
  ['kind=welcome', 'Welcome'],
  ['kind=day2&state=first', 'Day 2, never started'],
  ['kind=day2&state=first&subject=accountancy', 'Day 2, never started, subject chosen'],
  ['kind=day2&state=repair&n=4&subject=accountancy', 'Day 2, 4 open'],
  ['kind=day2&state=repair&n=1&subject=economics', 'Day 2, 1 open'],
  ['kind=day2&state=next&subject=business_studies', 'Day 2, nothing open'],
  ['kind=unsubscribe&state=done', 'Unsubscribed'],
  ['kind=unsubscribe&state=invalid', 'Bad link'],
  ['kind=unsubscribe&state=error', 'Could not save'],
];

function index() {
  const items = VIEWS.map(([q, label]) => `<li>${escapeHtml(label)}: <a href="?${q}">light</a>, <a href="?${q}&theme=dark">dark</a>${q.startsWith('kind=unsubscribe') ? '' : `, <a href="?${q}&part=text">text</a>`}</li>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Email preview</title></head><body style="font-family:Arial,sans-serif;padding:16px;line-height:1.8"><h1 style="font-size:20px">Student emails</h1><ul>${items}</ul></body></html>`;
}

export async function GET(request) {
  if (process.env.NODE_ENV === 'production') return new Response('Not found', { status: 404 });
  const q = new URL(request.url).searchParams;
  const kind = q.get('kind');
  const dark = q.get('theme') === 'dark';
  const html = (body) => new Response(dark ? forceDark(body) : body, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
  if (!kind) return html(index());
  if (kind === 'unsubscribe') return html(unsubscribePage(q.get('state') || 'done', { retry: '#', origin: ORIGIN }));
  const subject = q.get('subject') || null;
  const state = kind === 'day2'
    ? { kind: q.get('state') || 'first', subject, subjectName: NAMES[subject] || '', attemptId: 'att_sample_1', open: Number(q.get('n')) || 4, position: 3 }
    : {};
  const mail = buildStudentEmail({ kind, state, origin: ORIGIN, unsubscribe: unsubscribeUrl(ORIGIN, SAMPLE_USER, 'preview-secret') });
  if (q.get('part') === 'text') {
    return new Response(`Subject: ${mail.subject}\n\n${mail.text}`, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
  }
  return html(mail.html);
}
