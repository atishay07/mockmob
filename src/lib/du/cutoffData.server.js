import 'server-only';
// The DU cutoff pages' data, read from the published files when the pages are built (they are static: every course
// and college is a generateStaticParams entry and dynamicParams is off, so nothing here runs per request). Same files
// the calculator fetches in the browser (public/du/2026), so the two can never disagree.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildCatalog } from './cutoffPages.mjs';

const ROOT = join(process.cwd(), 'public', 'du', '2026');
let catalog = null;

export function duCutoffCatalog() {
  if (catalog) return catalog;
  const index = JSON.parse(readFileSync(join(ROOT, 'index.json'), 'utf8'));
  const offerings = {};
  for (const group of index.groups) {
    if (!group.offerings) continue;
    offerings[group.id] = JSON.parse(readFileSync(join(ROOT, 'offerings', `${group.id}.json`), 'utf8'));
  }
  catalog = buildCatalog(index, offerings);
  return catalog;
}

export const findCourse = (id) => duCutoffCatalog().courses.find((c) => c.id === id) || null;
export const findCollege = (slug) => duCutoffCatalog().colleges.find((c) => c.slug === slug) || null;
