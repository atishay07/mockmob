import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runRouteAuditLoop } from '../tools/runRouteAuditLoop.mjs';

test('runs one mock route and writes JSON + Markdown report', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mockmob-route-loop-'));
  const report = await runRouteAuditLoop({
    route: 'english::Para Jumbles',
    quality: 'speed',
    maxIterations: 1,
    mock: true,
    auditDir: dir,
  });
  assert.equal(report.summary.routes_tested, 1);
  assert.equal(existsSync(join(dir, 'latest_route_audit.json')), true);
  assert.equal(existsSync(join(dir, 'latest_route_audit.md')), true);
  assert.equal(report.patches_applied.length, 0);
});

test('stops after max iterations', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mockmob-route-loop-'));
  const report = await runRouteAuditLoop({
    route: 'physics::Electromagnetic Induction',
    quality: 'speed',
    maxIterations: 1,
    mock: true,
    auditDir: dir,
  });
  assert.equal(report.summary.routes_tested, 1);
});
