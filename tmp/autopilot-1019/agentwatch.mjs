// Prints one line per agent transcript (tasks/*.output) silent for more than 15 minutes, once per silence.
import fs from 'node:fs';
import path from 'node:path';
const DIR = process.argv[2];
const LIMIT = 15 * 60e3;
const told = new Set();
function tick() {
  const now = Date.now();
  for (const f of fs.readdirSync(DIR)) {
    if (!f.endsWith('.output')) continue;
    const p = path.join(DIR, f);
    const age = now - fs.statSync(p).mtimeMs;
    if (age < LIMIT) { told.delete(p); continue; }
    if (age > 4 * 3600e3 || told.has(p)) continue;
    told.add(p);
    console.log(`SILENT ${f} for ${Math.round(age / 60e3)} min`);
  }
}
tick();
setInterval(tick, 60e3);
