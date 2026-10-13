import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';

import '../theme/theme.dart';
import 'mobi_geometry.dart';
import 'mobi_painter.dart';
import 'mobi_palette.dart';
import 'mobi_rig.dart';

/// Mobi drawn from a fixed or externally driven [MobiRig], with no behaviour of its own. Sized by
/// [size] (height in dp); the width follows the character's proportions. Decorative.
class MobiFigure extends StatelessWidget {
  const MobiFigure({super.key, required this.rig, this.size = 96, this.shadow = true});

  /// A rig that changes over time (the painter repaints on each change), or a fixed one through
  /// [MobiFigure.still].
  final ValueListenable<MobiRig> rig;
  final double size;
  final bool shadow;

  /// Mobi held in one pose.
  MobiFigure.still(MobiRig rig, {Key? key, double size = 96, bool shadow = true})
      : this(key: key, rig: ValueNotifier(rig), size: size, shadow: shadow);

  /// Width of a Mobi [size] dp tall.
  static double widthFor(double size) => size * MobiGeo.width / MobiGeo.height;

  @override
  Widget build(BuildContext context) {
    final palette = MobiPalette.of(night: context.mmColors.isNight);
    return SizedBox(
      width: widthFor(size),
      height: size,
      child: CustomPaint(painter: MobiPainter(rig: rig, palette: palette, shadow: shadow)),
    );
  }
}
