// 20 Oct bug fixes: the sign-in email's app link (I2), assetlinks from ANDROID_CERT_SHA256, no email prefix as a name.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');

test('assetlinks: the owner can paste the Play SHA-256 as Play Console shows it, or without colons', async () => {
  const { parseCertFingerprints, assetLinksBody } = await import('../../src/lib/server/assetLinks.js');
  const colon = 'AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89';
  const bare = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  assert.deepEqual(parseCertFingerprints(''), []);
  assert.deepEqual(parseCertFingerprints(undefined), []);
  assert.deepEqual(parseCertFingerprints(colon), [colon]);
  assert.deepEqual(parseCertFingerprints(colon.toLowerCase()), [colon], 'lower case');
  assert.deepEqual(parseCertFingerprints(` ${bare} `), [bare.toUpperCase().match(/.{2}/g).join(':')], 'no colons');
  assert.deepEqual(parseCertFingerprints(`SHA256: ${colon}`), [colon], 'label copied with it');
  assert.deepEqual(parseCertFingerprints(`${colon}, ${bare}\n${colon}`).length, 2, 'two keys, comma or newline, no duplicates');
  assert.deepEqual(parseCertFingerprints('AB:CD, not-a-key'), [], 'typos are dropped');
  assert.deepEqual(assetLinksBody(''), []);
  const [statement] = assetLinksBody(colon);
  assert.deepEqual(statement.relation, ['delegate_permission/common.handle_all_urls']);
  assert.equal(statement.target.package_name, 'in.mockmob.app');
  assert.deepEqual(statement.target.sha256_cert_fingerprints, [colon]);
  assert.match(read('src/app/api/assetlinks/route.js'), /assetLinksBody\(process\.env\.ANDROID_CERT_SHA256\)/);
});

test('email link (I2): the app asks with client app and gets /app/login; the website keeps /auth/callback', async () => {
  const { loginLinkPath, isAppClient, APP_LOGIN_PATH } = await import('../../src/lib/server/emailLoginPolicy.js');
  assert.equal(APP_LOGIN_PATH, '/app/login');
  assert.equal(loginLinkPath({ client: 'app' }), '/app/login');
  assert.equal(loginLinkPath({}), '/auth/callback');
  assert.equal(loginLinkPath(null), '/auth/callback');
  assert.equal(loginLinkPath({ client: 'APP' }), '/auth/callback');
  assert.equal(isAppClient({ client: 'app' }), true);
  // The web fallback: the same page as /auth/callback, so a browser without the app still signs in.
  assert.ok(existsSync(resolve(root, 'src/app/app/login/page.jsx')));
  const page = read('src/app/app/login/page.jsx');
  assert.match(page, /import AuthCallbackPageClient from '\.\.\/\.\.\/auth\/callback\/AuthCallbackPageClient'/);
  assert.match(page, /index: false/);
});

test('code sign-up (bug 3): a new account without a name gets an empty name, never the email prefix', async () => {
  const { ensureDbUser } = await import('../../src/lib/server/cookieSession.js');
  const created = [];
  const db = {
    getUserById: async () => null,
    getUserByEmail: async () => null,
    updateUser: async (id, patch) => ({ id, ...patch }),
    createUser: async (row) => { created.push(row); return row; },
  };
  await ensureDbUser({ id: 'sb-1', email: 'walk-r11-web-1019a@example.com' }, db);
  assert.equal(created[0].name, '', 'users.name is NOT NULL, so no name is the empty string');
  await ensureDbUser({ id: 'sb-2', email: 'asha@example.com', name: '  Asha Verma ' }, db);
  assert.equal(created[1].name, 'Asha Verma', 'a real name (Google) is kept');
  assert.doesNotMatch(read('src/lib/server/cookieSession.js'), /email\.split\('@'\)\[0\]/);
});
