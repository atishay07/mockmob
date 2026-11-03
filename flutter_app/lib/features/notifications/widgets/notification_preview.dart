import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';

/// One example of a notification: a round glyph, the channel name and the exact words. It is
/// drawn, not a screenshot, and says plainly that it is an example.
class NotificationPreview extends StatelessWidget {
  const NotificationPreview({
    super.key,
    required this.icon,
    required this.channel,
    required this.body,
  });

  final IconData icon;
  final String channel;
  final String body;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      container: true,
      label: '$channel. $body',
      excludeSemantics: true,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: MmSpace.s12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 36,
              height: 36,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: colors.ink,
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, size: 18, color: colors.ground),
              ),
            ),
            const SizedBox(width: MmSpace.s12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(channel, style: type.label.copyWith(color: colors.ink3)),
                  const SizedBox(height: 2),
                  Text(body, style: type.body.copyWith(color: colors.ink)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Brings its child in with a short rise and fade, once, [index] steps after the first. The
/// only motion on the pre-prompt sheet; reduced motion shows it at once.
class StaggerIn extends StatefulWidget {
  const StaggerIn({super.key, required this.index, required this.child});

  final int index;
  final Widget child;

  @override
  State<StaggerIn> createState() => _StaggerInState();
}

class _StaggerInState extends State<StaggerIn>
    with SingleTickerProviderStateMixin {
  AnimationController? _controller;
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (Motion.reduced(context)) return;
    final controller = AnimationController(
      vsync: this,
      duration: Motion.card + Duration(milliseconds: 70 * widget.index),
    );
    _controller = controller..forward();
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final controller = _controller;
    if (controller == null) return widget.child;
    // The delay is the first part of the controller's run, so each row waits for the one above.
    final total = controller.duration!.inMilliseconds;
    final begin = (70 * widget.index) / total;
    final animation = CurvedAnimation(
      parent: controller,
      curve: Interval(begin, 1, curve: Motion.out),
    );
    return FadeTransition(
      opacity: animation,
      child: AnimatedBuilder(
        animation: animation,
        builder: (context, child) => Transform.translate(
          offset: Offset(0, 8 * (1 - animation.value)),
          child: child,
        ),
        child: widget.child,
      ),
    );
  }
}
