import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_state.dart';
import '../../../core/router/quick_start.dart' show QuickNta;
import '../../runner/runner_routes.dart' show NtaRoutes;
import '../model/cost_line.dart';
import '../model/practice_selection.dart';
import 'practice_catalog.dart';
import 'practice_quote.dart';

/// Start's NTA row, from the same quote the Practice tab reads (D101: always listed). Before the
/// quote answers it reads from the plan (Pro's for a Free student), so the row never pops in late;
/// it leaves only when the server says the exam-day mode is not offered for the student's practice
/// subject. `main.dart` overrides `quickStartNtaProvider` with this.
final practiceQuickNtaProvider = Provider.autoDispose<QuickNta?>((ref) {
  final subject = ref.watch(practiceSubjectProvider);
  final quote = ref.watch(practiceQuoteProvider(QuoteQuery(subject: subject, apiMode: 'nta', count: mockQuestionCount))).value;
  final access = practiceModeAccess(quote, isPro: ref.watch(authSnapshotProvider.select((a) => a.isPro)));
  if (access == ModeAccess.notOffered) return null;
  return QuickNta(location: NtaRoutes.location(subject), subject: subject, proOnly: access == ModeAccess.locked);
});
