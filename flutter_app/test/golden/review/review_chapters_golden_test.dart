// Review led by weak chapters (REVIEW-RESULT-1018 4, owner D18) at 412 x 915, Night and Day, on the reference student of the
// design (test/fixtures/review/student-1018.json: 220 marks lost, the lead chapter at 35 of the 80 marks on offer, nine saved
// repairs). The states: the lead chapter open, another chapter open, a chapter whose mistakes are all repaired, the whole page,
// the empty tab, loading, a failed read, and the zero-credit line.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/repositories/repair_local_repository.dart';
import 'package:mockmob/features/credits/data/credit_figures.dart' show CreditFigures;
import 'package:mockmob/features/review/screens/review_screen.dart';

import '../../unit/review/support/student_1018.dart';
import 'review_golden_support.dart';

const _phone = Size(412, 915);

List<Override> _student({
  Student1018? s,
  List<RepairLocalRecord> extra = const [],
  CreditFigures figures = const CreditFigures(practice: 40, ai: 68),
}) {
  final student = s ?? student1018();
  return reviewOverrides(
    attempts: student.attempts,
    records: [...student.records, ...extra],
    checks: student.checks,
    nowUtc: student.now,
    figures: figures,
  );
}

void main() {
  reviewGolden('rc412_lead', () => const ReviewScreen(), size: _phone, overrides: _student);

  // The whole page, top to bottom: the lead, More chapters, Revise, Saved repairs, the papers and the rows that open pages.
  reviewGolden('rc412_full', () => const ReviewScreen(), size: const Size(412, 4200), overrides: _student);

  // A tap on another chapter makes it the hero; the one that was the hero joins the list.
  reviewGolden(
    'rc412_other',
    () => const ReviewScreen(),
    size: const Size(412, 1700),
    overrides: _student,
    after: (tester) async {
      await tester.tap(find.textContaining('Dissolution of a firm').first);
      await tester.pumpAndSettle();
    },
  );

  // Every mistake of the lead chapter repaired: "Nothing left to repair", and Practise still leads.
  reviewGolden(
    'rc412_repaired',
    () => const ReviewScreen(),
    size: const Size(412, 1500),
    overrides: () {
      final s = student1018();
      final adm = [
        for (final (paper, q) in const [('m3', 42), ('m3', 38), ('m3', 45), ('m2', 11)])
          RepairLocalRecord(
            attemptId: paper,
            questionId: '$paper-q$q',
            requestId: 'req-$paper-q$q-000000000000',
            status: RepairLocalStatus.stored,
            ackedAt: DateTime.parse('2026-10-17T20:10:00+05:30'),
          ),
      ];
      return _student(s: s, extra: adm);
    },
  );

  reviewGolden('rc412_zero_credits', () => const ReviewScreen(), size: _phone, overrides: () => _student(figures: const CreditFigures(practice: 0, ai: 0)));
  reviewGolden('rc412_text130', () => const ReviewScreen(), size: const Size(412, 1500), overrides: _student, textScale: 1.3);
  reviewGolden('rc412_empty', () => const ReviewScreen(), size: _phone, overrides: () => reviewOverrides(attempts: const []));
  reviewGolden(
    'rc412_loading',
    () => const ReviewScreen(),
    size: _phone,
    overrides: () => reviewOverrides(attemptsState: const RemoteState<List<Attempt>>(loading: true)),
  );
  reviewGolden(
    'rc412_error',
    () => const ReviewScreen(),
    size: _phone,
    overrides: () => reviewOverrides(
      attemptsState: const RemoteState<List<Attempt>>(error: ApiError(kind: ApiErrorKind.network, code: 'network')),
    ),
  );
}
