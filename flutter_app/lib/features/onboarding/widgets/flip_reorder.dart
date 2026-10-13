import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart' show RenderFlex;

import '../../../core/motion/motion.dart';

/// Wraps one keyed child of a list that reorders. When the list moves it to a new place, it
/// glides from where it was to where it is (a FLIP: first, last, invert, play) on a near-critical
/// spring, as a transform only. Give it a stable key so its state follows the item.
class FlipItem extends StatefulWidget {
  const FlipItem({super.key, required this.child});

  final Widget child;

  @override
  State<FlipItem> createState() => _FlipItemState();
}

class _FlipItemState extends State<FlipItem> with SingleTickerProviderStateMixin {
  late final AnimationController _t = AnimationController.unbounded(vsync: this, value: 0);
  Offset? _last;
  Offset _from = Offset.zero;

  @override
  void dispose() {
    _t.dispose();
    super.dispose();
  }

  void _measure(Duration _) {
    if (!mounted) return;
    final box = context.findRenderObject();
    if (box is! RenderBox || !box.hasSize) return;
    // Measured inside the list itself, so scrolling never reads as a move. The translation is
    // painted by this item's own transform, which does not move its origin.
    final list = context.findAncestorRenderObjectOfType<RenderFlex>();
    final now = box.localToGlobal(Offset.zero, ancestor: list);
    final last = _last;
    _last = now;
    if (last == null || (last - now).distance < 1 || Motion.reduced(context)) return;
    _from = _offset + (last - now);
    _t.value = 1;
    _t.animateWith(Motion.spring(Springs.smooth, 1, 0));
  }

  Offset get _offset => _from * _t.value;

  @override
  Widget build(BuildContext context) {
    WidgetsBinding.instance.addPostFrameCallback(_measure);
    return AnimatedBuilder(
      animation: _t,
      child: widget.child,
      builder: (context, child) => Transform.translate(offset: _offset, child: child),
    );
  }
}
