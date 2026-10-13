import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';

/// The lime-and-gold foil seal, set inside the sheet's bottom-right corner (never clipped by
/// the card or the screen), turned -8 degrees with a soft shadow under it. When [sealed] turns
/// true it is stamped on: a quick press down to 0.92 and back over 280 ms.
class FoilSeal extends StatelessWidget {
  const FoilSeal({super.key, required this.sealed, this.size = 64, this.animate = true});

  final bool sealed;
  final double size;
  final bool animate;

  static const double _turn = -8 * 3.14159265 / 180;

  @override
  Widget build(BuildContext context) {
    final seal = Transform.rotate(
      angle: _turn,
      child: DecoratedBox(
        decoration: const BoxDecoration(
          shape: BoxShape.circle,
          boxShadow: [BoxShadow(color: Color(0x66000000), blurRadius: 12, offset: Offset(0, 4))],
        ),
        child: ArtImage(MmArt.foilSeal, width: size, height: size, semanticLabel: OnboardingCopy.sealed),
      ),
    );
    if (!animate) return SizedBox.square(dimension: size, child: sealed ? seal : null);
    return SizedBox.square(
      dimension: size,
      child: TweenAnimationBuilder<double>(
        tween: Tween(end: sealed ? 1 : 0),
        duration: Motion.of(context, Motion.ink),
        curve: Curves.linear,
        builder: (context, t, child) {
          if (t == 0) return const SizedBox.shrink();
          // 1.0 down to 0.92 at the midpoint and back: the press of a stamp.
          final scale = 1 - 0.08 * (1 - (2 * t - 1).abs());
          return Opacity(opacity: (t * 3).clamp(0.0, 1.0), child: Transform.scale(scale: scale, child: child));
        },
        child: seal,
      ),
    );
  }
}
