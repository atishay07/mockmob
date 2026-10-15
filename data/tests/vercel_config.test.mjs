import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));

test('functions run in Singapore (sin1, AWS ap-southeast-1), next to the Supabase project', () => {
  // Hobby allows exactly one function region; more fails the deployment before the build.
  assert.deepEqual(config.regions, ['sin1']);
  assert.equal('functionFailoverRegions' in config, false, 'failover regions are Enterprise only');
});

test('the two daily crons are unchanged and still point at existing routes', () => {
  assert.deepEqual(config.crons, [
    { path: '/api/internal/finalise-sessions', schedule: '45 21 * * *' },
    { path: '/api/internal/refresh-inventory', schedule: '30 21 * * *' },
  ]);
  for (const cron of config.crons) {
    assert.match(cron.schedule, /^\d+ \d+ \* \* \*$/, 'Hobby crons run at most once a day');
    assert.ok(existsSync(new URL(`../../src/app${cron.path}/route.js`, import.meta.url)), cron.path);
  }
  assert.deepEqual(Object.keys(config).sort(), ['crons', 'regions']);
});
