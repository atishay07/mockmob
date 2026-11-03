/// The Keep flight (the web's `flyTo`, A1 3.11): a small copy of the card (72 x 96, radius 10, the card's paper with its
/// hairline and shadow, R8) leaves the card's centre and lands on the top bar's kept count in 320 ms on `Motion.drawer`, shrinking to 0.3
/// and fading to 0.2, in the overlay. Nothing flies under reduced motion (the count still changes).
library;

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';

abstract final class StageFlight {
  static const Size ghost = Size(72, 96);
  static const Duration duration = Duration(milliseconds: 320);

  /// Flies a ghost from [from] (the card, `CardFace.cardKey`) to [to] (the kept count, `StageFrame.keptKey`). It
  /// waits for the frame that shows the count, then flies; the future completes when the ghost is gone. Nothing
  /// happens under reduced motion, or when either end is not on screen.
  static Future<void> fly(BuildContext context, {required GlobalKey from, required GlobalKey to}) async {
    if (Motion.reduced(context)) return;
    final overlay = Overlay.maybeOf(context, rootOverlay: true);
    if (overlay == null) return;
    final paper = context.mmColors.paper;
    await WidgetsBinding.instance.endOfFrame;
    if (!overlay.mounted) return;
    final space = overlay.context.findRenderObject();
    final a = _rect(from, space);
    final b = _rect(to, space);
    if (a == null || b == null || a.isEmpty || b.width <= 0) return;
    final start = Offset(a.center.dx - ghost.width / 2, a.center.dy - ghost.height / 2);
    final travel = b.center - a.center;
    final controller = AnimationController(vsync: overlay, duration: duration);
    final entry = OverlayEntry(
      builder: (context) => AnimatedBuilder(
        animation: controller,
        builder: (context, _) {
          final t = Motion.drawer.transform(controller.value);
          return Positioned(
            left: start.dx,
            top: start.dy,
            width: ghost.width,
            height: ghost.height,
            child: IgnorePointer(
              child: Transform.translate(
                offset: travel * t,
                child: Transform.scale(
                  scale: 1 - 0.7 * t,
                  child: Opacity(
                    opacity: 0.95 - 0.75 * t,
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        color: paper.paper,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: paper.line),
                        boxShadow: paper.shadow,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
    overlay.insert(entry);
    try {
      await controller.forward().orCancel;
    } on TickerCanceled {
      // The overlay went away mid-flight.
    } finally {
      entry.remove();
      controller.dispose();
    }
  }

  static Rect? _rect(GlobalKey key, RenderObject? space) {
    final box = key.currentContext?.findRenderObject();
    if (box is! RenderBox || !box.attached || !box.hasSize) return null;
    final origin = space is RenderBox ? box.localToGlobal(Offset.zero, ancestor: space) : box.localToGlobal(Offset.zero);
    return origin & box.size;
  }
}
