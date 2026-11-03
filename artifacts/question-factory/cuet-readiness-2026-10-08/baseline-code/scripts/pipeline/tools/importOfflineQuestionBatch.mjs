import { importOfflineQuestionBatch, parseCliArgs } from '../lib/offlineBatchFactory.mjs';

const args = parseCliArgs();
const write = args.write === true;
const dryRun = args['dry-run'] === true || args.dryRun === true || !write;

const result = await importOfflineQuestionBatch({
  dir: args.dir,
  quality: args.quality || process.env.OFFLINE_IMPORT_QUALITY_MODE || 'balanced',
  dryRun,
  write,
});

console.log('[offline_import]', {
  dir: result.importResults.dir,
  dry_run: result.importResults.dry_run,
  write_requested: result.importResults.write_requested,
  allow_db_write: result.importResults.allow_db_write,
  accepted_candidates: result.importResults.accepted_candidates_count,
  db_duplicates: result.importResults.db_duplicate_count,
  importable: result.importResults.importable_count,
  inserted: result.importResults.inserted_count,
  blocked_reasons: result.importResults.blocked_reasons,
});
