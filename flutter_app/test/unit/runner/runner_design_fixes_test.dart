import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/mascot/mascot.dart' show MobiCharacter;
import 'package:mockmob/core/sync/session/save_state.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/sync/session/session_engine.dart';
import 'package:mockmob/core/sync/session/session_submitter.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/runner/data/runner_loader.dart';
import 'package:mockmob/features/runner/nta/nta_action_bar.dart';
import 'package:mockmob/features/runner/nta/nta_copy.dart';
import 'package:mockmob/features/runner/nta/nta_header.dart' show NtaBar;
import 'package:mockmob/features/runner/nta/nta_instructions_parts.dart';
import 'package:mockmob/features/runner/nta/nta_option.dart';
import 'package:mockmob/features/runner/nta/nta_paper_theme.dart';
import 'package:mockmob/features/runner/widgets/runner_count.dart';
import 'package:mockmob/features/runner/widgets/runner_top_bar.dart';
import 'package:mockmob/features/runner/widgets/timing_track.dart';

import '../../helpers/fonts.dart';
import 'support/fake_session.dart';
import 'support/harness.dart';

/// Phase 1B design fixes for the runner (review_runner.md): the header's slots and shared scale,
/// the return notice, the track's edges, the ended state, the palette and sheet legends, and the
/// MockMob look of NTA mode.
void main() {
  setUpAll(loadAppFonts);

  group('top bar', () {
    testWidgets('the count and the clock share one scale: neither shrinks against the other at 1.3x', (tester) async {
      await pumpRunner(tester, session: FakeRunnerSession(currentIndex: 11), size: const Size(360, 780));
      await tester.pump(const Duration(seconds: 1));
      final countAt1 = tester.getRect(find.byType(RunnerCount)).height;
      final timerAt1 = tester.getRect(find.text('47:12')).height;

      await tester.pumpWidget(const SizedBox());
      await pumpRunner(tester, session: FakeRunnerSession(currentIndex: 11), size: const Size(360, 780), textScale: 1.3);
      await tester.pump(const Duration(seconds: 1));
      final countAt13 = tester.getRect(find.byType(RunnerCount)).height;
      final timerAt13 = tester.getRect(find.text('47:12')).height;

      expect(countAt13 / countAt1, closeTo(timerAt13 / timerAt1, 0.05), reason: 'both grow by the same factor');
      expect(countAt13 / countAt1, greaterThan(1.2), reason: 'the count grows with the text, it is not squeezed');
    });

    testWidgets('the clock sits in the middle of the bar at normal text size', (tester) async {
      await pumpRunner(tester, session: FakeRunnerSession(), size: const Size(360, 780));
      await tester.pump(const Duration(seconds: 1));
      final timer = tester.getRect(find.text('47:12'));
      expect(timer.center.dx, closeTo(180, 1.5), reason: 'equal room either side of the clock');
      expect(find.text('Questions'), findsOneWidget);
    });

    testWidgets('a phone narrower than 340 dp keeps the glyph and gives up the word, so the clock stays centred in room', (tester) async {
      await pumpRunner(tester, session: FakeRunnerSession(), size: const Size(320, 640));
      await tester.pump(const Duration(seconds: 1));
      expect(tester.takeException(), isNull);
      expect(find.text('Questions'), findsNothing);
    });

    testWidgets('a practice shows when it is open until in the bar, not on the subject line', (tester) async {
      final s = FakeRunnerSession(mode: 'quick', mockNumber: null, chapter: 'Goodwill', questions: accountancyQuestions(10));
      await pumpRunner(tester, session: s, size: const Size(360, 780));
      await tester.pump(const Duration(seconds: 1));
      expect(find.descendant(of: find.byType(RunnerTopBar), matching: find.text('Open until')), findsOneWidget);
      expect(find.descendant(of: find.byType(RunnerTopBar), matching: find.text('11:42 PM')), findsOneWidget);
    });

    testWidgets('the warning has one treatment: the clock takes the warning colour and nothing is drawn under it', (tester) async {
      final s = FakeRunnerSession(remaining: const Duration(minutes: 4, seconds: 59));
      await pumpRunner(tester, session: s, size: const Size(360, 780));
      await tester.pump(const Duration(seconds: 1));
      final colors = tester.element(find.byType(RunnerTopBar)).mmColors;
      final text = tester.widget<Text>(find.text('4:59'));
      expect(text.style!.color, colors.warnText);
      // The text alone: no underline bar in a Stack around it.
      expect(find.descendant(of: find.byType(RunnerTimer), matching: find.byType(Stack)), findsNothing);
    });
  });

  group('return notice', () {
    testWidgets('it replaces the subject on the meta line and the track keeps clear of it', (tester) async {
      final s = FakeRunnerSession(away: const AwayInfo(duration: Duration(minutes: 2, seconds: 10), allSaved: true, unsyncedAnswers: 0));
      await pumpRunner(tester, session: s, size: const Size(360, 780));
      await tester.pump(const Duration(seconds: 1));
      final notice = find.text('Away for 2 minutes 10 seconds. Timer kept running. Answers saved.');
      expect(notice, findsOneWidget);
      expect(tester.getRect(notice).bottom, lessThanOrEqualTo(tester.getRect(find.byType(TimingTrack)).top + 0.5), reason: 'the notice ends where the track starts');
      expect(tester.getRect(notice).top, greaterThanOrEqualTo(tester.getRect(find.byType(RunnerTopBar)).bottom));
    });
  });

  group('track', () {
    test('the first and last ring never touch the strip edge', () {
      for (final (count, width) in [(10, 328.0), (20, 328.0), (12, 288.0), (15, 288.0), (5, 328.0)]) {
        final g = TrackGeometry(count: count, width: width);
        if (g.marks) continue;
        final grow = ((g.pitch - g.diameter) / 2).clamp(1.0, 2.5);
        final ring = g.diameter / 2 + grow;
        expect(g.centerX(0) - ring, greaterThanOrEqualTo(0), reason: '$count in $width: first ring');
        expect(g.centerX(count - 1) + ring, lessThanOrEqualTo(width), reason: '$count in $width: last ring');
      }
    });
  });

  group('question', () {
    double sizeOf(WidgetTester tester) => tester.widget<Text>(find.textContaining('share profits')).style!.fontSize!;

    testWidgets('a short stem is set larger, and keeps the standard size at large text', (tester) async {
      await pumpRunner(tester, session: FakeRunnerSession(), size: const Size(360, 780));
      await tester.pump(const Duration(seconds: 1));
      expect(sizeOf(tester), greaterThan(19), reason: 'the stem is the hero of a short question');

      await tester.pumpWidget(const SizedBox());
      await pumpRunner(tester, session: FakeRunnerSession(), size: const Size(360, 780), textScale: 1.3);
      await tester.pump(const Duration(seconds: 1));
      expect(sizeOf(tester), 19, reason: 'at large text the options keep their room');
    });

    testWidgets('the options grow on a tall screen and keep 60 dp on a short one', (tester) async {
      await pumpRunner(tester, session: FakeRunnerSession(), size: const Size(384, 853));
      await tester.pump(const Duration(seconds: 1));
      final tall = tester.getSize(find.ancestor(of: find.text('5:3:2'), matching: find.byType(ConstrainedBox)).first).height;
      expect(tall, greaterThan(70));

      await tester.pumpWidget(const SizedBox());
      await pumpRunner(tester, session: FakeRunnerSession(), size: const Size(360, 640));
      await tester.pump(const Duration(seconds: 1));
      final short = tester.getSize(find.ancestor(of: find.text('5:3:2'), matching: find.byType(ConstrainedBox)).first).height;
      expect(short, closeTo(60, 0.5));
    });
  });

  group('last question key', () {
    testWidgets('says Review where Review and submit would wrap, and keeps the full words for a screen reader', (tester) async {
      final s = FakeRunnerSession(currentIndex: 49);
      await pumpRunner(tester, session: s, size: const Size(320, 640));
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('Review'), findsOneWidget);
      expect(find.text('Review and submit'), findsNothing);
      final handle = tester.ensureSemantics();
      expect(find.bySemanticsLabel('Review and submit'), findsOneWidget);
      handle.dispose();
    });
  });

  group('opening states', () {
    testWidgets('the ended state is one composition on the page gutter, with Mobi, and one dominant key', (tester) async {
      await pumpRunner(tester, load: const RunnerEnded(isMock: true), size: const Size(360, 780));
      await tester.pump(const Duration(seconds: 1));
      expect(find.byType(MobiCharacter), findsOneWidget);
      final title = tester.getRect(find.text('Time ran out on this mock.'));
      expect(title.center.dx, closeTo(180, 1.5), reason: 'centred under Mobi');
      final key = tester.getRect(find.text('Go to Today'));
      expect(key.center.dx, closeTo(180, 1.5));
      // The key's pill spans the 16 dp gutters, like the other screens.
      final pill = tester.getRect(find.ancestor(of: find.text('Go to Today'), matching: find.byType(ConstrainedBox)).first);
      expect(pill.left, lessThanOrEqualTo(16.5));
      // Mobi sits in the space between the top and the key, not hugging the top.
      final mobi = tester.getRect(find.byType(MobiCharacter));
      expect(mobi.top, greaterThan(100));
      expect(mobi.bottom, lessThan(key.top - 40));
    });
  });

  group('palette', () {
    testWidgets('the legend names only the states that exist', (tester) async {
      final s = FakeRunnerSession(currentIndex: 2, answers: {'q1': 0, 'q2': 1, 'q3': 2}, visited: {'q1', 'q2', 'q3'});
      await pumpRunner(tester, session: s, size: const Size(360, 780));
      await tester.pump(const Duration(seconds: 1));
      await tester.tap(find.text('Questions'));
      await settle(tester);
      expect(find.textContaining('Marked '), findsNothing, reason: 'no marked question, no marked legend');
      expect(find.textContaining('On this phone'), findsNothing);
      expect(find.textContaining('Not visited'), findsOneWidget);
      expect(find.textContaining('Not answered 0'), findsNothing);
    });
  });

  group('submit', () {
    testWidgets('the sheet lies on the page with a legend for the marked shapes that are on it', (tester) async {
      final s = FakeRunnerSession(
        answers: {for (var i = 1; i <= 8; i++) 'q$i': 0},
        marked: {'q2', 'q9'},
        visited: {for (var i = 1; i <= 10; i++) 'q$i'},
      );
      await pumpRunner(tester, session: s, location: '/run/sess-1/submit', size: const Size(360, 780));
      await settle(tester);
      expect(find.text('Marked, answered'), findsOneWidget);
      expect(find.text('Marked, not answered'), findsOneWidget);
    });

    testWidgets('with no marked question there is no legend', (tester) async {
      final s = FakeRunnerSession(answers: {'q1': 0});
      await pumpRunner(tester, session: s, location: '/run/sess-1/submit', size: const Size(360, 780));
      await settle(tester);
      expect(find.text('Marked, answered'), findsNothing);
      expect(find.text('Marked, not answered'), findsNothing);
    });

    testWidgets('answers held back say it once, with one icon, and the key retries', (tester) async {
      final s = FakeRunnerSession(
        submit: const SubmitUiState(SubmitStage.pending),
        save: const SaveSnapshot(state: SaveState.notSaved),
      );
      await pumpRunner(tester, session: s, location: '/run/sess-1/submit', size: const Size(360, 780));
      await settle(tester);
      expect(find.text('Saved on this phone, not on the server yet. We send it when you are online.'), findsOneWidget);
      expect(find.text('Not on the server yet'), findsNothing);
      expect(find.text('Try again'), findsOneWidget);
    });

    testWidgets('the received line is one line', (tester) async {
      final s = FakeRunnerSession(
        submit: SubmitUiState(
          SubmitStage.received,
          outcome: SubmitReceived(attempt: const {'id': 'att-1'}, receivedAt: DateTime(2026, 10, 13, 22, 42)),
        ),
      );
      await pumpRunner(tester, session: s, location: '/run/sess-1/submit', size: const Size(360, 780));
      await settle(tester, ms: 1600);
      final line = tester.renderObject<RenderParagraph>(find.text('Saved on the server at 10:42 PM.'));
      expect(line.size.height, lessThan(30), reason: 'one line: no orphaned time');
    });
  });

  group('NTA mode', () {
    Future<void> pumpNta(
      WidgetTester tester, {
      NtaStyle style = NtaStyle.nta,
      double textScale = 1,
      Size size = const Size(360, 780),
    }) async {
      final prefs = MemoryPrefsStore()..values['nta.style'] = style.index;
      await pumpRunner(
        tester,
        session: FakeRunnerSession(mode: 'nta', currentIndex: 11),
        prefs: prefs,
        size: size,
        textScale: textScale,
      );
      for (var i = 0; i < 6; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }
    }

    int boxedOptions(WidgetTester tester) => find
        .descendant(of: find.byType(NtaOption), matching: find.byWidgetPredicate((w) => w is Material && w.shape is RoundedRectangleBorder))
        .evaluate()
        .length;

    testWidgets('the exam look keeps boxed options (the paper of exam day)', (tester) async {
      await pumpNta(tester);
      expect(boxedOptions(tester), 4);
    });

    testWidgets('the MockMob look lies open: no panel, no head card, hairline option rows', (tester) async {
      await pumpNta(tester, style: NtaStyle.mockmob);
      expect(boxedOptions(tester), 0, reason: 'option rows are open, not boxes');
      final raisedPanels = find.byWidgetPredicate(
        (w) => w is DecoratedBox && w.decoration is ShapeDecoration && (w.decoration as ShapeDecoration).shape is RoundedRectangleBorder,
      );
      expect(raisedPanels, findsNothing, reason: 'no bordered question panel');
      // The chapter and the difficulty are one quiet line, not two pills in a card.
      expect(find.text('Retirement of a partner, Hard'), findsOneWidget);
    });

    testWidgets('the exam look ignores the app theme: the same paper in Night and Daylight', (tester) async {
      await pumpNta(tester);
      final night = tester.widget<NtaBar>(find.byType(NtaBar)).subject;
      expect(NtaPaper.colors.ground, const Color(0xFFEAF0F4), reason: 'pinned, not themed');
      expect(night, isNotEmpty);
    });

    testWidgets('at 1.3x the footer keys keep 12 dp of air either side of each label', (tester) async {
      await pumpNta(tester, textScale: 1.3);
      for (final label in [NtaCopy.markAndNext, NtaCopy.clearResponse, NtaCopy.previous, NtaCopy.saveAndNext]) {
        final text = tester.getRect(find.text(label));
        final key = tester.getRect(find.ancestor(of: find.text(label), matching: find.byType(NtaKey)).first);
        expect(text.left - key.left, greaterThanOrEqualTo(11.5), reason: '"$label" left');
        expect(key.right - text.right, greaterThanOrEqualTo(11.5), reason: '"$label" right');
      }
      // The footer stays two rows of 48 dp keys and does not take a third of a 780 dp screen.
      final bar = tester.getRect(find.byType(NtaActionBar));
      expect(bar.height, lessThan(780 / 4));
    });

    testWidgets('Unmark meets the first line of the state words, not the middle of two', (tester) async {
      final s = FakeRunnerSession(mode: 'nta', currentIndex: 11, answers: {'q12': 0}, marked: {'q12'});
      await pumpRunner(tester, session: s, size: const Size(360, 780), textScale: 1.3);
      for (var i = 0; i < 6; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }
      final words = tester.getRect(find.text(NtaCopy.answeredMarked));
      final unmark = tester.getRect(find.text(NtaCopy.unmark));
      final firstLineCentre = words.top + (words.height / 2) / (words.height > 30 ? 2 : 1);
      expect((unmark.center.dy - firstLineCentre).abs(), lessThan(14));
    });

    testWidgets('the A- and A+ keys are 48 dp targets', (tester) async {
      await pumpNta(tester);
      for (final label in [NtaCopy.smaller, NtaCopy.larger]) {
        final rect = tester.getRect(find.byWidgetPredicate((w) => w is Semantics && w.properties.label == label).first);
        expect(rect.width, greaterThanOrEqualTo(47.5));
        expect(rect.height, greaterThanOrEqualTo(47.5));
      }
    });
  });

  group('NTA instructions', () {
    test('the three facts share one shape and the declaration is one short line', () {
      expect(NtaStartCopy.declare, 'I have read the instructions and I am ready.');
      expect(NtaStartCopy.markingFigure, '+5  −1  0');
      expect(NtaStartCopy.preparingTitle, 'Building your paper.');
      expect(NtaStartCopy.steps[1], 'Picking your 50 questions');
    });
  });
}
