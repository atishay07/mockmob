import 'package:flutter/rendering.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/models/models.dart';
import 'package:mockmob/features/result/copy.dart';
import 'package:mockmob/features/result/data/result_providers.dart';
import 'package:mockmob/features/result/full/answer_row.dart' show AnswerRow;
import 'package:mockmob/features/result/full/full_sections.dart' show BlankGroup;
import 'package:mockmob/features/result/model/recap_model.dart';
import 'package:mockmob/features/today/logic/today_model.dart' show GoTo, TodayAction;

import '../../helpers/fonts.dart';
import 'support/fixtures.dart';
import 'support/harness.dart';

String _at(GoRouter r) => r.routerDelegate.currentConfiguration.uri.toString();

Future<void> _run(WidgetTester tester, int ms) async {
  await tester.pump();
  for (var t = 0; t < ms; t += 16) {
    await tester.pump(const Duration(milliseconds: 16));
  }
}

/// The student's first Business Studies mock, with six earlier Accountancy mocks on record.
({RecapModel model, AttemptDetail detail}) firstBusinessStudiesMock({List<(String, V)>? paper}) {
  final d = detail(attemptBody: attemptJson(subject: 'business_studies', paper: paper));
  return (model: mock7(withDetail: d, attempts: [...history(), d.attempt]), detail: d);
}

/// Six blank questions in one chapter and ten right ones: the leading chapter is blanks only.
List<(String, V)> blanksOnlyPaper() => [
  for (var i = 0; i < 6; i++) ('Business environment', V.blank),
  for (var i = 0; i < 10; i++) ('Nature and purpose of business', V.right),
];

