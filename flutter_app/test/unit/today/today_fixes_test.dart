// Bug-hunt fixes in Today's pure logic and widgets: the ended-mock notice expires, a plan
// action this app cannot open never becomes a "Start" key, the repair length chip on the sheet
// matches the card, the last week of the road counts days, and the slot key is a 48 dp target.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/models/learning_plan.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart' show KeyButton, MmSegmented;
import 'package:mockmob/features/today/copy.dart';
import 'package:mockmob/features/today/data/today_providers.dart';
import 'package:mockmob/features/today/logic/move_builder.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/today/logic/today_clock.dart';
import 'package:mockmob/features/today/logic/today_inputs.dart';
import 'package:mockmob/features/today/logic/today_model.dart';
import 'package:mockmob/features/today/screens/alternatives_sheet.dart';
import 'package:mockmob/features/today/screens/today_body.dart';
import 'package:mockmob/features/today/widgets/also_slots.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'support/today_fixtures.dart';

void main() {
  setUpAll(loadAppFonts);

  final now = tuesdayEvening;

  group('the ended-mock notice (today-01)', () {
    TodayDraft ended(DateTime endsAt, {bool? exists = false}) => TodayDraft(
          sessionId: 'm8',
          subject: 'accountancy',
          isMock: true,
          mockNumber: 8,
          total: 50,
          answered: 31,
          acknowledgedAnswered: 31,
          endsAt: endsAt,
          resumable: false,
          attemptExists: exists,
        );

    test('a mock that could not be recorded is the hero on the evening it ended', () {
      final view = buildToday(ashaInputs(draft: ended(now.subtract(const Duration(hours: 3)))));
      expect(view.hero, isA<EndedHero>());
      expect((view.hero! as EndedHero).line, contains('could not be recorded'));
      expect(view.also, hasLength(1), reason: "tonight's move waits in a slot");
    });

    test("a day later the notice is gone and tonight's move is the hero again", () {
      final view = buildToday(ashaInputs(draft: ended(now.subtract(const Duration(hours: 25)))));
      expect(view.hero, isA<MoveHero>());
      expect(view.also, isEmpty);
    });

    test('a recorded mock stops saying "Open result" after a day too', () {
      final soon = buildToday(ashaInputs(draft: ended(now.subtract(const Duration(hours: 5)), exists: true)));
      expect((soon.hero! as EndedHero).action.label, TodayCopy.openResult);
      final later = buildToday(ashaInputs(draft: ended(now.subtract(const Duration(hours: 24, minutes: 1)), exists: true)));
      expect(later.hero, isA<MoveHero>());
    });

    test('the cut-off is exact: 23 h 59 min still shows, 24 h does not', () {
      final edge = now.subtract(endedNoticeWindow);
      expect(buildToday(ashaInputs(draft: ended(edge.add(const Duration(minutes: 1))))).hero, isA<EndedHero>());
      expect(buildToday(ashaInputs(draft: ended(edge))).hero, isA<MoveHero>());
    });
  });

  group('a server action this app cannot open (today-06)', () {
    TodayInputs withPlan(String? href) => TodayInputs(
          now: now,
          firstName: 'Asha',
          subjects: const ['accountancy'],
          attempts: [accountancyMock('clean', daysBefore(now, 1))],
          plan: LearningPlan.fromJson({
            'primary': {'kind': 'repair', 'title': 'Repair ratio analysis', 'href': href, 'duration': '10 min'},
            'minutes': 10,
            'recordState': 'ready',
          }),
        );

    for (final href in ['/some/web/only/page', 'https://example.com/repair', null]) {
      test('href $href never becomes a Start key that opens the chooser', () {
        final m = buildMove(withPlan(href));
        expect(m.primary.target, isA<GoTo>(), reason: 'a key that says Start must start something');
        expect(m.primary.label, isNot(startsWith('Start,')));
        expect(m.primary.label, isNot(TodayCopy.chooseSomethingElse));
      });
    }

    test('an href the app can open still wins with its own label', () {
      final m = buildMove(withPlan('/test?mode=quick&count=10'));
      expect(m.primary.label, 'Start, 10 min');
      expect(m.primary.target, isA<GoTo>());
      expect(m.primary.startsSession, isTrue);
    });
  });

  group('the repair length on the sheet (today-07)', () {
    // Six open mistakes in one chapter: chips 5, 10 and 20 minutes.
    final record = [accountancyMock('m9', daysBefore(now, 1), wrongAt: {1, 2, 3, 4, 5, 6})];

    for (final (name, returning, at) in [
      ('returning', true, now),
      ('late at night', false, tuesdayLate),
      ('an ordinary evening', false, now),
    ]) {
      test('$name: the sheet highlights the length the card is using', () {
        final inputs = ashaInputs(attempts: record, returning: returning, now: at);
        final hero = buildMove(inputs);
        expect(hero.durations.map((d) => d.minutes), [5, 10, 20]);
        expect(repairMinutesSelected(inputs, MoveFacts(inputs)), hero.selectedMinutes);
      });
    }

    test('returning prefers 10, an ordinary evening 20', () {
      expect(buildMove(ashaInputs(attempts: record, returning: true)).selectedMinutes, 10);
      expect(buildMove(ashaInputs(attempts: record)).selectedMinutes, 20);
    });

    testWidgets('the sheet shows the same chip as the card', (tester) async {
      final inputs = ashaInputs(attempts: record, returning: true);
      await pumpMockmob(
        tester,
        const AlternativesSheet(),
        size: const Size(384, 900),
        disableAnimations: true,
        overrides: [
          authSnapshotProvider.overrideWithBuild((ref, notifier) => const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u')),
          todayInputsProvider.overrideWithValue(inputs),
        ],
      );
      final chips = tester.widget<MmSegmented<int>>(find.byType(MmSegmented<int>));
      expect(chips.value, 10, reason: 'the card says about 10 minutes');
    });
  });

  group('the last days before the window (today-10)', () {
    test('under a week the road counts days, never 0 weeks', () {
      final road = buildRoad(ashaInputs(now: DateTime.utc(2027, 4, 27, 8)))!;
      expect(road.phase, RoadPhase.countdown);
      expect(road.weeks, 0);
      expect(road.daysToWindow, 4);
    });

    test('a full week or more still counts weeks', () {
      final road = buildRoad(ashaInputs(now: DateTime.utc(2027, 4, 24, 8)))!;
      expect(road.weeks, 1);
      expect(road.daysToWindow, 7);
    });

    testWidgets('the card says "5 days", and "1 day" on the last day', (tester) async {
      Future<void> showAt(DateTime at) async {
        await pumpMockmob(
          tester,
          TodayBody(
            view: buildToday(ashaInputs(now: at)),
            skeletonDelay: Duration.zero,
            callbacks: TodayCallbacks(onAction: (_) {}, onTarget: (_) {}),
          ),
          size: const Size(384, 1900),
          disableAnimations: true,
          overrides: [authSnapshotProvider.overrideWithBuild((ref, notifier) => const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u'))],
        );
        await tester.scrollUntilVisible(find.text(TodayCopy.roadTitle), 300, scrollable: find.byType(Scrollable).first);
      }

      await showAt(DateTime.utc(2027, 4, 26, 8));
      expect(find.text(TodayCopy.daysToWindowLabel(5)), findsOneWidget);
      expect(find.text('5'), findsOneWidget);
      expect(find.text(TodayCopy.weeksLabel(0)), findsNothing);

      await showAt(DateTime.utc(2027, 4, 30, 8));
      expect(find.text(TodayCopy.daysToWindowLabel(1)), findsOneWidget);
      expect(TodayCopy.daysToWindowLabel(1), startsWith('day to'));
    });
  });

  group('the slot key (today-09)', () {
    for (final scale in [1.0, 1.3]) {
      testWidgets('is at least 48 dp tall at ${scale}x text on a 360 dp phone, and does not overflow', (tester) async {
        await pumpMockmob(
          tester,
          AlsoSlots(
            slots: const [
              AlsoSlot(title: "Tonight's move", line: 'Repair 4 mistakes from Mock 7', action: TodayAction('Start repair', GoTo('/review'))),
            ],
            onAction: (_) {},
          ),
          size: const Size(360, 640),
          textScale: scale,
          disableAnimations: true,
        );
        expect(tester.takeException(), isNull);
        expect(tester.getSize(find.byType(KeyButton)).height, greaterThanOrEqualTo(MmTarget.min));
      });
    }
  });
  group('the next move offered outside Today (the recap card 4)', () {
    TodayAction? offered(TodayInputs inputs) {
      final container = ProviderContainer(overrides: [todayInputsProvider.overrideWithValue(inputs)]);
      addTearDown(container.dispose);
      return container.read(todayNextActionProvider);
    }

    test('is the same primary action Today builds', () {
      final inputs = ashaInputs(attempts: [accountancyMock('clean', daysBefore(now, 1))]);
      final action = offered(inputs);
      expect(action, isNotNull);
      expect(action!.label, buildMove(inputs).primary.label);
      expect(action.target, isA<GoTo>());
    });

    test('is none while offline when the move starts a session', () {
      expect(offered(ashaInputs(attempts: [accountancyMock('clean', daysBefore(now, 1))], offline: true)), isNull);
    });

    test('is none when Today itself would only offer to retry or open the alternatives', () {
      expect(offered(TodayInputs(now: now, attemptsFailed: true)), isNull);
    });
  });

  group('the week strip and the header share one clock (review: returning frame)', () {
    test('Saturday 17 October marks Saturday, whatever column the week said was today', () {
      final view = buildToday(ashaInputs(now: now.add(const Duration(days: 4)), week: saturdayWeek, returning: true));
      expect(view.header.dateLine, startsWith('Saturday, 17 October'));
      expect([for (final d in view.header.week!.days) d.isToday], [false, false, false, false, false, true, false]);
    });

    test('a stale week that still says Tuesday is today is corrected from the header clock', () {
      final view = buildToday(ashaInputs(now: now.add(const Duration(days: 4))));
      expect(view.header.dateLine, startsWith('Saturday, 17 October'));
      expect(view.header.week!.days.indexWhere((d) => d.isToday), 5);
    });

    test('a week from another set of dates marks nothing as today', () {
      final view = buildToday(ashaInputs(now: now.add(const Duration(days: 9))));
      expect(view.header.week!.days.any((d) => d.isToday), isFalse);
    });
  });

  group('the window-closed ended card (review: box-in-box)', () {
    test("tonight's move leads with the one volt key; the picker steps back", () {
      final view = buildToday(
        ashaInputs(
          draft: TodayDraft(
            sessionId: 's8',
            subject: 'accountancy',
            isMock: true,
            mockNumber: 8,
            total: 50,
            answered: 31,
            acknowledgedAnswered: 31,
            endsAt: now.subtract(const Duration(hours: 3)),
            resumable: false,
            attemptExists: false,
          ),
        ),
      );
      expect(view.hero, isA<EndedHero>());
      expect(view.also.single.lead, isTrue);
    });

    test('a move that is not under it does not lead', () {
      expect(buildToday(ashaInputs()).also, isEmpty);
    });
  });
}
