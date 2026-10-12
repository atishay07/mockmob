import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';

/// A small pile of paper cards, drawn with plain shapes. The pile is taller when more cards
/// are due (one, two or three layers), a quiet picture of the count and never a meter. The top
/// card carries a folded corner, the same notch Mobi's folded sheet has.
class CardStackMark extends StatelessWidget {
  const CardStackMark({super.key, required this.count, this.size = const Size(72, 64)});

  final int count;
  final Size size;

  int get layers => count <= 0 ? 1 : (count < 5 ? 2 : 3);

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return ExcludeSemantics(
      child: RepaintBoundary(
        child: CustomPaint(
          size: size,
          painter: _StackPainter(
            layers: layers,
            top: colors.raised,
            under: colors.raised2,
            edge: colors.lineStrong,
            notch: colors.sunken,
          ),
        ),
      ),
    );
  }
}

class _StackPainter extends CustomPainter {
  const _StackPainter({required this.layers, required this.top, required this.under, required this.edge, required this.notch});

  final int layers;
  final Color top;
  final Color under;
  final Color edge;
  final Color notch;

  static const double _lift = 7;
  static const double _radius = 10;

  @override
  void paint(Canvas canvas, Size size) {
    final stroke = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.25
      ..color = edge;
    final inset = (layers - 1) * _lift;
    final cardHeight = size.height - inset;
    // Back cards peek out above the top card, a little narrower each.
    for (var i = layers - 1; i >= 0; i--) {
      final shrink = i * 6.0;
      final rect = Rect.fromLTWH(shrink, inset - i * _lift, size.width - shrink * 2, cardHeight);
      final rrect = RRect.fromRectAndRadius(rect, const Radius.circular(_radius));
      canvas.drawRRect(rrect, Paint()..color = i == 0 ? top : under);
      canvas.drawRRect(rrect, stroke);
      if (i == 0) _foldedCorner(canvas, rect);
    }
  }

  void _foldedCorner(Canvas canvas, Rect r) {
    const n = 14.0;
    final path = Path()
      ..moveTo(r.right - n, r.top)
      ..lineTo(r.right, r.top + n)
      ..lineTo(r.right - n, r.top + n)
      ..close();
    canvas.drawPath(path, Paint()..color = notch);
    canvas.drawPath(
      path,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.25
        ..strokeJoin = StrokeJoin.round
        ..color = edge,
    );
  }

  @override
  bool shouldRepaint(_StackPainter old) =>
      old.layers != layers || old.top != top || old.under != under || old.edge != edge || old.notch != notch;
}
