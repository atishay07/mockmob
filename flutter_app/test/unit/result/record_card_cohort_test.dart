import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/domain/domain.dart';
import 'package:mockmob/core/models/models.dart';
import 'package:mockmob/core/widgets/widgets.dart' show KeyButton;
import 'package:mockmob/features/result/copy.dart';
import 'package:mockmob/features/result/data/result_providers.dart';
import 'package:mockmob/features/result/full/full_sections.dart' show cohortLead;
import 'package:mockmob/features/result/model/recap_model.dart' show RecapModel;

import '../../helpers/fonts.dart';
import 'support/fixtures.dart';
import 'support/harness.dart';
import 'support/lab_fixtures.dart' show labContract;

/// Mock 7's wrong answers: tonight's chapter is Admission of a partner (4); question 11 is in
/// Goodwill (3 wrong), a chapter the repair order can lead to.
const _leadQid = 'q11';

Map<String, dynamic> orderLeading(RecapModel m, String qid, {String reason = 'most_right', String line = '26 of 31 other students got it right.'}) {
  final c = m.candidates.firstWhere((x) => x.questionId == qid);
  return {
    'version': 1,
    'state': 'cohort',
    'items': [
      {'qid': c.questionId, 'number': c.number, 'reason': reason, 'key': 'Repair Q${c.number} first', 'line': line},
      for (final o in m.candidates)
        if (o.questionId != c.questionId) {'qid': o.questionId, 'number': o.number, 'reason': 'paper', 'key': null, 'line': null},
    ],
  };
}

Finder keyLabelled(String label) => find.byWidgetPredicate((w) => w is KeyButton && w.label == label);

/// Recap card 4 (the one with the repair key) follows the server's repair order, the same as the
/// full result's key and the repair run (Mistake Lab v4 slice 3, spec 4.7): when the order leads
/// with a question most other students got right, or a common trap, the key opens that run.
void main() {
  setUpAll(loadAppFonts);

  Future<(GoRouter, RecapModel)> pump(WidgetTester tester, {Map<String, dynamic> Function(RecapModel m)? order}) async {
    final base = mock7();
    final lab = order == null ? null : {...labContract('ready'), 'repairOrder': order(base)};
    final d = detail(attemptBody: {...attemptJson(), 'lab': ?lab});
    final m = mock7(withDetail: d);
    final router = await pumpResultRoute(
      tester,
      location: '/result/a7/recap/4',
      disableAnimations: true,
      overrides: resultOverrides(attemptId: m.attemptId, data: RecapData(model: m, attempt: d.attempt, detail: d), log: ResultLog()),
    );
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pump(const Duration(milliseconds: 400));
    return (router, m);
  }

  testWidgets('no repair order: tonight\'s chapter, today\'s key and words', (tester) async {
    await pump(tester);
    expect(keyLabelled('Repair Admission of a partner, 3 mistakes'), findsOneWidget);
    expect(find.textContaining('Repair Q'), findsNothing);
  });

  testWidgets('a paper-order repair order is today\'s too', (tester) async {
    await pump(
      tester,
      order: (m) => {
        'version': 1,
        'state': 'paper',
        'items': [for (final o in m.candidates) {'qid': o.questionId, 'number': o.number, 'reason': 'paper', 'key': null, 'line': null}],
      },
    );
    expect(keyLabelled('Repair Admission of a partner, 3 mistakes'), findsOneWidget);
    expect(find.textContaining('Repair Q'), findsNothing);
  });

  testWidgets('a cohort order leading to question 11: the key names that run, the server\'s line says why, and the key opens it', (tester) async {
    final (router, m) = await pump(tester, order: (m) => orderLeading(m, _leadQid));
    final q = m.candidates.firstWhere((c) => c.questionId == _leadQid);
    final scope = RepairCandidates.scopeOf(m.candidates, startQuestionId: _leadQid, limit: 3)!;
    // The key says what opens: the led chapter, cut to the default 10-minute length.
    final label = ResultCopy.repairKey(scope, 10);
    expect(label, 'Repair Goodwill, 3 mistakes');
    expect(keyLabelled(label), findsOneWidget);
    expect(keyLabelled('Repair Admission of a partner, 3 mistakes'), findsNothing);
    // Why it starts there, in the website's words, with its denominator.
    expect(find.text('Repair Q${q.number} first. 26 of 31 other students got it right.'), findsOneWidget);
    expect(find.text(ResultCopy.repairScopeLine(scope, 10)), findsOneWidget);
    await tester.tap(keyLabelled(label));
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pump(const Duration(milliseconds: 500));
    expect(router.routerDelegate.currentConfiguration.uri.toString(), '/review/repair/a7/$_leadQid?count=3&minutes=10');
  });

  testWidgets('a common trap leads the same way, with its own line', (tester) async {
    final (router, m) = await pump(
      tester,
      order: (m) => orderLeading(m, _leadQid, reason: 'common_trap', line: '8 of the 12 who got it wrong chose B, as you did.'),
    );
    expect(find.text('Repair Q11 first. 8 of the 12 who got it wrong chose B, as you did.'), findsOneWidget);
    final scope = RepairCandidates.scopeOf(m.candidates, startQuestionId: _leadQid, limit: 3)!;
    await tester.tap(keyLabelled(ResultCopy.repairKey(scope, 10)));
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pump(const Duration(milliseconds: 500));
    expect(router.routerDelegate.currentConfiguration.uri.path, '/review/repair/a7/$_leadQid');
  });

  testWidgets('the length chips are sized to the led run: 5 minutes holds 2 of its 3, and the key and the link say so', (tester) async {
    final (router, m) = await pump(tester, order: (m) => orderLeading(m, _leadQid));
    await tester.tap(find.text(ResultCopy.chip(5)));
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pump(const Duration(milliseconds: 500));
    final scope = RepairCandidates.scopeOf(m.candidates, startQuestionId: _leadQid, limit: 2)!;
    expect(scope.count, 2);
    final label = ResultCopy.repairKey(scope, 5);
    expect(label, 'Repair Goodwill, 2 mistakes');
    expect(keyLabelled(label), findsOneWidget);
    // Tonight's chapter has 4 and would offer 15 minutes' worth; the led run of 3 does not.
    expect(find.text(ResultCopy.chip(20)), findsNothing);
    await tester.tap(keyLabelled(label));
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pump(const Duration(milliseconds: 500));
    expect(router.routerDelegate.currentConfiguration.uri.toString(), '/review/repair/a7/$_leadQid?count=2&minutes=5');
  });

  testWidgets('a led question that cannot be repaired here gives way to today\'s key', (tester) async {
    await pump(
      tester,
      order: (m) => {
        'version': 1,
        'state': 'cohort',
        'items': [
          {'qid': 'not-on-this-paper', 'number': 99, 'reason': 'most_right', 'key': 'Repair Q99 first', 'line': '20 of 22 other students got it right.'},
        ],
      },
    );
    expect(keyLabelled('Repair Admission of a partner, 3 mistakes'), findsOneWidget);
    expect(find.textContaining('Repair Q99'), findsNothing);
  });

  test('the card and the full result lead to the same question', () {
    final m = mock7();
    final order = RepairOrder.tryParse(orderLeading(m, _leadQid))!;
    expect(cohortLead(m, order)!.$1.qid, _leadQid);
    expect(cohortLead(m, order)!.$2.count, 3);
  });
}
