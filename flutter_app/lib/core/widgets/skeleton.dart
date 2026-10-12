import 'package:flutter/material.dart';

import '../theme/theme.dart';

/// A static placeholder block in the warm well colour, with a faint top light so it reads as a
/// shape waiting to be filled, not a hole. No shimmer: loading is shown by shape, not motion.
class Skeleton extends StatelessWidget {
  const Skeleton({super.key, this.width, this.height = 16, this.radius = MmRadius.small});

  final double? width;
  final double height;
  final double radius;

  /// A text-line placeholder.
  const Skeleton.line({super.key, this.width, this.height = 14}) : radius = 7;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: width ?? double.infinity,
      height: height,
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(radius),
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [context.mmColors.raised2, Color.lerp(context.mmColors.raised2, context.mmColors.line, 0.6)!],
          ),
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
