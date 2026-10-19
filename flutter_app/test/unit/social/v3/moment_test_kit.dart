// Harness for the full-screen moments K1 to K4: the overlay is shown inside a host after the images
// have loaded (on the real event loop, with no frame pumped, so the moment's clock has not moved),
// then the clock is pumped to an exact millisecond in 16 ms frames.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_den.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_fake_server.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_models.dart';
import 'package:mockmob/features/social/v3/screens/moment_overlay.dart';

import '../../../helpers/golden_harness.dart';
import 'mob_v3_test_kit.dart';

/// The fixture week of [server] (the Monday of v3Now, IST).
String fixtureWeek(MobV3FakeServer server) {
  final v3 = server.denNow()['v3'] as Map<String, dynamic>;
  return (v3['quest'] as Map<String, dynamic>)['week'] as String;
}

/// The fixture Mob's id (the Mob-scoped moment keys carry it).
String fixtureMobId(MobV3FakeServer server) => (server.denNow()['mob'] as Map<String, dynamic>?)?['id'] as String? ?? 'mob-chai-0001';

/// The server's quest key, `quest_done:<mobId>:<week>`.
String questKey(MobV3FakeServer server) => dueMoments(server).firstWhere((k) => k.startsWith('quest_done:'), orElse: () => 'quest_done:${fixtureMobId(server)}:${fixtureWeek(server)}');

/// The server's stitch key, `stitch:<mobId>:<week>` (built even when not due, for the negative tests).
String stitchKey(MobV3FakeServer server) => dueMoments(server).firstWhere((k) => k.startsWith('stitch:'), orElse: () => 'stitch:${fixtureMobId(server)}:${fixtureWeek(server)}');

List<String> dueMoments(MobV3FakeServer server) => [for (final m in (server.denNow()['v3'] as Map<String, dynamic>)['moments'] as List) m as String];

/// A chain at a milestone: [days] in a row, one rested day four days ago, today done.
ChainState chainAt(int days, {String? reward, bool restPass = false}) {
  final today = DateTime.utc(2026, 10, 22);
  String d(DateTime x) => '${x.year}-${x.month.toString().padLeft(2, '0')}-${x.day.toString().padLeft(2, '0')}';
  final rested = today.subtract(const Duration(days: 4));
  final cal = <Map<String, dynamic>>[];
  for (var i = days + 3; i >= 0; i--) {
    final x = today.subtract(Duration(days: i));
    final state = i >= days ? 'none' : (x == rested ? 'rested' : (i == 0 ? 'today' : 'practised'));
    cal.add({'day': d(x), 'state': state});
  }
  return ChainState.fromJson({
    'days': days,
    'practised': days - 1,
    'rested': 1,
    'best': days,
    'today': {'answered': 5, 'needed': 5, 'done': true},
    'calendar': cal,
    'week': cal.sublist(cal.length - 7),
    'milestones': [
      {'at': days, 'reward': reward, 'done': true},
    ],
  });
}

class FixedChain extends ChainRepository {
  FixedChain(this.value);
  final ChainState value;

  @override
  Future<ChainState> build() async => value;
}

class MomentHost extends StatelessWidget {
  const MomentHost(this.which, {super.key});
  final ValueNotifier<String?> which;

  @override
  Widget build(BuildContext context) => ValueListenableBuilder<String?>(
        valueListenable: which,
        builder: (context, k, _) => k == null ? const SizedBox.expand() : MomentOverlay(momentKey: k),
      );
}

/// Pumps the host (no moment yet). Returns the switch that shows one.
Future<ValueNotifier<String?>> pumpMomentHost(
  WidgetTester tester, {
  required MobV3FakeServer server,
  Brightness brightness = Brightness.dark,
  Size size = const Size(360, 780),
  double textScale = 1,
  bool reduced = false,
  ChainState? chain,
  List<Override> extra = const [],
}) async {
  loadFoldManifestForTest();
  final which = ValueNotifier<String?>(null);
  addTearDown(which.dispose);
  await pumpMockmob(
    tester,
    MomentHost(which),
    brightness: brightness,
    size: size,
    textScale: textScale,
    wrapInScaffold: false,
    disableAnimations: reduced,
    overrides: [
      ...v3Overrides(server),
      if (chain != null) chainProvider.overrideWith(() => FixedChain(chain)),
      ...extra,
    ],
  );
  return which;
}

/// Shows [key] and lets its images load with the clock still at 0. After this the moment is at 0 ms.
Future<void> startMoment(WidgetTester tester, ValueNotifier<String?> which, String key) async {
  which.value = key;
  await tester.pump();
  // Images decode on the real event loop, and each step's continuation runs on the fake one: so
  // alternate the two. A zero pump moves no fake time, so the moment's clock stays at 0.
  for (var i = 0; i < 8; i++) {
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 80)));
    await tester.pump();
  }
  // The first tick of the moment's clock (elapsed 0).
  await tester.pump();
}

/// Pumps from [from] ms to [to] ms in 16 ms frames, calling [each] after every frame with its ms.
Future<void> pumpTo(WidgetTester tester, int to, {int from = 0, void Function(int ms)? each}) async {
  var t = from;
  while (t < to) {
    final step = (to - t).clamp(0, 16);
    await tester.pump(Duration(milliseconds: step));
    t += step;
    each?.call(t);
  }
}
