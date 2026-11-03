// Additive, preregistered evidence adapter. Does not edit the frozen study or permit publication.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { payloadHash } from '../lib/cuetFitBenchmark.mjs';
import { expectedReleaseBindingV713 } from '../lib/releaseEvidenceV713.mjs';
const [directoryArg] = process.argv.slice(2);
if (!directoryArg) throw Error('prepared_study_directory_required');
const directory = resolve(directoryArg), path = name => resolve(directory, name);
const read = p => JSON.parse(readFileSync(p, 'utf8'));
const sha = p => createHash('sha256').update(readFileSync(p)).digest('hex');
const frozen = read(path('frozen.json')), reg = read(path('registration.json')), state = read(path('state.json'));
const binding = expectedReleaseBindingV713();
if (reg.qualification !== true || frozen.denominator !== 36 || frozen.fixtures.length !== 36 ||
    frozen.publication !== 'never' || frozen.verifier_contract !== binding.validation_contract_hash ||
    reg.contract_hash !== binding.validation_contract_hash || reg.prompt_hash !== binding.prompt_hash ||
    sha(path('frozen.json')) !== reg.frozen_sha256 || sha(path('registry.json')) !== reg.registry_sha256)
  throw Error('exact_prepared_fresh_study_required');
if (state.request_keys.length || Object.keys(state.cases).length || state.runs.length)
  throw Error('release_envelope_must_precede_every_evaluation');
if (existsSync(path('release-envelope.json'))) throw Error('release_envelope_exists_never_overwrite');
const releaseEligibility = { scope: 'full_cuet_release', classification: 'fresh', approved_before_evaluation: true,
  previously_read: false, tuned_on: false, preregistration_id: reg.id,
  custody_basis: frozen.custody.custody_basis,
  meaning: 'Academic cases authored after contract freeze; independent source-only oracle before evaluation. Local delegated custody, not cryptographic actor identity.' };
const envelope = { ...frozen, verifier_version: binding.verifier_version,
  payload_hash: payloadHash(frozen.fixtures), release_eligibility: releaseEligibility,
  underlying_frozen_path: path('frozen.json'), underlying_frozen_sha256: sha(path('frozen.json')),
  registration_sha256: sha(path('registration.json')), contract_binding: binding,
  adapted_at: new Date().toISOString(),
  limitation: 'This envelope only supplies exact preregistered fields to the existing release assessor. It contains no outcome and cannot release the generator. Both-provider complete fresh and regression evidence and receipts are still required.' };
writeFileSync(path('release-envelope.json'), JSON.stringify(envelope, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ prepared: path('release-envelope.json'), sha256: sha(path('release-envelope.json')),
  denominator: frozen.fixtures.length, provider_calls: 0, release_record: false }));
