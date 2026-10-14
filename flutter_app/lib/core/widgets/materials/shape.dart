import 'package:flutter/widgets.dart';

/// True for the pill radius (`MmRadius.pill`): such shapes are drawn as true stadiums.
bool isPillRadius(BorderRadius r) => r.topLeft.x >= 400;

/// The border for a MockMob surface: continuous corners for panels, a stadium for pills.
OutlinedBorder mmShapeBorder(BorderRadius radius, {BorderSide side = BorderSide.none}) =>
    isPillRadius(radius) ? StadiumBorder(side: side) : RoundedSuperellipseBorder(borderRadius: radius, side: side);

/// Clips [child] to the MockMob shape for [borderRadius].
class MmClip extends StatelessWidget {
  const MmClip({super.key, required this.borderRadius, required this.child});

  final BorderRadius borderRadius;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (isPillRadius(borderRadius)) {
      return ClipRRect(borderRadius: borderRadius, child: child);
    }
    return ClipRSuperellipse(borderRadius: borderRadius, child: child);
  }
}
