import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';

/// A section that opens and closes with its size: 320 ms on the emphasized curve to open, 200 ms
/// on the exit curve to close, the content fading in over the back half of the opening so the
/// rows never appear before there is room for them. Closed, the child is not built at all.
///
/// The child is laid out once at full height and revealed through `heightFactor`, so the cost of
/// the motion is a clip, not a relayout of the rows per frame. Under reduced motion it snaps.
class MmCollapsible extends StatefulWidget {
  const MmCollapsible({super.key, required this.expanded, required this.child});

  final bool expanded;
  final Widget child;

  static const Duration open = Duration(milliseconds: 320);
  static const Duration close = Duration(milliseconds: 200);

  /// Where the content's fade begins in the opening (a share of [open]): rows that fade in on their
  /// own must start no earlier, or their stagger plays under a still-transparent parent.
  static const double fadeStart = 0.35;

  /// The content's fade begins this long after the opening starts.
  static Duration get fadeLead => open * fadeStart;

  @override
  State<MmCollapsible> createState() => _MmCollapsibleState();
}

class _MmCollapsibleState extends State<MmCollapsible> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, value: widget.expanded ? 1 : 0)
    ..addStatusListener((_) {
      if (mounted) setState(() {});
    });
  late final CurvedAnimation _size = CurvedAnimation(parent: _c, curve: Motion.emphasized, reverseCurve: Motion.exit);
  late final CurvedAnimation _fade = CurvedAnimation(parent: _c, curve: const Interval(MmCollapsible.fadeStart, 1, curve: Curves.easeOut), reverseCurve: const Interval(0, 0.6));

  @override
  void didUpdateWidget(MmCollapsible old) {
    super.didUpdateWidget(old);
    if (widget.expanded == old.expanded) return;
    final reduced = Motion.reduced(context);
    _c.duration = reduced ? Duration.zero : MmCollapsible.open;
    _c.reverseDuration = reduced ? Duration.zero : MmCollapsible.close;
    if (widget.expanded) {
      _c.forward();
    } else {
      _c.reverse();
    }
    if (reduced) _c.value = widget.expanded ? 1 : 0;
  }

  @override
  void dispose() {
    _size.dispose();
    _fade.dispose();
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_c.isDismissed && !widget.expanded) return const SizedBox(width: double.infinity);
    return AnimatedBuilder(
      animation: _c,
      child: FadeTransition(opacity: _fade, child: widget.child),
      builder: (context, child) => ClipRect(
        child: Align(alignment: Alignment.topCenter, heightFactor: _size.value.clamp(0.0, 1.0), child: child),
      ),
    );
  }
}
