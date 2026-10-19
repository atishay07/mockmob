import 'server-only';
// Reads the parts of "What should I revise tonight?" (data/mobi_tonight.js): the rule book, the traps that catch the student
// and the Revise cards due. No model call, no credit. Each part that cannot be read is simply left out.
import { supabaseAdmin } from '@/lib/supabase';
import { readRuleBook } from '@/lib/server/ruleBook';
import { atlasForAttempts } from '@/lib/server/trapAtlas';
import { buildTrapsMeet } from '@/../data/trap_atlas';
import { bookRules } from '@/../data/rule_book';
import { istDate } from '@/../data/repair_check';
import { tonightPack } from '@/../data/mobi_tonight';

async function reviseDue(userId, now) {
  const { count, error } = await supabaseAdmin().from('revise_cards').select('question_id', { count: 'exact', head: true }).eq('user_id', userId).lte('due_day', istDate(now));
  return error ? 0 : count || 0;
}

export async function readTonight({ userId, attempts, insights, now = Date.now() }) {
  const [book, atlas, due] = await Promise.all([
    readRuleBook(userId, attempts).then((r) => r.book).catch(() => null),
    atlasForAttempts(attempts).catch(() => null),
    reviseDue(userId, now).catch(() => 0),
  ]);
  const rules = book ? bookRules(book).filter((r) => String(r.id || '').startsWith('repair:')).map((r) => ({ text: r.text, chapter: r.chapter })) : [];
  let traps = [];
  try { traps = buildTrapsMeet({ attempts, atlas }).rows || []; } catch { traps = []; }
  return tonightPack({ insights, rules, traps, reviseDue: due, now: new Date(now) });
}
