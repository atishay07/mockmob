// M13 (spec 5.6): switching Mobs fades through, 90 ms out and 210 ms in, with a selection haptic,
// and the den stays on screen while the other Mob loads (today's Mob page never flashes between).
// Reduced motion: one 120 ms fade in.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/features/social/data/mob_models.dart';
import 'package:mockmob/features/social/data/mob_repository.dart';
import 'package:mockmob/features/social/screens/mob_screen.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_fake_server.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_models.dart';
import 'package:mockmob/features/social/v3/screens/den_screen.dart';
import 'package:mockmob/features/you/widgets/you_page.dart';

import '../../../helpers/golden_harness.dart';
import '../../../unit/core/motion/motion_harness.dart' show RecordingHaptics;
import '../../../unit/social/v3/mob_v3_test_kit.dart';

/// Chai Circle plus a second Mob (Quiet Comets, just you), which is the one on screen.
Future<MobV3FakeServer> _twoMobs() async {
  final s = v3Server(scenario: 'heavy', billing: 'pro');
  await s.createMob(subject: 'accountancy', name: 'Aarav', colour: 0, nameKey: 1, fold: FoldKey.dart);
  return s;
}

/// The repository as the app runs it in fixture mode, minus the account and the phone's cache: a
/// read asks the fixture server and lands 150 ms later (a network's worth), so the switch has a
/// loading gap to cover.
class _FixtureMobRepository extends MobRepository {
  _FixtureMobRepository(this.first);
  final MobRead first;

  @override
  RemoteState<MobRead> build() => RemoteState(value: first, fetchedAt: v3Now);

  @override
  Future<void> refresh({bool force = false}) async {
    final body = await fetchJson();
    await Future<void>.delayed(const Duration(milliseconds: 150));
    state = RemoteState(value: parse(body), fetchedAt: v3Now);
  }
}

double _opacity(WidgetTester t) => t.widget<FadeTransition>(find.byKey(const ValueKey('den-switch-fade'))).opacity.value;

Future<RecordingHaptics> _pump(WidgetTester t, MobV3FakeServer s, {bool reduced = false}) async {
  final haptics = RecordingHaptics();
  await pumpMockmob(
    t,
    const MobScreen(asTab: true),
    wrapInScaffold: false,
    disableAnimations: reduced,
    overrides: [
      for (final o in v3Overrides(s))
        if (!identical(o.origin, mobRepositoryProvider)) o,
      mobRepositoryProvider.overrideWith(() => _FixtureMobRepository(MobRead.fromJson(s.denNow()))),
      hapticsProvider.overrideWithValue(Haptics(enabled: true, driver: haptics)),
    ],
  );
  for (var i = 0; i < 100; i++) {
    await t.pump(const Duration(milliseconds: 16));
  }
  return haptics;
}

/// Opens the switcher and picks Chai Circle. Returns the selection haptics fired before the pick.
Future<int> _pickChai(WidgetTester t, [RecordingHaptics? haptics]) async {
  // V4 3.5: the Mob's name opens Your Mobs.
  await t.tap(find.byKey(const ValueKey('den-your-mobs')));
  for (var i = 0; i < 40; i++) {
    await t.pump(const Duration(milliseconds: 16));
  }
  expect(find.text('Accountancy 2'), findsOneWidget, reason: 'the switcher lists the other Mob');
  final before = haptics?.count('selection') ?? 0;
  await t.tap(find.text('Accountancy 2'));
  return before;
}

void main() {
  setUpAll(loadFoldManifestForTest);

  testWidgets('fades out in 90 ms, keeps the den while loading, then fades Chai Circle in over 210 ms', (t) async {
    final s = await _twoMobs();
    final haptics = await _pump(t, s);
    expect(find.text('Quiet Comets'), findsWidgets);
    expect(_opacity(t), 1);
    final before = await _pickChai(t, haptics);
    await t.pump();
    await t.pump(const Duration(milliseconds: 10));
    expect(haptics.count('selection'), greaterThan(before), reason: 'a selection haptic on the switch');
    var sawZero = false;
    for (var ms = 0; ms < 600; ms += 10) {
      await t.pump(const Duration(milliseconds: 10));
      expect(find.byType(DenScreen), findsOneWidget, reason: 'the den stays at $ms ms');
      expect(find.byType(YouPage), findsNothing, reason: "today's Mob page never flashes ($ms ms)");
      if (_opacity(t) == 0) sawZero = true;
      if (ms == 40) expect(_opacity(t), inExclusiveRange(0, 1), reason: 'mid fade out');
    }
    expect(sawZero, isTrue, reason: 'the old Mob fades fully out');
    expect(_opacity(t), 1);
    expect(find.text('Chai Circle'), findsWidgets);
    expect(find.text('Quiet Comets'), findsNothing);
  });

  testWidgets('the fade out is 90 ms and the fade in 210 ms', (t) async {
    final s = await _twoMobs();
    await _pump(t, s);
    await _pickChai(t);
    await t.pump();
    // 90 ms out: gone by 100 ms.
    await t.pump(const Duration(milliseconds: 100));
    // The fixture answers at once, so the fade in starts within a few frames.
    var start = -1;
    for (var ms = 0; ms < 400; ms += 10) {
      await t.pump(const Duration(milliseconds: 10));
      final o = _opacity(t);
      if (start < 0 && o > 0) start = ms;
      if (start >= 0 && ms - start < 150) expect(o, lessThan(1), reason: 'still fading in at ${ms - start} ms');
    }
    expect(start, greaterThanOrEqualTo(0));
    expect(_opacity(t), 1);
  });

  testWidgets('reduced motion: no fade out, one 120 ms fade in', (t) async {
    final s = await _twoMobs();
    await _pump(t, s, reduced: true);
    await _pickChai(t);
    await t.pump();
    var minSeen = 1.0;
    for (var ms = 0; ms < 300; ms += 10) {
      await t.pump(const Duration(milliseconds: 10));
      final o = _opacity(t);
      if (o < minSeen) minSeen = o;
      expect(find.byType(YouPage), findsNothing);
    }
    expect(minSeen, lessThan(1), reason: 'the new Mob fades in');
    expect(_opacity(t), 1);
    expect(find.text('Chai Circle'), findsWidgets);
  });
}
