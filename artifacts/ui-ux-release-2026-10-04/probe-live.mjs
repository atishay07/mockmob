import { writeFile } from 'node:fs/promises';
const results = [];
for (const start of ['https://mockmob.in/', 'https://www.mockmob.in/', 'https://www.mockmob.in/cuet-cutoff-calculator']) {
  let url = start;
  const chain = [];
  for (let i = 0; i < 6; i++) {
    const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(30000), headers: { 'User-Agent': 'MockMob-release-verification', 'Cache-Control': 'no-cache' } });
    chain.push({ url, status: response.status, location: response.headers.get('location') });
    if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
      url = new URL(response.headers.get('location'), url).href;
      continue;
    }
    const html = await response.text();
    results.push({ start, chain, finalUrl: url, status: response.status, newTour: html.includes('Choose a feature'), newSample: html.includes('Try five questions'), bytes: Buffer.byteLength(html) });
    break;
  }
  if (!results.some(result => result.start === start)) throw new Error(`Redirect limit: ${start}`);
}
await writeFile(new URL('./live-http.json', import.meta.url), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
if (results.some(result => result.status !== 200)) process.exitCode = 1;
