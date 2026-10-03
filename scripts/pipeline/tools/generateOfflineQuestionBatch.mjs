import { generateOfflineQuestionFiles, parseCliArgs } from '../lib/offlineBatchFactory.mjs';

const args = parseCliArgs();

const result = generateOfflineQuestionFiles({
  subject: args.subject,
  chapter: args.chapter,
  quality: args.quality,
  count: Number(args.count || 100),
  batchSize: Number(args['batch-size'] || args.batchSize || 10),
  out: args.out,
});

console.log('[offline_generate]', {
  out: result.outDir,
  subject: result.subject,
  chapter: result.chapter,
  quality: result.quality,
  raw_questions: result.count,
  batch_size: result.batchSize,
  files_written: result.files.length,
});
