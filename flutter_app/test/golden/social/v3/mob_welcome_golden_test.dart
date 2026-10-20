// Goldens for the Mob welcome (V16 A3): the screen at 0, 600, 1200, 2400 and 3600 ms, Night and Day, 360 dp; the end
// frame at 1.3x text; the reduced-motion end frame; and a frame strip of the room alone (the lamp, the three hops, the
// seat, the pennant), as the Mob V4 acts strips are.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_models.dart' show FoldPose;
import 'package:mockmob/features/social/v3/screens/mob_welcome_screen.dart';
import 'package:mockmob/features/social/v3/widgets/fold_puppet.dart';
import 'package:mockmob/features/social/v3/widgets/welcome_stage.dart';

import '../../../helpers/golden_harness.dart';
import '../../../unit/social/v3/mob_v3_test_kit.dart';
import '../../../unit/social/v3/social_test_kit.dart';
import '../../you/you_golden_kit.dart';

String _tag(Brightness b) => b == Brightness.dark ? 'night' : 'day';

/// The strip's moments: dark, bulb, beam, room up, Riya lands, Kabir mid-leap, Zoya lands, the seat and the pennant,
/// the words, the end.
const List<double> stripAt = [0, 140, 420, 900, 1460, 1500, 2160, 2480, 3000, 3800];

class _Strip extends StatelessWidget {
  const _Strip({required this.times});
  final List<double> times;

  static const double frameW = 180;
  static const double roomH = 430;

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    return Material(
      color: c.ground,
      child: Stack(
        children: [
          // Every pose the strip shows, decoded before the frames are drawn.
          Offstage(
            child: Row(
              children: [
                for (final f in WelcomeCast.folds)
                  for (final p in const [FoldPose.idle, FoldPose.wave]) FoldPuppet(fold: f, size: 76, pose: p),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(8),
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final ms in times)
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text('${(ms / 1000).toStringAsFixed(2)} s', style: context.mmType.caption.copyWith(color: c.ink2)),
                      const SizedBox(height: 4),
                      Container(
                        width: frameW,
                        height: frameW * roomH / 360,
                        decoration: BoxDecoration(border: Border.all(color: c.line)),
                        child: FittedBox(
                          child: SizedBox(
                            width: 360,
                            height: roomH,
                            child: WelcomeStage(ms: ms, height: roomH, reduced: false),
                          ),
                        ),
                      ),
                    ],
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

Future<GlobalKey<MobWelcomeScreenState>> _pump(WidgetTester t, Brightness b, {double scale = 1, bool reduced = false}) async {
  loadFoldManifestForTest();
  final key = GlobalKey<MobWelcomeScreenState>();
  await pumpMockmob(
    t,
    MobWelcomeScreen(key: key, inMob: false, autoplay: false),
    brightness: b,
    size: const Size(360, 780),
    textScale: scale,
    wrapInScaffold: false,
    disableAnimations: reduced,
    overrides: socialOverrides(SocialServer(scenario: 'fresh')),
  );
  await settleImages(t);
  return key;
}

void main() {
  setUpGoldenFonts();

  for (final b in [Brightness.dark, Brightness.light]) {
    testWidgets('welcome frames 360 ${_tag(b)}', (t) async {
      final key = await _pump(t, b);
      for (final ms in [0, 600, 1200, 2400, 3600]) {
        key.currentState!.seek(ms.toDouble());
        await t.pump();
        // The Skip pill fades over 200 ms; the clock stays where it was put.
        await t.pump(const Duration(milliseconds: 250));
        await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/mob_welcome/welcome_${ms}ms_360_${_tag(b)}.png'));
      }
    });

    testWidgets('welcome end 360 x13 ${_tag(b)}', (t) async {
      final key = await _pump(t, b, scale: 1.3);
      key.currentState!.seek(WelcomeTimeline.total);
      await t.pump();
      await t.pump(const Duration(milliseconds: 250));
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/mob_welcome/welcome_end_360_x13_${_tag(b)}.png'));
    });

    testWidgets('welcome reduced motion 360 ${_tag(b)}', (t) async {
      final key = await _pump(t, b, reduced: true);
      key.currentState!.seek(WelcomeTimeline.reducedTotal);
      await t.pump();
      await t.pump(const Duration(milliseconds: 250));
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/mob_welcome/welcome_reduced_360_${_tag(b)}.png'));
    });

    testWidgets('welcome strip ${_tag(b)}', (t) async {
      loadFoldManifestForTest();
      await pumpMockmob(
        t,
        const _Strip(times: stripAt),
        brightness: b,
        size: const Size(956, 520),
        wrapInScaffold: false,
      );
      await settleImages(t);
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/mob_welcome/welcome_strip_${_tag(b)}.png'));
    });
  }
}
