// 20 Oct, G13 re-check after the walk (M5 changed the accept code): the frames, 8 ms apart, against the approved
// durations. Measured on 2485e83e: the card lifts to 1.03 by about 64 ms, is within 2% of the lead at about 390 ms, has
// faded into it by about 370 ms, never overshoots and has one peak; the lead dips to about 0.985 at 264 ms and is still
// by about 470 ms. (Was: 19 Oct (G13, rule R5): the "Do this next" accept animation as one continuous move. The accepted
// card lifts to 1.03 with a deeper shadow, travels to the lead card on one spring that never
// overshoots by more than 4% and settles within 350 to 450 ms, the lead card's words wait for it
// and the lead card settles under it. Reduced motion: a crossfade, no flight.)
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/today/logic/suggested_deck.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/today/logic/today_inputs.dart';
import 'package:mockmob/features/today/screens/today_body.dart';
import 'package:mockmob/features/today/widgets/move_hero.dart';
import 'package:mockmob/features/today/widgets/suggested_stack.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'support/today_fixtures.dart';

final DateTime _sunday = DateTime.utc(2026, 10, 18, 14, 10);

const TodayWeek _week = TodayWeek(
  studied: [true, false, false, true, false, true, false],
  todayIndex: 6,
  label: '3 of 4 study days',
  goal: 4,
  planned: {0, 3, 5, 6},
  dates: [12, 13, 14, 15, 16, 17, 18],
);

final _overrides = [
  authSnapshotProvider.overrideWithBuild((ref, notifier) => const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u', name: 'Asha Verma')),
];

Future<void> _pump(WidgetTester tester, {required bool animate, Size size = const Size(412, 2400)}) async {
  await pumpMockmob(
    tester,
    TodayBody(
      view: buildToday(ashaInputs(now: _sunday, attempts: ashaRecord(_sunday), week: _week, reviseDue: 6)),
      skeletonDelay: Duration.zero,
      callbacks: TodayCallbacks(onAction: (_) {}, onTarget: (_) {}),
    ),
    size: size,
    disableAnimations: !animate,
    overrides: _overrides,
  );
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(loadAppFonts);
  setUp(() {
    debugResetTodayPicks();
    DeckCoach.debugReset();
    DeckMemoryStore.debugReset();
    SuggestedStack.debugReset();
    DeckCoach.store = MemoryPrefsStore();
    DeckMemoryStore.store = MemoryPrefsStore();
    DeckMemoryStore.clock = () => _sunday;
    DeckCoach.debugRun = DeckCoachRun.taught();
  });
  tearDown(() {
    DeckCoach.debugReset();
    DeckMemoryStore.debugReset();
    SuggestedStack.debugReset();
    DeckCoach.store = null;
    DeckMemoryStore.store = null;
  });

  testWidgets('G13 frames: one move, settled inside the approved 350 to 450 ms, lift 1.03, no overshoot, the lead still by 500 ms', (tester) async {
    await _pump(tester, animate: true);
    final frames = <({double progress, double scale, double opacity, Offset at})>[];
    final times = <int>[];
    var now = 0;
    SuggestedStack.debugFlightFrame = (f) {
      frames.add(f);
      times.add(now);
    };
    await tester.tap(find.byKey(SuggestedStack.upNextKey));
    final lead = <(int, double)>[];
    for (var k = 0; k < 100; k++) {
      await tester.pump(const Duration(milliseconds: 8));
      now += 8;
      final t = find.ancestor(of: find.byType(MoveHeroCard), matching: find.byType(Transform)).evaluate();
      final scales = [for (final e in t) if ((e.widget as Transform).transform.entry(0, 0) != 1) (e.widget as Transform).transform.entry(0, 0)];
      lead.add((now, scales.isEmpty ? 1.0 : scales.first));
    }
    await tester.pumpAndSettle();
    int firstAt(bool Function(int i) test) {
      for (var i = 0; i < frames.length; i++) {
        if (test(i)) return times[i];
      }
      return -1;
    }

    final within2 = firstAt((i) => (frames[i].progress - 1).abs() <= 0.02);
    final faded = firstAt((i) => frames[i].opacity <= 0.01);
    expect(within2, inInclusiveRange(350, 450), reason: 'card within 2% of the lead at $within2 ms');
    expect(faded, inInclusiveRange(300, 450), reason: 'card faded into the lead at $faded ms');
    // One peak: the card's top edge only ever rises, and the progress never passes 1.
    for (var i = 1; i < frames.length; i++) {
      expect(frames[i].at.dy, lessThanOrEqualTo(frames[i - 1].at.dy + 0.01), reason: 'a second bounce at ${times[i]} ms');
    }
    expect(frames.map((f) => f.progress).reduce((a, b) => a > b ? a : b), lessThanOrEqualTo(1.0 + 1e-6));
    expect(frames.map((f) => f.scale).reduce((a, b) => a > b ? a : b), lessThanOrEqualTo(1.03 + 1e-6));
    // The lead card's settle: it starts as the card lands and is still (within 0.001) by 500 ms.
    final dipStart = lead.firstWhere((l) => l.$2 != 1.0).$1;
    expect(dipStart, inInclusiveRange(150, 300), reason: 'the lead starts to settle at $dipStart ms, as the card lands');
    final still = lead.lastWhere((l) => (l.$2 - 1).abs() > 0.001).$1;
    expect(still, lessThanOrEqualTo(500), reason: 'the lead card was still moving at $still ms');
    expect(tester.takeException(), isNull);
  });
}
