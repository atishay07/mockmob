// Fail-closed measured release gate. A dry run is read-only; a non-dry run writes only a passing, fully bound measurement.
import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { assessReleaseEvidenceV7, expectedReleaseBinding } from '../lib/releaseEvidenceV7.mjs';
import { buildCuetFitTopologyReleaseVNext } from '../lib/currentCuetCalibrationGateVNext.mjs';

const arg = n => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const topology = arg('--topology'), tag = arg('--tag') || 'v7.1', dry = process.argv.includes('--dry-run');
if (!topology) throw Error('topology_required');
const dir = 'artifacts/question-factory/cuet-fit-2026-10-07/benchmark', read = p => JSON.parse(readFileSync(p, 'utf8'));
const need = p => { if (!existsSync(p)) throw Error('measurement_missing:' + p); return read(p); };
const freshName = arg('--fresh') || 'v3';
const resultFresh = need(`${dir}/results-${tag}-${freshName}.json`), resultRegression = need(`${dir}/results-${tag}-regression.json`);
const frozenFresh = need(`${dir}/frozen-${freshName}.json`), frozenRegression = need(`${dir}/regression-frozen.json`);
const registry = read('data/source_registry.json'), binding = expectedReleaseBinding();
const assessment = assessReleaseEvidenceV7({ resultFresh, frozenFresh, resultRegression, frozenRegression, topology, binding });
if (resultFresh.tag !== tag || resultRegression.tag !== tag) assessment.problems.push('result_tag_does_not_match_requested_tag');
if (resultFresh.set !== freshName || resultRegression.set !== 'regression') assessment.problems.push('result_set_does_not_match_requested_frozen_sets');
const release = buildCuetFitTopologyReleaseVNext({
  assessment, resultFresh, topology, tag, freshName, binding,
  sourceRegistryVersion: registry.version, at: new Date().toISOString(),
});
console.log(JSON.stringify(release, null, 2));
if (dry) process.exit(release.problems.length ? 2 : 0);
if (release.state !== 'released' || release.problems.length) throw Error('release_preflight_failed_no_files_written');
const path = 'data/calibration_manifest.json', manifest = read(path);
manifest.cuet_fit_releases = { ...(manifest.cuet_fit_releases || {}), [topology]: release };
writeFileSync(path + '.tmp', JSON.stringify(manifest, null, 2) + '\n'); renameSync(path + '.tmp', path);
writeFileSync(`${dir}/release-${topology}-${tag}.json`, JSON.stringify(release, null, 2) + '\n');
