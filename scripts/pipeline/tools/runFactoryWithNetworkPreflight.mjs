// Additive entry point; never changes registered runner hashes or active workers.
// node scripts/pipeline/tools/runFactoryWithNetworkPreflight.mjs --probe-only
// node scripts/pipeline/tools/runFactoryWithNetworkPreflight.mjs scripts/pipeline/tools/runFreshCuetReadinessV74.mjs <existing arguments>
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkFactoryConnectivity, launchAfterFactoryPreflight } from '../lib/factoryNetworkLaunchPreflight.mjs';

const childExit = argv => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, argv, { windowsHide: true, stdio: 'inherit', env: process.env });
  child.once('error', reject);
  child.once('close', code => resolve(code ?? 1));
});

if (!process.execArgv.includes('--use-system-ca')) {
  process.exitCode = await childExit(['--use-system-ca', fileURLToPath(import.meta.url), ...process.argv.slice(2)]);
} else if (process.argv[2] === '--probe-only' && process.argv.length === 3) {
  const result = await checkFactoryConnectivity();
  console.log(JSON.stringify(result));
  process.exitCode = result.ready ? 0 : 1;
} else {
  const result = await launchAfterFactoryPreflight({
    runner: process.argv[2], args: process.argv.slice(3),
    launch: async argv => { console.log(JSON.stringify({ network_preflight: 'passed', paid_calls_in_preflight: 0 })); return childExit(argv); },
  });
  if (!result.launched) console.log(JSON.stringify(result.preflight));
  process.exitCode = result.exit_code;
}
