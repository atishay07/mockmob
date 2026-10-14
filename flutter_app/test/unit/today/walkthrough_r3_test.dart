// Device walk-through round 3 (Today): the hero never says "nothing" while an older paper has
// open mistakes, the colleges caption says words not portal codes, Today's late-night line is
// its own, the primary key stays in reach above the dock, and its label does not wrap at 1.3x.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/domain/next_move.dart';
import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/core/widgets/widgets.dart' show KeyButton;
import 'package:mockmob/features/practice/copy.dart';
import 'package:mockmob/features/review/copy.dart';
import 'package:mockmob/features/today/copy.dart';
import 'package:mockmob/features/today/logic/move_builder.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/today/logic/today_model.dart';
import 'package:mockmob/features/today/screens/today_body.dart';
import 'package:mockmob/features/today/widgets/move_keys.dart';

import '../../golden/today/today_golden_support.dart' show PhoneFrame, kPhoneInsets, todayOverrides;
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'support/today_fixtures.dart';

void main() {
  setUpAll(loadAppFonts);

  final now = tuesdayEvening;

  // Three mostly blank Business Studies mocks on top of Asha's Accountancy record: the newest
  // papers have no wrong answers (a blank is not a repair), the older Accountancy mocks do.
  List<Attempt> blankAbove() => [
        for (var k = 0; k < 3; k++)
          paper(
            id: 'bs$k',
            completedAt: daysBefore(now, k, hour: 17),
            subject: 'business_studies',
            runs: const [('Planning', V.blank, 45), ('Planning', V.right, 5)],
          ),
        ...ashaRecord(now),
      ];

  group('a newer paper with no mistakes does not hide an older one (P1-1)', () {
    test('Today offers the repair from the newest paper that still has open mistakes', () {
      final inputs = ashaInputs(attempts: blankAbove());
      final m = buildMove(inputs);
      expect(m.state, NextMoveState.ready);
      expect(m.evidenceId, 'm7');
      expect(m.subjectLine, 'Accountancy');
      expect(m.meaning, isNot(contains('Nothing stands out')));
      expect(m.primary.actionType, 'repair');
    });

    test('with the blank mocks alone, it says so honestly: no open mistakes, not "nothing stands out"', () {
      final only = [for (final a in blankAbove().take(3)) a];
      final m = buildMove(ashaInputs(attempts: only));
      expect(m.state, NextMoveState.noStrongWeakness);
      expect(m.meaning, TodayCopy.noOpenMistakes);
    });

    test('a repaired paper above an unrepaired one still offers the unrepaired one', () {
      final m = buildMove(ashaInputs(repaired: {'m7': repairedAll(ashaRecord(now))['m7']!}));
      // Mock 7 is done; the Business Studies Quick 10 (a 10-question paper can carry a repair)
      // is the next paper with an open mistake, the same walk Review makes.
      expect(m.evidenceId, 'q1');
    });

    test('everything repaired is still the repaired state, told from the newest paper', () {
      final m = buildMove(ashaInputs(repaired: repairedAll(ashaRecord(now))));
      expect(m.state, NextMoveState.repairedCheckNotDue);
      expect(m.numberLabel, contains('Mock 7'));
    });
  });

  group('the colleges caption (P2-3)', () {
    test('UR is said as unreserved, never as the code', () {
      expect(TodayCopy.ladderCaption('UR'), "Round 1 minimum, 2026, unreserved");
      expect(TodayCopy.ladderCaption(null), TodayCopy.ladderCaption('UR'));
      expect(TodayCopy.ladderCaption('ur'), TodayCopy.ladderCaption('UR'));
    });

    test('other categories use the name a student says, and an unknown one is kept as it came', () {
      expect(TodayCopy.ladderCaption('OBC-NCL'), "Round 1 minimum, 2026, OBC");
      expect(TodayCopy.ladderCaption('EWS'), "Round 1 minimum, 2026, EWS");
      expect(TodayCopy.ladderCaption('SIKH'), "Round 1 minimum, 2026, Sikh minority");
      expect(TodayCopy.ladderCaption('SGC'), "Round 1 minimum, 2026, single girl child");
      expect(TodayCopy.ladderCaption('XYZ'), "Round 1 minimum, 2026, XYZ");
    });
  });

  test("Today's late-night line is its own, not Practice's or Review's (P3-2)", () {
    expect(TodayCopy.lateNight, isNot(PracticeCopy.lateOverline));
    expect(TodayCopy.lateNight, isNot(ReviewCopy.lateNight));
    expect(PracticeCopy.lateOverline, isNot(ReviewCopy.lateNight), reason: 'each screen says its own');
    expect(TodayCopy.lateNight, isNot(TodayCopy.mobiSleepy.first), reason: 'the header Mobi is not shown beside it, but taps say that one');
    for (final line in [TodayCopy.lateNight, TodayCopy.noOpenMistakes, PracticeCopy.lateOverline, ReviewCopy.lateNight]) {
      expect(line, isNot(contains('!')));
      expect(line, isNot(contains('—')));
    }
  });

  group('the primary key stays in reach above the dock (P2-2)', () {
    Future<void> pump(WidgetTester tester, TodayView view, {double scale = 1, Size size = const Size(360, 800), bool dock = true, ScrollController? controller}) async {
      await pumpMockmob(
        tester,
        PhoneFrame(
          dock: dock,
          child: TodayBody(
            view: view,
            skeletonDelay: Duration.zero,
            controller: controller,
            callbacks: TodayCallbacks(onAction: (_) {}, onTarget: (_) {}, onMinutes: (_) {}, onShowMe: (_) {}, onWeek: () {}),
          ),
        ),
        size: size,
        textScale: scale,
        disableAnimations: true,
        overrides: todayOverrides,
      );
      await tester.pump();
      await tester.pump();
    }

    Finder bar() => find.byType(StickyMoveBar);

    // The dock's top edge on a phone with the test insets, and the top of the ground fade the
    // shell draws above it: the bar rests on that edge, clear of the fade.
    const dockTop = 20 + 10 + 60.0;
    const barRest = dockTop + 48;

    testWidgets('at rest on a short phone the bar stands in for a key that is under the dock', (tester) async {
      await pump(tester, buildToday(ashaInputs(now: tuesdayLate)));
      expect(bar(), findsOneWidget);
      final rect = tester.getRect(find.descendant(of: bar(), matching: find.byType(KeyButton)).first);
      expect(rect.bottom, lessThanOrEqualTo(800 - barRest + 0.5), reason: 'wholly above the dock and its fade');
      expect(rect.height, greaterThanOrEqualTo(48));
      // The alternative is there too, as a 48 dp target named for screen readers.
      final alt = find.bySemanticsLabel(TodayCopy.chooseSomethingElse);
      expect(alt, findsWidgets);
      expect(tester.takeException(), isNull);
    });

    testWidgets('at 1.3x text the key is below the fold and the bar still holds it', (tester) async {
      await pump(tester, buildToday(ashaInputs()), scale: 1.3);
      expect(bar(), findsOneWidget);
      final rect = tester.getRect(find.descendant(of: bar(), matching: find.byType(KeyButton)).first);
      expect(rect.bottom, lessThanOrEqualTo(800 - barRest + 0.5));
      expect(tester.takeException(), isNull);
    });

    testWidgets('on a tall screen the card shows its own key and no bar is added', (tester) async {
      await pump(tester, buildToday(ashaInputs()), size: const Size(384, 1100));
      expect(bar(), findsNothing);
      expect(find.byType(KeyButton), findsNWidgets(2), reason: 'the card has its primary and its quiet alternative');
    });

    testWidgets('scrolling the card key into the clear hands over to it: one primary key at a time', (tester) async {
      final controller = ScrollController();
      addTearDown(controller.dispose);
      await pump(tester, buildToday(ashaInputs(now: tuesdayLate)), controller: controller);
      expect(bar(), findsOneWidget);
      controller.jumpTo(300);
      await tester.pump();
      await tester.pump();
      expect(bar(), findsNothing);
      final primaries = find.text(TodayCopy.startRepair(10));
      expect(primaries, findsOneWidget);
      controller.jumpTo(0);
      await tester.pump();
      await tester.pump();
      expect(bar(), findsOneWidget);
    });

    testWidgets('without a dock (no shell) nothing is pinned', (tester) async {
      await pump(tester, buildToday(ashaInputs(now: tuesdayLate)), dock: false);
      expect(bar(), findsNothing);
    });

    testWidgets('offline, where the start is disabled with its reason, no bar covers the page', (tester) async {
      await pump(tester, buildToday(ashaInputs(offline: true, now: tuesdayLate)));
      expect(bar(), findsNothing);
    });

    testWidgets('the bar taps through to the same action as the card key', (tester) async {
      final events = <Object>[];
      await pumpMockmob(
        tester,
        PhoneFrame(
          child: TodayBody(
            view: buildToday(ashaInputs(now: tuesdayLate)),
            skeletonDelay: Duration.zero,
            callbacks: TodayCallbacks(onAction: events.add, onTarget: events.add, onMinutes: (_) {}, onShowMe: (_) {}, onWeek: () {}),
          ),
        ),
        size: const Size(360, 800),
        disableAnimations: true,
        overrides: todayOverrides,
      );
      await tester.pump();
      await tester.pump();
      await tester.tap(find.descendant(of: bar(), matching: find.byType(KeyButton)).first);
      await tester.pump();
      final action = events.whereType<TodayAction>().single;
      expect(action.actionType, 'repair');
    });
  });

  group('the primary key label does not wrap at 1.3x (P3-36)', () {
    Future<double> keyHeight(WidgetTester tester, {required double scale}) async {
      await pumpMockmob(
        tester,
        TodayBody(
          view: buildToday(ashaInputs(selectedMinutes: 5)),
          skeletonDelay: Duration.zero,
          callbacks: TodayCallbacks(onAction: (_) {}, onTarget: (_) {}, onMinutes: (_) {}, onShowMe: (_) {}, onWeek: () {}),
        ),
        size: const Size(360, 1900),
        textScale: scale,
        disableAnimations: true,
        overrides: todayOverrides,
      );
      final key = find.ancestor(of: find.textContaining('Start repair'), matching: find.byType(KeyButton));
      return tester.getSize(key.first).height;
    }

    testWidgets('at 1.0x the long label shows; at 1.3x the short one, on one line', (tester) async {
      final normal = await keyHeight(tester, scale: 1);
      expect(find.text(TodayCopy.startRepair(5)), findsOneWidget);
      final large = await keyHeight(tester, scale: 1.3);
      expect(find.text(TodayCopy.startRepair(5)), findsNothing);
      expect(find.text(TodayCopy.startRepairShort(5)), findsOneWidget);
      expect(large, lessThan(normal * 1.3 + 8), reason: 'one line of text, so the key only grows with its text size');
    });

    testWidgets('the key still says its full label to screen readers', (tester) async {
      await keyHeight(tester, scale: 1.3);
      expect(find.bySemanticsLabel(TodayCopy.startRepair(5)), findsOneWidget);
    });

    testWidgets('the week count stays on one line when the outlook has to drop below it', (tester) async {
      await pumpMockmob(
        tester,
        TodayBody(
          view: buildToday(ashaInputs()),
          skeletonDelay: Duration.zero,
          callbacks: TodayCallbacks(onAction: (_) {}, onTarget: (_) {}, onMinutes: (_) {}, onShowMe: (_) {}, onWeek: () {}),
        ),
        size: const Size(360, 1900),
        textScale: 1.3,
        disableAnimations: true,
        overrides: todayOverrides,
      );
      // The count is one run of text (the figure in the condensed cut, then its words).
      final count = find.text('1 of 4 study days', findRichText: true);
      expect(count, findsOneWidget);
      final painter = TextPainter(
        text: tester.widget<RichText>(count).text,
        textDirection: TextDirection.ltr,
        textScaler: const TextScaler.linear(1.3),
      )..layout();
      expect(tester.getSize(count).height, closeTo(painter.height, 1), reason: 'one line, not two');
    });
  });

  test('kPhoneInsets are what the dock test assumes', () {
    expect(kPhoneInsets.bottom, 20);
  });
}
