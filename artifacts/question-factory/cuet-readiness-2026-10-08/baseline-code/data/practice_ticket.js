// Transitional practice uses authenticated encryption over the server-selected snapshot.
// The client cannot read keys or change questions, owner, deadline, or entitlement.
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';
import { deflateRawSync, inflateRawSync } from 'node:zlib';

const MAX_TICKET_LENGTH = 500000;
const MAX_SNAPSHOT_BYTES = 8 * 1024 * 1024;

function key(secret) {
  if (typeof secret !== 'string' || secret.length < 32) throw new Error('PRACTICE_SECRET_REQUIRED');
  return createHash('sha256').update(`mockmob-practice-v1:${secret}`).digest();
}
export function practiceId(secret, userId, requestKey, selection) {
  return `att_practice_${createHmac('sha256', key(secret)).update(JSON.stringify([userId, requestKey, selection])).digest('hex').slice(0, 32)}`;
}
export function sealPractice(row, secret) {
  // Factory verification records belong to the selected server snapshot. Keep
  // them intact, but compress before encryption so a complete paper can submit.
  const snapshot = Buffer.from(JSON.stringify(row), 'utf8');
  if (snapshot.length > MAX_SNAPSHOT_BYTES) throw new Error('PRACTICE_SNAPSHOT_TOO_LARGE');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(secret), iv);
  cipher.setAAD(Buffer.from('mockmob-practice-v2'));
  const bytes = Buffer.concat([cipher.update(deflateRawSync(snapshot)), cipher.final()]);
  const ticket = ['p2', iv.toString('base64url'), bytes.toString('base64url'), cipher.getAuthTag().toString('base64url')].join('.');
  // startPractice seals before charging. An oversized set fails without spend.
  if (ticket.length > MAX_TICKET_LENGTH) throw new Error('PRACTICE_SNAPSHOT_TOO_LARGE');
  return ticket;
}
export function openPractice(ticket, secret, userId, now = Date.now(), { allowExpired = false } = {}) {
  if (typeof ticket !== 'string' || ticket.length > MAX_TICKET_LENGTH) throw new Error('INVALID_PRACTICE_SESSION');
  let row;
  try {
    const [version, iv, ciphertext, tag, extra] = ticket.split('.');
    if (!['p1', 'p2'].includes(version) || extra) throw new Error();
    const decipher = createDecipheriv('aes-256-gcm', key(secret), Buffer.from(iv, 'base64url'));
    decipher.setAAD(Buffer.from(version === 'p1' ? 'mockmob-practice-v1' : 'mockmob-practice-v2'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    const bytes = Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]);
    row = JSON.parse((version === 'p2' ? inflateRawSync(bytes, { maxOutputLength: MAX_SNAPSHOT_BYTES }) : bytes).toString());
  } catch { throw new Error('INVALID_PRACTICE_SESSION'); }
  if (row.user_id !== userId) throw new Error('SESSION_NOT_FOUND');
  if (!allowExpired && now > Date.parse(row.expires_at) + 120000) throw new Error('SESSION_EXPIRED');
  return row;
}
