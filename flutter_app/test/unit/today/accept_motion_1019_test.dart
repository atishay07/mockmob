// 19 Oct (G13, rule R5): the "Do this next" accept animation as one continuous move. The accepted
// card lifts to 1.03 with a deeper shadow, travels to the lead card on one spring that never
// overshoots by more than 4% and settles within 350 to 450 ms, the lead card's words wait for it
// and the lead card settles under it. Reduced motion: a crossfade, no flight.
import 'package:flutter/material.dart';
import 'package:flutter/physics.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/today/copy_glance.dart';
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

String _heroTitle(WidgetTester tester) => tester.widget<MoveHeroCard>(find.byType(MoveHeroCard)).move.title!;

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

  test('the travel spring: one spring, no overshoot over 4%, within 2% of the lead between 350 and 450 ms (approved Springs.settle)', () {
    final sim = SpringSimulation(deckFlightSpring, 0, 1, 0);
    var peak = 0.0;
    double? settledAt;
    for (var ms = 0; ms <= 1000; ms++) {
      final x = sim.x(ms / 1000);
      if (x > peak) peak = x;
      if (settledAt == null && (x - 1).abs() <= 0.02) settledAt = ms.toDouble();
    }
    expect(peak, lessThanOrEqualTo(1.04), reason: 'overshoot ${(peak - 1) * 100}%');
    expect(settledAt, inInclusiveRange(350, 450));
  });

  testWidgets('with motion on, the accepted card is one continuous move: it lifts to 1.03, travels on one spring, fades into the lead, and the lead settles', (tester) async {
    await _pump(tester, animate: true);
    final frames = <({double progress, double scale, double opacity, Offset at})>[];
    SuggestedStack.debugFlightFrame = frames.add;
    final before = _heroTitle(tester);
    await tester.tap(find.byKey(SuggestedStack.upNextKey));
    // 60 frames a second for 0.8 s, sampling the lead card's scale as it goes.
    final leadScales = <double>[];
    for (var k = 0; k < 48; k++) {
      await tester.pump(const Duration(milliseconds: 16));
      final t = find.ancestor(of: find.byType(MoveHeroCard), matching: find.byType(Transform)).evaluate();
      final scales = [
        for (final e in t)
          // The x scale (a Transform.scale keeps z at 1).
          if ((e.widget as Transform).transform.entry(0, 0) != 1) (e.widget as Transform).transform.entry(0, 0),
      ];
      leadScales.add(scales.isEmpty ? 1 : scales.first);
    }
    await tester.pumpAndSettle();
    expect(_heroTitle(tester), isNot(before));
    expect(_heroTitle(tester), GlanceCopy.titleWeakest);
    expect(frames, isNotEmpty);
    // One move: progress only ever goes forward, with no jump bigger than a frame's worth of spring.
    for (var k = 1; k < frames.length; k++) {
      expect(frames[k].progress, greaterThanOrEqualTo(frames[k - 1].progress - 1e-9), reason: 'frame $k goes back');
      expect(frames[k].progress - frames[k - 1].progress, lessThan(0.2), reason: 'frame $k jumps');
    }
    expect(frames.map((f) => f.progress).reduce((a, b) => a > b ? a : b), lessThanOrEqualTo(1.04));
    // The lift: up to 1.03 on the way, and back to 1.0 by the landing.
    final peak = frames.map((f) => f.scale).reduce((a, b) => a > b ? a : b);
    expect(peak, closeTo(1.03, 0.002));
    expect(frames.last.scale, closeTo(1.0, 0.002));
    expect(frames.last.opacity, closeTo(0, 0.01), reason: 'it fades into the lead card');
    // The lead card gives a little as the card lands (about 0.985) and comes back to rest.
    final dip = leadScales.reduce((a, b) => a < b ? a : b);
    expect(dip, inInclusiveRange(0.98, 0.992), reason: 'the lead card settles under the card');
    expect(leadScales.last, closeTo(1.0, 0.001));
    expect(tester.takeException(), isNull);
  });

  testWidgets('with motion on, the lead card\'s new words wait for the card: nothing of them shows in the first 160 ms', (tester) async {
    await _pump(tester, animate: true);
    await tester.tap(find.byKey(SuggestedStack.upNextKey));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    final early = find.descendant(of: find.byType(MoveHeroCard), matching: find.text(GlanceCopy.titleWeakest));
    expect(early, findsOneWidget, reason: 'the new body is mounted');
    final opacities = [
      for (final e in find.ancestor(of: early, matching: find.byType(Opacity)).evaluate()) (e.widget as Opacity).opacity,
    ];
    expect(opacities.any((o) => o == 0), isTrue, reason: 'still hidden at 100 ms');
    await tester.pumpAndSettle();
  });

  testWidgets('M5: with the lead card scrolled out of view the page goes first on a short ease-out, then the card travels with the page still', (tester) async {
    await _pump(tester, animate: true, size: const Size(360, 640));
    final scroll = tester.state<ScrollableState>(find.byType(Scrollable).first);
    // The student has read down to the deck: the lead card is above the top of the screen.
    await tester.ensureVisible(find.byKey(SuggestedStack.upNextKey));
    await tester.pumpAndSettle();
    final start = scroll.position.pixels;
    expect(start, greaterThan(200), reason: 'the page is scrolled down to the deck');
    final lead = find.byType(MoveHeroCard);
    expect(lead.evaluate().isEmpty || tester.getRect(lead).bottom < 0, isTrue, reason: 'the lead card is off screen, so the page has to move');

    final flightScroll = <double>[];
    SuggestedStack.debugFlightFrame = (_) => flightScroll.add(scroll.position.pixels);
    await tester.tap(find.byKey(SuggestedStack.upNextKey));
    // A fake clock at 60 frames a second: the pixels at every frame, from the tap on.
    final pixels = <double>[scroll.position.pixels];
    final times = <int>[0];
    for (var ms = 16; ms <= 1200; ms += 16) {
      await tester.pump(const Duration(milliseconds: 16));
      pixels.add(scroll.position.pixels);
      times.add(ms);
    }
    await tester.pumpAndSettle();
    expect(_heroTitle(tester), GlanceCopy.titleWeakest, reason: 'the pick was made');
    expect(flightScroll, isNotEmpty, reason: 'the card travelled');
    // One ease-out: it only ever moves toward the lead, and it is done inside 300 ms.
    final flightEnd = times.length;
    final firstStill = pixels.indexWhere((p) => p == pixels[pixels.indexOf(pixels.reduce((a, b) => a < b ? a : b))]);
    for (var k = 1; k <= firstStill; k++) {
      expect(pixels[k], lessThanOrEqualTo(pixels[k - 1] + 1e-6), reason: 'frame $k scrolls the wrong way');
    }
    expect(flightEnd, greaterThan(firstStill));
    final doneAt = times[firstStill];
    expect(doneAt, lessThanOrEqualTo(300), reason: 'the page was still moving at $doneAt ms');
    expect(pixels.first - pixels[firstStill], greaterThan(100), reason: 'it did bring the lead back');
    // The card moves only when the page has stopped: every flight frame sees the same page.
    final landed = flightScroll.first;
    for (final p in flightScroll) {
      expect(p, closeTo(landed, 0.5), reason: 'the page moved during the flight');
    }
    expect(landed, closeTo(pixels[firstStill], 0.5));
    expect(tester.takeException(), isNull);
  });

  testWidgets('M5: with the lead card in view the page does not scroll at all while the card travels', (tester) async {
    await _pump(tester, animate: true, size: const Size(360, 1100));
    final scroll = tester.state<ScrollableState>(find.byType(Scrollable).first);
    final before = scroll.position.pixels;
    final seen = <double>[];
    SuggestedStack.debugFlightFrame = (_) => seen.add(scroll.position.pixels);
    await tester.tap(find.byKey(SuggestedStack.upNextKey));
    for (var ms = 0; ms < 1000; ms += 16) {
      await tester.pump(const Duration(milliseconds: 16));
      expect(scroll.position.pixels, closeTo(before, 0.5), reason: 'the page moved at $ms ms');
    }
    await tester.pumpAndSettle();
    expect(seen, isNotEmpty);
  });

  testWidgets('reduced motion: no flight, the lead crossfades and the deck swaps at once', (tester) async {
    await _pump(tester, animate: false);
    final frames = <Object>[];
    SuggestedStack.debugFlightFrame = frames.add;
    await tester.tap(find.byKey(SuggestedStack.upNextKey));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 60));
    // Mid-crossfade both bodies are on screen, the new one partly faded in.
    expect(find.descendant(of: find.byType(MoveHeroCard), matching: find.text(GlanceCopy.titleWeakest)), findsOneWidget);
    await tester.pumpAndSettle();
    expect(frames, isEmpty, reason: 'no flight under reduced motion');
    expect(_heroTitle(tester), GlanceCopy.titleWeakest);
    expect(tester.takeException(), isNull);
  });
}
