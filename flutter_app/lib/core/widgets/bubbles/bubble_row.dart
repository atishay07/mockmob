import 'package:flutter/material.dart';

import '../../theme/theme.dart';
import 'bubble_painter.dart';

/// A compact row of bubbles: a past mock on Today ("Your sheet"), a progress line, an option's
/// A to D row. Painted in one pass; give it a [semanticsLabel] that says what it means.
class BubbleRow extends StatelessWidget {
  const BubbleRow({
    super.key,
    required this.states,
    this.bubbleSize = 12,
    this.gap = 4,
    this.emphasis,
    this.semanticsLabel,
  });

  final List<BubbleState> states;
  final double bubbleSize;
  final double gap;

  /// Index of a bubble to ring.
  final int? emphasis;
  final String? semanticsLabel;

  Size get size => Size(states.isEmpty ? 0 : states.length * bubbleSize + (states.length - 1) * gap, bubbleSize);

  @override
  Widget build(BuildContext context) {
    final painted = RepaintBoundary(
      child: CustomPaint(
        size: size,
        painter: _BubbleRowPainter(states: states, size: bubbleSize, gap: gap, emphasis: emphasis, colors: context.mmColors),
      ),
    );
    // In a bounded slot (a Flexible or Expanded beside a label that grew with large text) the row
    // scales down to fit, bubbles and gaps together, instead of running into the screen edge. In
    // an unbounded slot it keeps its own size.
    final fitted = FittedBox(fit: BoxFit.scaleDown, alignment: AlignmentDirectional.centerStart, child: painted);
    if (semanticsLabel == null) return ExcludeSemantics(child: fitted);
    return Semantics(container: true, label: semanticsLabel, excludeSemantics: true, child: fitted);
  }
}

class _BubbleRowPainter extends CustomPainter {
  _BubbleRowPainter({required this.states, required this.size, required this.gap, required this.colors, this.emphasis});

  final List<BubbleState> states;
  final double size;
  final double gap;
  final MmColors colors;
  final int? emphasis;

  @override
  void paint(Canvas canvas, Size canvasSize) {
    final paint = BubblePaint(colors);
    final r = size / 2;
    for (var i = 0; i < states.length; i++) {
      paint.paint(canvas, Offset(r + i * (size + gap), r), r, states[i], emphasis: emphasis == i);
    }
  }

  @override
  bool shouldRepaint(_BubbleRowPainter old) =>
      old.colors != colors || old.size != size || old.gap != gap || old.emphasis != emphasis || !_listEquals(old.states, states);

  static bool _listEquals(List<BubbleState> a, List<BubbleState> b) {
    if (a.length != b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (a[i] != b[i]) return false;
    }
    return true;
  }
}
