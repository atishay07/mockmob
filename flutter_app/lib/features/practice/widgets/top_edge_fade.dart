import 'package:flutter/material.dart';

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
