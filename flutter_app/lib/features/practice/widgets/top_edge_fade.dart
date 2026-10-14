import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';

/// Fades the top [extent] dp of a scrolling [child] into the ground once it has scrolled, so text
/// passing under the app bar dissolves instead of being cut through at the viewport's edge. At
/// rest (offset 0) nothing is faded. Always wrapped, so the list keeps its place when the fade
/// comes or goes.
class TopEdgeFade extends StatelessWidget {
  const TopEdgeFade({super.key, required this.controller, required this.child, this.extent = 24});

  final ScrollController controller;
  final Widget child;
  final double extent;

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: controller,
    builder: (context, child) {
      final scrolled = controller.hasClients && controller.offset > 2;
      return ShaderMask(
        blendMode: BlendMode.dstIn,
        shaderCallback: (rect) => LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [scrolled ? const Color(0x00FFFFFF) : const Color(0xFFFFFFFF), const Color(0xFFFFFFFF)],
          stops: [0, (extent / rect.height).clamp(0.0, 1.0)],
        ).createShader(rect),
        child: child,
      );
    },
    child: child,
  );
}

/// The 24 dp fade from clear to the ground that sits on the scrolling content right above a
/// pinned action bar (SPACING.md 4.5), so a row passing under the bar dims instead of being cut
/// in half at a hard edge. Place it at the bottom of a [Stack] over the scroller; it takes no
/// touches.
class BarFade extends StatelessWidget {
  const BarFade({super.key});

  static const double extent = 24;

  @override
  Widget build(BuildContext context) {
    final ground = context.mmColors.ground;
    return Positioned(
      left: 0,
      right: 0,
      bottom: 0,
      height: extent,
      child: IgnorePointer(
        child: DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [ground.withValues(alpha: 0), ground],
            ),
          ),
        ),
      ),
    );
  }
}
