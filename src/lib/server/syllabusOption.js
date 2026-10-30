// The option a student saved for a subject (Maths B1/B2, CS B1/B2, Accountancy AFS/CAS), read for question selection.
// The table (student_subject_options) arrives with the Key cards migration (20261031140000_key_cards.sql); the
// PUT /api/me/subject-options route that writes it belongs to the Key cards server part. Until the table exists, or
// on any read error, a student has no saved option and selection is unchanged.
import { normalizeOption, SUBJECT_OPTIONS } from '../../../data/cuet_syllabus.js';

/** The saved option for (user, subject), normalised against the subject's choices, or null. Never throws. */
export async function loadSyllabusOption(db, userId, subject) {
  if (!db || !userId || !SUBJECT_OPTIONS[subject]) return null;
  try {
    const { data, error } = await db.from('student_subject_options').select('option').eq('user_id', userId).eq('subject', subject).maybeSingle();
    if (error || !data) return null;
    return normalizeOption(subject, data.option);
  } catch {
    return null;
  }
}
