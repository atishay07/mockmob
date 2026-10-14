import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/router/quick_start.dart' show QuickNta;
import '../../runner/runner_routes.dart' show NtaRoutes;
import '../model/cost_line.dart';
import '../model/practice_selection.dart';
import 'practice_catalog.dart';
import 'practice_quote.dart';

/// Start's NTA row, from the same quote the Practice tab reads: shown only when the server
/// offers the exam-day mode for the student's practice subject. `main.dart` overrides
/// `quickStartNtaProvider` with this.
final practiceQuickNtaProvider = Provider.autoDispose<QuickNta?>((ref) {
  final subject = ref.watch(practiceSubjectProvider);
  final quote = ref.watch(practiceQuoteProvider(QuoteQuery(subject: subject, apiMode: 'nta', count: mockQuestionCount))).value;
  if (quote == null || !quoteOffersMode(quote)) return null;
  return QuickNta(
    location: NtaRoutes.location(subject),
    subject: subject,
    proOnly: costLineFor(quote).kind == CostKind.proGated,
  );
});
