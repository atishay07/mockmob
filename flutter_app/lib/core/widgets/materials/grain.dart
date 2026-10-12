import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/widgets.dart';

import '../../theme/theme.dart';

/// A static film-grain tile (128 px), generated once from a fixed seed and cached for the life
/// of the app. Warm grain on the moment layer; type stays crisp because grain sits under it.
abstract final class GrainTile {
  static ui.Image? _tile;

  static const int size = 128;

  /// The cached tile, drawn on first use.
  static ui.Image get image => _tile ??= _draw();

  static ui.Image _draw() {
    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder);
    final random = math.Random(7);
    final light = <Offset>[];
    final dark = <Offset>[];
    for (var i = 0; i < size * size ~/ 3; i++) {
      final p = Offset(random.nextInt(size) + 0.5, random.nextInt(size) + 0.5);
      (random.nextBool() ? light : dark).add(p);
    }
    final paint = Paint()
      ..strokeWidth = 1
      ..strokeCap = StrokeCap.square;
    canvas.drawPoints(ui.PointMode.points, light, paint..color = const Color(0xFFFFF4E0));
    canvas.drawPoints(ui.PointMode.points, dark, paint..color = const Color(0xFF000000));
    final picture = recorder.endRecording();
    final image = picture.toImageSync(size, size);
    picture.dispose();
    return image;
  }
}

/// Paints the grain tile over its area at [opacity] (defaults to the theme's grain). Static: it
/// sits in its own RepaintBoundary and never animates.
class Grain extends StatelessWidget {
  const Grain({super.key, this.opacity, this.child});

  final double? opacity;
  final Widget? child;

  @override
  Widget build(BuildContext context) {
    final o = opacity ?? context.mmColors.grain;
    return CustomPaint(
      foregroundPainter: o <= 0 ? null : GrainPainter(opacity: o),
      child: child ?? const SizedBox.expand(),
    );
  }
}

class GrainPainter extends CustomPainter {
  const GrainPainter({required this.opacity});

  final double opacity;

  @override
  void paint(Canvas canvas, Size size) {
    final shader = ui.ImageShader(
      GrainTile.image,
      TileMode.repeated,
      TileMode.repeated,
      // Half size: one grain dot per physical pixel at DPR 2, so it reads as film, not dots.
      Matrix4.diagonal3Values(0.5, 0.5, 1).storage,
    );
    canvas.drawRect(
      Offset.zero & size,
      Paint()
        ..shader = shader
        ..color = Color.fromRGBO(0, 0, 0, opacity),
    );
  }

  @override
  bool shouldRepaint(GrainPainter old) => old.opacity != opacity;
}
