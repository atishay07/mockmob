import 'server-only';
import { supabaseAdmin } from '@/lib/supabase';
import { readChapterInventory } from '@/../data/chapter_inventory';

/**
 * What the bank holds in each of these chapters, and how much of it the student has not seen (spec D.5-5), for the
 * result page's "Do these next". Counts only: data/chapter_inventory.js. `attempt.subject` is the stored subject id the
 * questions table uses. A chapter that cannot be read is left out, and the plan leaves its row as it was.
 */
export function chapterInventoryFor(userId) {
  return ({ attempt, chapters }) => readChapterInventory(supabaseAdmin(), {
    userId, subject: attempt.subject, chapters,
    warn: (chapter, error) => console.warn(`[api/attempts/:id] bank count for ${chapter} skipped:`, error?.message),
  });
}
