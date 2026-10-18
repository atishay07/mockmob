import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/mistake_lab_traps.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart' show KeyButton, MmSelectRow;
import 'package:mockmob/features/review/data/repair_check_api.dart';
import 'package:mockmob/features/review/revise/revise_data.dart';
import 'package:mockmob/features/review/revise/revise_screen.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'support/repair_check_fixtures.dart';

Map<String, dynamic> _later() => jsonDecode(File('test/fixtures/mistake_lab/contract_later_v1.json').readAsStringSync()) as Map<String, dynamic>;

Map<String, dynamic> _answer(String which, {bool? correct}) => {...((_later()['answers'] as Map)[which] as Map).cast<String, dynamic>(), 'correct': ?correct};

/// The website's merged queue (`GET /api/me/revise?queue=1`, src/lib/server/revise.js composeQueue): a repaired
/// mistake due again, a wrong answer, the same wrong answer again (the phone keeps one card per question), a
/// pending Check it held and two concept cards.
Map<String, dynamic> queueBody({bool checks = true, int cards = 2}) {
  final revise = (_later()['revise'] as Map).cast<String, dynamic>();
  final items = (revise['items'] as List).cast<Map<String, dynamic>>();
  return {
    ...revise,
    'queue': {
      'version': 2,
      'items': [
        {...items[0], 'kind': 'again', 'source': 'Mock 2, 12 Oct, 10:42 PM'},
        {...items[1], 'kind': 'question', 'source': null},
        {...items[0], 'kind': 'question'},
        if (checks) {'kind': 'check', 'attemptId': 'm7', 'questionId': 'm7-q0', 'number': 42, 'paper': 'Mock 3', 'chapter': 'Admission of a partner'},
        for (var i = 0; i < cards; i++) {'kind': 'card', 'slot': i + 1},
      ],
      'counts': {'questions': 1, 'again': 1, 'checks': checks ? 1 : 0, 'cards': cards, 'back': 2},
      'total': 99,
      'minutes': 4,
    },
  };
}

class _Api implements ReviseApi {
  _Api(this.body);

  final Map<String, dynamic> body;
  final List<String> answered = [];
  final List<ReviseAnswer> grades = [];

  @override
  Future<ReviseRead> read({required int cap}) async => ReviseRead.parse({...body, 'cap': cap});

  @override
  Future<ReviseAnswer> answer({required String questionId, required int choice, required int cap}) async {
    answered.add(questionId);
    return grades.removeAt(0);
  }
}

Future<void> _settle(WidgetTester tester) async {
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 400));
  await tester.pump(const Duration(milliseconds: 400));
}

Finder _key(String label) => find.byWidgetPredicate((w) => w is KeyButton && w.label == label);

Future<void> _pump(WidgetTester tester, _Api api, {FakeCheckApi? check}) async {
  tester.view.physicalSize = const Size(390, 2400) * 2;
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        reviseApiProvider.overrideWithValue(api),
        revisePrefsStoreProvider.overrideWithValue(MemoryPrefsStore()),
        repairCheckApiProvider.overrideWithValue(check ?? FakeCheckApi()),
      ],
      child: DefaultAssetBundle(
        bundle: FileAssetBundle(),
        child: MaterialApp(
          theme: buildTheme(Brightness.light),
          builder: (context, app) => MediaQuery(data: MediaQuery.of(context).copyWith(disableAnimations: true), child: app!),
          home: const ReviseScreen(),
        ),
      ),
    ),
  );
  await _settle(tester);
}

Future<void> _tapKey(WidgetTester tester, String label) async {
  final k = _key(label);
  expect(k, findsOneWidget, reason: label);
  await tester.ensureVisible(k);
  await tester.tap(k);
  await _settle(tester);
}

