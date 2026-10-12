import 'package:flutter/material.dart';

import '../theme/theme.dart';

/// A static placeholder block. No shimmer: loading is shown by shape, not motion.
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
        decoration: BoxDecoration(color: context.mmColors.line, borderRadius: BorderRadius.circular(radius)),
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
