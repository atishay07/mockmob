import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/runner/copy.dart';
import 'package:mockmob/features/runner/widgets/answer_option.dart';
import 'package:mockmob/features/runner/widgets/answer_sheet_view.dart';
import 'package:mockmob/features/runner/widgets/clear_band.dart';
import 'package:mockmob/features/runner/widgets/palette_sheet.dart';
import 'package:mockmob/features/runner/widgets/runner_bottom_bar.dart';
import 'package:mockmob/features/runner/widgets/runner_controls.dart';
import 'package:mockmob/features/runner/widgets/runner_top_bar.dart';
import 'package:mockmob/features/runner/widgets/timing_track.dart';

import '../../helpers/fonts.dart';
import 'support/fake_session.dart';
import 'support/harness.dart';

/// Runner packet C (design critic findings 4, 11 and 23): the soft option cards, the pinned
/// "Clear my answer" band, the one-row header and the 12 sp numbers of the submit grid.
void main() {
  setUpAll(loadAppFonts);

  /// A practice on question 10 of 20 with option C chosen: the long-question case of finding 11.
  FakeRunnerSession answered() => FakeRunnerSession(
    questions: accountancyQuestions(20),
    mode: 'quick',
    mockNumber: null,
    chapter: 'Admission of a partner',
    currentIndex: 9,
    answers: {'q1': 0, 'q2': 1, 'q10': 2},
    marked: {'q10'},
    visited: {for (var i = 1; i <= 10; i++) 'q$i'},
  );

  group('Clear my answer is never cut by the bar (finding 11)', () {
    for (final size in [const Size(360, 780), const Size(320, 640), const Size(384, 853)]) {
      testWidgets('${size.width.toInt()} x ${size.height.toInt()} dp, answer chosen, nothing scrolled', (tester) async {
        await pumpRunner(tester, session: answered(), size: size);
        await settle(tester);

        final clear = tester.getRect(find.text(RunnerCopy.clearAnswer).last);
        final key = tester.getRect(find.ancestor(of: find.text(RunnerCopy.clearAnswer).last, matching: find.byType(ConstrainedBox)).first);
        final bar = tester.getRect(find.byType(RunnerBottomBar));
        expect(clear.bottom, lessThanOrEqualTo(bar.top), reason: 'the words end above the bar');
        expect(key.bottom, lessThanOrEqualTo(bar.top + 0.5), reason: 'the whole key sits above the bar, not under it');
        expect(tester.getRect(find.byType(ClearBand)).bottom, closeTo(bar.top, 0.5), reason: 'the band is pinned right above the bar');
        expect(tester.getRect(find.byType(ClearBand)).height, ClearBand.height);

        expect(tester.takeException(), isNull);
      });
    }

    testWidgets('the band keeps its height with no answer, so nothing jumps when one is given', (tester) async {
      final s = FakeRunnerSession(questions: accountancyQuestions(20), mode: 'quick', mockNumber: null);
      await pumpRunner(tester, session: s, size: const Size(360, 780));
      await settle(tester);
      final before = tester.getRect(find.byType(ClearBand));
      expect(find.text(RunnerCopy.clearAnswer), findsNothing);
      await tester.tap(find.byType(AnswerOption).at(1));
      await settle(tester);
      expect(find.text(RunnerCopy.clearAnswer), findsWidgets);
      expect(tester.getRect(find.byType(ClearBand)), before);
    });
  });

  group('the answer cards (finding 4)', () {
    testWidgets('four soft cards, at least 56 dp tall, 8 dp apart, with no rules between them', (tester) async {
      final s = FakeRunnerSession(questions: accountancyQuestions(10), mode: 'quick', mockNumber: null);
      await pumpRunner(tester, session: s, size: const Size(360, 780));
      await settle(tester);
      final cards = find.byType(AnswerOption);
      expect(cards, findsNWidgets(4));
      for (var i = 0; i < 4; i++) {
        final r = tester.getRect(cards.at(i));
        expect(r.height, greaterThanOrEqualTo(56));
        expect(r.width, closeTo(360 - 32, 0.5), reason: 'a full-width card inside the gutter');
        if (i > 0) expect(r.top - tester.getRect(cards.at(i - 1)).bottom, AnswerOption.cardGap);
      }
      // The old OMR rules were 1 dp ColoredBoxes the full width of the column.
      final rules = find.byWidgetPredicate(
        (w) => w is SizedBox && w.height == 1 && w.child is ColoredBox,
      );
      expect(rules, findsNothing);
    });

    testWidgets('the question sits in the middle of the room between the track and the cards', (tester) async {
      final s = FakeRunnerSession(questions: accountancyQuestions(10), mode: 'quick', mockNumber: null, currentIndex: 3);
      await pumpRunner(tester, session: s, size: const Size(384, 853));
      await settle(tester);
      final track = tester.getRect(find.byType(TimingTrack));
      final question = tester.getRect(find.text(s.questions[3].question));
      final mark = tester.getRect(find.byType(MarkToggle));
      final firstCard = tester.getRect(find.byType(AnswerOption).first);
      // 4 dp of top padding under the track; 16 dp between the mark key and the first card.
      final above = question.top - (track.bottom + 4);
      final below = firstCard.top - 16 - mark.bottom;
      expect(above, greaterThanOrEqualTo(0));
      expect((above - below).abs(), lessThan(2), reason: 'equal air above and below the question block');
    });
  });

  group('the header (finding 4)', () {
    testWidgets('the practice count is one pill and the time is not in the bar', (tester) async {
      await pumpRunner(tester, session: answered(), size: const Size(384, 853));
      await settle(tester);
      expect(find.descendant(of: find.byType(RunnerTopBar), matching: find.textContaining('Open until')), findsNothing);
      expect(tester.getSize(find.byType(RunnerTopBar)).height, lessThanOrEqualTo(60));
    });

    testWidgets('Open until is the quiet line of the Questions sheet', (tester) async {
      await pumpRunner(tester, session: answered(), size: const Size(384, 853));
      await settle(tester);
      await tester.tap(find.byType(SheetKey));
      await settle(tester);
      expect(find.descendant(of: find.byType(PaletteSheet), matching: find.text('Open until 11:42 PM')), findsOneWidget);
    });

    testWidgets('a mock has its clock in the bar and no Open until anywhere', (tester) async {
      await pumpRunner(tester, session: FakeRunnerSession(), size: const Size(384, 853));
      await tester.pump(const Duration(seconds: 1));
      await tester.tap(find.byType(SheetKey));
      await settle(tester);
      expect(find.textContaining('Open until'), findsNothing);
    });
  });

  group('the submit grid numbers (finding 23)', () {
    test('are 12 sp, the floor for text a student reads', () {
      expect(AnswerSheetView.numberSize, greaterThanOrEqualTo(12));
      expect(AnswerSheetView.numberLine, greaterThanOrEqualTo(AnswerSheetView.numberSize));
    });

    testWidgets('the grid stays ten across and fits at 320 dp and at large text', (tester) async {
      for (final (size, scale) in [(const Size(320, 640), 1.0), (const Size(384, 853), 1.0), (const Size(360, 780), 1.3)]) {
        final s = FakeRunnerSession(currentIndex: 49, answers: {for (var i = 1; i <= 45; i++) 'q$i': 0}, marked: {'q4'});
        await pumpRunner(tester, session: s, size: size, textScale: scale, location: '/run/sess-1/submit');
        await settle(tester);
        expect(tester.takeException(), isNull, reason: '$size at $scale');
        final grid = tester.getRect(find.byType(AnswerSheetView));
        expect(grid.width, lessThanOrEqualTo(size.width - 32 + 0.5));
        // 5 rows of (17 dp bubble + number line), none shorter than the 12 sp number needs.
        expect(grid.height, greaterThanOrEqualTo(5 * (17 + AnswerSheetView.numberLine + 3) + 4 * 10 - 0.5));
      }
    });
  });
}
