// Goldens for R7 the podium (spec 7.3): open with a tie, closed, switch off and only you at 360 dp
// Night and Day; the open podium also at 412 dp and at text scale 1.3; and the G-6 frame goldens of
// the reveal at 0, 600, 1200, 1800, 2400, 3200 and 3500 ms (Night and Day; MOB-MINIMAL 4.3, about 3.5 s).

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_fake_server.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_models.dart';
import 'package:mockmob/features/social/v3/widgets/podium_stage.dart';

import '../../../helpers/golden_harness.dart';
import '../../../unit/social/v3/mob_v3_test_kit.dart';
import '../../../widget/social/v3/results_kit.dart';
import '../../you/you_golden_kit.dart' show setUpGoldenFonts;

String _tag(Brightness b) => b == Brightness.dark ? 'night' : 'day';

void main() {
  setUpGoldenFonts();
  late MobV3FakeServer server;
  late Podium open;
  late Podium closed;
  late Podium off;

  setUpAll(() async {
    loadFoldManifestForTest();
    FoilSheenProgram.enabled = false;
    server = await openServer();
    open = await server.podium(riyaGame);
    closed = await server.podium(zoyaGame);
    off = Podium(
      soFar: true,
      showPodium: false,
      right: open.right,
      of: open.of,
      closesAt: open.closesAt,
      places: [for (final p in open.places) PodiumPlace(memberId: p.memberId, name: p.name, fold: p.fold, colour: p.colour, marks: p.marks, you: p.you)],
    );
  });

  Widget stage(Podium p, String title, {bool autoplay = false}) => PodiumStage(podium: p, gameTitle: title, now: v3Now, autoplay: autoplay, onMoments: () {}, onRematch: () {}, onClose: () {});

  for (final b in [Brightness.dark, Brightness.light]) {
    final cases = <(String, Podium Function(), String)>[
      ('r7_open', () => open, "Riya's sprint"),
      ('r7_closed', () => closed, "Zoya's sprint"),
      ('r7_switch_off', () => off, "Riya's sprint"),
      ('r7_only_you', onlyYouPodium, 'Your sprint'),
      ('r7_private', privatePodium, "Riya's sprint"),
    ];
    for (final (name, podium, title) in cases) {
      testWidgets('$name 360 ${_tag(b)}', (tester) async {
        await pumpMockmob(tester, stage(podium(), title), brightness: b, size: const Size(360, 780), overrides: v3Overrides(server));
        await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/${name}_360_${_tag(b)}.png'));
      });
    }
    for (final (w, scale) in [(412.0, 1.0), (360.0, 1.3)]) {
      testWidgets('r7_open ${w.round()} x$scale ${_tag(b)}', (tester) async {
        await pumpMockmob(tester, stage(open, "Riya's sprint"), brightness: b, size: Size(w, scale == 1 ? 860 : 900), textScale: scale, overrides: v3Overrides(server));
        await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/r7_open_${w.round()}${scale == 1 ? '' : '_x13'}_${_tag(b)}.png'));
      });
    }

    // G-6: frames of the reveal, from a stage started at 0 ms with its art already decoded.
    testWidgets('G-6 podium frames ${_tag(b)}', (tester) async {
      final go = ValueNotifier<bool>(false);
      await pumpMockmob(
        tester,
        SwapHost(go: go, warm: stage(open, "Riya's sprint"), live: KeyedSubtree(key: const ValueKey('live'), child: stage(open, "Riya's sprint", autoplay: true))),
        brightness: b,
        size: const Size(360, 780),
        overrides: v3Overrides(server),
      );
      go.value = true;
      await tester.pump();
      var t = 0;
      for (final at in const [0, 600, 1200, 1800, 2400, 3200, 3500]) {
        while (t + 16 <= at) {
          await tester.pump(const Duration(milliseconds: 16));
          t += 16;
        }
        if (at > t) {
          await tester.pump(Duration(milliseconds: at - t));
          t = at;
        }
        await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/g6_podium_${at}_${_tag(b)}.png'));
      }
      await tester.pump(const Duration(seconds: 2));
    });
  }
}
