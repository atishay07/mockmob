// A12 frame strip (MOB-MINIMAL 4.1, 4.2): the eye windows on three Folds. Columns: at rest, a blink at 25%, 50%
// (8% of the real eye shape) and 75% of its 150 ms, then a glance left and right. Night and Day.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_models.dart';
import 'package:mockmob/features/social/v3/widgets/fold_manifest.dart';
import 'package:mockmob/features/social/v3/widgets/fold_puppet.dart';

import '../../../helpers/golden_harness.dart';
import '../../../unit/social/v3/mob_v3_test_kit.dart';
import '../../you/you_golden_kit.dart' show setUpGoldenFonts;

const _frames = <(String, double, double)>[('rest', 0, 0), ('blink 25%', 0.25, 0), ('blink 50%', 0.5, 0), ('blink 75%', 0.75, 0), ('glance left', 0, -1), ('glance right', 0, 1)];

class _Strip extends StatelessWidget {
  const _Strip();

  @override
  Widget build(BuildContext context) {
    final m = FoldManifest.cached!;
    const size = 104.0;
    return Material(
      color: Theme.of(context).scaffoldBackgroundColor,
      child: Padding(
        padding: const EdgeInsets.all(8),
        child: Column(
          children: [
            for (final f in const [FoldKey.dart, FoldKey.hop, FoldKey.crane])
              Row(
                children: [
                  for (final (label, b, g) in _frames)
                    Expanded(
                      child: Column(
                        children: [
                          Builder(builder: (context) {
                            final still = m[f]!.still(FoldPose.idle)!;
                            final side = size / still.box.height;
                            return SizedBox(
                              width: still.box.width * side,
                              height: size,
                              child: Stack(clipBehavior: Clip.none, children: [
                                Positioned(left: -still.box.left * side, top: -still.box.top * side, width: side, height: side, child: Image.asset(still.file, width: side, height: side)),
                                Positioned(
                                  left: -still.box.left * side,
                                  top: -still.box.top * side,
                                  width: side,
                                  height: side,
                                  child: EyeWindows(path: still.file, eyes: still.eyes, visor: still.visorColour ?? const Color(0xFF16151A), side: side, blink: AlwaysStoppedAnimation(b), glance: AlwaysStoppedAnimation(g), reach: 2.5),
                                ),
                              ]),
                            );
                          }),
                          Text(label, style: const TextStyle(fontSize: 9)),
                        ],
                      ),
                    ),
                ],
              ),
          ],
        ),
      ),
    );
  }
}

void main() {
  setUpGoldenFonts();
  setUpAll(loadFoldManifestForTest);

  test('a blink squashes the eye to 8% at its middle and back', () {
    expect(EyeWindows.openness(0), 1);
    expect(EyeWindows.openness(0.5), closeTo(0.08, 1e-9));
    expect(EyeWindows.openness(1), 1);
  });

  for (final b in [Brightness.dark, Brightness.light]) {
    testWidgets('eye windows strip (${b == Brightness.dark ? 'night' : 'day'})', (t) async {
      await pumpMockmob(t, const _Strip(), brightness: b, size: const Size(720, 440), wrapInScaffold: false);
      await settleImages(t);
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/fold_life/eyes_strip_${b == Brightness.dark ? 'night' : 'day'}.png'));
    });
  }
}
