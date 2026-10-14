import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/runner/copy.dart';
import 'package:mockmob/features/runner/data/runner_session.dart';
import 'package:mockmob/features/runner/widgets/answer_option.dart';

import '../../helpers/fonts.dart';
import 'support/fake_session.dart';
import 'support/harness.dart';

/// Crossing an option out (a scratch mark kept in memory only) and the 4 s Undo after clearing an
/// answer.
void main() {
  setUpAll(loadAppFonts);

  List<String> optionsOf(FakeRunnerSession s, int i) => [for (final o in s.questions[i].options) o.text];

  double rowOpacity(WidgetTester tester, String text) {
    var o = 1.0;
    RenderObject? r = tester.renderObject(find.text(text));
    while (r != null) {
      if (r is RenderOpacity) o *= r.opacity;
      if (r is RenderAnimatedOpacity) o *= r.opacity.value;
      r = r.parent;
    }
    return o;
  }

  group('StrikeBook', () {
    test('toggles, restores and remembers that it was used', () {
      final book = StrikeBook();
      expect(book.used, isFalse);
      book.toggle('q1', 2);
      expect(book.isStruck('q1', 2), isTrue);
      expect(book.used, isTrue);
      book.toggle('q1', 0);
      expect(book.struckOn('q1'), [0, 2]);
      book.toggle('q1', 2);
      expect(book.isStruck('q1', 2), isFalse);
      book.restore('q1', 0);
      expect(book.struckOn('q1'), isEmpty);
      expect(book.isStruck('q2', 0), isFalse, reason: 'strikes belong to one question');
    });
  });

  group('crossing an option out', () {
    testWidgets('a long press dims the row to 55% and draws the line; no answer is saved', (tester) async {
      final s = FakeRunnerSession(questions: accountancyQuestions(10), mode: 'quick', mockNumber: null);
      final h = await pumpRunner(tester, session: s);
      await settle(tester);
      final option = optionsOf(s, 0)[1];
      await tester.longPress(find.text(option));
      await tester.pump(const Duration(milliseconds: 110));
      final mid = rowOpacity(tester, option);
      expect(mid, inExclusiveRange(AnswerOption.struckOpacity, 1.0), reason: 'the dim runs over 220 ms');
      await tester.pump(const Duration(milliseconds: 200));
      expect(s.strikes.isStruck('q1', 1), isTrue);
      expect(rowOpacity(tester, option), closeTo(AnswerOption.struckOpacity, 0.01));
      expect(s.answers, isEmpty, reason: 'a strike is never an answer');
      expect(s.calls.where((c) => c.startsWith('select')), isEmpty, reason: 'nothing is sent anywhere');
      expect(h.haptics.calls, contains('selection'));
    });

    testWidgets('a crossed-out option stays tappable, and picking it brings it back', (tester) async {
      final s = FakeRunnerSession(questions: accountancyQuestions(10), mode: 'quick', mockNumber: null);
      await pumpRunner(tester, session: s);
      await settle(tester);
      final option = optionsOf(s, 0)[2];
      await tester.longPress(find.text(option));
      await settle(tester, ms: 400);
      expect(s.strikes.isStruck('q1', 2), isTrue);
      await tester.tap(find.text(option));
      await settle(tester, ms: 400);
      expect(s.answers['q1'], 2);
      expect(s.strikes.isStruck('q1', 2), isFalse);
      expect(rowOpacity(tester, option), closeTo(1, 0.01));
    });

    testWidgets('a second long press restores the option', (tester) async {
      final s = FakeRunnerSession(questions: accountancyQuestions(10), mode: 'quick', mockNumber: null);
      await pumpRunner(tester, session: s);
      await settle(tester);
      final option = optionsOf(s, 0)[3];
      await tester.longPress(find.text(option));
      await settle(tester, ms: 400);
      await tester.longPress(find.text(option));
      await settle(tester, ms: 400);
      expect(s.strikes.isStruck('q1', 3), isFalse);
      expect(rowOpacity(tester, option), closeTo(1, 0.01));
    });

    testWidgets('the chosen option cannot be crossed out', (tester) async {
      final s = FakeRunnerSession(questions: accountancyQuestions(10), mode: 'quick', mockNumber: null, answers: {'q1': 0});
      await pumpRunner(tester, session: s);
      await settle(tester);
      await tester.longPress(find.text(optionsOf(s, 0)[0]));
      await settle(tester, ms: 400);
      expect(s.strikes.isStruck('q1', 0), isFalse);
      expect(s.answers['q1'], 0);
    });

    testWidgets('screen readers hear "crossed out" and get a Cross out action', (tester) async {
      final handle = tester.ensureSemantics();
      final s = FakeRunnerSession(questions: accountancyQuestions(10), mode: 'quick', mockNumber: null);
      await pumpRunner(tester, session: s);
      await settle(tester);
      final option = optionsOf(s, 0)[1];
      final data = tester.getSemantics(find.bySemanticsLabel(RunnerCopy.optionSemantics('B', option))).getSemanticsData();
      expect(data.hasAction(SemanticsAction.customAction), isTrue, reason: 'Cross out is offered as an action');
      s.strikes.toggle('q1', 1);
      await settle(tester, ms: 400);
      expect(find.bySemanticsLabel(RunnerCopy.optionSemantics('B', option, crossedOut: true)), findsOneWidget);
      handle.dispose();
    });

    testWidgets('question 1 tells how to cross out until it has been done once', (tester) async {
      final s = FakeRunnerSession(questions: accountancyQuestions(10), mode: 'full');
      await pumpRunner(tester, session: s);
      await settle(tester);
      expect(find.text(RunnerCopy.strikeHint), findsOneWidget);
      await tester.longPress(find.text(optionsOf(s, 0)[1]));
      await settle(tester, ms: 400);
      expect(find.text(RunnerCopy.strikeHint), findsNothing);
    });

    testWidgets('in practice the hint waits for the practice note to go', (tester) async {
      final s = FakeRunnerSession(questions: accountancyQuestions(10), mode: 'quick', mockNumber: null);
      await pumpRunner(tester, session: s);
      await settle(tester);
      expect(find.text(RunnerCopy.practiceNote), findsOneWidget);
      expect(find.text(RunnerCopy.strikeHint), findsNothing);
      await tester.tap(find.text(optionsOf(s, 0)[0]));
      await settle(tester);
      expect(find.text(RunnerCopy.strikeHint), findsOneWidget);
    });

    testWidgets('under reduced motion the strike is there at once', (tester) async {
      final s = FakeRunnerSession(questions: accountancyQuestions(10), mode: 'quick', mockNumber: null);
      await pumpRunner(tester, session: s, disableAnimations: true);
      await settle(tester);
      final option = optionsOf(s, 0)[1];
      await tester.longPress(find.text(option));
      await tester.pump();
      expect(rowOpacity(tester, option), closeTo(AnswerOption.struckOpacity, 0.01));
    });
  });

  group('clearing an answer can be undone', () {
    testWidgets('"Answer cleared. Undo" holds 4 s in the same band and puts the answer back', (tester) async {
      final s = FakeRunnerSession(questions: accountancyQuestions(10), mode: 'quick', mockNumber: null, answers: {'q1': 2});
      await pumpRunner(tester, session: s);
      await settle(tester);
      final clearAt = tester.getCenter(find.text(RunnerCopy.clearAnswer).last);
      await tester.tap(find.text(RunnerCopy.clearAnswer).last);
      await settle(tester, ms: 400);
      expect(s.answers.containsKey('q1'), isFalse);
      expect(find.text(RunnerCopy.answerCleared), findsOneWidget);
      final undo = find.text(RunnerCopy.undo).last;
      expect(find.text(RunnerCopy.undo), findsWidgets);
      expect((tester.getCenter(undo).dy - clearAt.dy).abs(), lessThan(2), reason: 'the same 48 dp band');
      await tester.tap(undo);
      await settle(tester, ms: 400);
      expect(s.answers['q1'], 2, reason: 'restored through selectAnswer');
      expect(s.calls.where((c) => c.startsWith('select')).toList(), ['select q1 null', 'select q1 2']);
      expect(find.text(RunnerCopy.clearAnswer), findsWidgets);
    });

    testWidgets('the Undo goes after 4 s', (tester) async {
      final s = FakeRunnerSession(questions: accountancyQuestions(10), mode: 'quick', mockNumber: null, answers: {'q1': 1});
      await pumpRunner(tester, session: s);
      await settle(tester);
      await tester.tap(find.text(RunnerCopy.clearAnswer).last);
      await tester.pump(const Duration(seconds: 3));
      expect(find.text(RunnerCopy.undo), findsWidgets);
      await tester.pump(const Duration(milliseconds: 1100));
      await settle(tester, ms: 400);
      expect(find.text(RunnerCopy.undo), findsNothing);
      expect(find.text(RunnerCopy.answerCleared), findsNothing);
    });

    testWidgets('choosing another answer ends the Undo', (tester) async {
      final s = FakeRunnerSession(questions: accountancyQuestions(10), mode: 'quick', mockNumber: null, answers: {'q1': 1});
      await pumpRunner(tester, session: s);
      await settle(tester);
      await tester.tap(find.text(RunnerCopy.clearAnswer).last);
      await settle(tester, ms: 400);
      await tester.tap(find.text(optionsOf(s, 0)[3]));
      await settle(tester, ms: 400);
      expect(find.text(RunnerCopy.undo), findsNothing);
      expect(find.text(RunnerCopy.clearAnswer), findsWidgets);
      expect(s.answers['q1'], 3);
    });
  });
}