void main() {
  setUpAll(loadAppFonts);

  Future<GoRouter> open(
    WidgetTester tester,
    String location,
    RecapModel m,
    AttemptDetail d, {
    Size size = const Size(384, 853),
    double textScale = 1,
    TodayAction? nextMove,
  }) async {
    final router = await pumpResultRoute(
      tester,
      location: location,
      size: size,
      textScale: textScale,
      overrides: resultOverrides(
        attemptId: m.attemptId,
        data: RecapData(model: m, attempt: d.attempt, detail: d),
        ritual: const RecapRitual(sheetsOpened: 1),
        nextMove: nextMove,
      ),
    );
    await _run(tester, 1500);
    return router;
  }

  group('P1-2: the effort line is per subject', () {
    test('the first paper names its subject, never "first full paper"', () {
      expect(ResultCopy.effort(1, firstInSubject: true, subject: 'Business Studies'), 'Your first Business Studies paper.');
      expect(ResultCopy.effort(5, firstInSubject: true, subject: 'Business Studies'), 'Your first Business Studies paper.');
      expect(ResultCopy.effort(1, firstInSubject: false, subject: 'Accountancy'), 'First full paper this month.');
      expect(ResultCopy.effort(3, firstInSubject: false, subject: 'Accountancy'), 'Third full paper this month.');
    });

    testWidgets('card 4 of a first Business Studies mock, after seven Accountancy papers', (tester) async {
      final f = firstBusinessStudiesMock();
      expect(f.model.ordinal, 1);
      await open(tester, '/result/a7/recap/4', f.model, f.detail);
      // The first mock is said once, by the token row; no second line about it.
      expect(find.text('Your first Business Studies paper.'), findsNothing);
      expect(find.text('Your first full paper.'), findsNothing);
    });
  });

  group('P2-5: card 3 with blanks only still goes on', () {
    testWidgets('the primary key continues to card 4; practising the chapter is a second key', (tester) async {
      final f = firstBusinessStudiesMock(paper: blanksOnlyPaper());
      await open(tester, '/result/a7/recap/3', f.model, f.detail);
      expect(find.text('Start with the questions you left blank in Business environment'), findsOneWidget);
      expect(find.text('Practise this chapter'), findsOneWidget);
      await tester.tap(find.text('See what is recorded'));
      await _run(tester, 900);
      expect(find.bySemanticsLabel(RegExp(r'^Card 4 of 4')), findsOneWidget);
      expect(find.text('Mock 1 is in your record.'), findsOneWidget);
    });

    testWidgets('Practise this chapter still leaves for practice on that chapter', (tester) async {
      final f = firstBusinessStudiesMock(paper: blanksOnlyPaper());
      final router = await open(tester, '/result/a7/recap/3', f.model, f.detail);
      await tester.tap(find.text('Practise this chapter'));
      await tester.pumpAndSettle();
      expect(_at(router), startsWith('/practice/setup/chapter'));
      expect(_at(router), contains('subject=business_studies'));
    });

    testWidgets('both keys are at least 48 dp tall', (tester) async {
      final f = firstBusinessStudiesMock(paper: blanksOnlyPaper());
      await open(tester, '/result/a7/recap/3', f.model, f.detail, size: const Size(360, 748), textScale: 1.3);
      for (final label in ['See what is recorded', 'Practise this chapter']) {
        // The quiet key paints 40 dp and answers a finger in a 48 dp box (MmHitSlop), so the
        // semantics node, which is what the touch target is measured on, is the 48.
        final node = tester.getSemantics(find.ancestor(of: find.text(label), matching: find.byType(Semantics)).first);
        expect(node.rect.height, greaterThanOrEqualTo(48), reason: label);
      }
    });
  });

  // The answer rows inside the folded "Not attempted" group: none until it is opened. A row names
  // only its question (the group header says why they are here), so they are counted by type.
  final blankRows = find.descendant(of: find.byType(BlankGroup), matching: find.byType(AnswerRow));

  group('P3-8: the full result folds the "Not attempted" rows', () {
    testWidgets('folded by default; one tap shows the rows, another folds them', (tester) async {
      final f = firstBusinessStudiesMock(paper: blanksOnlyPaper());
      await open(tester, '/result/a7', f.model, f.detail);
      expect(blankRows, findsNothing);
      final header = find.text('Not attempted (6)');
      await tester.scrollUntilVisible(header, 300, scrollable: find.byType(Scrollable).first);
      expect(find.bySemanticsLabel('6 questions not attempted. Show them.'), findsOneWidget);
      await tester.tap(header);
      await _run(tester, 400);
      expect(blankRows, findsNWidgets(6));
      expect(find.bySemanticsLabel('6 questions not attempted. Hide them.'), findsOneWidget);
      await tester.tap(header);
      await _run(tester, 400);
      expect(blankRows, findsNothing);
    });

    testWidgets('the correct answers are reachable without passing every blank', (tester) async {
      final f = firstBusinessStudiesMock(paper: blanksOnlyPaper());
      await open(tester, '/result/a7', f.model, f.detail);
      final correct = find.text('Correct (10)');
      await tester.scrollUntilVisible(correct, 300, scrollable: find.byType(Scrollable).first);
      expect(correct, findsOneWidget);
      expect(blankRows, findsNothing);
    });

    testWidgets('a link to a blank question opens the group on it', (tester) async {
      final f = firstBusinessStudiesMock(paper: blanksOnlyPaper());
      await open(tester, '/result/a7?q=3', f.model, f.detail);
      expect(find.bySemanticsLabel('6 questions not attempted. Hide them.'), findsOneWidget);
      expect(find.text('You did not answer this question.'), findsOneWidget);
    });
  });

  group('P3-9: the result title keeps its subject', () {
    for (final (size, scale) in [(const Size(384, 853), 1.0), (const Size(360, 748), 1.0), (const Size(360, 748), 1.3)]) {
      testWidgets('Mock 1, Business Studies is not cut short at ${size.width.toInt()} dp, ${scale}x text', (tester) async {
        final f = firstBusinessStudiesMock();
        await open(tester, '/result/a7', f.model, f.detail, size: size, textScale: scale);
        expect(tester.takeException(), isNull);
        final title = find.text('Mock 1, Business Studies');
        expect(title, findsOneWidget);
        final paragraph = tester.renderObject<RenderParagraph>(title);
        expect(paragraph.didExceedMaxLines, isFalse, reason: 'the title would end in an ellipsis');
        expect(find.text('Replay recap'), findsOneWidget);
      });
    }
  });

  group('P3-10: card 4 at 1.3x text keeps the length chips whole', () {
    testWidgets('every chip sits above the pinned key, and the quiet keys are still reachable', (tester) async {
      await open(tester, '/result/a7/recap/4', mock7(), detail(), size: const Size(360, 748), textScale: 1.3);
      expect(tester.takeException(), isNull);
      final keyTop = tester.getRect(find.text('Start 10-minute repair')).top;
      for (final label in ['5 min', '10 min', '15 min']) {
        expect(tester.getRect(find.text(label)).bottom, lessThanOrEqualTo(keyTop), reason: '$label chip is under the key');
      }
      // The quiet keys are pinned with the primary one, so they are always in reach.
      expect(find.text('Choose something else'), findsOneWidget);
      expect(find.bySemanticsLabel('More'), findsOneWidget);
    });

    testWidgets('at normal text the quiet keys stay pinned under the primary key', (tester) async {
      await open(tester, '/result/a7/recap/4', mock7(), detail());
      final keyBottom = tester.getRect(find.text('Start 10-minute repair')).bottom;
      expect(find.text('Finish for now'), findsNothing, reason: 'one quiet key, the other behind More');
      expect(tester.getRect(find.text('Choose something else')).top, greaterThan(keyBottom));
      expect(tester.getRect(find.bySemanticsLabel('More')).top, greaterThan(keyBottom));
    });
  });

  group('P3-11: scores read "N of M" on the result', () {
    test('the comparison lines use the same form as the figure', () {
      expect(ResultCopy.previous('Mock 6', 92, 250), 'Mock 6, same format: 92 of 250.');
      expect(ResultCopy.higherCompare('Mock 6', 92, 'Mock 7', 115, 250), 'Mock 6: 92 of 250. Mock 7: 115 of 250.');
      expect(ResultCopy.outOf(250), 'of 250');
    });
  });
  group('card 4 with nothing to repair names the next move', () {
    const mixed = TodayAction(
      'Start mixed practice, 10 questions',
      GoTo('/practice/setup/quick?count=10&subject=business_studies'),
      startsSession: true,
      actionType: 'practice',
    );

    testWidgets('a next move is the primary key; Choose something else is the one quiet key below it', (tester) async {
      final f = firstBusinessStudiesMock(paper: blanksOnlyPaper());
      await open(tester, '/result/a7/recap/4', f.model, f.detail, nextMove: mixed);
      expect(find.text('No wrong answers to repair from this mock.'), findsOneWidget);
      final primary = find.text(mixed.label);
      expect(primary, findsOneWidget);
      final bottom = tester.getRect(primary).bottom;
      expect(find.text('Finish for now'), findsNothing, reason: 'it waits behind More');
      expect(find.bySemanticsLabel('More'), findsOneWidget);
      expect(tester.getRect(find.text('Choose something else')).top, greaterThan(bottom));
      // The key is a real 48 dp target.
      final box = tester.renderObject<RenderBox>(find.ancestor(of: primary, matching: find.byType(Semantics)).first);
      expect(box.size.height, greaterThanOrEqualTo(48));
    });

    testWidgets('the primary key opens that move', (tester) async {
      final f = firstBusinessStudiesMock(paper: blanksOnlyPaper());
      final router = await open(tester, '/result/a7/recap/4', f.model, f.detail, nextMove: mixed);
      await tester.tap(find.text(mixed.label));
      await tester.pumpAndSettle();
      // Pushed over the recap, so Back returns to it.
      expect(find.textContaining('AT /practice/setup/quick?count=10'), findsOneWidget);
      expect(router.canPop(), isTrue);
    });

    testWidgets('with no next move, Finish for now is the primary key and Choose something else stays quiet', (tester) async {
      final f = firstBusinessStudiesMock(paper: blanksOnlyPaper());
      await open(tester, '/result/a7/recap/4', f.model, f.detail);
      final finish = find.text('Finish for now');
      expect(finish, findsOneWidget, reason: 'one Finish key, not a primary and a quiet copy');
      expect(tester.getRect(find.text('Choose something else')).top, greaterThan(tester.getRect(finish).bottom));
      final box = tester.renderObject<RenderBox>(find.ancestor(of: finish, matching: find.byType(Semantics)).first);
      expect(box.size.height, greaterThanOrEqualTo(48));
    });

    testWidgets('a paper with something to repair keeps the repair as the primary key', (tester) async {
      await open(tester, '/result/a7/recap/4', mock7(), detail(), nextMove: mixed);
      expect(find.text('Start 10-minute repair'), findsOneWidget);
      expect(find.text(mixed.label), findsNothing);
      expect(find.text('Finish for now'), findsNothing, reason: 'it waits behind More');
      expect(find.bySemanticsLabel('More'), findsOneWidget);
      expect(find.text('Choose something else'), findsOneWidget);
    });
  });
}
