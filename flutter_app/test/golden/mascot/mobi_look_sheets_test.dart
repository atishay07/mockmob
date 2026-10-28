import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/mascot/mascot.dart';
import 'package:mockmob/core/mascot/mobi_geometry.dart';
import 'package:mockmob/core/theme/theme.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'mascot_support.dart';

/// Review panels for a look pass on Mobi (not goldens): each act's key pose at 32, 64 and 160 dp
/// (lite detail under [MobiCharacter.liteBelow], as the app paints it),
/// and six-frame strips of two acts mid-motion, on the Night and Day grounds, written as PNGs at
/// a phone's 3x density into `MOBI_LOOK_OUT/<MOBI_LOOK_PHASE>/`. Run once before a change and
/// once after, then lay the two side by side. Skipped unless `MOBI_LOOK_OUT` is set.
///
/// `MOBI_LOOK_OUT=... MOBI_LOOK_PHASE=after bash tool/flutter_locked.sh test -j 1 test/golden/mascot/mobi_look_sheets_test.dart`
void main() {
  final out = Platform.environment['MOBI_LOOK_OUT'];
  final phase = Platform.environment['MOBI_LOOK_PHASE'] ?? 'after';
  final skip = out == null || out.isEmpty;

  setUpAll(loadAppFonts);

  const acts = <(String, MobiAct)>[
    ('greet', MobiAct.hello),
    ('think', MobiAct.think),
    ('cheer', MobiAct.cheer),
    ('oops', MobiAct.oops),
    ('celebrate', MobiAct.celebrate),
    ('nod', MobiAct.nod),
    ('wave', MobiAct.wave),
    ('sleep', MobiAct.sleep),
    ('idle', MobiAct.idle),
    ('correct', MobiAct.correct),
  ];

  Future<void> shoot(WidgetTester tester, String name, Size size, Brightness b, Widget Function(BuildContext) build) async {
    final key = GlobalKey();
    await pumpMockmob(
      tester,
      RepaintBoundary(
        key: key,
        child: Builder(builder: (context) => ColoredBox(color: context.mmColors.ground, child: SizedBox.fromSize(size: size, child: build(context)))),
      ),
      brightness: b,
      size: size,
      disableAnimations: true,
    );
    final boundary = key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
    await tester.runAsync(() async {
      final image = await boundary.toImage(pixelRatio: 3);
      final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
      image.dispose();
      final dir = Directory('$out/$phase')..createSync(recursive: true);
      await File('${dir.path}/$name.png').writeAsBytes(bytes!.buffer.asUint8List());
    });
  }

  for (final b in [Brightness.dark, Brightness.light]) {
    final tag = b == Brightness.dark ? 'night' : 'day';
    for (final (name, act) in acts) {
      testWidgets('look panel $name $tag', skip: skip, (tester) async {
        final rig = MobiMoves.keyPose(act);
        await shoot(tester, '${name}_$tag', const Size(300, 196), b, (context) {
          final line = context.mmColors.line;
          Widget fig(double s) => Stack(clipBehavior: Clip.none, children: [
                Positioned(left: -4, right: -4, top: s * MobiGeo.ground / MobiGeo.height, height: 1, child: ColoredBox(color: line)),
                MobiFigure.still(rig, size: s, lite: s < MobiCharacter.liteBelow),
              ]);
          return Padding(
            padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [fig(32), fig(64), fig(160)],
            ),
          );
        });
      });
    }

    for (final (name, act, times) in const [
      ('cheer', MobiAct.cheer, [0.12, 0.24, 0.36, 0.5, 0.66, 0.78]),
      ('greet', MobiAct.hello, [0.12, 0.34, 0.5, 0.66, 0.9, 1.4]),
      ('celebrate', MobiAct.celebrate, [0.14, 0.3, 0.5, 0.86, 1.04, 1.34]),
    ]) {
      testWidgets('look strip $name $tag', skip: skip, (tester) async {
        final frames = framesOf(act, times);
        await shoot(tester, 'strip_${name}_$tag', const Size(600, 150), b, (context) {
          final line = context.mmColors.line;
          return Padding(
            padding: const EdgeInsets.fromLTRB(8, 12, 8, 0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                for (final (_, rig) in frames)
                  SizedBox(
                    width: 96,
                    height: 124,
                    child: Stack(clipBehavior: Clip.none, alignment: Alignment.topCenter, children: [
                      Positioned(left: 0, right: 0, top: 124 * MobiGeo.ground / MobiGeo.height, height: 1, child: ColoredBox(color: line)),
                      MobiFigure.still(rig, size: 124),
                    ]),
                  ),
              ],
            ),
          );
        });
      });
    }
  }
}
