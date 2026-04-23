import { NextResponse } from 'next/server';
import { Database } from '@/../data/db';
import { SUBJECTS, getSubjectById } from '@/../data/subjects';

/**
 * GET /api/chapters?subject=<id>
 *
 * Returns the chapters for a given subject, reading from the chapters
 * table when available. Falls back to the static SUBJECTS list if the
 * table is empty or the migration hasn't been applied yet — so the UI
 * always has something to render.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const subject = searchParams.get('subject');
    if (!subject) {
      return NextResponse.json({ error: 'subject is required' }, { status: 400 });
    }

    const fromDb = await Database.getChapters(subject);
    if (fromDb && fromDb.length) return NextResponse.json(fromDb);

    // Fallback
    const sub = getSubjectById(subject);
    if (!sub) return NextResponse.json([], { status: 200 });
    return NextResponse.json(
      sub.chapters.map((name, i) => ({
        id: `${subject}__${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
        subjectId: subject,
        name,
        sortOrder: i,
      })),
    );
  } catch (e) {
    console.error('[api/chapters] GET failed:', e);
    return NextResponse.json({ error: 'Failed to load chapters' }, { status: 500 });
  }
}
