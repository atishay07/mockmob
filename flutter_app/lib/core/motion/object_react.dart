import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';

import '../haptics/haptics.dart';
import 'motion.dart';

/// A physical object answering a touch (a subject's photo-real render, a stamp, a medal): it gives
/// under the finger to 0.94, springs past rest to 1.04, then settles at 1, with a 2 degree twist,
/// over 420 ms, and a light haptic. Each change of [pulse] plays it once (a new pulse restarts it).
///
/// [amplitude] scales the give, the overshoot and the twist together (0.5 for a small chip, 1 for a
/// hero object). Transform only, on its own layer; it never changes layout. Under reduced motion it
/// does not move and the haptic still fires.
class MmObjectReact extends StatefulWidget {
  const MmObjectReact({
    super.key,
    required this.child,
    required this.pulse,
    this.amplitude = 1,
    this.haptic = true,
    this.alignment = Alignment.center,
  });

  final Widget child;
  final ValueListenable<int> pulse;
  final double amplitude;
  final bool haptic;

  /// The pivot of the give and the twist (bottomCenter for an object standing on a surface).
  final Alignment alignment;

  static const Duration duration = Duration(milliseconds: 420);

  /// Scale at [t] (0 to 1) for [amplitude] 1: 1 to 0.94 by 22%, to 1.04 by 58%, to 1 at the end,
  /// eased between keys.
  static double scaleAt(double t, {double amplitude = 1}) {
    final double k;
    if (t <= 0 || t >= 1) {
      k = 1;
    } else if (t < 0.22) {
      k = 1 - 0.06 * Motion.out.transform(t / 0.22);
    } else if (t < 0.58) {
      k = 0.94 + 0.10 * Motion.inOut.transform((t - 0.22) / 0.36);
    } else {
      k = 1.04 - 0.04 * Motion.out.transform((t - 0.58) / 0.42);
    }
    return 1 + (k - 1) * amplitude;
  }

  /// Rotation in radians at [t]: one damped swing of 2 degrees.
  static double turnAt(double t, {double amplitude = 1}) {
    if (t <= 0 || t >= 1) return 0;
    return (2 * math.pi / 180) * amplitude * math.sin(t * 2 * math.pi) * (1 - t);
  }

  @override
  State<MmObjectReact> createState() => _MmObjectReactState();
}

class _MmObjectReactState extends State<MmObjectReact> with SingleTickerProviderStateMixin {
  late final AnimationController _t = AnimationController(vsync: this, duration: MmObjectReact.duration, value: 1);

  @override
  void initState() {
    super.initState();
    widget.pulse.addListener(_play);
  }

  @override
  void didUpdateWidget(MmObjectReact old) {
    super.didUpdateWidget(old);
    if (old.pulse != widget.pulse) {
      old.pulse.removeListener(_play);
      widget.pulse.addListener(_play);
    }
  }

  void _play() {
    if (!mounted) return;
    if (widget.haptic) hapticsOf(context)?.light();
    if (Motion.reduced(context)) return;
    _t.forward(from: 0);
  }

  @override
  void dispose() {
    widget.pulse.removeListener(_play);
    _t.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return RepaintBoundary(
      child: AnimatedBuilder(
        animation: _t,
        builder: (context, child) {
          final v = _t.value;
          final a = widget.amplitude;
          // One structure at rest and in motion, so the object never remounts.
          return Transform.rotate(
            alignment: widget.alignment,
            angle: MmObjectReact.turnAt(v, amplitude: a),
            child: Transform.scale(alignment: widget.alignment, scale: MmObjectReact.scaleAt(v, amplitude: a), child: child),
          );
        },
        child: widget.child,
      ),
    );
  }
}
