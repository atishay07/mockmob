import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';

/// The Night Sheet golden frame: 384 by 853 logical px at DPR 2.
const Size kNightSize = Size(384, 853);

/// Runs [body] once per theme as a golden test named `<name>_<night|day>.png`.
void nightGolden(String name, Widget Function() build, {Size size = kNightSize, bool disableAnimations = true}) {
  setUpAll(loadAppFonts);
  for (final brightness in [Brightness.dark, Brightness.light]) {
    final tag = brightness == Brightness.dark ? 'night' : 'day';
    testWidgets('$name, $tag', (tester) async {
      final boundary = GlobalKey();
      await pumpMockmob(
        tester,
        RepaintBoundary(
          key: boundary,
          child: Builder(builder: (context) => ColoredBox(color: context.mmColors.ground, child: build())),
        ),
        brightness: brightness,
        size: size,
        disableAnimations: disableAnimations,
      );
      await expectLater(find.byType(Scaffold).first, matchesGoldenFile('goldens/${name}_$tag.png'));
      await _preview(tester, boundary, '${name}_$tag');
    });
  }
}

/// A screen-like backdrop for glass: the desk art at the top fading into the ground, then rows
/// of ordinary content, so blur and tint are judged over something real.
class GoldenRoom extends StatelessWidget {
  const GoldenRoom({super.key, required this.child, this.artHeight = 420});

  final Widget child;
  final double artHeight;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return ColoredBox(
      color: colors.ground,
      child: Stack(
        fit: StackFit.expand,
        children: [
          Positioned(
            left: 0,
            right: 0,
            top: 0,
            height: artHeight,
            child: const ArtImage(MmArt.heroDesk, fit: BoxFit.cover, alignment: Alignment(0, 0.25)),
          ),
          Positioned(
            left: 0,
            right: 0,
            top: artHeight - 160,
            height: 161,
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [colors.ground.withValues(alpha: 0), colors.ground],
                ),
              ),
            ),
          ),
          Positioned(
            left: 16,
            right: 16,
            top: artHeight - 20,
            bottom: 0,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Your sheet', style: type.title),
                const SizedBox(height: 12),
                for (final (label, n) in const [('Mock 7', 4), ('Mock 6', 9), ('Quick 10', 2), ('Mock 5', 6)]) ...[
                  Row(children: [
                    SizedBox(width: 72, child: Text(label, style: type.labelLarge)),
                    BubbleRow(states: [for (var i = 0; i < 16; i++) i % n == 1 ? BubbleState.wrong : BubbleState.filled]),
                  ]),
                  const SizedBox(height: 14),
                ],
              ],
            ),
          ),
          child,
        ],
      ),
    );
  }
}

/// When `MM_PREVIEW_DIR` is set, also writes a DPR 2 render of the golden there, for reviewing
/// detail the 1x golden cannot show. Not part of the comparison.
Future<void> _preview(WidgetTester tester, GlobalKey key, String name) async {
  final dir = Platform.environment['MM_PREVIEW_DIR'];
  if (dir == null || dir.isEmpty) return;
  final boundary = key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
  await tester.runAsync(() async {
    final image = await boundary.toImage(pixelRatio: 2);
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    image.dispose();
    await File('$dir/$name.png').writeAsBytes(bytes!.buffer.asUint8List());
  });
}
