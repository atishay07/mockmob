import 'server-only';
// The published DU offerings files (public/du/2026/offerings/<programmeId>.json), read on the server for "Where you
// stand" and Ask Mobi's context. next.config.mjs traces them into the functions that read them. A programme id is the
// catalog id My colleges already validated (lowercase letters, digits and hyphens), so it can never leave the folder.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ID = /^[a-z0-9][a-z0-9-]{0,119}$/;
const cache = new Map();

export function offeringsFor(programmeId) {
  if (typeof programmeId !== 'string' || !ID.test(programmeId)) return null;
  if (cache.has(programmeId)) return cache.get(programmeId);
  let data = null;
  try { data = JSON.parse(readFileSync(join(process.cwd(), 'public', 'du', '2026', 'offerings', `${programmeId}.json`), 'utf8')); } catch { data = null; }
  if (cache.size > 100) cache.clear();
  cache.set(programmeId, data);
  return data;
}
