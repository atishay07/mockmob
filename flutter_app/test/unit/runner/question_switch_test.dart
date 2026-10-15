import 'package:flutter/rendering.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/rhythm/rhythm.dart' show CelebrationMode;
import 'package:mockmob/features/runner/copy.dart';
import 'package:mockmob/features/runner/widgets/question_stage.dart';
import 'package:mockmob/features/runner/widgets/runner_motion.dart';

import '../../helpers/fonts.dart';
import 'support/fake_session.dart';
import 'support/harness.dart';

/// In-use findings 6, 7, 25 and 27 (14 Oct recordings): every Previous and Next tap counts, a
/// switch is never a blank frame, one paper carries one name, and the submit page is a moment.
/// The opacity a piece of text is painted at: every opacity above it, multiplied.
double _paintedOpacity(Element e) {
  var o = 1.0;
  RenderObject? r = e.renderObject;
  while (r != null) {
    if (r is RenderOpacity) o *= r.opacity;
    if (r is RenderAnimatedOpacity) o *= r.opacity.value;
    r = r.parent;
  }
  return o;
}

/// The summed painted opacity of every copy of [text] on screen (0 when none is built).
double _textOpacity(String text) => find.text(text).evaluate().fold(0.0, (sum, e) => sum + _paintedOpacity(e));

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

  group('a switch never blanks the question region and never doubles the text (finding 7)', () {
    test('the question text and the line under it arrive from 0.35; the options from nothing', () {
      expect(RunnerMotion.enterOpacity(0, 0), closeTo(0.35, 1e-9));
      expect(RunnerMotion.enterOpacity(1, 0), closeTo(0.35, 1e-9));
      expect(RunnerMotion.enterOpacity(2, 0), 0);
      expect(RunnerMotion.enterOpacity(0, 1), 1);
    });

    test('the leaving text fades in 60 ms with an ease-out, and the whole arrival fits 150 to 350 ms', () {
      expect(RunnerMotion.ghostFade, const Duration(milliseconds: 60));
      expect(RunnerMotion.crossFade, RunnerMotion.ghostFade);
      expect(RunnerMotion.ghostCurve.transform(0.5), greaterThan(0.6), reason: 'ease-out: most of the fade is in the first half');
      expect(RunnerMotion.ghostCurve.transform(1), 1);
      // The text starts 0 ms in and the fourth option (order 5) starts 5 steps in.
      final last = RunnerMotion.stagger * 5 + RunnerMotion.enter;
      expect(last.inMilliseconds, inInclusiveRange(150, 350));
      expect(RunnerMotion.enter.inMilliseconds, inInclusiveRange(150, 350));
    });

    for (final back in [false, true]) {
      testWidgets('${back ? 'Previous' : 'Next'}: the outgoing text is near 0 by 60 ms, two texts never read together for long', (tester) async {
        final s = FakeRunnerSession(questions: accountancyQuestions(10), mode: 'quick', mockNumber: null, currentIndex: back ? 2 : 0);
        await pumpRunner(tester, session: s);
        await settle(tester);
        final from = s.questions[s.currentIndex].question;
        final to = s.questions[s.currentIndex + (back ? -1 : 1)].question;
        await tester.tap(find.text(back ? 'Previous' : 'Next').last);
        var lowest = 2.0;
        var bothReadable = 0;
        var previousLeaving = 1.0;
        for (var ms = 4; ms <= 400; ms += 4) {
          await tester.pump(const Duration(milliseconds: 4));
          final leaving = _textOpacity(from);
          final arriving = _textOpacity(to);
          if (leaving + arriving < lowest) lowest = leaving + arriving;
          // "Reads": painted at a quarter or more. Both at once is a double picture.
          if (leaving >= 0.25 && arriving >= 0.25) bothReadable += 4;
          expect(leaving, lessThanOrEqualTo(previousLeaving + 1e-9), reason: 'the leaving text only ever fades, at $ms ms');
          previousLeaving = leaving;
          // The fade starts on the frame that builds the switch (the first sample, at 4 ms), so 60 ms
          // later it is over.
          if (ms >= 64) expect(leaving, lessThanOrEqualTo(0.02), reason: 'the leaving text is gone 60 ms into the swap (at $ms ms)');
        }
        expect(bothReadable, lessThanOrEqualTo(60), reason: 'two question texts, each at 0.25 or more, read together for at most about 60 ms');
        expect(lowest, greaterThanOrEqualTo(0.7), reason: 'summed text opacity of the leaving and arriving question: never a blank frame');
        expect(_textOpacity(from), 0, reason: 'the leaving question is gone once the switch is done');
        expect(_textOpacity(to), closeTo(1, 1e-6));
      });
    }

    testWidgets('the outgoing text is at or near 0 by about 60 ms into the swap (sampled at 16 ms frames)', (tester) async {
      final s = FakeRunnerSession(questions: accountancyQuestions(10), mode: 'quick', mockNumber: null);
      await pumpRunner(tester, session: s);
      await settle(tester);
      final from = s.questions[0].question;
      await tester.tap(find.text('Next'));
      // The frame that builds the swap: the question just left is still whole under the new one.
      await tester.pump(const Duration(milliseconds: 16));
      expect(_textOpacity(from), closeTo(1, 1e-6));
      await tester.pump(const Duration(milliseconds: 16));
      expect(_textOpacity(from), lessThan(0.7), reason: '16 ms into the swap it is already going');
      await tester.pump(const Duration(milliseconds: 16));
      expect(_textOpacity(from), lessThan(0.5), reason: '32 ms in, under half');
      await tester.pump(const Duration(milliseconds: 16));
      expect(_textOpacity(from), lessThanOrEqualTo(0.1), reason: '48 ms in, faint');
      await tester.pump(const Duration(milliseconds: 16));
      expect(_textOpacity(from), lessThanOrEqualTo(0.02), reason: '64 ms in, gone');
      await settle(tester);
    });

    testWidgets('the whole arrival is done inside 350 ms of the tap, with the last option fully there', (tester) async {
      final s = FakeRunnerSession(questions: accountancyQuestions(10), mode: 'quick', mockNumber: null);
      await pumpRunner(tester, session: s);
      await settle(tester);
      final lastOption = s.questions[1].options.last.text;
      await tester.tap(find.text('Next'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 16));
      expect(_textOpacity(lastOption), lessThan(1), reason: 'the options are still arriving a frame in');
      // 16 ms for the frame that builds the switch, 16 ms for the first tick, 325 ms for the arrival.
      await tester.pump(const Duration(milliseconds: 340));
      expect(_textOpacity(lastOption), closeTo(1, 1e-6));
      expect(_textOpacity(s.questions[1].question), closeTo(1, 1e-6));
      await settle(tester);
    });

    testWidgets('both layers paint in their own repaint boundary', (tester) async {
      final s = FakeRunnerSession(questions: accountancyQuestions(10), mode: 'quick', mockNumber: null);
      await pumpRunner(tester, session: s);
      await settle(tester);
      await tester.tap(find.text('Next'));
      await tester.pump(const Duration(milliseconds: 8));
      for (final i in [0, 1]) {
        final boundary = find.ancestor(of: find.text(s.questions[i].question), matching: find.byType(RepaintBoundary));
        final insideStage = find.descendant(of: find.byType(QuestionStage), matching: boundary);
        expect(insideStage, findsWidgets, reason: 'question ${i + 1} is in a layer boundary');
      }
      await settle(tester);
    });

    testWidgets('the question just left stays under the arriving one for a few frames, then goes', (tester) async {
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
      expect(leavingGoneAt, inInclusiveRange(32, 96), reason: 'the leaving question is a picture for a few frames only, then goes');
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
      // The live semantics tree, not a render object's last node: the picture keeps its render
      // objects (so it stays still), and ExcludeSemantics drops them from the tree.
      final labels = <String>[];
      bool visit(SemanticsNode node) {
        labels.add(node.label);
        node.visitChildren(visit);
        return true;
      }

      visit(tester.binding.renderViews.first.owner!.semanticsOwner!.rootSemanticsNode!);
      expect(labels, isNot(contains(RunnerCopy.optionSemantics('C', optionsOf(s, 0)[2]))));
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
