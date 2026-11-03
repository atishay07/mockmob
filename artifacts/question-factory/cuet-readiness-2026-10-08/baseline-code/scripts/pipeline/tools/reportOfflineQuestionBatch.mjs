import { buildOfflineBatchReport, parseCliArgs, writeOfflineBatchReport } from '../lib/offlineBatchFactory.mjs';

const args = parseCliArgs();
const dir = args.dir || 'data/offline_question_batches/economics_money_banking';
const report = buildOfflineBatchReport({ dir, quality: args.quality || process.env.OFFLINE_IMPORT_QUALITY_MODE || 'balanced' });
const paths = writeOfflineBatchReport(dir, report);

console.log('[offline_report]', {
  dir,
  report_json: paths.json,
  report_markdown: paths.markdown,
  final_accepted: report.counts.final_accepted,
  good_enough_to_import: report.recommendation.good_enough_to_import,
});
