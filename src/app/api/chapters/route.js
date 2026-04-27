import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSubjectById } from '@/../data/subjects';

/**
 * GET /api/chapters?subject=<id>
 *
 * Response always has shape:
 *
 *   WITH units (e.g. accountancy):
 *   { grouped: true, units: [{ id, name, sortOrder, chapters: [{ id, name, sortOrder }] }] }
 *
 *   WITHOUT units (all other subjects):
 *   { grouped: false, chapters: [{ id, name, sortOrder }] }
 *
 * Falls back to static data/subjects.js when DB tables are empty.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const subject = searchParams.get('subject');
    if (!subject) {
      return NextResponse.json({ error: 'subject is required' }, { status: 400 });
    }

    // ── Try units first ────────────────────────────────────────
    const [unitsRes, chaptersRes] = await Promise.all([
      supabaseAdmin()
        .from('units')
        .select('id, name, sort_order')
        .eq('subject_id', subject)
        .order('sort_order', { ascending: true }),
      supabaseAdmin()
        .from('chapters')
        .select('id, name, sort_order, unit_id')
        .eq('subject_id', subject)
        .order('sort_order', { ascending: true }),
    ]);

    // Ignore "table does not exist" errors — migration not yet applied.
    const unitsTableMissing =
      unitsRes.error?.code === '42P01' ||
      /units/.test(unitsRes.error?.message ?? '');

    if (unitsRes.error && !unitsTableMissing) throw unitsRes.error;
    if (chaptersRes.error) throw chaptersRes.error;

    const units    = unitsRes.data    ?? [];
    const chapters = chaptersRes.data ?? [];

    // ── Grouped response (subject has units wired) ─────────────
    if (units.length > 0) {
      const unitMap = new Map(
        units.map(u => [u.id, {
          id:        u.id,
          name:      u.name,
          sortOrder: u.sort_order,
          chapters:  [],
        }]),
      );

      for (const ch of chapters) {
        if (ch.unit_id && unitMap.has(ch.unit_id)) {
          unitMap.get(ch.unit_id).chapters.push({
            id:        ch.id,
            name:      ch.name,
            sortOrder: ch.sort_order,
          });
        }
      }

      const unassignedChapters = chapters
        .filter((ch) => !ch.unit_id || !unitMap.has(ch.unit_id))
        .map((ch) => ({
          id:        ch.id,
          name:      ch.name,
          sortOrder: ch.sort_order,
        }));
      const groupedUnits = [...unitMap.values()].filter(u => u.chapters.length > 0);
      if (unassignedChapters.length > 0) {
        groupedUnits.push({
          id:        `${subject}__unassigned`,
          name:      'Other chapters',
          sortOrder: Number.MAX_SAFE_INTEGER,
          chapters:  unassignedChapters,
        });
      }
      return NextResponse.json({ grouped: true, units: groupedUnits });
    }

    // ── Flat response (no units yet) ───────────────────────────
    if (chapters.length > 0) {
      return NextResponse.json({
        grouped: false,
        chapters: chapters.map(r => ({
          id:        r.id,
          name:      r.name,
          sortOrder: r.sort_order,
        })),
      });
    }

    // ── Static fallback ────────────────────────────────────────
    const sub = getSubjectById(subject);
    if (!sub) return NextResponse.json({ grouped: false, chapters: [] }, { status: 200 });

    return NextResponse.json({
      grouped: false,
      chapters: sub.chapters.map((name, i) => ({
        id:        `${subject}__${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
        name,
        sortOrder: i,
      })),
    });

  } catch (e) {
    console.error('[api/chapters] GET failed:', e);
    return NextResponse.json({ error: 'Failed to load chapters' }, { status: 500 });
  }
}
