// The moments K1 to K4 (spec 5.3, 5.6 M8 to M11, 7.2): the K2 count rolls to the TRUE total and never
// stops at the target (F8), the bar is full, the seal is a square paper seal (not a coin), K3 plays only
// for a stitch the server sent after quest.done (F13), the reveal has no ray or sunburst painter (F6),
// Skip and a tap land the end state in 200 ms, reduced motion shows the end state at once, and the
// overlay never marks a moment seen (the den does, from momentsShownProvider).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/social/v3/copy_v3.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_den.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_models.dart';
import 'package:mockmob/features/social/v3/screens/moment_overlay.dart';
import 'package:mockmob/features/social/v3/widgets/moment_kit.dart';
import 'package:mockmob/features/social/v3/widgets/moment_milestone.dart';
import 'package:mockmob/features/social/v3/widgets/moment_quest_done.dart';
import 'package:mockmob/features/social/v3/widgets/moment_reveal.dart';
import 'package:mockmob/features/social/v3/widgets/moment_stitched.dart';
import 'package:mockmob/features/social/v3/widgets/parcel.dart';

import '../../../unit/social/v3/mob_v3_test_kit.dart';
import '../../../unit/social/v3/moment_test_kit.dart';

int? _count(WidgetTester tester) {
  final f = find.byKey(const ValueKey('k2-count'));
  if (f.evaluate().isEmpty) return null;
  final t = tester.widget<Text>(f);
  final plain = t.textSpan!.toPlainText();
  return int.parse(plain.split(' ').first);
}

Iterable<CustomPainter> _painters(WidgetTester tester) => [
      for (final w in tester.widgetList<CustomPaint>(find.byType(CustomPaint))) ...[?w.painter, ?w.foregroundPainter],
    ];

ProviderContainer _container(WidgetTester tester) => ProviderScope.containerOf(tester.element(find.byType(MomentHost)));

