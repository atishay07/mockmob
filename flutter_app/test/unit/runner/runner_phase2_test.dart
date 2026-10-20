import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/widgets/widgets.dart' show Mobi;
import 'package:mockmob/features/rhythm/rhythm.dart' show CelebrationMode;
import 'package:mockmob/features/runner/copy.dart';
import 'package:mockmob/features/runner/nta/nta_text_size.dart';
import 'package:mockmob/features/runner/widgets/lock_flight.dart';
import 'package:mockmob/features/runner/widgets/runner_count.dart';

import '../../helpers/fonts.dart';
import 'support/fake_session.dart';
import 'support/harness.dart';

/// UI phase 2 on the runner: the calmed lock-in (practice only, kept to the gutter), the mark
/// key under the question, the 13 sp "of 50", the Celebrations setting on the submit page, the
/// words after twelve seconds of sending, and the two NTA layout and text-size fixes.
void main() {
  setUpAll(loadAppFonts);

  group('the lock-in flight', () {
    testWidgets('a practice has the flight layer', (tester) async {
      await pumpRunner(
        tester,
        session: FakeRunnerSession(questions: accountancyQuestions(20), mode: 'quick', mockNumber: null, currentIndex: 5),
      );
      await settle(tester);
      expect(find.byType(LockFlightLayer), findsOneWidget);
    });

    testWidgets('a timed mock has none', (tester) async {
      await pumpRunner(tester, session: FakeRunnerSession(questions: accountancyQuestions(20), mode: 'full', currentIndex: 5));
      await settle(tester);
      expect(find.byType(LockFlightLayer), findsNothing, reason: 'no flight in a timed paper');
    });

    testWidgets('in a mock the cell still inks, by itself, once the wash has arrived', (tester) async {
      final handle = tester.ensureSemantics();
      final s = FakeRunnerSession(questions: accountancyQuestions(20), mode: 'full', currentIndex: 5);
      await pumpRunner(tester, session: s);
      await settle(tester);
      await tester.tap(find.text(s.questions[5].options[2].text));
      await tester.pump();
      expect(s.answers['q6'], 2, reason: 'the answer is taken on the next frame');
      await tester.pump(const Duration(milliseconds: 500));
      expect(find.bySemanticsLabel('Question 6 of 20, answered'), findsOneWidget);
      await tester.pump(const Duration(seconds: 2));
      handle.dispose();
    });

    test('the whole way between the option and the track keeps to the gutter', () {
      const lane = 8.0;
      // A bubble at x 38 low on the screen; the cells of question 1, a middle one and the last.
      for (final cell in const [Offset(21, 120), Offset(190, 120), Offset(360, 120)]) {
        final route = FlightRoute(const Offset(38, 620), cell, lane: lane);
        for (var d = 0.0; d <= route.length; d += 1) {
          final p = route.at(d);
          final inQuestion = p.dy > 120 + 12 && p.dy < 620 - 12;
          if (inQuestion) {
            expect(p.dx, closeTo(lane, 0.01), reason: 'at ${p.dy.round()} dp the dot must be left of the question text (x 16)');
          }
        }
      }
    });
  });

  group('the mark key', () {
    testWidgets('sits under the question, not up beside the top bar', (tester) async {
      final s = FakeRunnerSession(questions: accountancyQuestions(10), mode: 'quick', mockNumber: null);
      await pumpRunner(tester, session: s);
      await settle(tester);
      final question = tester.getRect(find.textContaining('A and B share profits'));
      final mark = tester.getRect(find.text('Mark for review'));
      final note = tester.getRect(find.text('Marks come after you submit.'));
      expect(mark.top, greaterThan(question.bottom), reason: 'the mark key follows the stem');
      expect(mark.top - question.bottom, lessThan(40), reason: 'about 16 dp under it');
      expect((note.center.dy - mark.center.dy).abs(), lessThan(4), reason: 'the practice line shares the mark key row');
    });
  });

  group('the count', () {
    testWidgets('"of 50" is a 13 sp semibold word, not a small superscript', (tester) async {
      await pumpRunner(tester, session: FakeRunnerSession());
      await settle(tester);
      final unit = tester.widget<Text>(find.descendant(of: find.byType(RunnerCount), matching: find.text('of 50')));
      expect(unit.style!.fontSize, greaterThanOrEqualTo(13));
      expect(unit.style!.fontWeight, FontWeight.w600);
    });
  });

  group('the submit page and the Celebrations setting', () {
    Future<RunnerHarness> received(WidgetTester tester, CelebrationMode mode) async {
      final s = FakeRunnerSession(questions: accountancyQuestions(5), answers: {'q1': 0, 'q2': 1});
      final h = await pumpRunner(tester, session: s, location: '/run/sess-1/submit', celebrations: mode);
      await settle(tester);
      await tester.tap(find.text('Submit mock'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      // Past the sheet's ink (700 ms) and Mobi's hop, before the hand-off to the mark sheet reveal at 1.2 s (K7).
      await tester.pump(const Duration(milliseconds: 900));
      return h;
    }

    testWidgets('Full: Mobi hops once the sheet has inked', (tester) async {
      await received(tester, CelebrationMode.full);
      expect(find.byType(Mobi), findsOneWidget);
      await tester.pump(const Duration(seconds: 3));
    });

    testWidgets('Quiet: the sheet inks and the words come, with no Mobi', (tester) async {
      await received(tester, CelebrationMode.quiet);
      expect(find.byType(Mobi), findsNothing);
      expect(find.text(RunnerCopy.receivedTitle), findsOneWidget);
      await tester.pump(const Duration(seconds: 3));
    });

    testWidgets('Off: words only, no Mobi and no success buzz', (tester) async {
      final full = await received(tester, CelebrationMode.full);
      final fullBuzz = full.haptics.calls.length;
      await tester.pump(const Duration(seconds: 3));
      await tester.pumpWidget(const SizedBox());

      final off = await received(tester, CelebrationMode.off);
      expect(find.byType(Mobi), findsNothing);
      expect(find.text(RunnerCopy.receivedTitle), findsOneWidget);
      expect(off.haptics.calls.length, lessThan(fullBuzz), reason: 'the success pattern is part of the moment, so Off drops it');
      await tester.pump(const Duration(seconds: 3));
    });

    testWidgets('a wait that goes on says so after 12 seconds, and not before', (tester) async {
      final s = FakeRunnerSession(questions: accountancyQuestions(5), answers: {'q1': 0})..nextOutcome = null;
      await pumpRunner(tester, session: s, location: '/run/sess-1/submit');
      await settle(tester);
      await tester.tap(find.text('Submit mock'));
      await tester.pump();
      await tester.pump(const Duration(seconds: 11));
      expect(find.text(RunnerCopy.stillSending), findsNothing);
      await tester.pump(const Duration(seconds: 2));
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.text(RunnerCopy.stillSending), findsOneWidget);
    });
  });

  group('the NTA paper text (NTA-04)', () {
    test('the A+ step and the phone text size together never pass 1.3x', () {
      for (final system in [0.85, 1.0, 1.15, 1.3, 1.5, 2.0]) {
        for (final step in NtaTextStep.scales) {
          final paper = NtaTextStep.paperStep(step, system);
          expect(system * paper, lessThanOrEqualTo(NtaTextStep.maxEffective + 1e-9), reason: 'system $system step $step');
          expect(paper, lessThanOrEqualTo(step), reason: 'A+ never makes it larger than its step');
        }
      }
      expect(NtaTextStep.paperStep(1.0, 1.0), 1.0, reason: 'the default size is untouched');
      expect(NtaTextStep.paperStep(0.9, 2.0), lessThan(1), reason: 'A- still shrinks');
    });

    testWidgets('at the phone text size 1.3 with the largest step the question is 1.3x, not 1.69x', (tester) async {
      final prefs = MemoryPrefsStore()..values['nta.textStep'] = 3;
      await pumpRunner(tester, session: FakeRunnerSession(mode: 'nta'), textScale: 1.3, prefs: prefs);
      await settle(tester);
      final text = tester.renderObject<RenderParagraph>(find.textContaining('A and B share profits'));
      final shown = text.text.style!.fontSize! * 1.3; // the phone's own scale applies on top of this
      expect(shown, lessThanOrEqualTo(18 * 1.3 + 0.01), reason: 'the paper grows to the same 1.3x cap as the bar around it');
    });
  });

  group('wide and narrow (NTA-03)', () {
    testWidgets('crossing the wide breakpoint keeps the question where the student had scrolled it', (tester) async {
      final s = FakeRunnerSession(mode: 'nta', questions: passageQuestions(), currentIndex: 1);
      await pumpRunner(tester, session: s, size: const Size(820, 520));
      await settle(tester);
      final scroll = find.descendant(of: find.byKey(const ValueKey('nta-question-1')), matching: find.byType(Scrollable));
      final before = tester.state<ScrollableState>(scroll.first);
      before.position.jumpTo(math.min(40, before.position.maxScrollExtent));
      final offset = before.position.pixels;
      expect(offset, greaterThan(0), reason: 'the paper has to be taller than the window for this to mean anything');
      await tester.pump();

      tester.view.physicalSize = const Size(900, 520) * 2;
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));
      final after = tester.state<ScrollableState>(
        find.descendant(of: find.byKey(const ValueKey('nta-question-1')), matching: find.byType(Scrollable)).first,
      );
      expect(after.position.pixels, offset, reason: 'the scroll view kept its element across the breakpoint');
    });
  });
}
