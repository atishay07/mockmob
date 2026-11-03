// Execution-only safeguards. No model payload, credentials, reservations, or academic judgments.
import { longFetch } from './longFetch.mjs';
const CODES = new Set(['ENOTFOUND', 'EAI_AGAIN', 'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT',
  'CERT_HAS_EXPIRED', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_VERIFY_FIRST_CERTIFICATE', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'ERR_TLS_CERT_ALTNAME_INVALID',
  'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_SOCKET', 'ABORT_ERR']);
function knownCodes(error) {
  const codes = []; let current = error;
  for (let depth = 0; current && depth < 3; depth++, current = current.cause) {
    if (CODES.has(current.code)) codes.push(current.code);
  }
  return codes;
}
export function providerTransportFaultV713R3(error) {
  if (error?.providerReceipt) return /^provider_http_5\d\d:/.test(error.message || '');
  return knownCodes(error).length > 0 ||
    /unable to verify (?:the )?first certificate|self.signed certificate|certificate (?:has expired|verify failed)|fetch failed|ENOTFOUND|EAI_AGAIN|ECONNRESET|ECONNREFUSED|ETIMEDOUT|UND_ERR|operation was aborted|timed out|TimeoutError/i.test(error?.message || '');
}
export function transportDiagnosticV713R3(error) {
  const codes = knownCodes(error);
  return { message: providerTransportFaultV713R3(error) ? 'Provider connection or availability interrupted.' : 'Execution paused.',
    code: CODES.has(error?.code) ? error.code : null,
    cause_code: codes.find(code => code !== error?.code) || null,
    classification: providerTransportFaultV713R3(error) ? 'provider_transport_fault' : 'other' };
}
export async function assertTrustedNetworkV713R3({ fetchImpl = longFetch, execArgv = process.execArgv,
  env = process.env, platform = process.platform } = {}) {
  if (env.NODE_TLS_REJECT_UNAUTHORIZED === '0') throw Error('insecure_tls_configuration_forbidden');
  const trustFlags = [...(env.NODE_OPTIONS || '').split(/\s+/), ...execArgv].filter(flag => ['--use-system-ca', '--no-use-system-ca'].includes(flag));
  if (platform === 'win32' && trustFlags.at(-1) !== '--use-system-ca') throw Error('trusted_system_ca_launch_required');
  const rows = [];
  for (const host of ['api.openai.com', 'generativelanguage.googleapis.com']) {
    // Any HTTP status proves DNS + TLS completed; this is not an inference/API request.
    const response = await fetchImpl(`https://${host}/`, { method: 'HEAD', signal: AbortSignal.timeout(15000) });
    if (!Number.isInteger(response.status) || response.status < 100 || response.status > 599) throw Error('trusted_tls_probe_invalid_response');
    rows.push({ host, method: 'HEAD', status: response.status, tls_verified: true });
  }
  return { schema: 'cuet-v713-trusted-network-r3', checked_at: new Date().toISOString(),
    contains_credentials: false, contains_question_payload: false, model_calls: 0, rows };
}
