// Launch-time connectivity only. No credentials, model inference or ledger access.
import { resolve } from 'node:path';

export const FACTORY_NETWORK_PROBES = Object.freeze([
  { provider: 'openai', url: 'https://api.openai.com/v1/models', statuses: [401] },
  { provider: 'gemini', url: 'https://generativelanguage.googleapis.com/v1beta/models', statuses: [400, 401, 403] },
]);
const RUNNERS = new Set([
  'scripts/pipeline/tools/runFreshCuetReadinessV74.mjs',
  'scripts/pipeline/tools/runFreshCuetReadinessV75.mjs',
  'scripts/pipeline/tools/runCuetPilotV75.mjs',
]);

export function factoryLaunchArguments(runner, args = []) {
  if (!RUNNERS.has(runner) || !Array.isArray(args) || args.some(value => typeof value !== 'string')) {
    throw Error('explicit_current_factory_runner_required');
  }
  return ['--use-system-ca', resolve(runner), ...args];
}

export async function checkFactoryConnectivity({ fetchImpl = fetch, timeoutMs = 10000 } = {}) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) throw Error('bounded_probe_timeout_required');
  const results = await Promise.all(FACTORY_NETWORK_PROBES.map(async probe => {
    try {
      const response = await fetchImpl(probe.url, {
        method: 'GET', redirect: 'error', signal: AbortSignal.timeout(timeoutMs),
      });
      await response.body?.cancel();
      return { provider: probe.provider, reachable: probe.statuses.includes(response.status), http_status: response.status };
    } catch (error) {
      const code = error?.cause?.code || error?.code || error?.name || 'unknown_network_error';
      return { provider: probe.provider, reachable: false, error_code: String(code) };
    }
  }));
  return { at: new Date().toISOString(), ready: results.every(result => result.reachable), results,
    paid_calls: 0, ledger_access: false, credentials_sent: false,
    scope: 'TLS/connectivity only; does not establish provider credit, model availability or receipt settlement' };
}

export async function launchAfterFactoryPreflight({ runner, args = [], fetchImpl, launch }) {
  const argv = factoryLaunchArguments(runner, args);
  if (typeof launch !== 'function') throw Error('launcher_required');
  const preflight = await checkFactoryConnectivity({ fetchImpl });
  if (!preflight.ready) return { launched: false, preflight, exit_code: 1 };
  return { launched: true, preflight, exit_code: await launch(argv) };
}
