import { readFileSync } from 'node:fs';
import { buildSwot, swotPlanChapters } from '../data/mock_swot.js';
import { buildMissedBefore } from '../src/components/recovery/repairRun.js';
const s = JSON.parse(readFileSync('data/tests/fixtures/swot/three_mocks_repeat_loss.json','utf8'));
const args = { ...s, missedBefore: buildMissedBefore(s.allAttempts, s.attempt.id) };
console.log(swotPlanChapters(args));
const inv = { 'Accounting Ratios': { bank: 8, unseen: 3 }, 'Debentures': { bank: 4, unseen: 1 }, 'Share Capital': { bank: 40, unseen: 0 } };
const out = buildSwot({ ...args, inventory: inv });
console.log(JSON.stringify(out.plan, null, 1));
