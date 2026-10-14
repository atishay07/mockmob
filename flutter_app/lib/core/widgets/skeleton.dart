import 'package:flutter/material.dart';

import '../theme/theme.dart';

/// A static placeholder in the warm well colour, drawn in the shape of what will replace it
/// (a line, a tile, a circle for an avatar or a bubble). Flat: no gradient and no shimmer;
/// loading is shown by shape, not motion.
class Skeleton extends StatelessWidget {
  const Skeleton({super.key, this.width, this.height = 16, this.radius = MmRadius.small, this.shape});

  final double? width;
  final double height;
  final double radius;

  /// The final layout's shape. Null is a rounded rectangle with [radius].
  final ShapeBorder? shape;

  /// A text-line placeholder.
  const Skeleton.line({super.key, this.width, this.height = 14})
      : radius = 7,
        shape = null;

  /// A round placeholder (an avatar, a bubble, Mobi's spot).
  const Skeleton.circle({super.key, required double size})
      : width = size,
        height = size,
        radius = 0,
        shape = const CircleBorder();

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: width ?? double.infinity,
      height: height,
      child: DecoratedBox(
        decoration: ShapeDecoration(
          color: context.mmColors.raised2,
          shape: shape ?? RoundedRectangleBorder(borderRadius: BorderRadius.circular(radius)),
        ),
      ),
    );
  }
}

/// Wraps a group of [Skeleton]s so a screen reader hears one "Loading" instead of nothing.
class SkeletonGroup extends StatelessWidget {
  const SkeletonGroup({super.key, required this.child, this.label = 'Loading'});

  final Widget child;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      container: true,
      label: label,
      excludeSemantics: true,
      child: RepaintBoundary(child: child),
    );
  }
}
