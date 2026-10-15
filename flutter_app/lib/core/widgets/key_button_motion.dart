import 'package:flutter/material.dart';

import '../motion/motion.dart';
import '../theme/theme.dart';

/// A block that comes and goes without a cut: it grows open (size and a short fade, 200 ms on
/// [Motion.out]) when [show] turns true and closes the same way when it turns false, keeping what
/// it last showed until it has closed. Under reduced motion it is simply there or not.
///
/// [child] is read only while [show] is true, so a caller can pass `Text(line ?? '')` and the exit
/// still shows the line that is leaving.
class KeyReveal extends StatefulWidget {
  const KeyReveal({super.key, required this.show, required this.child, this.duration = Motion.ui});

  final bool show;
  final Widget child;
  final Duration duration;

  @override
  State<KeyReveal> createState() => _KeyRevealState();
}

class _KeyRevealState extends State<KeyReveal> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: widget.duration, value: widget.show ? 1 : 0);
  Widget? _held;

  @override
  void initState() {
    super.initState();
    if (widget.show) _held = widget.child;
  }

  @override
  void didUpdateWidget(KeyReveal old) {
    super.didUpdateWidget(old);
    if (widget.show) _held = widget.child;
    if (widget.show == old.show) return;
    if (Motion.reduced(context)) {
      _c.value = widget.show ? 1 : 0;
    } else if (widget.show) {
      _c.forward();
    } else {
      _c.reverse();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final held = _held;
    return AnimatedBuilder(
      animation: _c,
      builder: (context, _) {
        if (held == null || (_c.value == 0 && !widget.show)) return const SizedBox.shrink();
        final t = Motion.out.transform(_c.value.clamp(0.0, 1.0));
        if (t >= 1) return held;
        return ClipRect(
          child: Align(
            alignment: Alignment.topCenter,
            heightFactor: t,
            child: Opacity(opacity: t, child: held),
          ),
        );
      },
    );
  }
}

/// A veil that answers a finger on a touch area drawn by something else (a chart, a rail of days):
/// it fades in over 90 ms the moment the finger lands and out over 160 ms on release, in the shape
/// of [radius]. It takes no gesture of its own; the host's detector still commits the tap.
class PressHalo extends StatefulWidget {
  const PressHalo({super.key, required this.child, this.radius = 14, this.inset = EdgeInsets.zero});

  final Widget child;
  final double radius;
  final EdgeInsets inset;

  @override
  State<PressHalo> createState() => _PressHaloState();
}

class _PressHaloState extends State<PressHalo> {
  bool _down = false;
  Offset _at = Offset.zero;

  void _set(bool v) {
    if (_down != v && mounted) setState(() => _down = v);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final reduced = Motion.reduced(context);
    return Listener(
      behavior: HitTestBehavior.translucent,
      onPointerDown: (e) {
        _at = e.position;
        _set(true);
      },
      onPointerMove: (e) {
        // A scroll or a drag away lets the veil go.
        if ((e.position - _at).distance > 18) _set(false);
      },
      onPointerUp: (_) => _set(false),
      onPointerCancel: (_) => _set(false),
      child: Stack(
        fit: StackFit.passthrough,
        children: [
          Positioned.fill(
            child: Padding(
              padding: widget.inset,
              child: IgnorePointer(
                child: AnimatedOpacity(
                  opacity: _down ? 1 : 0,
                  duration: reduced ? Duration.zero : (_down ? const Duration(milliseconds: 90) : const Duration(milliseconds: 160)),
                  curve: Curves.easeOut,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: colors.ink.withValues(alpha: colors.isNight ? 0.09 : 0.07),
                      borderRadius: BorderRadius.circular(widget.radius),
                    ),
                  ),
                ),
              ),
            ),
          ),
          widget.child,
        ],
      ),
    );
  }
}
