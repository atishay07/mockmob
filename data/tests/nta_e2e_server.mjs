// Local backend for driving the real NTA runner in a browser: the website's real /api/sessions and
// /api/attempts handlers over the read-only production fixtures (data/tests/nta_e2e_harness.mjs).
// No database, model or network. Start the Next dev server separately and open
//   /preview/arena/nta?view=test&plan=pro&subject=<id>&mode=nta&generationKey=<12+ chars>
//
//   node --use-system-ca data/tests/nta_e2e_server.mjs [--mode=asis|promoted] [--durable] [--port=3108]
//
// Extra endpoints for the tester: GET /__state (counts and stored attempts), POST /__reset.
import http from 'node:http';
import fs from 'node:fs';
import * as h from './nta_e2e_harness.mjs';

const arg = (name, fallback) => (process.argv.find((entry) => entry.startsWith(`--${name}=`)) || '').split('=')[1] ?? fallback;
const mode = arg('mode', 'promoted');
const port = Number(arg('port', 3108));
const durable = process.argv.includes('--durable');
if (!h.fixturesAvailable()) throw new Error('fixtures missing: run node --use-system-ca scripts/nta-fixture-export.mjs');
const signingKey = mode === 'asis' ? h.productionSigningKey() : h.TEST_SECRET;
if (!signingKey) throw new Error('production signing key not in .env.local');
h.configure({ signingKey, durable });
const subjects = Object.values(h.readManifest().subjects).map((entry) => entry.internal);
const students = [{ id: 'prem' }, { id: 'free', premium: false, credits: 100 }];
await h.loadSubject(subjects, { mode, students });
console.log(`nta e2e backend on :${port} mode=${mode} durable=${durable} subjects=${subjects.length}`);

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, authorization, x-test-user', 'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, OPTIONS' };
const readBody = (request) => new Promise((resolve) => { const chunks = []; request.on('data', (chunk) => chunks.push(chunk)); request.on('end', () => resolve(Buffer.concat(chunks).toString())); });
let counter = 0;
http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://localhost:${port}`);
  const send = (status, body) => { response.writeHead(status, { ...cors, 'Content-Type': 'application/json' }); response.end(JSON.stringify(body)); };
  if (request.method === 'OPTIONS') { response.writeHead(204, cors); return response.end(); }
  if (url.pathname === '/__state') {
    return send(200, {
      mode, durable,
      attempts: h.fake.table('attempts').map(({ questions_snapshot, details, ...rest }) => ({ ...rest, snapshot: questions_snapshot?.length, details: details?.length })),
      sessions: h.fake.table('recovery_sessions').map((row) => ({ id: row.id, state: row.state, events: row.events?.length })),
      progress: h.fake.table('user_question_progress').length, writes: h.fake.store.calls.writes.length,
    });
  }
  if (url.pathname === '/__driver.js') {
    response.writeHead(200, { ...cors, 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' });
    return response.end(fs.readFileSync(new URL('./nta_e2e_driver.js', import.meta.url), 'utf8'));
  }
  if (url.pathname === '/__keys') {
    // Test-only: the stored key of each requested question, so a tester can check a UI submission by hand.
    const ids = new Set((url.searchParams.get('ids') || '').split(',').filter(Boolean));
    const keys = {};
    for (const row of h.fake.table('questions')) {
      if (!ids.has(row.id)) continue;
      const options = row.options.map((o, i) => (typeof o === 'string' ? { key: 'ABCD'[i], text: o } : { key: o.key || 'ABCD'[i], text: o.text }));
      const letter = options.findIndex((o) => o.key === String(row.correct_answer ?? '').trim());
      keys[row.id] = letter >= 0 ? letter : row.correct_index;
    }
    return send(200, keys);
  }
  if (url.pathname === '/__passage') {
    // Test-only: one real English passage, for checking how the runner lays a passage out.
    const groups = h.fake.table('passage_groups').filter((group) => group.passage_text).sort((a, b) => b.passage_text.length - a.passage_text.length);
    return send(200, { id: groups[0].id, title: groups[0].title || 'Reading Comprehension', text: groups[0].passage_text });
  }
  if (url.pathname === '/__reset') {
    for (const name of ['attempts', 'user_question_progress', 'recovery_sessions']) h.fake.seed(name, []);
    return send(200, { ok: true });
  }
  if (!['/api/sessions', '/api/attempts'].includes(url.pathname)) return send(404, { error: 'not_found' });
  const text = await readBody(request);
  const route = url.pathname === '/api/attempts' ? 'attempts' : 'sessions';
  const user = url.searchParams.get('as') === 'free' ? 'free' : url.searchParams.get('as') === 'anon' ? null : 'prem';
  try {
    const result = await h.call(request.method, text ? JSON.parse(text) : {}, user, { path: url.pathname, route });
    console.log(`${request.method} ${url.pathname} ${result.status} #${(counter += 1)}`);
    send(result.status, result.body);
  } catch (error) { console.error(error); send(500, { error: String(error.message) }); }
}).listen(port);
