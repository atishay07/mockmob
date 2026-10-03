// Transitional practice uses authenticated encryption over the server-selected snapshot.
// The client cannot read keys or change questions, owner, deadline, or entitlement.
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';

function key(secret) {
  if (typeof secret !== 'string' || secret.length < 32) throw new Error('PRACTICE_SECRET_REQUIRED');
  return createHash('sha256').update(`mockmob-practice-v1:${secret}`).digest();
}
export function practiceId(secret, userId, requestKey, selection) {
  return `att_practice_${createHmac('sha256', key(secret)).update(JSON.stringify([userId, requestKey, selection])).digest('hex').slice(0, 32)}`;
}
export function sealPractice(row, secret) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(secret), iv);
  cipher.setAAD(Buffer.from('mockmob-practice-v1'));
  const bytes = Buffer.concat([cipher.update(JSON.stringify(row), 'utf8'), cipher.final()]);
  return ['p1', iv.toString('base64url'), bytes.toString('base64url'), cipher.getAuthTag().toString('base64url')].join('.');
}
export function openPractice(ticket, secret, userId, now = Date.now(), { allowExpired = false } = {}) {
  if (typeof ticket !== 'string' || ticket.length > 500000) throw new Error('INVALID_PRACTICE_SESSION');
  let row;
  try {
    const [version, iv, ciphertext, tag, extra] = ticket.split('.');
    if (version !== 'p1' || extra) throw new Error();
    const decipher = createDecipheriv('aes-256-gcm', key(secret), Buffer.from(iv, 'base64url'));
    decipher.setAAD(Buffer.from('mockmob-practice-v1'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    row = JSON.parse(Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString());
  } catch { throw new Error('INVALID_PRACTICE_SESSION'); }
  if (row.user_id !== userId) throw new Error('SESSION_NOT_FOUND');
  if (!allowExpired && now > Date.parse(row.expires_at) + 120000) throw new Error('SESSION_EXPIRED');
  return row;
}
