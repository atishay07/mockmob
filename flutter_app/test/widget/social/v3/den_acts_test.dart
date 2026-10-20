// The den's event acts on the stage (MOB-MINIMAL 4.2): a friend who joined since this phone last saw the den hops in
// once; a friend's new sticker makes the Mob cheer; nothing plays on a first open, under the results run, or beyond
// the reduced variant in reduced motion.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/social/data/mob_repository.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_fake_server.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_models.dart';
import 'package:mockmob/features/social/v3/logic/den_acts.dart';
import 'package:mockmob/features/social/v3/screens/den_screen.dart';
import 'package:mockmob/features/social/v3/screens/results_run.dart';
import 'package:mockmob/features/social/v3/widgets/den_stage.dart';
import 'package:mockmob/features/social/v3/widgets/fold_puppet.dart';
import 'package:mockmob/features/social/v3/widgets/sticker_row.dart';

import '../../../golden/social/v3/den_kit.dart';
import '../../../unit/social/v3/mob_v3_test_kit.dart';

const _aarav = 'AARAV0000001';
const _riya = 'RIYA00000002';
const _kabir = 'KABIR0000003';
const _zoya = 'ZOYA00000004';
const _meher = MobV3FakeServer.newcomerId;

/// A phone that last saw Chai Circle with [members] standing in it (and stickers up to [upTo]).
MemoryPrefsStore _phone(Set<String> members, {DateTime? upTo}) =>
    MemoryPrefsStore()..values[DenActBook.keyFor(MobV3FakeServer.chaiId)] = DenActMemory(members: members, reactionsUpTo: upTo).encode();

DenActMemory? _memoryOn(MemoryPrefsStore store) => DenActMemory.decode(store.values[DenActBook.keyFor(MobV3FakeServer.chaiId)] as String?);

Finder _player(String id) => find.byKey(ValueKey('den-act-$id'), skipOffstage: false);
Finder _waitSeat(String id) => find.byKey(ValueKey('den-waitseat-$id'), skipOffstage: false);

DenActPlayer _p(WidgetTester t, String id) => t.widget<DenActPlayer>(_player(id));
ActFrame _frame(WidgetTester t, String id) => t.widget<ActTransform>(find.descendant(of: _player(id), matching: find.byType(ActTransform), skipOffstage: false)).frame;
FoldPuppet _puppet(WidgetTester t, String id) => t.widget<FoldPuppet>(find.descendant(of: _player(id), matching: find.byType(FoldPuppet), skipOffstage: false));

/// Pumps 16 ms frames until an act is on [id] (or [limit] passes). Returns false when none started.
Future<bool> _untilAct(WidgetTester t, String id, {Duration limit = const Duration(seconds: 6)}) async {
  for (var waited = Duration.zero; waited < limit; waited += const Duration(milliseconds: 16)) {
    if (_player(id).evaluate().isNotEmpty && _p(t, id).actId != 0) return true;
    await t.pump(const Duration(milliseconds: 16));
  }
  return false;
}

/// Moves the act on [id] to [ms] of its clock.
Future<void> _at(WidgetTester t, String id, double ms, double length) async {
  final now = _p(t, id).clock!.value * length;
  if (ms > now) await t.pump(Duration(microseconds: ((ms - now) * 1000).round()));
}

Future<void> _closeRun(WidgetTester tester) async {
  for (var i = 0; i < 6 && find.byType(ResultsRun).evaluate().isNotEmpty; i++) {
    await tester.tap(find.byIcon(LucideIcons.x).last, warnIfMissed: false);
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pump(const Duration(milliseconds: 300));
  }
}

