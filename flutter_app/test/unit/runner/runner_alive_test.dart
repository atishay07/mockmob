import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/mascot/mascot.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/rhythm/rhythm.dart' show CelebrationMode;
import 'package:mockmob/features/runner/copy.dart';
import 'package:mockmob/features/runner/logic/sheet_cells.dart';
import 'package:mockmob/features/runner/widgets/palette_sheet.dart';
import 'package:mockmob/features/runner/widgets/question_stage.dart';
import 'package:mockmob/features/runner/widgets/sheet_cell.dart';

import '../../helpers/fonts.dart';
import 'support/fake_session.dart';
import 'support/harness.dart';

/// The runner alive in use: the swipe between questions, the palette's filter keys, the passage
/// fold, and Mobi's cue on a practice's submit page.
void main() {
  setUpAll(loadAppFonts);

  SheetCell cell(int n, {bool answered = false, bool visited = true, bool marked = false, bool unsynced = false, bool current = false}) =>
      SheetCell(number: n, answered: answered, visited: visited, marked: marked, unsynced: unsynced, current: current);

  String marker(FakeRunnerSession s, int i) => s.questions[i].options[1].text;

  group('the sheet logic', () {
    test('a filter matches the legend meaning of each state', () {
      final blank = cell(1);
      final unseen = cell(2, visited: false);
      final marked = cell(3, answered: true, marked: true);
      final phone = cell(4, answered: true, unsynced: true);
      expect(sheetCellMatches(blank, SheetFilter.notAnswered), isTrue);
      expect(sheetCellMatches(unseen, SheetFilter.notAnswered), isFalse, reason: 'not visited is its own key');
      expect(sheetCellMatches(unseen, SheetFilter.notVisited), isTrue);
      expect(sheetCellMatches(marked, SheetFilter.marked), isTrue);
      expect(sheetCellMatches(phone, SheetFilter.unsynced), isTrue);
      expect(sheetCellMatches(phone, SheetFilter.marked), isFalse);
    });

    test('the go-to key walks the matches from the question on show, wrapping round', () {
      final cells = [
        cell(1, marked: true),
        cell(2, answered: true),
        cell(3, marked: true, current: true),
        cell(4, answered: true),
        cell(5, marked: true),
      ];
      expect(nextSheetMatch(cells, SheetFilter.marked, 2), 4);
      expect(nextSheetMatch(cells, SheetFilter.marked, 4), 0);
      expect(nextSheetMatch(cells, SheetFilter.marked, 0), 2);
      expect(nextSheetMatch(cells, SheetFilter.unsynced, 2), -1);
      expect(nextSheetMatch(cells, SheetFilter.marked, -1), 0, reason: 'with nothing on show it starts at the first');
    });

    test('Mobi points at blanks first, tilts at marks, nods at a full sheet', () {
      const blanks = SheetCounts(answered: 7, notAnswered: 3, notVisited: 1, marked: 2, total: 10);
      const marks = SheetCounts(answered: 10, notAnswered: 0, notVisited: 0, marked: 2, total: 10);
      const full = SheetCounts(answered: 10, notAnswered: 0, notVisited: 0, marked: 0, total: 10);
      expect(sheetMobiCue(blanks), SheetMobiCue.pointAtBlank);
      expect(sheetMobiCue(marks), SheetMobiCue.tilt);
      expect(sheetMobiCue(full), SheetMobiCue.nod);
    });

    test('his line says what the sheet means, never the count printed above him', () {
      expect(RunnerCopy.sheetMobiLine(open: [1, 2, 3, 4, 5, 6, 7, 8, 9], marked: [2]), 'Q2 to Q10 are blank and score 0.');
      expect(RunnerCopy.sheetMobiLine(open: [6], marked: const []), 'Q7 is blank and scores 0.');
      expect(RunnerCopy.sheetMobiLine(open: [2, 6, 8], marked: const []), 'Blanks score 0. The first is Q3.');
      expect(RunnerCopy.sheetMobiLine(open: const [], marked: [3]), 'Q4 is marked. Its answer still counts.');
      expect(RunnerCopy.sheetMobiLine(open: const [], marked: [3, 5]), 'Marked answers still count. The first is Q4.');
      expect(RunnerCopy.sheetMobiLine(open: const [], marked: const []), isNull);
      for (final line in [
        RunnerCopy.sheetMobiLine(open: [1, 2, 3, 4, 5, 6, 7, 8, 9], marked: const []),
        RunnerCopy.sheetMobiLine(open: [2, 6, 8], marked: const []),
      ]) {
        expect(line, isNot(contains('not answered')));
      }
    });
  });

  group('swiping between questions', () {
    testWidgets('a swipe to the left past 72 dp goes to the next question', (tester) async {
      final s = FakeRunnerSession(questions: accountancyQuestions(10), mode: 'quick', mockNumber: null, currentIndex: 3);
      await pumpRunner(tester, session: s);
      await settle(tester);
      await tester.drag(find.text(marker(s, 3)), const Offset(-140, 0));
      await settle(tester);
      expect(s.currentIndex, 4);
      expect(find.text(marker(s, 4)), findsOneWidget);
    });

    testWidgets('a swipe to the right goes back one', (tester) async {
      final s = FakeRunnerSession(questions: accountancyQuestions(10), mode: 'quick', mockNumber: null, currentIndex: 3);
      await pumpRunner(tester, session: s);
      await settle(tester);
      await tester.drag(find.text(marker(s, 3)), const Offset(140, 0));
      await settle(tester);
      expect(s.currentIndex, 2);
    });

    testWidgets('a short slow drag springs home and moves nothing', (tester) async {
      final s = FakeRunnerSession(questions: accountancyQuestions(10), mode: 'quick', mockNumber: null, currentIndex: 3);
      await pumpRunner(tester, session: s);
      await settle(tester);
      final gesture = await tester.startGesture(tester.getCenter(find.text(marker(s, 3))));
      for (var i = 0; i < 10; i++) {
        await gesture.moveBy(const Offset(-4, 0));
        await tester.pump(const Duration(milliseconds: 40));
      }
      await gesture.up();
      await settle(tester);
      expect(s.currentIndex, 3);
      expect(s.calls.where((c) => c.startsWith('goTo')), isEmpty);
    });

    testWidgets('on the first question a swipe to the right rubber-bands and stays', (tester) async {
      final s = FakeRunnerSession(questions: accountancyQuestions(10), mode: 'quick', mockNumber: null);
      await pumpRunner(tester, session: s);
      await settle(tester);
      await tester.drag(find.text(marker(s, 0)), const Offset(200, 0));
      await settle(tester);
      expect(s.currentIndex, 0);
      expect(tester.getTopLeft(find.byType(QuestionStage)).dx, 0);
    });

    testWidgets('a mostly vertical drag is left to the scroll', (tester) async {
      final s = FakeRunnerSession(questions: accountancyQuestions(10), mode: 'quick', mockNumber: null, currentIndex: 3);
      await pumpRunner(tester, session: s);
      await settle(tester);
      await tester.drag(find.text(marker(s, 3)), const Offset(-60, -200));
      await settle(tester);
      expect(s.currentIndex, 3);
    });

    testWidgets('past the last question a swipe opens the submit page', (tester) async {
      final s = FakeRunnerSession(questions: accountancyQuestions(5), mode: 'quick', mockNumber: null, currentIndex: 4);
      await pumpRunner(tester, session: s);
      await settle(tester);
      await tester.drag(find.text(marker(s, 4)), const Offset(-160, 0));
      await settle(tester);
      expect(find.text(RunnerCopy.submitTitle), findsOneWidget);
      expect(s.currentIndex, 4);
    });
  });

  group('the palette filter keys', () {
    Widget host(List<SheetCell> cells, {SheetFilter? filter, ValueChanged<SheetFilter?>? onFilter}) => MaterialApp(
      theme: buildTheme(Brightness.dark),
      home: Scaffold(
        body: SingleChildScrollView(
          child: PaletteSheet(cells: cells, onJump: (_) {}, onReview: () {}, filter: filter, onFilter: onFilter ?? (_) {}),
        ),
      ),
    );

    final cells = [
      cell(1, answered: true, current: true),
      cell(2, marked: true),
      cell(3, answered: true),
      cell(4, answered: true, marked: true),
      cell(5, visited: false),
    ];

    testWidgets('a legend key turns its filter on, and again off', (tester) async {
      SheetFilter? picked = SheetFilter.notVisited;
      await tester.pumpWidget(host(cells, onFilter: (f) => picked = f));
      await tester.pump(const Duration(seconds: 1));
      await tester.tap(find.text('${RunnerCopy.markedShort} 2'));
      expect(picked, SheetFilter.marked);
      await tester.pumpWidget(host(cells, filter: SheetFilter.marked, onFilter: (f) => picked = f));
      await tester.tap(find.text('${RunnerCopy.markedShort} 2'));
      expect(picked, isNull);
    });

    testWidgets('with a filter the others dim to 30% and the key goes to the next match', (tester) async {
      await tester.pumpWidget(host(cells, filter: SheetFilter.marked));
      await tester.pump(const Duration(seconds: 1));
      double opacityOf(int i) => tester
          .widget<AnimatedOpacity>(find.ancestor(of: find.byType(SheetCellKey).at(i), matching: find.byType(AnimatedOpacity)).first)
          .opacity;
      expect([for (var i = 0; i < cells.length; i++) opacityOf(i)], [0.3, 1, 0.3, 1, 0.3], reason: 'the two marked cells stay bright');
      expect(find.text(RunnerCopy.goToQuestion(2)), findsOneWidget);
    });

    testWidgets('without a filter the key still goes to the first question without an answer', (tester) async {
      await tester.pumpWidget(host(cells));
      await tester.pump(const Duration(seconds: 1));
      expect(find.text(RunnerCopy.goToFirstOpen(2)), findsOneWidget);
    });
  });

  group('the passage well', () {
    testWidgets('the caption folds the well to one line and opens it again', (tester) async {
      final s = FakeRunnerSession(questions: passageQuestions(), mode: 'quick', mockNumber: null, subject: 'english');
      await pumpRunner(tester, session: s);
      await settle(tester);
      final passage = find.textContaining('The first bus to the old market');
      expect(tester.getSize(passage).height, greaterThan(0));
      await tester.tap(find.bySemanticsLabel(RegExp(RunnerCopy.passageHide)));
      await settle(tester);
      expect(find.bySemanticsLabel(RegExp(RunnerCopy.passageShow)), findsOneWidget);
      final folded = tester.getRect(find.bySemanticsLabel(RegExp(RunnerCopy.passageShow)));
      expect(
        tester.getRect(find.text(s.questions[0].question)).top,
        greaterThan(folded.bottom),
        reason: 'the question sits under the caption',
      );
      await tester.tap(find.bySemanticsLabel(RegExp(RunnerCopy.passageShow)));
      await settle(tester);
      expect(find.bySemanticsLabel(RegExp(RunnerCopy.passageHide)), findsOneWidget);
    });

    testWidgets('folded on one question, the next question of the passage stays folded', (tester) async {
      final s = FakeRunnerSession(questions: passageQuestions(), mode: 'quick', mockNumber: null, subject: 'english');
      await pumpRunner(tester, session: s);
      await settle(tester);
      await tester.tap(find.bySemanticsLabel(RegExp(RunnerCopy.passageHide)));
      await settle(tester);
      await tester.tap(find.text('Next'));
      await settle(tester);
      expect(s.currentIndex, 1);
      expect(find.bySemanticsLabel(RegExp(RunnerCopy.passageShow)), findsOneWidget);
    });
  });

  group('the leave guard', () {
    testWidgets('has Mobi with Celebrations on, and none with them off', (tester) async {
      final s = FakeRunnerSession(questions: accountancyQuestions(5), mode: 'quick', mockNumber: null);
      await pumpRunner(tester, session: s);
      await settle(tester);
      await tester.tap(find.bySemanticsLabel(RunnerCopy.leaveSemantics(false)).first);
      await settle(tester);
      expect(find.byType(MobiCharacter), findsOneWidget);
      await tester.tap(find.text(RunnerCopy.keepGoing));
      await settle(tester);
      expect(find.text(RunnerCopy.keepGoing), findsNothing, reason: 'the sheet closes a beat after his nod');
    });

    testWidgets('Celebrations Off: no Mobi on the guard', (tester) async {
      final s = FakeRunnerSession(questions: accountancyQuestions(5), mode: 'quick', mockNumber: null);
      await pumpRunner(tester, session: s, celebrations: CelebrationMode.off);
      await settle(tester);
      await tester.tap(find.bySemanticsLabel(RunnerCopy.leaveSemantics(false)).first);
      await settle(tester);
      expect(find.text(RunnerCopy.keepGoing), findsOneWidget);
      expect(find.byType(MobiCharacter), findsNothing);
    });
  });

  group('the submit page in a practice', () {
    testWidgets('Mobi says the plain fact and the open row is there to point at', (tester) async {
      final s = FakeRunnerSession(questions: accountancyQuestions(10), mode: 'quick', mockNumber: null, answers: {'q1': 0, 'q2': 1});
      await pumpRunner(tester, session: s, location: '/run/sess-1/submit');
      await settle(tester, ms: 4000);
      expect(find.byType(MobiCharacter), findsOneWidget);
      expect(find.textContaining('8 not answered. Go to 3?', findRichText: true), findsWidgets);
    });

    testWidgets('a timed mock has no reading Mobi before the hand-in', (tester) async {
      final s = FakeRunnerSession(questions: accountancyQuestions(10), answers: {'q1': 0});
      await pumpRunner(tester, session: s, location: '/run/sess-1/submit');
      await settle(tester, ms: 4000);
      expect(find.byType(MobiCharacter), findsNothing);
    });
  });
}