void main() {
  group('K2 quest done (F8)', () {
    testWidgets('the count rolls to the true total, never above it and never stopping at the target', (tester) async {
      final server = v3Server(scenario: 'questdone');
      final which = await pumpMomentHost(tester, server: server);
      await startMoment(tester, which, questKey(server));
      final seen = <int>[];
      seen.add(_count(tester)!);
      await pumpTo(tester, 1900, each: (ms) {
        final c = _count(tester)!;
        expect(c, lessThanOrEqualTo(70), reason: 'at $ms ms');
        if (seen.isNotEmpty) expect(c, greaterThanOrEqualTo(seen.last), reason: 'the count only rolls up ($ms ms)');
        if (ms >= 600) expect(c, 70, reason: 'the true total from 600 ms ($ms ms)');
        seen.add(c);
      });
      expect(seen.first, 50, reason: 'rolls from ten below the target when the last seen value is unknown');
      expect(seen.where((c) => c == 60).length, lessThan(4), reason: 'it passes 60 and does not stop there');
      expect(find.text('70 answered. The quest needed 60.', findRichText: true), findsOneWidget);
      expect(find.text(MobV3Copy.questDoneLine('Chai Circle', 70, 60, 4)), findsOneWidget);
      expect(find.text(MobV3Copy.openParcel), findsOneWidget);
    });

    testWidgets('the bar is full from the target on, and folds away for the seal', (tester) async {
      final server = v3Server(scenario: 'questdone');
      final which = await pumpMomentHost(tester, server: server);
      await startMoment(tester, which, questKey(server));
      await pumpTo(tester, 640);
      final bar = tester.widget<CustomPaint>(find.byKey(const ValueKey('k2-bar'))).painter! as QuestBarPainter;
      expect(bar.fill, 1.0);
      await pumpTo(tester, 1400, from: 640);
      expect(find.byKey(const ValueKey('k2-bar')), findsNothing);
      expect(_painters(tester).whereType<PaperSealPainter>(), isNotEmpty);
    });

    test('the seal is a square paper seal, not a disc', () {
      const s = Size(100, 100);
      final p = PaperSealPainter.outline(s);
      // A corner of the square is inside; a disc of the same size would leave it out.
      expect(p.contains(const Offset(8, 8)), isTrue);
      expect(p.contains(const Offset(92, 92)), isTrue);
      expect(p.contains(const Offset(50, 50)), isTrue);
      expect((const Offset(8, 8) - const Offset(50, 50)).distance, greaterThan(50));
      final b = p.getBounds();
      expect((b.width - b.height).abs(), lessThan(0.5));
    });

    test('the roll starts at the last seen value, never above the true total', () {
      const q = Quest(target: 60, answered: 70, done: true);
      expect(QuestDoneMoment.rollFrom(q, null), 50);
      expect(QuestDoneMoment.rollFrom(q, 64), 64);
      expect(QuestDoneMoment.rollFrom(q, 90), 70);
      expect(QuestDoneMomentState.countAt(q, null, 0), 50);
      expect(QuestDoneMomentState.countAt(q, null, 600), 70);
      expect(QuestDoneMomentState.countAt(q, null, 1900), 70);
    });

    testWidgets('Open the parcel plays the reveal of Hop in place; nothing is marked seen', (tester) async {
      final server = v3Server(scenario: 'questdone');
      final which = await pumpMomentHost(tester, server: server);
      await startMoment(tester, which, questKey(server));
      await pumpTo(tester, 2000);
      await tester.tap(find.text(MobV3Copy.openParcel));
      await tester.pump();
      await pumpTo(tester, 400);
      expect(find.byType(RevealMoment), findsOneWidget);
      expect(_container(tester).read(momentsShownProvider), [questKey(server)]);
      expect(dueMoments(server), contains(questKey(server)), reason: 'the overlay never calls seen');
    });
  });

  group('K3 week stitched (F13)', () {
    testWidgets('plays for a stitch key after quest.done, with the desk bell card', (tester) async {
      final server = v3Server(scenario: 'questdone');
      final which = await pumpMomentHost(tester, server: server);
      await startMoment(tester, which, stitchKey(server));
      await pumpTo(tester, 600);
      final pen = _painters(tester).whereType<PennantPainter>().single;
      expect(pen.weeks, 4);
      expect(pen.sew, inExclusiveRange(0, 1), reason: 'the needle is sewing at 600 ms');
      await pumpTo(tester, 2000, from: 600);
      expect(find.text('4 weeks in a row'), findsOneWidget);
      expect(find.text(MobV3Copy.stitchedLine('Chai Circle', 4, 4)), findsOneWidget);
      expect(find.text('A desk bell for your den'), findsOneWidget);
      expect(find.text(MobV3Copy.staysOnShelf), findsOneWidget);
      expect(find.text(MobV3Copy.backToDen), findsOneWidget);
    });

    testWidgets('never plays while the quest is not done', (tester) async {
      final server = v3Server(scenario: 'heavy');
      final which = await pumpMomentHost(tester, server: server);
      await startMoment(tester, which, stitchKey(server));
      await pumpTo(tester, 800);
      expect(find.byType(StitchedMoment), findsNothing);
      expect(_painters(tester).whereType<PennantPainter>(), isEmpty);
    });

    testWidgets('never plays for another week, or for a quest key', (tester) async {
      final server = v3Server(scenario: 'questdone');
      final which = await pumpMomentHost(tester, server: server);
      await startMoment(tester, which, 'stitch:mob-chai-0001:2026-10-05');
      await pumpTo(tester, 800);
      expect(find.byType(StitchedMoment), findsNothing);
      which.value = null;
      await tester.pump();
      await startMoment(tester, which, questKey(server));
      await pumpTo(tester, 800);
      expect(_painters(tester).whereType<PennantPainter>(), isEmpty);
    });
  });

  group('K4 reveal (F6)', () {
    testWidgets('no ray or sunburst painter in any frame; the light is the radial lamp and leak', (tester) async {
      final server = v3Server(scenario: 'questdone');
      final which = await pumpMomentHost(tester, server: server);
      await startMoment(tester, which, 'reveal:hop');
      final types = <Type>{};
      await pumpTo(tester, 2000, each: (_) => types.addAll(_painters(tester).map((p) => p.runtimeType)));
      expect(types.where((t) => RegExp('ray|sun|burst|beam|cone', caseSensitive: false).hasMatch('$t')), isEmpty, reason: '$types');
      expect(types, containsAll(<Type>[LampFieldPainter, ParcelBackPainter, ParcelFrontPainter]));
      expect(find.text(MobV3Copy.newOnShelf), findsOneWidget);
      expect(find.text('Hop'), findsOneWidget);
      expect(find.text(MobV3Copy.foldLine(FoldKey.hop)), findsOneWidget);
      expect(find.text(MobV3Copy.revealFact('Chai Circle', FoldKey.hop)), findsOneWidget);
      expect(find.text('Play as Hop'), findsOneWidget);
      expect(find.text(MobV3Copy.seeShelf), findsOneWidget);
    });

    testWidgets('the parcel opens on the spec beats', (tester) async {
      expect(RevealMomentState.poseAt(300).anyOpen, isFalse);
      expect(RevealMomentState.poseAt(300).sealPop, 0);
      expect(RevealMomentState.poseAt(640).sealPop, 0);
      expect(RevealMomentState.poseAt(840).sealPop, 1);
      expect(RevealMomentState.poseAt(760).flaps.first, 0);
      expect(RevealMomentState.poseAt(1400).flaps, everyElement(1.0));
      // The warm leak: 0 at 560, up to 90% by 760, back to 50%.
      expect(RevealMomentState.poseAt(560).leak, 0);
      expect(RevealMomentState.poseAt(760).leak, closeTo(0.9, 0.01));
      expect(RevealMomentState.poseAt(1400).leak, closeTo(0.5, 0.01));
    });

    testWidgets('Skip lands the end state within 200 ms', (tester) async {
      final server = v3Server(scenario: 'questdone');
      final which = await pumpMomentHost(tester, server: server);
      await startMoment(tester, which, 'reveal:hop');
      await pumpTo(tester, 300);
      final state = tester.state<RevealMomentState>(find.byType(RevealMoment));
      expect(find.text(MobV3Copy.skipShow), findsOneWidget);
      await tester.tap(find.text(MobV3Copy.skipShow));
      await pumpTo(tester, 100);
      expect(state.landed, isFalse);
      await pumpTo(tester, 200, from: 100);
      expect(state.landed, isTrue);
      expect(state.ms, 2000);
    });

    testWidgets('a tap anywhere lands the end state within 200 ms', (tester) async {
      final server = v3Server(scenario: 'questdone');
      final which = await pumpMomentHost(tester, server: server);
      await startMoment(tester, which, 'reveal:hop');
      await pumpTo(tester, 700);
      await tester.tapAt(const Offset(180, 400));
      await pumpTo(tester, 200);
      expect(tester.state<RevealMomentState>(find.byType(RevealMoment)).landed, isTrue);
    });

    testWidgets('closing records the key for the den and never calls seen', (tester) async {
      final server = v3Server(scenario: 'questdone');
      final which = await pumpMomentHost(tester, server: server);
      await startMoment(tester, which, 'reveal:hop');
      await pumpTo(tester, 500);
      await tester.tap(find.byWidgetPredicate((w) => w is Semantics && w.properties.label == MobV3Copy.close));
      await tester.pump();
      expect(_container(tester).read(momentsShownProvider), ['reveal:hop']);
      expect(dueMoments(server), contains('reveal:hop'));
    });
  });

  group('K1 milestone', () {
    testWidgets('14 days, the line, no chip when the milestone gives nothing, Mobi once', (tester) async {
      final server = v3Server();
      final which = await pumpMomentHost(tester, server: server, chain: chainAt(14));
      await startMoment(tester, which, 'chain:14');
      await pumpTo(tester, 2000);
      expect(find.text('14'), findsOneWidget);
      expect(find.text('days in a row'), findsOneWidget);
      expect(find.text('You practised 13 of them and rested 1. It is your best run so far.'), findsOneWidget);
      expect(find.text(MobV3Copy.aRestPass), findsNothing);
      expect(find.byKey(const ValueKey('k1-mobi')), findsOneWidget);
      expect(find.text(MobV3Copy.backToDen), findsOneWidget);
      final arc = _painters(tester).whereType<TickArcPainter>().single;
      expect(arc.rested.length, 14);
      expect(arc.rested.where((r) => r).length, 1, reason: 'the rested day is a moon link, not a gap');
      expect(arc.rested.last, isFalse, reason: 'today is the volt tick');
    });

    testWidgets('a milestone with a rest pass shows the chip', (tester) async {
      final server = v3Server();
      final which = await pumpMomentHost(tester, server: server, chain: chainAt(7, reward: 'rest_pass'));
      await startMoment(tester, which, 'chain:7');
      await pumpTo(tester, 2000);
      expect(find.text(MobV3Copy.aRestPass), findsOneWidget);
    });
  });

  group('reduced motion', () {
    testWidgets('K2 shows the end state with one 120 ms fade', (tester) async {
      final server = v3Server(scenario: 'questdone');
      final which = await pumpMomentHost(tester, server: server, reduced: true);
      await startMoment(tester, which, questKey(server));
      final state = tester.state<QuestDoneMomentState>(find.byType(QuestDoneMoment));
      expect(state.reducedPath, isTrue);
      expect(state.landed, isTrue);
      expect(_count(tester), 70);
      expect(find.text('70 answered. The quest needed 60.', findRichText: true), findsOneWidget);
      expect(find.text(MobV3Copy.skipShow), findsOneWidget, reason: 'the pill is in the tree');
      await tester.pump(const Duration(milliseconds: 120));
      expect(find.byType(FadeTransition), findsWidgets);
    });

    testWidgets('K4 and K1 land at once', (tester) async {
      final server = v3Server(scenario: 'questdone');
      final which = await pumpMomentHost(tester, server: server, reduced: true, chain: chainAt(14));
      await startMoment(tester, which, 'reveal:hop');
      expect(tester.state<RevealMomentState>(find.byType(RevealMoment)).landed, isTrue);
      expect(find.text('Play as Hop'), findsOneWidget);
      which.value = null;
      await tester.pump();
      await startMoment(tester, which, 'chain:14');
      expect(find.byType(MilestoneMoment), findsOneWidget);
      expect(find.text('14'), findsOneWidget);
    });
  });

  test('the parcel prize comes from what the server sent', () {
    final s = v3Server(scenario: 'questdone');
    final v3 = MobV3.fromJson(s.denNow()['v3'] as Map<String, dynamic>);
    final prize = questPrizeOf(v3);
    expect(prize.kind, ParcelKind.fold);
    expect(prize.fold, FoldKey.hop);
    expect(weekItemOf(v3), 'desk_bell');
    final week = fixtureWeek(s);
    expect(stitchAllowed(DenView(mob: null, v3: v3), MomentKey.parse('stitch:mob-chai-0001:$week')), isTrue);
    expect(stitchAllowed(DenView(mob: null, v3: v3), MomentKey.parse('stitch:mob-chai-0001:2026-10-05')), isFalse);
    final heavy = MobV3.fromJson(v3Server().denNow()['v3'] as Map<String, dynamic>);
    expect(stitchAllowed(DenView(mob: null, v3: heavy), MomentKey.parse('stitch:mob-chai-0001:$week')), isFalse);
  });
}
