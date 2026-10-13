import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../logic/sheet_cells.dart';

/// Progress as the timing marks along the edge of an OMR sheet: one short bar per question,
/// ink when answered, a faint hairline when not, and a taller bar at the current question.
/// Answered of total, instant, never volt (spec 5.5).
class TimingTrack extends StatelessWidget {
  const TimingTrack({super.key, required this.cells});

  final List<SheetCell> cells;

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: RepaintBoundary(
        child: CustomPaint(
          size: const Size(double.infinity, 14),
          painter: _TrackPainter(cells: cells, colors: context.mmColors),
        ),
      ),
    );
  }
}

class _TrackPainter extends CustomPainter {
  const _TrackPainter({required this.cells, required this.colors});

  final List<SheetCell> cells;
  final MmColors colors;

  @override
  void paint(Canvas canvas, Size size) {
    final n = cells.length;
    if (n == 0) return;
    final mark = (size.width / n * 0.42).clamp(2.5, 64.0);
    final step = n == 1 ? 0.0 : (size.width - mark) / (n - 1);
    final mid = size.height / 2;
    for (var i = 0; i < n; i++) {
      final c = cells[i];
      final x = i * step + mark / 2;
      final h = c.current ? size.height : (c.answered ? 8.0 : 6.0);
      final color = c.current
          ? colors.ink
          : c.answered
          ? colors.ink2
          : colors.lineStrong;
      canvas.drawRRect(
        RRect.fromRectAndRadius(Rect.fromCenter(center: Offset(x, mid), width: mark, height: h), Radius.circular(mark / 2)),
        Paint()..color = color,
      );
    }
  }

  @override
  bool shouldRepaint(_TrackPainter old) => old.colors != colors || !_same(old.cells);

  bool _same(List<SheetCell> other) {
    if (other.length != cells.length) return false;
    for (var i = 0; i < cells.length; i++) {
      if (other[i] != cells[i]) return false;
    }
    return true;
  }
}