void main() {
  testWidgets('the first open of a Mob plays no act, and remembers everyone standing there', (tester) async {
    final store = MemoryPrefsStore();
    await pumpDen(tester, v3Server(scenario: 'played'), reduced: false, prefs: store);
    expect(await _untilAct(tester, _zoya, limit: const Duration(seconds: 5)), isFalse);
    for (final id in [_aarav, _riya, _kabir, _zoya]) {
      expect(_p(tester, id).actId, 0);
    }
    expect(_waitSeat(_zoya), findsNothing);
    expect(_memoryOn(store)!.members, {_aarav, _riya, _kabir, _zoya});
  });

  testWidgets('a friend who joined since the last look hops in once: two hops from the edge, the seat folds away, the name engraves, the others glance', (tester) async {
    final semantics = tester.ensureSemantics();
    final store = _phone({_aarav, _riya, _kabir});
    await pumpDen(tester, v3Server(scenario: 'played'), reduced: false, prefs: store);
    await tester.pump();
    // Waiting: her seat shows, her Fold does not, and the header does not count her yet.
    expect(_waitSeat(_zoya), findsOneWidget);
    expect(_player(_zoya), findsNothing);
    expect(find.textContaining('3 of 5 seats'), findsOneWidget);

    expect(await _untilAct(tester, _zoya), isTrue);
    expect(_p(tester, _zoya).kind, DenActKind.join);
    // Others stand still in their places; only the newcomer travels.
    expect(_p(tester, _kabir).actId, 0);
    await tester.pump();
    const length = JoinAct.total;

    await _at(tester, _zoya, 240, length);
    final hop1 = _frame(tester, _zoya);
    expect(hop1.dx, greaterThan(40), reason: 'she comes from the right edge');
    expect(hop1.dy, lessThan(-20), reason: 'the first hop is about 26 dp high');
    await _at(tester, _zoya, 720, length);
    final hop2 = _frame(tester, _zoya);
    expect(hop2.dx, inExclusiveRange(0, hop1.dx));
    await _at(tester, _zoya, JoinAct.land + 90, length);
    final landed = _frame(tester, _zoya);
    expect(landed.dx, closeTo(0, 0.5));
    expect(landed.scaleY, closeTo(0.86, 0.02));
    expect(landed.scaleX, closeTo(1.12, 0.02));
    // The seat outline folds away and the name engraves; the others turn their eyes toward her (she is to their right).
    await _at(tester, _zoya, 1400, length);
    expect(_frame(tester, _zoya).seat, lessThan(0.2));
    expect(_frame(tester, _zoya).name, greaterThan(0.4));
    final look = _puppet(tester, _kabir).look;
    expect(look, isNotNull);
    expect(look!.value, greaterThan(0.9));
    expect(find.bySemanticsLabel('Zoya joined'), findsOneWidget);
    await _at(tester, _zoya, 1800, length);
    expect(_puppet(tester, _zoya).pose, FoldPose.wave);

    await tester.pump(const Duration(milliseconds: 700));
    expect(_p(tester, _zoya).actId, 0, reason: 'the act ended');
    expect(_waitSeat(_zoya), findsNothing);
    expect(_puppet(tester, _kabir).look, isNull);
    expect(_frame(tester, _zoya).dx, 0);
    expect(find.textContaining('4 of 5 seats'), findsOneWidget);
    expect(_memoryOn(store)!.members, contains(_zoya));

    // Open the den again on the same phone: she is simply there.
    await tester.pumpWidget(const SizedBox());
    await pumpDen(tester, v3Server(scenario: 'played'), reduced: false, prefs: store);
    expect(_waitSeat(_zoya), findsNothing);
    expect(await _untilAct(tester, _zoya, limit: const Duration(seconds: 4)), isFalse);
    semantics.dispose();
  });

  testWidgets("a friend's new sticker: the Mob cheers, rippling out from the sender, and the sticker flies from their Fold", (tester) async {
    final server = v3Server(scenario: 'played')..arrive();
    // This phone saw the four of them and every sticker up to an hour ago; Meher has joined and said "Let's go" since.
    final store = _phone({_aarav, _riya, _kabir, _zoya}, upTo: v3Now.subtract(const Duration(hours: 1)));
    await pumpDen(tester, server, reduced: false, prefs: store);
    expect(await _untilAct(tester, _meher), isTrue);
    expect(_p(tester, _meher).kind, DenActKind.join);
    expect(find.byType(StickerFlight), findsNothing, reason: "Meher's sticker waits for the cheer");
    // The join, then a quiet beat, then the cheer: everyone on the floor at once.
    for (var i = 0; i < 300 && (_p(tester, _meher).kind != DenActKind.reaction || _p(tester, _meher).actId == 0); i++) {
      await tester.pump(const Duration(milliseconds: 16));
    }
    expect(_p(tester, _meher).kind, DenActKind.reaction);
    final cue = _p(tester, _meher);
    expect(cue.actId, isNot(0));
    for (final id in [_aarav, _riya, _kabir, _zoya]) {
      expect(_p(tester, id).actId, cue.actId);
    }
    // Meher leads (index 0), Zoya beside her next, Aarav at the far end last.
    expect(cue.index, 0);
    expect(_p(tester, _zoya).index, 1);
    expect(_p(tester, _aarav).index, 4);
    expect(find.descendant(of: find.byType(DenStage), matching: find.byType(StickerFlight)), findsOneWidget);
    await tester.pump();
    final length = ReactionAct.totalFor(5);
    await _at(tester, _meher, 100, length);
    expect(_puppet(tester, _meher).pose, FoldPose.cheer);
    expect(_puppet(tester, _aarav).pose, FoldPose.idle);
    await _at(tester, _meher, 270, length);
    expect(_frame(tester, _meher).dy, closeTo(-14, 0.6));
    await _at(tester, _meher, 700, length);
    expect(_puppet(tester, _aarav).pose, FoldPose.cheer);
    await tester.pump(const Duration(milliseconds: 1400));
    for (final id in [_aarav, _riya, _kabir, _zoya, _meher]) {
      expect(_p(tester, id).actId, 0);
      expect(_puppet(tester, id).pose, FoldPose.idle);
    }
    expect(_memoryOn(store)!.reactionsUpTo, isNotNull);
    expect(_memoryOn(store)!.reactionsUpTo!.isAfter(v3Now.subtract(const Duration(hours: 1))), isTrue);
  });

  testWidgets('reduced motion: a friend who joins while the den is open cross-fades into the seat in 120 ms, with no travel and no glance', (tester) async {
    final server = v3Server(scenario: 'played');
    final store = _phone({_aarav, _riya, _kabir, _zoya});
    await pumpDen(tester, server, reduced: true, prefs: store);
    await tester.pump(const Duration(seconds: 1));
    expect(_player(_meher), findsNothing);
    // Meher joins; the den reads again (a pull, the tab coming back).
    server.arrive();
    final container = ProviderScope.containerOf(tester.element(find.byType(DenScreen)));
    container.read(mobRepositoryProvider.notifier).accept(await server.den());
    for (var i = 0; i < 20 && _waitSeat(_meher).evaluate().isEmpty; i++) {
      await tester.pump(const Duration(milliseconds: 16));
    }
    expect(_waitSeat(_meher), findsOneWidget, reason: 'she waits in her seat for the beat before her act');
    expect(_player(_meher), findsNothing);
    expect(await _untilAct(tester, _meher), isTrue);
    await tester.pump();
    await _at(tester, _meher, 60, 120);
    final mid = _frame(tester, _meher);
    expect(mid.dx, 0);
    expect(mid.dy, 0);
    expect(mid.scaleY, 1);
    expect(mid.opacity, inExclusiveRange(0.2, 0.8));
    expect(mid.seat, inExclusiveRange(0.2, 0.8));
    expect(_puppet(tester, _zoya).look, isNull);
    await tester.pump(const Duration(milliseconds: 80));
    expect(_p(tester, _meher).actId, 0);
    expect(_waitSeat(_meher), findsNothing);
    // Her "Let's go" then cheers as a pose swap only: no hop.
    expect(await _untilAct(tester, _meher), isTrue);
    expect(_p(tester, _meher).kind, DenActKind.reaction);
    await tester.pump();
    await _at(tester, _meher, 100, ReactionAct.totalFor(5));
    expect(_puppet(tester, _meher).pose, FoldPose.cheer);
    expect(_frame(tester, _meher).dy, 0);
    expect(_frame(tester, _meher).scaleY, 1);
    await tester.pump(const Duration(seconds: 2));
    expect(_puppet(tester, _meher).pose, FoldPose.idle);
  });

  testWidgets('no act while the results run shows: the newcomer waits in her seat until it closes', (tester) async {
    final store = _phone({_aarav, _riya, _kabir});
    await pumpDen(tester, v3Server(scenario: 'questdone'), reduced: false, prefs: store);
    for (var i = 0; i < 40 && find.byType(ResultsRun).evaluate().isEmpty; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
    expect(find.byType(ResultsRun), findsOneWidget);
    for (var i = 0; i < 20; i++) {
      await tester.pump(const Duration(milliseconds: 250));
    }
    expect(find.byType(ResultsRun), findsOneWidget);
    expect(_player(_zoya), findsNothing, reason: 'still waiting in her seat');
    expect(_memoryOn(store)!.members, isNot(contains(_zoya)));
    // Close the run (and any achievement still due that comes back after it): her act starts only once none shows.
    var played = false;
    for (var i = 0; i < 16 && !played; i++) {
      if (find.byType(ResultsRun, skipOffstage: false).evaluate().isNotEmpty) {
        expect(_player(_zoya).evaluate().isEmpty || _p(tester, _zoya).actId == 0, isTrue, reason: 'no act under the results run');
        await _closeRun(tester);
      }
      played = await _untilAct(tester, _zoya, limit: const Duration(milliseconds: 900));
    }
    expect(played, isTrue);
    expect(find.byType(ResultsRun, skipOffstage: false), findsNothing);
    expect(_memoryOn(store)!.members, contains(_zoya));
    await tester.pump(const Duration(seconds: 3));
    expect(_p(tester, _zoya).actId, 0);
  });
}
