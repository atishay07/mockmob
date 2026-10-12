import { SUBJECTS } from '../../../data/subjects.js';
import { toPublicSubjectId } from '../../../data/cuet_controls.js';

// Accept both the internal ids and the public ids that /api/subjects sends (for example the
// General Test is 'gat' internally and 'general_test' publicly); store whatever the client sent.
const SUBJECT_IDS = new Set(SUBJECTS.flatMap((subject) => [subject.id, toPublicSubjectId(subject.id)]));
const MAX_SUBJECTS = 5;

// Students may change only their display name and subjects here. Entitlements, role, email and
// billing fields are server-owned (payments, webhooks, admin) and are never accepted from a client.
export function profilePatch(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Send a JSON object.' };
  const patch = {};
  if ('name' in body) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > 80) return { error: 'Name must be 1 to 80 characters.' };
    patch.name = name;
  }
  if ('subjects' in body) {
    const subjects = Array.isArray(body.subjects) ? [...new Set(body.subjects)] : null;
    if (!subjects || subjects.length > MAX_SUBJECTS || !subjects.every((id) => typeof id === 'string' && SUBJECT_IDS.has(id))) {
      return { error: `Choose up to ${MAX_SUBJECTS} listed subjects.` };
    }
    patch.subjects = subjects;
  }
  if (!Object.keys(patch).length) return { error: 'Nothing to update.' };
  return { patch };
}