/// Revise as one queue (LEARN-REVIEW-1017 5.8, P-LR5): the questions back and the repaired mistakes, deduped by
/// question, then the pending Check it held in the same run, then the concept cards from the lesson recall run.
void main() {
  setUpAll(loadAppFonts);

  test('the queue keeps one card per question, the checks it can ask, and a head that adds up', () {
    final read = ReviseRead.parse(queueBody());
    final q = read.queue!;
    expect([for (final i in q.back) '${i.kind}:${i.questionId}'], ['again:r-q5', 'question:r-q1']);
    expect(q.back.first.source, 'Mock 2, 12 Oct, 10:42 PM');
    expect(q.checks.single.key, 'm7/m7-q0');
    expect(q.checks.single.number, 42);
    expect((q.counts.back, q.counts.again, q.counts.checks, q.counts.cards), (2, 1, 1, 2));
    // The head counts what the phone shows: 2 back, 1 check, 2 cards (never the server's stray 99).
    expect(q.total, 5);
    expect(read.runItems.length, 2);
    expect(read.runChecks.length, 1);
  });

  test('an older server without the queue plays its plain list, and cards above five are capped', () {
    final plain = ReviseRead.parse((_later()['revise'] as Map).cast<String, dynamic>());
    expect(plain.queue, isNull);
    expect(plain.runItems.length, 4);
    expect(plain.runChecks, isEmpty);
    expect(ReviseRead.parse(queueBody(cards: 9)).queue!.counts.cards, 5);
  });

  testWidgets('the top: one head, the mix line, and the box lanes folded under How Revise schedules', (tester) async {
    await _pump(tester, _Api(queueBody()));
    expect(find.text('5 due today, about 4 minutes.'), findsOneWidget);
    expect(find.text('2 questions back, 1 Check it held, 2 concept cards'), findsOneWidget);
    expect(find.text('Free. Not counted in your marks or accuracy.'), findsOneWidget);
    expect(find.text('Box 1'), findsNothing, reason: 'the lanes are folded');
    await tester.tap(find.text('How Revise schedules'));
    await _settle(tester);
    expect(find.text('Box 1'), findsOneWidget);
    // The first card says what it is and where it came from.
    expect(find.text('1 of 3. A mistake you repaired'), findsOneWidget);
    expect(find.text('Mock 2, 12 Oct, 10:42 PM. Cash Flow Statement'), findsOneWidget);
  });

  testWidgets('one run: two questions back, the Check it held, then the end with the concept cards', (tester) async {
    final api = _Api(queueBody())
      ..grades.addAll([
        ReviseAnswer.tryParse(_answer('right'))!,
        ReviseAnswer.tryParse(_answer('wrong', correct: false))!,
      ]);
    final check = FakeCheckApi(onSubmit: (_, _) => answer(right: true));
    await _pump(tester, api, check: check);

    await tester.tap(find.text('B. Illustrative option 5b'));
    await _settle(tester);
    await _tapKey(tester, 'Next question');
    expect(find.text('2 of 3. A question you got wrong'), findsOneWidget);
    await tester.tap(find.text('A. Illustrative option 1a'));
    await _settle(tester);
    await _tapKey(tester, 'Next question');
    expect(api.answered, ['r-q5', 'r-q1']);

    // The check: its place in the run, the mistake it checks, Review's own Check it held block.
    expect(find.text('3 of 3'), findsOneWidget);
    expect(find.text('Your Q42 rule. Mock 3. Admission of a partner'), findsOneWidget);
    expect(find.text('Check it held'), findsOneWidget);
    expect(check.loads, 1);
    expect(_key('Skip for today'), findsOneWidget);
    expect(_key('Finish'), findsNothing, reason: 'the student answers it or leaves it for later');
    await tester.tap(find.widgetWithText(MmSelectRow, 'Debit Goodwill, credit the sacrificing partners'));
    await tester.pump();
    final submit = find.widgetWithText(KeyButton, 'Check my answer').first;
    await tester.ensureVisible(submit);
    await tester.tap(submit);
    await _settle(tester);
    expect(check.submits.single.attemptId, 'm7');
    await _tapKey(tester, 'Finish');

    // The end: the questions back, the check as the server marked it, and the concept cards next.
    expect(find.text('1 recalled, 1 come back tomorrow'), findsOneWidget);
    expect(find.text('1 held on a new question.'), findsOneWidget);
    expect(_key('Revise 2 concept cards'), findsOneWidget);
    expect(_key('Back to Review'), findsOneWidget);
  });

  testWidgets('a check left for later is still due, and the end says so', (tester) async {
    final api = _Api(queueBody(cards: 0))
      ..grades.addAll([
        ReviseAnswer.tryParse(_answer('right'))!,
        ReviseAnswer.tryParse(_answer('right'))!,
      ]);
    await _pump(tester, api);
    for (final pick in ['B. Illustrative option 5b', 'B. Illustrative option 1b']) {
      await tester.tap(find.text(pick));
      await _settle(tester);
      await _tapKey(tester, 'Next question');
    }
    await _tapKey(tester, 'Skip for today');
    expect(find.text('2 recalled'), findsOneWidget);
    expect(find.text('1 Check it held is still due. It stays in Revise.'), findsOneWidget);
    expect(_key('Back to Review'), findsOneWidget);
    expect(find.textContaining('concept card'), findsNothing);
  });
}
