// R7 the podium and its reveal (spec 5.3 R7, 5.6 M7, 7.2 podium_stage_test): the order of marks is
// true at every 16 ms frame (F10), the floor members appear with the collective line and never alone
// (F11), Skip lands the end state within 200 ms, reduced motion runs about 1 s, ties share a place
// and a height, the switch off shows no numerals, only you, and private marks.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_fake_server.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_models.dart';
import 'package:mockmob/features/social/v3/screens/podium_screen.dart';
import 'package:mockmob/features/social/v3/widgets/podium_stage.dart';

import '../../../helpers/golden_harness.dart';
import '../../../unit/social/v3/mob_v3_test_kit.dart';
import 'results_kit.dart';

double _opacityOf(WidgetTester tester, Finder f) {
  var o = 1.0;
  for (final e in find.ancestor(of: f, matching: find.byType(Opacity)).evaluate()) {
    o *= (e.widget as Opacity).opacity;
  }
  return o;
}

void main() {
  late MobV3FakeServer server;
  late Podium open;
  late Podium closed;

  setUpAll(() async {
    loadFoldManifestForTest();
    FoilSheenProgram.enabled = false;
    server = await openServer();
    open = await server.podium(riyaGame);
    closed = await server.podium(zoyaGame);
  });

  Widget stage(Podium p, {bool autoplay = true}) => PodiumStage(podium: p, gameTitle: "Riya's sprint", now: v3Now, autoplay: autoplay);

  Future<void> pumpLive(WidgetTester tester, Podium p, {bool reduced = false}) async {
    final go = ValueNotifier<bool>(false);
    await pumpMockmob(
      tester,
      SwapHost(go: go, warm: const SizedBox.shrink(), live: stage(p)),
      brightness: Brightness.dark,
      size: const Size(360, 780),
      disableAnimations: reduced,
      overrides: v3Overrides(server),
    );
    go.value = true;
    await tester.pump();
  }

  group('the plan', () {
    test('the open fixture: Riya first, You and Kabir share second, Zoya on the floor', () {
      final plan = PodiumPlan.of(open);
      expect(plan.layout, PodiumLayout.stage);
      expect([for (final c in plan.columns) c.memberId], [youId, riyaId, kabirId]);
      expect([for (final f in plan.floor) f.memberId], [zoyaId]);
      // Second rolls from the highest floor mark (13), first from second's marks (19).
      expect(plan.rollFrom[youId], 13);
      expect(plan.rollFrom[kabirId], 13);
      expect(plan.rollFrom[riyaId], 19);
      expect(open.tie?.names, ['You', 'Kabir']);
    });

    test('the closed fixture: first, second, third and the floor', () {
      final plan = PodiumPlan.of(closed);
      expect([for (final c in plan.columns) c.place], [2, 1, 3]);
      expect(plan.floor.single.memberId, kabirId);
      final third = plan.columns.firstWhere((c) => c.place == 3);
      expect(plan.rollFrom[third.memberId], 13);
    });

    test('switch off and only you sit at the table', () {
      expect(PodiumPlan.of(onlyYouPodium()).layout, PodiumLayout.table);
      expect(PodiumPlan.of(onlyYouPodium()).onlyYou, isTrue);
      final off = Podium(showPodium: false, places: [for (final p in open.places) PodiumPlace(memberId: p.memberId, name: p.name, fold: p.fold, marks: p.marks, you: p.you)]);
      expect(PodiumPlan.of(off).layout, PodiumLayout.table);
    });
  });

  testWidgets('F10: the order of marks is true at every 16 ms frame across the 4800 ms reveal', (tester) async {
    await pumpLive(tester, open);
    var frames = 0;
    for (var t = 0; t <= 4900; t += 16) {
      final first = marksShown(tester, riyaId)!;
      final you = marksShown(tester, youId)!;
      final kabir = marksShown(tester, kabirId)!;
      final zoya = marksShown(tester, zoyaId)!;
      expect(first, greaterThanOrEqualTo(you), reason: 'at $t ms first $first, second $you');
      expect(you, kabir, reason: 'a shared place rolls together at $t ms');
      expect(you, greaterThanOrEqualTo(zoya), reason: 'at $t ms second $you, floor $zoya');
      // The visible order too: a place never shows marks while the place above it shows fewer.
      frames++;
      await tester.pump(const Duration(milliseconds: 16));
    }
    expect(frames, greaterThan(300));
    expect(marksShown(tester, riyaId), 20);
    expect(marksShown(tester, youId), 19);
    expect(marksShown(tester, zoyaId), 13);
    expect(stageState(tester).elapsedMs, PodiumTimeline.total);
  });

  testWidgets('F10 on the closed podium: first >= second >= third >= floor in every frame', (tester) async {
    await pumpLive(tester, closed);
    final plan = PodiumPlan.of(closed);
    String idOf(int place) => plan.columns.firstWhere((c) => c.place == place).memberId;
    for (var t = 0; t <= 4900; t += 16) {
      final a = marksShown(tester, idOf(1))!, b = marksShown(tester, idOf(2))!, c = marksShown(tester, idOf(3))!, f = marksShown(tester, kabirId)!;
      expect(a >= b && b >= c && c >= f, isTrue, reason: 'at $t ms: $a, $b, $c, $f');
      await tester.pump(const Duration(milliseconds: 16));
    }
  });

  testWidgets('F11: the floor member appears together with the collective line, never alone', (tester) async {
    await pumpLive(tester, open);
    for (var t = 0; t <= 1000; t += 16) {
      final floor = _opacityOf(tester, find.byKey(const ValueKey('podium-fold-$zoyaId')));
      final line = _opacityOf(tester, find.byKey(const ValueKey('podium-collective')));
      if (floor > 0.01) expect(line, greaterThan(0.01), reason: 'at $t ms the floor shows without the collective line');
      if (t < 400) expect(floor, 0, reason: 'nothing on the floor before 400 ms');
      // No plinth Fold is shown before its own turn (no ghost before 1400 ms).
      if (t < 1400) expect(_opacityOf(tester, find.byKey(const ValueKey('podium-fold-$riyaId'))), 0);
      await tester.pump(const Duration(milliseconds: 16));
    }
    expect(_opacityOf(tester, find.byKey(const ValueKey('podium-fold-$zoyaId'))), greaterThan(0.9));
    expect(find.text('Your Mob got 15 of 20 right together.'), findsOneWidget);
    await tester.pump(const Duration(seconds: 5));
  });

  testWidgets('a Fold is never see-through mid-drop', (tester) async {
    await pumpLive(tester, open);
    for (var t = 0; t <= 3000; t += 16) {
      for (final id in [youId, riyaId, kabirId]) {
        final o = _opacityOf(tester, find.byKey(ValueKey('podium-fold-$id')));
        expect(o == 0 || o == 1, isTrue, reason: '$id at $t ms has opacity $o');
      }
      await tester.pump(const Duration(milliseconds: 16));
    }
    await tester.pump(const Duration(seconds: 3));
  });

  testWidgets('the Skip pill lands the end state within 200 ms', (tester) async {
    await pumpLive(tester, open);
    await tester.pump(const Duration(milliseconds: 1200));
    expect(find.byKey(const ValueKey('podium-skip')), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('podium-skip')));
    for (var i = 0; i < 12; i++) {
      await tester.pump(const Duration(milliseconds: 16));
    }
    await tester.pump(const Duration(milliseconds: 8));
    expect(stageState(tester).elapsedMs, PodiumTimeline.total);
    expect(marksShown(tester, riyaId), 20);
    expect(marksShown(tester, youId), 19);
    expect(find.text('Riya is on top so far'), findsOneWidget);
    await tester.pump(const Duration(milliseconds: 300));
  });

  testWidgets('any tap on the stage lands the end state within 200 ms', (tester) async {
    await pumpLive(tester, open);
    await tester.pump(const Duration(milliseconds: 600));
    await tester.tapAt(const Offset(180, 400));
    for (var i = 0; i < 12; i++) {
      await tester.pump(const Duration(milliseconds: 16));
    }
    await tester.pump(const Duration(milliseconds: 8));
    expect(stageState(tester).elapsedMs, PodiumTimeline.total);
    await tester.pump(const Duration(milliseconds: 300));
  });

  testWidgets('H6: the headline is up at 120 ms (+360), the tie line waits for 3700 ms', (tester) async {
    await pumpLive(tester, open);
    await tester.pump(const Duration(milliseconds: 100));
    expect(_opacityOf(tester, find.byKey(const ValueKey('podium-headline'))), 0);
    await tester.pump(const Duration(milliseconds: 420));
    expect(_opacityOf(tester, find.byKey(const ValueKey('podium-headline'))), greaterThan(0.95));
    if (find.byKey(const ValueKey('podium-tie')).evaluate().isNotEmpty) {
      expect(_opacityOf(tester, find.byKey(const ValueKey('podium-tie'))), 0);
    }
    await tester.pump(const Duration(milliseconds: 3700 - 520 + 400));
    if (find.byKey(const ValueKey('podium-tie')).evaluate().isNotEmpty) {
      expect(_opacityOf(tester, find.byKey(const ValueKey('podium-tie'))), greaterThan(0.95));
    }
    await tester.pump(const Duration(seconds: 2));
  });

  testWidgets('H6: every Fold stands inside the screen, the floor Fold included', (tester) async {
    await pumpLive(tester, open);
    await tester.pump(const Duration(seconds: 5));
    for (final e in find.byWidgetPredicate((w) => w.key is ValueKey<String> && (w.key! as ValueKey<String>).value.startsWith('podium-fold-')).evaluate()) {
      final r = tester.getRect(find.byWidget(e.widget));
      expect(r.left, greaterThanOrEqualTo(0), reason: '${e.widget.key} left');
      expect(r.right, lessThanOrEqualTo(360), reason: '${e.widget.key} right');
    }
  });

  test('PodiumFit draws a wide Fold smaller and leaves a narrow one alone', () {
    expect(PodiumFit.size(null, null, 66, 66), 66); // fallback width 0.8 x size fits
    expect(PodiumFit.size(null, null, 100, 40), closeTo(50, 0.01));
  });

  testWidgets('the reveal stays inside the T4 ceiling', (tester) async {
    expect(PodiumTimeline.total, lessThanOrEqualTo(6000));
    expect(PodiumTimeline.tableTotal, lessThanOrEqualTo(6000));
  });

  testWidgets('reduced motion: three fades 300 ms apart, about 1 s, order kept', (tester) async {
    await pumpLive(tester, closed, reduced: true);
    final plan = PodiumPlan.of(closed);
    String idOf(int place) => plan.columns.firstWhere((c) => c.place == place).memberId;
    double fold(int place) => _opacityOf(tester, find.byKey(ValueKey('podium-fold-${idOf(place)}')));
    await tester.pump(const Duration(milliseconds: 420));
    expect(fold(3), closeTo(1, 1e-6));
    expect(fold(2), 0);
    expect(fold(1), 0);
    await tester.pump(const Duration(milliseconds: 300));
    expect(fold(2), closeTo(1, 1e-6));
    expect(fold(1), 0);
    await tester.pump(const Duration(milliseconds: 300));
    expect(fold(1), closeTo(1, 1e-6));
    // Marks never roll in reduced motion; they are the final numbers when they appear.
    expect(marksShown(tester, idOf(1)), closed.first!.marks);
    await tester.pump(const Duration(milliseconds: 20));
    final s = stageState(tester);
    expect(s.elapsedMs, PodiumTimeline.reducedTotal);
    expect(PodiumTimeline.reducedTotal, inInclusiveRange(900, 1200));
    expect(find.byKey(const ValueKey('podium-skip')).hitTestable(), findsNothing);
  });

  testWidgets('a tie shares one place: two numerals "2" on plinths of the same height', (tester) async {
    await pumpMockmob(tester, stage(open, autoplay: false), brightness: Brightness.dark, overrides: v3Overrides(server));
    expect(find.byKey(const ValueKey('podium-numeral-$youId')), findsOneWidget);
    final a = tester.widget<Text>(find.byKey(const ValueKey('podium-numeral-$youId')));
    final b = tester.widget<Text>(find.byKey(const ValueKey('podium-numeral-$kabirId')));
    expect(a.data, '2');
    expect(b.data, '2');
    final ha = tester.getSize(find.ancestor(of: find.byKey(const ValueKey('podium-numeral-$youId')), matching: find.byType(SizedBox)).first).height;
    final hb = tester.getSize(find.ancestor(of: find.byKey(const ValueKey('podium-numeral-$kabirId')), matching: find.byType(SizedBox)).first).height;
    expect(ha, hb);
    expect(find.text('You and Kabir tie on 19, so you share second.'), findsOneWidget);
    expect(find.text('Places can change until 2:05 PM tomorrow.'), findsOneWidget);
    expect(find.text('So far'), findsOneWidget);
    // The floor holds Zoya with no numeral.
    expect(find.byKey(const ValueKey('podium-numeral-$zoyaId')), findsNothing);
  });

  testWidgets('closed: "Riya came first" and "Final"', (tester) async {
    await pumpMockmob(tester, stage(closed, autoplay: false), brightness: Brightness.light, overrides: v3Overrides(server));
    expect(find.text('Riya came first'), findsOneWidget);
    expect(find.text('Final'), findsOneWidget);
    expect(find.textContaining('Places can change'), findsNothing);
  });

  testWidgets('switch off: "Everyone\'s marks", no places, no numerals', (tester) async {
    final off = Podium(
      soFar: true,
      showPodium: false,
      right: open.right,
      of: open.of,
      places: [for (final p in open.places) PodiumPlace(memberId: p.memberId, name: p.name, fold: p.fold, colour: p.colour, marks: p.marks, you: p.you)],
    );
    await pumpMockmob(tester, stage(off, autoplay: false), brightness: Brightness.dark, overrides: v3Overrides(server));
    expect(find.text("Everyone's marks"), findsOneWidget);
    expect(find.byWidgetPredicate((w) => w.key is ValueKey && '${(w.key as ValueKey).value}'.startsWith('podium-numeral')), findsNothing);
    expect(find.textContaining('tie on'), findsNothing);
    expect(find.textContaining('on top'), findsNothing);
    expect(marksShown(tester, zoyaId), 13);
  });

  testWidgets('only you: the first-to-finish lines and your Fold at the table', (tester) async {
    await pumpMockmob(tester, stage(onlyYouPodium(), autoplay: false), brightness: Brightness.dark, overrides: v3Overrides(server));
    expect(find.text("You're the first to finish."), findsOneWidget);
    expect(find.text('Places fill in as friends play.'), findsOneWidget);
    expect(find.byKey(const ValueKey('podium-fold-$youId')), findsOneWidget);
    expect(find.byWidgetPredicate((w) => w.key is ValueKey && '${(w.key as ValueKey).value}'.startsWith('podium-numeral')), findsNothing);
  });

  testWidgets('only you played: the line and the key are yours, not the Mob (walk M9)', (tester) async {
    await pumpLive(tester, onlyYouPodium());
    await tester.pump(const Duration(seconds: 5));
    expect(find.text('You got 4 of 5 right.'), findsOneWidget);
    expect(find.textContaining('together'), findsNothing);
    expect(find.text('See your moment'), findsOneWidget);
  });

  testWidgets('private marks: the Fold stands with "Private" and no place', (tester) async {
    await pumpMockmob(tester, stage(privatePodium(), autoplay: false), brightness: Brightness.dark, overrides: v3Overrides(server));
    expect(find.text('Private'), findsOneWidget);
    expect(find.byKey(const ValueKey('podium-fold-$kabirId')), findsOneWidget);
    expect(find.byKey(const ValueKey('podium-numeral-$kabirId')), findsNothing);
    expect(marksShown(tester, kabirId), isNull);
  });

  testWidgets('the screen: PODIUM_NOT_YET says finish first and offers Back', (tester) async {
    final fresh = v3Server();
    await pumpMockmob(tester, const PodiumScreen(gameId: riyaGame), brightness: Brightness.dark, wrapInScaffold: false, overrides: v3Overrides(fresh));
    await tester.pump();
    expect(find.text('Finish your run first, then you can see the podium.'), findsOneWidget);
    expect(find.text('Back'), findsOneWidget);
  });

  testWidgets('the screen loads the podium and the game title', (tester) async {
    await pumpMockmob(tester, const PodiumScreen(gameId: riyaGame), brightness: Brightness.dark, wrapInScaffold: false, overrides: v3Overrides(server));
    await tester.pump(const Duration(seconds: 6));
    expect(find.text("Riya's sprint"), findsOneWidget);
    expect(find.text('Riya is on top so far'), findsOneWidget);
    expect(find.text("See everyone's moment"), findsOneWidget);
  });
}
