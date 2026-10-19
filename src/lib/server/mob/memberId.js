// memberId: how members are addressed (never by user id). No 'server-only' and no '@/' imports, so node:test loads it.
import { createHmac } from 'node:crypto';
import { CODE_ALPHABET } from '../../mob/model.mjs';

/** memberId: the first 12 Crockford characters of HMAC-SHA256(secret, mobId:userId). */
export function memberIdFor(secret, mobId, userId) {
  const digest = createHmac('sha256', String(secret || 'mob')).update(`${mobId}:${userId}`).digest();
  let out = '';
  for (let i = 0; i < 12; i += 1) out += CODE_ALPHABET[digest[i] & 31];
  return out;
}
