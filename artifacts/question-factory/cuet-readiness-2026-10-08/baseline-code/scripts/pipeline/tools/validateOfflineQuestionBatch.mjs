import { parseCliArgs, validateOfflineQuestionBatch } from '../lib/offlineBatchFactory.mjs';

const args = parseCliArgs();

const result = await validateOfflineQuestionBatch({
  dir: args.dir,
  quality: args.quality || process.env.OFFLINE_IMPORT_QUALITY_MODE || 'balanced',
  realSampleSize: Number(args['real-sample'] ?? args.realSample ?? 20),
});

console.log('[offline_validate]', {
  dir: result.dir,
  raw_questions: result.validatorResults.raw_count,
  schema_valid: result.validatorResults.schema_valid_count,
  alignment_pass: result.validatorResults.alignment_pass_count,
  selfcheck_pass: result.validatorResults.selfcheck_pass_count,
  mini_accepted: result.validatorResults.mini_validator_accepted_count,
  strict_accepted: result.validatorResults.strict_validator_accepted_count,
  final_accepted: result.validatorResults.final_accepted_count,
  final_rejected: result.validatorResults.final_rejected_count,
  real_validation_sample_status: result.realValidationSample?.status || 'missing',
  real_validation_sample_accepted: result.realValidationSample?.accepted_count ?? null,
});
