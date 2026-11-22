import 'server-only';
// The CUET 2026 coverage pages' data, read from the built files when the pages are built (scripts/coverage/build-public.mjs
// writes data/coverage/cuet2026/public/). The pages are static: every subject is a generateStaticParams entry and
// dynamicParams is off, so nothing here runs per request.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(process.cwd(), 'data', 'coverage', 'cuet2026', 'public');
const EMPTY = Object.freeze({ subjects: [], total: { counted: 0, covered: 0, pct: 0, same: 0, newValues: 0, concept: 0 }, chapters: { asked: 0, withPractice: 0 } });

/** summary.json, or an empty summary when it has not been built. */
export function coverageSummary() {
  const file = join(DIR, 'summary.json');
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : EMPTY;
}

/** One subject's file, only for an id the summary lists (so an address can never read another file). */
export function coverageSubject(id) {
  if (!coverageSummary().subjects.some((s) => s.id === id)) return null;
  return JSON.parse(readFileSync(join(DIR, `${id}.json`), 'utf8'));
}
