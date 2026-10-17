import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/result/data/result_providers.dart';

import '../../helpers/fonts.dart';
import 'support/fixtures.dart';
import 'support/harness.dart';
import 'support/lab_fixtures.dart' show labContract;

Map<String, dynamic> contract(String name) =>
    jsonDecode(File('test/fixtures/mistake_lab/contract_${name}_v1.json').readAsStringSync()) as Map<String, dynamic>;

Finder get _page => find.byType(Scrollable).first;

/// Mistake Lab v4 slice 4 on the full result: the trap tag under the opened wrong answer, "Same
/// mistakes later" in Prove, and "Your traps across mocks" at the end of Find.
void main() {
  setUpAll(loadAppFonts);

  Future<void> pump(WidgetTester tester, Map<String, dynamic> lab, {String location = '/result/a7'}) async {
    final d = detail(attemptBody: {...attemptJson(), 'lab': lab});
    await pumpResultRoute(
      tester,
      openFolds: true,
      location: location,
      overrides: resultOverrides(attemptId: 'a7', data: RecapData(model: mock7(withDetail: d), attempt: d.attempt, detail: d), log: ResultLog()),
    );
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pumpAndSettle();
  }

  /// The first wrong answer of Mock 7 (question 6): the option the student chose, and its letter.
  ({String qid, int given, String letter}) firstWrong() {
    final d = detail();
    final q = d.attempt.details.firstWhere((x) => x.isCorrect == false);
    return (qid: q.qid, given: q.givenIndex!, letter: 'ABCD'[q.givenIndex!]);
  }

  Map<String, dynamic> tagFor(({String qid, int given, String letter}) w, {String source = 'repair'}) => {
        'index': w.given,
        'letter': w.letter,
        'trapType': 'look_alike_term',
        'label': 'A look-alike term',
        'text': 'Trap: a look-alike term',
        'detail': null,
        'source': source,
        'sourceText': source == 'repair' ? 'Named by Mistake Repair' : 'From the question format',
      };

  testWidgets('the trap under the student\'s wrong option once that answer is open, and nowhere else', (tester) async {
    final w = firstWrong();
    final number = int.parse(w.qid.substring(1));
    await pump(
      tester,
      {
        ...labContract('ready'),
        'traps': {'version': 1, 'tags': {w.qid: tagFor(w)}},
      },
      location: '/result/a7?q=$number',
    );
    await tester.scrollUntilVisible(find.text('Trap: a look-alike term'), 300, scrollable: _page);
    expect(find.text('Trap: a look-alike term'), findsOneWidget);
    expect(find.text('Named by Mistake Repair'), findsOneWidget);
  });

  testWidgets('no tags from the server: the answers read as before', (tester) async {
    final w = firstWrong();
    final number = int.parse(w.qid.substring(1));
    await pump(tester, labContract('ready'), location: '/result/a7?q=$number');
    await tester.scrollUntilVisible(find.text('Every answer, all 50'), 400, scrollable: _page);
    expect(find.textContaining('Trap:'), findsNothing);
  });

  testWidgets('Find ends with the traps disclosure, Prove has Same mistakes later, in that order', (tester) async {
    await pump(tester, {
      ...labContract('ready'),
      'prove': {'later': contract('later')['prove']},
    });
    await tester.scrollUntilVisible(find.text('Same mistakes later'), 300, scrollable: _page);
    expect(find.text('Your traps across mocks'), findsOneWidget);
    expect(find.text('7 of these come back tomorrow, Fri 16 Oct.'), findsOneWidget);
    expect(find.text('Open Revise'), findsNothing, reason: 'tomorrow: nothing to open yet');
    double top(Finder f) => tester.getTopLeft(f.first).dy;
    expect(top(find.text('Your traps across mocks')) < top(find.text('Same mistakes later')), isTrue);
  });

  testWidgets('ready now: Same mistakes later opens Revise', (tester) async {
    await pump(tester, {
      ...labContract('ready'),
      'prove': {'later': contract('later')['proveWithCards']},
    });
    await tester.scrollUntilVisible(find.text('Same mistakes later'), 300, scrollable: _page);
    expect(find.text('5 of these are ready to revise now.'), findsOneWidget);
    expect(find.text('Open Revise'), findsWidgets);
  });

  testWidgets('an older server (no lab slice 4): none of it', (tester) async {
    await pump(tester, labContract('ready'));
    await tester.scrollUntilVisible(find.text('Every answer, all 50'), 400, scrollable: _page);
    expect(find.text('Same mistakes later'), findsNothing);
    expect(find.textContaining('Trap:'), findsNothing);
  });
}
