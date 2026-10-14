import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';

/// A chip that answers being chosen or let go: chosen, it springs from 0.9 to 1 with a small
/// overshoot; let go, it dips to 0.96 and returns. Transform only. The first build is at rest
/// (a chip drawn with the page does not pop), and under reduced motion it never moves.
class PopOnSelect extends StatefulWidget {
  const PopOnSelect({super.key, required this.selected, required this.child});

  final bool selected;
  final Widget child;

  static const Duration duration = Duration(milliseconds: 320);

  /// The scale at [t] (0 to 1) of a pop in ([selected] true) or a dip out.
  static double scaleAt(double t, {required bool selected}) {
    if (t >= 1) return 1;
    if (selected) return 0.9 + 0.1 * Curves.easeOutBack.transform(t);
    final dip = t < 0.4 ? t / 0.4 : 1 - (t - 0.4) / 0.6;
    return 1 - 0.04 * Curves.easeOut.transform(dip.clamp(0.0, 1.0));
  }

  @override
  State<PopOnSelect> createState() => _PopOnSelectState();
}

class _PopOnSelectState extends State<PopOnSelect> with SingleTickerProviderStateMixin {
  late final AnimationController _t = AnimationController(vsync: this, duration: PopOnSelect.duration, value: 1);

  @override
  void didUpdateWidget(PopOnSelect old) {
    super.didUpdateWidget(old);
    if (old.selected == widget.selected) return;
    if (Motion.reduced(context)) {
      _t.value = 1;
      return;
    }
    _t.forward(from: 0);
  }

  @override
  void dispose() {
    _t.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _t,
      child: widget.child,
      builder: (context, child) {
        if (_t.value >= 1) return child!;
        return Transform.scale(scale: PopOnSelect.scaleAt(_t.value, selected: widget.selected), child: child);
      },
    );
  }
}
