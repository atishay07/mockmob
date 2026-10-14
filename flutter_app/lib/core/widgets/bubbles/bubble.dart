import 'package:flutter/material.dart';

import '../../motion/motion.dart';
import '../../theme/theme.dart';
import 'bubble_painter.dart';

export 'bubble_painter.dart' show BubbleState, BubblePaint;

/// One answer bubble. When [state] changes to [BubbleState.filled] or [BubbleState.wrong] the
/// ink spreads from [inkOrigin] (the touch point, in the bubble's -1 to 1 space) over 260 ms;
/// under reduced motion it appears filled at once.
class Bubble extends StatefulWidget {
  const Bubble({
    super.key,
    required this.state,
    this.size = 20,
    this.emphasis = false,
    this.inkOrigin = Offset.zero,
    this.animate = true,
    this.semanticsLabel,
  });

  final BubbleState state;

  /// Diameter in dp.
  final double size;
  final bool emphasis;
  final Offset inkOrigin;

  /// False draws every state at rest (lists, goldens of a settled sheet).
  final bool animate;
  final String? semanticsLabel;

  @override
  State<Bubble> createState() => _BubbleState();
}

class _BubbleState extends State<Bubble> with SingleTickerProviderStateMixin {
  late final AnimationController _ink = AnimationController(vsync: this, duration: Motion.ink, value: 1);
  late final Animation<double> _curved = CurvedAnimation(parent: _ink, curve: Motion.glide);

  bool _inks(BubbleState s) => s == BubbleState.filled || s == BubbleState.wrong;

  @override
  void didUpdateWidget(Bubble oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.state == oldWidget.state) return;
    if (widget.animate && _inks(widget.state) && !Motion.reduced(context)) {
      _ink.forward(from: 0);
    } else {
      _ink.value = 1;
    }
  }

  @override
  void dispose() {
    _ink.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final pad = widget.emphasis ? 5.0 : 0.0;
    final painted = RepaintBoundary(
      child: CustomPaint(
        size: Size.square(widget.size + pad * 2),
        painter: _BubblePainter(
          colors: context.mmColors,
          state: widget.state,
          emphasis: widget.emphasis,
          origin: widget.inkOrigin,
          ink: _curved,
        ),
      ),
    );
    if (widget.semanticsLabel == null) return ExcludeSemantics(child: painted);
    return Semantics(label: widget.semanticsLabel, child: painted);
  }
}

class _BubblePainter extends CustomPainter {
  _BubblePainter({required this.colors, required this.state, required this.emphasis, required this.origin, required this.ink})
      : super(repaint: ink);

  final MmColors colors;
  final BubbleState state;
  final bool emphasis;
  final Offset origin;
  final Animation<double> ink;

  @override
  void paint(Canvas canvas, Size size) {
    final pad = emphasis ? 5.0 : 0.0;
    final r = size.shortestSide / 2 - pad;
    BubblePaint(colors).paint(canvas, size.center(Offset.zero), r, state, fill: ink.value, origin: origin, emphasis: emphasis);
  }

  @override
  bool shouldRepaint(_BubblePainter old) =>
      old.colors != colors || old.state != state || old.emphasis != emphasis || old.origin != origin || old.ink != ink;
}
