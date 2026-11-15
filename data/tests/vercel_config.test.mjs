import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));

test('functions run in Singapore (sin1, AWS ap-southeast-1), next to the Supabase project', () => {
  // Hobby allows exactly one function region; more fails the deployment before the build.
  assert.deepEqual(config.regions, ['sin1']);
  assert.equal('functionFailoverRegions' in config, false, 'failover regions are Enterprise only');
});

test('the daily crons point at existing routes; the NTA index safety rebuild rides on the inventory cron; the day-2 email runs at 12:30 UTC', () => {
  // Hobby allows 100 cron jobs a project, each at most once a day, fired within the hour (Vercel docs, read 15 Nov 2026).
  // The day-2 email (src/app/api/email/day-two) is the third: about 6:00 pm India time, and the job itself sends only
  // between 5:00 pm and 9:00 pm India time.
  assert.deepEqual(config.crons, [
    { path: '/api/internal/finalise-sessions', schedule: '45 21 * * *' },
    { path: '/api/internal/refresh-inventory', schedule: '30 21 * * *' },
    { path: '/api/email/day-two', schedule: '30 12 * * *' },
  ]);
  for (const cron of config.crons) {
    assert.match(cron.schedule, /^\d+ \d+ \* \* \*$/, 'Hobby crons run at most once a day');
    assert.ok(existsSync(new URL(`../../src/app${cron.path}/route.js`, import.meta.url)), cron.path);
  }
  assert.deepEqual(Object.keys(config).sort(), ['crons', 'regions']);
  const route = readFileSync(new URL('../../src/app/api/internal/refresh-inventory/route.js', import.meta.url), 'utf8');
  assert.match(route, /refreshStaleNtaIndexes/);
  assert.ok(route.indexOf('await refreshInventorySnapshot()') < route.indexOf('await refreshNtaIndex(startedAt)'), 'the inventory refresh keeps its place; the index pass follows it');
});
