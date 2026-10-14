import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/rhythm/rhythm.dart' show CelebrationMode;
import 'package:mockmob/features/runner/copy.dart';
import 'package:mockmob/features/runner/widgets/question_stage.dart';

import '../../helpers/fonts.dart';
import 'support/fake_session.dart';
import 'support/harness.dart';

/// In-use findings 6, 7, 25 and 27 (14 Oct recordings): every Previous and Next tap counts, a
/// switch is never a blank frame, one paper carries one name, and the submit page is a moment.
void main() {
  setUpAll(loadAppFonts);

  List<String> optionsOf(FakeRunnerSession s, int i) => [for (final o in s.questions[i].options) o.text];

  // Question 1 and 2 of the fixture have different option text, so "is this question on screen"
  // is an unambiguous find.
  String marker(FakeRunnerSession s, int i) => s.questions[i].options[1].text;

  group('every tap counts (finding 6)', () {
    testWidgets('two Previous taps 350 ms apart go back two questions', (tester) async {
      final s = FakeRunnerSession(questions: accountancyQuestions(10), mode: 'quick', mockNumber: null, currentIndex: 5);
      await pumpRunner(tester, session: s);
      await settle(tester);
      await tester.tap(find.text('Previous').last);
      await tester.pump(const Duration(milliseconds: 350));
      await tester.tap(find.text('Previous').last);
      await tester.pump(const Duration(milliseconds: 350));
      expect(s.currentIndex, 3);
    });

    testWidgets('two Previous taps 150 ms apart still go back two', (tester) async {
      final s = FakeRunnerSession(questions: accountancyQuestions(10), mode: 'quick', mockNumber: null, currentIndex: 5);
      await pumpRunner(tester, session: s);
      await settle(tester);
      await tester.tap(find.text('Previous').last);
      await tester.pump(const Duration(milliseconds: 150));
      await tester.tap(find.text('Previous').last);
      await tester.pump(const Duration(milliseconds: 150));
      expect(s.currentIndex, 3, reason: 'the key keeps no tap lock; a quick second tap is a second step');
      expect(s.calls.where((c) => c.startsWith('goTo')).toList(), ['goTo 4', 'goTo 3']);
    });

    testWidgets('a tap during the entrance registers: Next, Next, Previous lands on the second question', (tester) async {
      final s = FakeRunnerSession(questions: accountancyQuestions(10), mode: 'quick', mockNumber: null);
      await pumpRunner(tester, session: s);
      await settle(tester);
      await tester.tap(find.text('Next'));
      await tester.pump(const Duration(milliseconds: 40));
      await tester.tap(find.text('Next'));
      await tester.pump(const Duration(milliseconds: 40));
      await tester.tap(find.text('Previous').last);
      await tester.pump(const Duration(milliseconds: 40));
      expect(s.currentIndex, 1);
      await settle(tester);
      expect(find.text(marker(s, 1)), findsOneWidget, reason: 'only the question on show is left once the switch is done');
    });

    testWidgets('an option tapped during the entrance is taken', (tester) async {
      final s = FakeRunnerSession(questions: accountancyQuestions(10), mode: 'quick', mockNumber: null);
      await pumpRunner(tester, session: s);
      await settle(tester);
      await tester.tap(find.text('Next'));
      await tester.pump(const Duration(milliseconds: 30));
      await tester.tap(find.text(optionsOf(s, 1)[2]), warnIfMissed: false);
      await tester.pump();
      expect(s.answers['q2'], 2);
    });
  });

  group('a switch never blanks the question region (finding 7)', () {
    testWidgets('the question just left stays under the arriving one, then goes', (tester) async {
      final s = FakeRunnerSession(questions: accountancyQuestions(10), mode: 'quick', mockNumber: null);
      await pumpRunner(tester, session: s);
      await settle(tester);
      expect(find.text(marker(s, 0)), findsOneWidget);

      await tester.tap(find.text('Next'));
      // Every frame of the switch has the leaving or the arriving question to show, and the
      // leaving one is only gone once the arriving one has risen.
      var firstBothGone = -1;
      var leavingGoneAt = -1;
      for (var ms = 0; ms <= 400; ms += 16) {
        await tester.pump(const Duration(milliseconds: 16));
        final leaving = find.text(marker(s, 0)).evaluate().isNotEmpty;
        final arriving = find.text(marker(s, 1)).evaluate().isNotEmpty;
        if (!leaving && !arriving && firstBothGone < 0) firstBothGone = ms;
        if (!leaving && leavingGoneAt < 0) leavingGoneAt = ms;
        expect(arriving, isTrue, reason: 'the arriving question is built from the first frame');
      }
      expect(firstBothGone, -1, reason: 'no frame has neither question');
      expect(leavingGoneAt, greaterThanOrEqualTo(80), reason: 'the leaving question holds while the arriving one starts');
    });

    testWidgets('the leaving picture takes no touches and has no semantics', (tester) async {
      final handle = tester.ensureSemantics();
      final s = FakeRunnerSession(questions: accountancyQuestions(10), mode: 'quick', mockNumber: null);
      await pumpRunner(tester, session: s);
      await settle(tester);
      await tester.tap(find.text('Next'));
      await tester.pump(const Duration(milliseconds: 20));
      final ghost = find.text(optionsOf(s, 0)[2]);
      expect(ghost, findsOneWidget);
      await tester.tap(ghost, warnIfMissed: false);
      await tester.pump();
      expect(s.answers.containsKey('q1'), isFalse, reason: 'the question just left cannot be answered');
      expect(find.bySemanticsLabel(RunnerCopy.optionSemantics('C', optionsOf(s, 0)[2])), findsNothing);
      await settle(tester);
      handle.dispose();
    });

    testWidgets('going 1, 2, 1 quickly arrives afresh and ends with one question', (tester) async {
      final s = FakeRunnerSession(questions: accountancyQuestions(10), mode: 'quick', mockNumber: null);
      await pumpRunner(tester, session: s);
      await settle(tester);
      await tester.tap(find.text('Next'));
      await tester.pump(const Duration(milliseconds: 60));
      await tester.tap(find.text('Previous').last);
      await tester.pump(const Duration(milliseconds: 60));
      expect(s.currentIndex, 0);
      await settle(tester, ms: 1000);
      expect(find.text(marker(s, 0)), findsOneWidget);
      expect(find.byType(QuestionStage), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('under reduced motion the question is swapped at once', (tester) async {
      final s = FakeRunnerSession(questions: accountancyQuestions(10), mode: 'quick', mockNumber: null);
      await pumpRunner(tester, session: s, disableAnimations: true);
      await settle(tester);
      await tester.tap(find.text('Next'));
      await tester.pump();
      expect(find.text(marker(s, 0)), findsNothing);
      expect(find.text(marker(s, 1)), findsOneWidget);
    });
  });

  group('one paper, one name (finding 25)', () {
    test('a practice is "Subject practice", with its chapter when it has one; a mock keeps its number', () {
      expect(RunnerCopy.paperName(isMock: false, mode: 'quick', subject: 'accountancy'), 'Accountancy practice');
      expect(
        RunnerCopy.paperName(isMock: false, mode: 'quick', subject: 'accountancy', chapter: 'Goodwill'),
        'Accountancy practice, Goodwill',
        reason: 'the same words the practice result opens with',
      );
      expect(RunnerCopy.paperName(isMock: true, mode: 'full', subject: 'accountancy', mockNumber: 7), 'Mock 7, Accountancy');
    });

    testWidgets('the submit page names a chapter practice by its chapter, not "Quick practice"', (tester) async {
      final s = FakeRunnerSession(
        questions: accountancyQuestions(5),
        mode: 'quick',
        mockNumber: null,
        chapter: 'Goodwill',
        answers: {'q1': 0},
      );
      await pumpRunner(tester, session: s, location: '/run/sess-1/submit');
      await settle(tester);
      expect(find.text('Accountancy practice, Goodwill'), findsOneWidget);
      expect(find.textContaining('Quick practice'), findsNothing);
    });

    testWidgets('a mixed practice is "Accountancy practice" on the submit page', (tester) async {
      final s = FakeRunnerSession(questions: accountancyQuestions(5), mode: 'quick', mockNumber: null, answers: {'q1': 0});
      await pumpRunner(tester, session: s, location: '/run/sess-1/submit');
      await settle(tester);
      expect(find.text('Accountancy practice'), findsOneWidget);
    });

    testWidgets('the runner header shows the chapter the practice was started for on every question', (tester) async {
      final s = FakeRunnerSession(questions: accountancyQuestions(5), mode: 'quick', mockNumber: null, chapter: 'Goodwill');
      await pumpRunner(tester, session: s);
      await settle(tester);
      expect(find.text('Accountancy, Goodwill'), findsOneWidget);
      await tester.tap(find.text('Next'));
      await settle(tester);
      expect(find.text('Accountancy, Goodwill'), findsOneWidget, reason: 'question 2 is in another chapter, the paper is not');
    });
  });

  group('the submit page is a moment (finding 27)', () {
    for (final stage in ['idle', 'received']) {
      testWidgets('$stage: the block rests between the header and the keys, with no dead band above the keys', (tester) async {
        final s = FakeRunnerSession(questions: accountancyQuestions(5), mode: 'quick', mockNumber: null, answers: {'q1': 0, 'q2': 1});
        await pumpRunner(tester, session: s, location: '/run/sess-1/submit', celebrations: CelebrationMode.full);
        await settle(tester);
        if (stage == 'received') {
          await tester.tap(find.text('Submit practice'));
          await tester.pump();
          await tester.pump(const Duration(milliseconds: 100));
          await tester.pump(const Duration(milliseconds: 1500));
        }
        final title = tester.getRect(find.text(stage == 'idle' ? RunnerCopy.submitTitle : RunnerCopy.receivedTitle));
        // The pinned keys' top: the first key on the page.
        final key = tester.getRect(find.text(stage == 'idle' ? 'Submit practice' : RunnerCopy.openResult(false)));
        final above = title.top - 60;
        expect(above, greaterThan(40), reason: 'the title is not stuck under the header');
        expect(title.top, lessThan(key.top - 200), reason: 'the block is above the keys, not on them');
        await tester.pump(const Duration(seconds: 3));
      });
    }

    testWidgets('the block does not move when Mobi lands', (tester) async {
      final s = FakeRunnerSession(questions: accountancyQuestions(5), mode: 'quick', mockNumber: null, answers: {'q1': 0});
      await pumpRunner(tester, session: s, location: '/run/sess-1/submit', celebrations: CelebrationMode.full);
      await settle(tester);
      final before = tester.getTopLeft(find.text(RunnerCopy.submitTitle)).dy;
      await tester.tap(find.text('Submit practice'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      await tester.pump(const Duration(milliseconds: 1500));
      final received = tester.getTopLeft(find.text(RunnerCopy.receivedTitle)).dy;
      expect(received, closeTo(before, 0.5));
      await tester.pump(const Duration(seconds: 3));
    });
  });
}
