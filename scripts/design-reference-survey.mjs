import { writeFile, mkdir } from 'node:fs/promises';
const base = 'https://www.awwwards.com';
const catalogs = await Promise.allSettled(Array.from({ length: 5 }, async (_, i) => {
  const url = `${base}/websites/sites_of_the_day/${i ? `?page=${i + 1}` : ''}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  const html = await response.text();
  return [...new Set([...html.matchAll(/href="(\/sites\/[^"?#]+)"/g)].map((m) => m[1]))];
}));
const paths = [...new Set(catalogs.flatMap((r) => r.status === 'fulfilled' ? r.value : []))].slice(0, 120);
const references = [];
for (let start = 0; start < paths.length; start += 8) {
  await Promise.all(paths.slice(start, start + 8).map(async (path) => {
    try {
      const response = await fetch(base + path, { signal: AbortSignal.timeout(12000) });
      const html = await response.text();
      const title = html.match(/<title>([^<]+)/i)?.[1]?.replace(/\s*-\s*Awwwards.*$/i, '').trim();
      references.push({ title: title || path.slice(7), url: base + path, status: response.status });
    } catch { references.push({ title: path.slice(7), url: base + path, status: 'unavailable' }); }
  }));
}
references.sort((a, b) => a.title.localeCompare(b.title));
await mkdir('artifacts/homepage', { recursive: true });
await writeFile('artifacts/homepage/reference-survey.json', JSON.stringify({ date: '2026-10-02', method: 'Public award listing and detail-page title survey; not 120 individual visual audits.', references }, null, 2));
console.log(JSON.stringify({ count: references.length, successful: references.filter((r) => r.status === 200).length, titles: references.map((r) => r.title) }));
