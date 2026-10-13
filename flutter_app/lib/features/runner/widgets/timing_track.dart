import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../logic/sheet_cells.dart';

/// Progress along the top of the paper, answered of total, instant, never volt (spec 5.5).
///
/// A short practice reads as a row of answer bubbles (10 dp, 8 dp apart): answered ones inked
/// in paper ink at 55%, the current one ringed in paper white, the rest hairline rings. A mock's
/// 50 questions read as the timing marks along the edge of an OMR sheet, with the current mark
/// a taller paper-white bar.
class TimingTrack extends StatelessWidget {
  const TimingTrack({super.key, required this.cells});

  final List<SheetCell> cells;

  /// Up to this many questions draw as bubbles; more draw as timing marks.
  static const int bubbleLimit = 20;

  @override
  Widget build(BuildContext context) {
    final bubbles = cells.length <= bubbleLimit;
    return ExcludeSemantics(
      child: RepaintBoundary(
        child: CustomPaint(
          size: Size(double.infinity, bubbles ? 16 : 14),
          painter: _TrackPainter(cells: cells, colors: context.mmColors, bubbles: bubbles),
        ),
      ),
    );
  }
}

class _TrackPainter extends CustomPainter {
  const _TrackPainter({required this.cells, required this.colors, required this.bubbles});

  final List<SheetCell> cells;
  final MmColors colors;
  final bool bubbles;

  @override
  void paint(Canvas canvas, Size size) {
    if (cells.isEmpty) return;
    bubbles ? _bubbles(canvas, size) : _marks(canvas, size);
  }

  void _bubbles(Canvas canvas, Size size) {
    const d = 10.0, gap = 8.0;
    final mid = size.height / 2;
    for (var i = 0; i < cells.length; i++) {
      final c = cells[i];
      final center = Offset(d / 2 + i * (d + gap), mid);
      if (center.dx + d / 2 > size.width) break;
      if (c.answered) canvas.drawCircle(center, d / 2, Paint()..color = colors.ink.withValues(alpha: 0.55));
      final ring = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = c.current ? 1.5 : 1
        ..color = c.current ? colors.ink : (c.answered ? colors.ink.withValues(alpha: 0) : colors.lineStrong);
      canvas.drawCircle(center, d / 2 - ring.strokeWidth / 2 + (c.current ? 2.5 : 0), ring);
    }
  }

  void _marks(Canvas canvas, Size size) {
    final n = cells.length;
    final mark = (size.width / n * 0.42).clamp(2.5, 64.0);
    final step = n == 1 ? 0.0 : (size.width - mark) / (n - 1);
    final mid = size.height / 2;
    for (var i = 0; i < n; i++) {
      final c = cells[i];
      final x = i * step + mark / 2;
      final w = c.current ? 3.0 : mark;
      final h = c.current ? 12.0 : (c.answered ? 8.0 : 6.0);
      final color = c.current
          ? colors.ink
          : c.answered
          ? colors.ink2
          : colors.lineStrong;
      canvas.drawRRect(
        RRect.fromRectAndRadius(Rect.fromCenter(center: Offset(x, mid), width: w, height: h), Radius.circular(w / 2)),
        Paint()..color = color,
      );
    }
  }

  @override
  bool shouldRepaint(_TrackPainter old) => old.colors != colors || old.bubbles != bubbles || !_same(old.cells);

  bool _same(List<SheetCell> other) {
    if (other.length != cells.length) return false;
    for (var i = 0; i < cells.length; i++) {
      if (other[i] != cells[i]) return false;
    }
    return true;
  }
}
