import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parallelMeasurementCampaignDirectory, readParallelMeasurementRegistration, verifyRegisteredCampaign } from '../lib/parallelMeasurementRegistrationVNext.mjs';

const registration = readParallelMeasurementRegistration();
const directory = parallelMeasurementCampaignDirectory();
verifyRegisteredCampaign('improved', { directory, args: registration.worker_mode });
const campaignWorker = fileURLToPath(new URL('./cuetFitFactory.mjs', import.meta.url));
const stopFile = join(directory, `STOP_AFTER_WAVE-${randomUUID()}.json`);
const args = ['--use-system-ca', campaignWorker, 'worker', '--campaign-dir', directory,
  '--realtime-all', '--staging', '--measurement-only', '--parallel-measurement', '--max-waves', String(registration.maximum_wave_iterations), '--stop-file', stopFile];
console.log(JSON.stringify({ parallel_measurement: 'B', campaign_id: registration.arms.improved.campaign_id,
  candidate_count: registration.arms.improved.candidate_count, maximum_wave_iterations: registration.maximum_wave_iterations,
  publish: false, worker: 'cuetFitFactory.mjs' }));
const child = spawn(process.execPath, args, { cwd: process.cwd(), env: process.env, stdio: 'inherit', windowsHide: true });
let stopRequested = false;
const requestBoundaryStop = signal => {
  if (stopRequested) return;
  stopRequested = true;
  try { writeFileSync(stopFile, JSON.stringify({ requested_at: new Date().toISOString(), signal, action: 'finish_current_wave_then_stop' }) + '\n', { flag: 'wx' }); }
  catch (error) { if (error.code !== 'EEXIST') console.error(`parallel_measurement_stop_marker_failed:${error.code || 'unknown'}`); }
  console.log(JSON.stringify({ stop_requested: 'after_current_wave' }));
};
const onInterrupt = () => requestBoundaryStop('SIGINT'), onTerminate = () => requestBoundaryStop('SIGTERM');
process.on('SIGINT', onInterrupt);
process.on('SIGTERM', onTerminate);
child.once('error', error => { console.error(`parallel_measurement_worker_start_failed:${error.code || 'unknown'}`); process.exitCode = 1; });
child.once('exit', (code, signal) => {
  process.removeListener('SIGINT', onInterrupt);
  process.removeListener('SIGTERM', onTerminate);
  process.exitCode = code ?? (signal ? 1 : 0);
});
