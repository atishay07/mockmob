// The earned moment on the result (BADGES-REFINE-1018 3): one compact "Badge earned" row near the top of the
// analysis, the coin revealed once (0.85 to 1 with one light band, 600 ms on the app's motion curves; a 150 ms fade
// under reduced motion), one light tick, shown once per badge and per earned date, never a modal. The Celebrations
// setting rules it: Full is the reveal and the tick, Quiet is the same words with no movement and no tick, Off shows
// nothing and spends nothing.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/core/models/rhythm.dart';
import 'package:mockmob/core/repositories/rhythm_repository.dart';
import 'package:mockmob/core/repositories/rhythm_seen_repository.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/result/data/result_providers.dart' show RecapData;
import 'package:mockmob/features/result/widgets/next_move_panel.dart' show NextMovePanel;
import 'package:mockmob/features/rhythm/data/rhythm_prefs.dart' show CelebrationMode;
import 'package:mockmob/features/rhythm/logic/badge_shelf.dart';
import 'package:mockmob/features/rhythm/widgets/badge_earned_row.dart';
import 'package:mockmob/features/rhythm/widgets/medal.dart';

import '../../golden/rhythm/rhythm_test_kit.dart';
import '../../helpers/fonts.dart';
import '../result/support/fixtures.dart' as result_fixtures;
import '../result/support/harness.dart';

/// `rhythm_seen` in memory.
class MemorySeen implements RhythmSeenRepository {
  final Set<String> ids = {};
  bool unreadable = false;

  @override
  Future<RhythmSeenState> read() async {
    if (unreadable) throw StateError('no storage');
    return RhythmSeenState(celebratedIds: {...ids});
  }

  @override
  Future<bool> markCelebrated(String id) async => ids.add(id);

