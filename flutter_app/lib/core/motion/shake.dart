import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';

import '../haptics/haptics.dart';
import 'motion.dart';

/// A refused action: the surface shakes sideways [MmShake.amplitude] dp for [MmShake.cycles]
/// cycles in [MmShake.duration], decaying so it lands exactly where it started, with the warn
/// haptic. Use it when a tap cannot do what it asked (Submit with nothing chosen, a locked tile),
/// always beside a line of text that says why: the shake is the reaction, the text is the
/// information.
///
/// Trigger it by bumping [pulse] (any change shakes once), or from a `GlobalKey<MmShakeState>` with
/// [MmShakeState.shake]. Under reduced motion it does not move; the haptic still fires (it has its
/// own Touch feedback switch). Transform only, on its own layer.
class MmShake extends StatefulWidget {
  const MmShake({
    super.key,
    required this.child,
    this.pulse,
    this.haptic = true,
    this.size = amplitude,
    this.length = duration,
  });

  final Widget child;

  /// Each change of the value shakes the child once.
  final ValueListenable<int>? pulse;

  /// Fires `Haptics.warn` with each shake.
  final bool haptic;

  /// This shake's sideways reach and length (the defaults are [amplitude] and [duration]).
  final double size;
  final Duration length;

  static const double amplitude = 4;
  static const int cycles = 3;
  static const Duration duration = Duration(milliseconds: 220);

  /// The sideways offset at [t] (0 to 1) of a shake: [amplitude] dp, [cycles] full cycles, a linear
  /// decay so the last cycle is small and it ends at exactly 0.
  static double offsetAt(double t, {double size = amplitude}) {
    if (t <= 0 || t >= 1) return 0;
    return size * math.sin(t * cycles * 2 * math.pi) * (1 - t);
  }

  @override
  State<MmShake> createState() => MmShakeState();
}

class MmShakeState extends State<MmShake> with SingleTickerProviderStateMixin {
  late final AnimationController _t = AnimationController(vsync: this, duration: widget.length, value: 1);

  @override
  void initState() {
    super.initState();
    widget.pulse?.addListener(shake);
  }

  @override
  void didUpdateWidget(MmShake oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.pulse != widget.pulse) {
      oldWidget.pulse?.removeListener(shake);
      widget.pulse?.addListener(shake);
    }
  }

  @override
  void dispose() {
    widget.pulse?.removeListener(shake);
    _t.dispose();
    super.dispose();
  }

  /// Shakes the child once (restarting a shake in progress).
  void shake() {
    if (!mounted) return;
    if (widget.haptic) hapticsOf(context)?.warn();
    if (Motion.reduced(context)) return;
    _t.forward(from: 0);
  }

  @override
  Widget build(BuildContext context) {
    return RepaintBoundary(
      child: AnimatedBuilder(
        animation: _t,
        builder: (context, child) => Transform.translate(offset: Offset(MmShake.offsetAt(_t.value, size: widget.size), 0), child: child),
        child: widget.child,
      ),
    );
  }
}
