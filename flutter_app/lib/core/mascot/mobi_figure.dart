import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';

import '../theme/theme.dart';
import 'mobi_geometry.dart';
import 'mobi_painter.dart';
import 'mobi_palette.dart';
import 'mobi_rig.dart';

/// Mobi drawn from a fixed or externally driven [MobiRig], with no behaviour of its own. Sized by
/// [size] (height in dp); the width follows the character's proportions, or is [size] for a
/// [head]. Decorative.
class MobiFigure extends StatelessWidget {
  const MobiFigure({super.key, required this.rig, this.size = 96, this.shadow = true, this.lite = false, this.head = false});

  /// A rig that changes over time (the painter repaints on each change), or a fixed one through
  /// [MobiFigure.still].
  final ValueListenable<MobiRig> rig;
  final double size;
  final bool shadow;

  /// Lite detail (see [MobiPainter.lite]).
  final bool lite;

  /// Only the head, in a square (see [MobiPainter.head]).
  final bool head;

  /// Mobi held in one pose.
  MobiFigure.still(MobiRig rig, {Key? key, double size = 96, bool shadow = true, bool lite = false, bool head = false})
      : this(key: key, rig: ValueNotifier(rig), size: size, shadow: shadow, lite: lite, head: head);

  /// Width of a Mobi [size] dp tall.
  static double widthFor(double size) => size * MobiGeo.width / MobiGeo.height;

  @override
  Widget build(BuildContext context) {
    final palette = MobiPalette.of(night: context.mmColors.isNight);
    return SizedBox(
      width: head ? size : widthFor(size),
      height: size,
      child: CustomPaint(painter: MobiPainter(rig: rig, palette: palette, shadow: shadow, lite: lite, head: head)),
    );
  }
}