  @override
  Future<bool> hasCelebrated(String id) async => ids.contains(id);

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class CountingDriver implements HapticDriver {
  final List<String> calls = [];

  @override
  Future<void> selectionClick() async => calls.add('selection');

  @override
  Future<void> lightImpact() async => calls.add('light');

  @override
  Future<void> mediumImpact() async => calls.add('medium');
}

/// 11:30 AM in India on Wednesday 14 October 2026; the fixture clock (`kNow`) is an hour later.
final _done = DateTime.utc(2026, 10, 14, 3, 30);

Attempt _attempt(String id, {required DateTime at, int correct = 7, int wrong = 2, int total = 10}) => Attempt.fromJson({
      'id': id,
      'subject': 'accountancy',
      'score': 0,
      'correct': correct,
      'wrong': wrong,
      'unattempted': total - correct - wrong,
      'total': total,
      'details': const [],
      'questionsSnapshot': const [],
      'selectionMeta': {'mode': 'quick', 'scoringVersion': 'server_practice_v1'},
      'completedAt': at.millisecondsSinceEpoch,
    });

RhythmMilestone _m(String id, DateTime at) => RhythmMilestone(id: id, achievedAt: at);

void main() {
  setUpAll(loadAppFonts);

  Future<void> pumpRow(
    WidgetTester tester, {
    required MemorySeen seen,
    required CountingDriver driver,
    List<RhythmMilestone> milestones = const [],
    List<Attempt>? attempts,
    DateTime? completed,
    String attemptId = 'a1',
    CelebrationMode mode = CelebrationMode.full,
    bool hidden = false,
    bool reduced = false,
    VoidCallback? onSee,
  }) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          ...rhythmOverrides(
            rhythm: loaded(rhythmFixture(milestones: [...milestones, const RhythmMilestone(id: 'first_hold'), const RhythmMilestone(id: 'run_weeks_3')])),
            attempts: attempts ?? [_attempt('a1', at: _done)],
            mode: mode,
            hidden: hidden,
          ),
          rhythmSeenRepositoryProvider.overrideWithValue(seen),
          hapticsProvider.overrideWithValue(Haptics(enabled: true, driver: driver)),
        ],
        child: MaterialApp(
          theme: buildTheme(Brightness.dark),
          home: MediaQuery(
            data: MediaQueryData(size: const Size(412, 900), disableAnimations: reduced),
            child: Scaffold(
              body: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: BadgeEarnedRow(attemptId: attemptId, completedAt: completed ?? _done, onSeeBadges: onSee ?? () {}),
                  ),
                  const Padding(padding: EdgeInsets.all(16), child: Text('below the row')),
                ],
              ),
            ),
          ),
        ),
      ),
    );
    // The seen record is read, then the row grows in: let the microtasks and the size ease run.
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
  }

  testWidgets('a paper that earned a badge shows one row: the coin, "Badge earned", its name and "See your badges"', (tester) async {
    final seen = MemorySeen();
    final driver = CountingDriver();
    var opened = 0;
    await pumpRow(tester, seen: seen, driver: driver, milestones: [_m('first_scored_session', _done.add(const Duration(seconds: 20)))], onSee: () => opened++);
    await tester.pump(const Duration(milliseconds: 700));
    expect(find.text('Badge earned'), findsOneWidget);
    expect(find.text('First scored set'), findsOneWidget);
    expect(find.text('See your badges'), findsOneWidget);
    expect(find.byType(Medal), findsOneWidget);
    expect(find.bySemanticsLabel('Badge earned. First scored set.'), findsOneWidget);
    // Never a modal.
    expect(find.byType(Dialog), findsNothing);
    expect(find.byType(BottomSheet), findsNothing);
    await tester.tap(find.text('See your badges'));
    expect(opened, 1);
  });

  testWidgets('it is shown once: the badge and its date are remembered, so a second visit shows nothing and ticks nothing', (tester) async {
    final seen = MemorySeen();
    final driver = CountingDriver();
    final at = _done.add(const Duration(seconds: 20));
    await pumpRow(tester, seen: seen, driver: driver, milestones: [_m('first_scored_session', at)]);
    await tester.pump(const Duration(milliseconds: 700));
    expect(find.text('Badge earned'), findsOneWidget);
    expect(driver.calls, ['selection'], reason: 'one light tick, once');
    expect(seen.ids, containsAll([badgeSeenKey('first_scored_session', at), 'first_scored_session']));

    // The result is opened again: a new row, the same memory.
    await tester.pumpWidget(const SizedBox());
    await pumpRow(tester, seen: seen, driver: driver, milestones: [_m('first_scored_session', at)]);
    await tester.pump(const Duration(milliseconds: 700));
    expect(find.text('Badge earned'), findsNothing);
    expect(driver.calls, ['selection'], reason: 'no second tick');
  });

  testWidgets('two badges at once are one row: "2 badges earned" with both names, one tick', (tester) async {
    final seen = MemorySeen();
    final driver = CountingDriver();
    await pumpRow(
      tester,
      seen: seen,
      driver: driver,
      milestones: [_m('first_scored_session', _done.add(const Duration(seconds: 20))), _m('first_full_mock', _done.add(const Duration(seconds: 25)))],
    );
    await tester.pump(const Duration(milliseconds: 700));
    expect(find.text('2 badges earned'), findsOneWidget);
    expect(find.text('First scored set and First full mock'), findsOneWidget);
    expect(find.text('See your badges'), findsOneWidget);
    expect(find.byType(Medal), findsNWidgets(2));
    expect(driver.calls, ['selection']);
  });

  testWidgets('a badge the phone worked out from this paper is announced by its record', (tester) async {
    final seen = MemorySeen();
    final driver = CountingDriver();
    await pumpRow(tester, seen: seen, driver: driver, attempts: [_attempt('a1', at: _done, correct: 10, wrong: 0)]);
    await tester.pump(const Duration(milliseconds: 700));
    expect(find.text('Badge earned'), findsOneWidget);
    expect(find.text('Clean set'), findsOneWidget);
  });

  testWidgets('another paper, a result older than three days, and a badge with no date announce nothing', (tester) async {
    final other = MemorySeen();
    await pumpRow(tester, seen: other, driver: CountingDriver(), milestones: [_m('first_scored_session', _done.add(const Duration(seconds: 20)))], attemptId: 'b2', completed: _done.subtract(const Duration(hours: 5)));
    await tester.pump(const Duration(milliseconds: 700));
    expect(find.text('Badge earned'), findsNothing, reason: 'the badge belongs to another paper');
    expect(other.ids, isEmpty, reason: 'nothing is spent');

    await tester.pumpWidget(const SizedBox());
    final old = DateTime.utc(2026, 10, 9, 3, 30); // five days before the clock
    final seen = MemorySeen();
    await pumpRow(tester, seen: seen, driver: CountingDriver(), milestones: [_m('first_scored_session', old)], completed: old, attempts: [_attempt('a1', at: old)]);
    await tester.pump(const Duration(milliseconds: 700));
    expect(find.text('Badge earned'), findsNothing);

    await tester.pumpWidget(const SizedBox());
    await pumpRow(tester, seen: MemorySeen(), driver: CountingDriver(), milestones: const [RhythmMilestone(id: 'first_scored_session')]);
    await tester.pump(const Duration(milliseconds: 700));
    expect(find.text('Badge earned'), findsNothing, reason: 'earned only with a real date');
  });

  testWidgets('a badge dated again by the server is a new moment', (tester) async {
    final seen = MemorySeen();
    final first = _done.add(const Duration(seconds: 20));
    seen.ids.addAll([badgeSeenKey('first_scored_session', first), 'first_scored_session']);
    await pumpRow(tester, seen: seen, driver: CountingDriver(), milestones: [_m('first_scored_session', first.add(const Duration(seconds: 30)))]);
    await tester.pump(const Duration(milliseconds: 700));
    expect(find.text('Badge earned'), findsOneWidget);
  });

  testWidgets('memory that cannot be read shows nothing rather than risk showing it twice', (tester) async {
    final seen = MemorySeen()..unreadable = true;
    final driver = CountingDriver();
    await pumpRow(tester, seen: seen, driver: driver, milestones: [_m('first_scored_session', _done.add(const Duration(seconds: 20)))]);
    await tester.pump(const Duration(milliseconds: 700));
    expect(find.text('Badge earned'), findsNothing);
    expect(driver.calls, isEmpty);
  });

  group('the Celebrations setting', () {
    final milestones = [_m('first_scored_session', _done.add(const Duration(seconds: 20)))];

    testWidgets('Off shows nothing and spends nothing, so the moment waits', (tester) async {
      final seen = MemorySeen();
      final driver = CountingDriver();
      await pumpRow(tester, seen: seen, driver: driver, milestones: milestones, mode: CelebrationMode.off);
      await tester.pump(const Duration(milliseconds: 700));
      expect(find.text('Badge earned'), findsNothing);
      expect(seen.ids, isEmpty);
      expect(driver.calls, isEmpty);
    });

    testWidgets('rhythm turned off hides it everywhere, and spends nothing', (tester) async {
      final seen = MemorySeen();
      await pumpRow(tester, seen: seen, driver: CountingDriver(), milestones: milestones, hidden: true);
      await tester.pump(const Duration(milliseconds: 700));
      expect(find.text('Badge earned'), findsNothing);
      expect(seen.ids, isEmpty);
    });

    testWidgets('Quiet is the same words with no movement and no tick', (tester) async {
      final seen = MemorySeen();
      final driver = CountingDriver();
      await pumpRow(tester, seen: seen, driver: driver, milestones: milestones, mode: CelebrationMode.quiet);
      expect(find.text('Badge earned'), findsOneWidget);
      expect(driver.calls, isEmpty);
      final scale = find.descendant(of: find.byType(BadgeEarnedRow), matching: find.byType(ScaleTransition));
      expect(scale, findsNothing, reason: 'a coin that does not move');
    });
  });

  group('the reveal', () {
    final milestones = [_m('first_scored_session', _done.add(const Duration(seconds: 20)))];

    double scaleNow(WidgetTester tester) => tester.widget<ScaleTransition>(find.descendant(of: find.byType(BadgeEarnedRow), matching: find.byType(ScaleTransition))).scale.value;

    testWidgets('the coin scales from 0.85 to 1 over 600 ms, with one light band across it', (tester) async {
      expect(kBadgeReveal, const Duration(milliseconds: 600));
      await tester.binding.setSurfaceSize(const Size(412, 900));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      await tester.pumpWidget(const SizedBox());
      await tester.runAsync(() async {});
      final seen = MemorySeen();
      // Build without settling, so the first frames of the reveal are seen.
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            ...rhythmOverrides(rhythm: loaded(rhythmFixture(milestones: [...milestones, const RhythmMilestone(id: 'first_hold'), const RhythmMilestone(id: 'run_weeks_3')])), attempts: [_attempt('a1', at: _done)]),
            rhythmSeenRepositoryProvider.overrideWithValue(seen),
            hapticsProvider.overrideWithValue(Haptics(enabled: true, driver: CountingDriver())),
          ],
          child: MaterialApp(theme: buildTheme(Brightness.dark), home: Scaffold(body: BadgeEarnedRow(attemptId: 'a1', completedAt: _done, onSeeBadges: () {}))),
        ),
      );
      await tester.pump(); // the record is read
      await tester.pump(); // the row is built; the reveal starts at 0
      final start = scaleNow(tester);
      expect(start, closeTo(0.85, 0.05));
      await tester.pump(const Duration(milliseconds: 150));
      final mid = scaleNow(tester);
      expect(mid, greaterThan(start));
      expect(mid, lessThan(1));
      // One band of light is painted while it runs (the medal's own sweep clock is on).
      final medal = tester.widget<Medal>(find.byType(Medal));
      expect(medal.sweep, isNotNull);
      await tester.pump(const Duration(milliseconds: 600));
      expect(scaleNow(tester), 1.0);
    });

    testWidgets('under reduced motion it is a 150 ms fade, with no scale and no light band', (tester) async {
      expect(kBadgeRevealReduced, const Duration(milliseconds: 150));
      final seen = MemorySeen();
      await pumpRow(tester, seen: seen, driver: CountingDriver(), milestones: milestones, reduced: true);
      expect(find.text('Badge earned'), findsOneWidget);
      expect(find.descendant(of: find.byType(BadgeEarnedRow), matching: find.byType(ScaleTransition)), findsNothing);
      expect(tester.widget<Medal>(find.byType(Medal)).sweep, isNull);
      final fade = find.descendant(of: find.byType(Medal), matching: find.byType(FadeTransition));
      expect(find.ancestor(of: find.byType(Medal), matching: find.byType(FadeTransition)), findsWidgets);
      expect(fade, findsNothing);
      await tester.pump(const Duration(milliseconds: 200));
      final opacity = tester.widget<FadeTransition>(find.ancestor(of: find.byType(Medal), matching: find.byType(FadeTransition)).first).opacity.value;
      expect(opacity, 1.0);
    });
  });

  group('on the result', () {
    testWidgets('the row sits under the marks and above the next move, once, and the page below it is not covered', (tester) async {
      final seen = MemorySeen();
      final driver = FakeHaptics();
      final d = result_fixtures.detail();
      final done = d.attempt.completedAt;
      final router = await pumpResultRoute(
        tester,
        openFolds: true,
        location: '/result/a7',
        overrides: resultOverrides(
          attemptId: 'a7',
          data: RecapData(model: result_fixtures.mock7(withDetail: d), attempt: d.attempt, detail: d),
          haptics: driver,
          extra: [
            rhythmRepositoryProvider.overrideWith(() => FakeRhythmRepo(loaded(rhythmFixture(milestones: [_m('first_full_mock', done.add(const Duration(seconds: 25))), const RhythmMilestone(id: 'first_hold'), const RhythmMilestone(id: 'run_weeks_3')])))),
            rhythmSeenRepositoryProvider.overrideWithValue(seen),
          ],
        ),
      );
      expect(router, isNotNull);
      await tester.pump(const Duration(seconds: 2));
      expect(find.text('Badge earned'), findsOneWidget);
      expect(find.text('First full mock'), findsOneWidget);
      final row = tester.getTopLeft(find.text('Badge earned')).dy;
      expect(row, greaterThan(tester.getTopLeft(find.bySemanticsLabel('115 of 250 marks').first).dy));
      expect(row, lessThan(tester.getTopLeft(find.byType(NextMovePanel)).dy), reason: 'above the one next move, which it never pushes off the page');
      expect(driver.calls.where((c) => c == 'selection'), hasLength(1));
    });
  });
}
