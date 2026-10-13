import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../copy.dart';
import '../logic/sheet_cells.dart';

/// Where every cell of the track sits for a given width: the pitch comes from the real width,
/// never from a fixed number, so each cell of the paper always has a mark.
///
/// Bubbles are 10 dp across and at most 18 dp apart; as the paper grows or the phone narrows the
/// pitch tightens, and below [marksBelow] the strip switches to the timing marks of an OMR sheet.
class TrackGeometry {
  TrackGeometry({required this.count, required this.width}) {
    pitch = count <= 1 ? maxPitch : (maxPitch < (width - bubble) / (count - 1) ? maxPitch : (width - bubble) / (count - 1));
  }

  final int count;
  final double width;

  /// Bubble diameter.
  static const double bubble = 10;

  /// The widest a bubble slot gets: a 10 dp bubble and an 8 dp gap.
  static const double maxPitch = 18;

  /// Below this slot width, bubbles crowd; marks take over.
  static const double marksBelow = 12;

  /// Distance between bubble centres.
  late final double pitch;

  bool get marks => pitch < marksBelow;

  /// The painted width of one timing mark and the distance between mark centres.
  double get markWidth => (width / count * 0.42).clamp(2.5, 64.0);
  double get markStep => count == 1 ? 0 : (width - markWidth) / (count - 1);

  /// The centre of cell [i] along the strip.
  double centerX(int i) => marks ? i * markStep + markWidth / 2 : bubble / 2 + i * pitch;

  /// The slot a tap on cell [i] lands in: neighbours share edges, nothing overlaps.
  (double, double) slot(int i) {
    if (marks) {
      final step = width / count;
      return (i * step, (i + 1) * step);
    }
    final half = pitch / 2;
    return ((centerX(i) - half).clamp(0.0, width), (centerX(i) + half).clamp(0.0, width));
  }
}

/// Progress along the top of the paper, answered of total, instant, never volt (spec 5.5).
///
/// A short practice reads as a row of answer bubbles: answered ones inked in paper ink at 55%,
/// the current one ringed in paper white, the rest hairline rings. When the paper is long or the
/// phone narrow the bubbles give way to the timing marks along the edge of an OMR sheet, with the
/// current mark a taller paper-white bar.
///
/// The strip is a labelled control, not a picture: it reads "Question 3 of 20, answered", and a
/// tap on a bubble jumps there (a 44 dp tall hit box per cell). Timing marks are too fine to
/// tap, so on a long paper only TalkBack gets jump targets, for the few cells around the current
/// question; the Questions key holds the whole sheet.
class TimingTrack extends StatelessWidget {
  const TimingTrack({super.key, required this.cells, this.onJump});

  final List<SheetCell> cells;

  /// Zero-based index to go to; null makes the strip a plain, labelled indicator.
  final ValueChanged<int>? onJump;

  /// Height of the bubble strip: the touch height of one cell.
  static const double tappableHeight = 44;

  /// Height of the timing-mark strip: 4 dp of air above 14 dp of marks.
  static const double marksHeight = 18;

  /// Cells either side of the current one TalkBack can jump to on a long paper.
  static const int semanticsWindow = 3;

  /// The strip's height for a paper of [count] questions in [width].
  static double heightFor(int count, double width) => TrackGeometry(count: count, width: width).marks ? marksHeight : tappableHeight;

  @override
  Widget build(BuildContext context) {
    if (cells.isEmpty) return const SizedBox.shrink();
    return LayoutBuilder(
      builder: (context, box) {
        final geometry = TrackGeometry(count: cells.length, width: box.maxWidth.isFinite ? box.maxWidth : 328);
        final height = geometry.marks ? marksHeight : tappableHeight;
        final current = cells.indexWhere((c) => c.current);
        final at = current < 0 ? 0 : current;
        final label = RunnerCopy.trackSemantics(number: at + 1, total: cells.length, answered: cells[at].answered);
        final from = geometry.marks ? (at - semanticsWindow).clamp(0, cells.length - 1) : 0;
        final to = geometry.marks ? (at + semanticsWindow).clamp(0, cells.length - 1) : cells.length - 1;
        return Semantics(
          container: true,
          explicitChildNodes: true,
          label: label,
          child: SizedBox(
            height: height,
            width: double.infinity,
            child: Stack(
              children: [
                Positioned.fill(
                  child: ExcludeSemantics(
                    child: RepaintBoundary(
                      child: CustomPaint(
                        painter: _TrackPainter(cells: cells, colors: context.mmColors, geometry: geometry),
                      ),
                    ),
                  ),
                ),
                if (onJump != null)
                  for (var i = from; i <= to; i++) _cellTarget(i, geometry, touch: !geometry.marks),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _cellTarget(int i, TrackGeometry geometry, {required bool touch}) {
    final c = cells[i];
    final (start, end) = geometry.slot(i);
    return Positioned(
      key: ValueKey('track-cell-$i'),
      left: start,
      width: (end - start).clamp(1.0, geometry.width),
      top: 0,
      bottom: 0,
      child: Semantics(
        button: true,
        selected: c.current,
        label: RunnerCopy.cellSemantics(
          number: c.number,
          answered: c.answered,
          visited: c.visited,
          marked: c.marked,
          unsynced: c.unsynced,
          current: c.current,
        ),
        onTap: () => onJump!(i),
        child: touch
            ? GestureDetector(behavior: HitTestBehavior.opaque, onTap: c.current ? null : () => onJump!(i), child: const SizedBox.expand())
            : const SizedBox.expand(),
      ),
    );
  }
}

class _TrackPainter extends CustomPainter {
  const _TrackPainter({required this.cells, required this.colors, required this.geometry});

  final List<SheetCell> cells;
  final MmColors colors;
  final TrackGeometry geometry;

  @override
  void paint(Canvas canvas, Size size) {
    if (cells.isEmpty) return;
    geometry.marks ? _marks(canvas, size) : _bubbles(canvas, size);
  }

  void _bubbles(Canvas canvas, Size size) {
    const d = TrackGeometry.bubble;
    final mid = size.height / 2;
    // The current ring grows 2.5 dp, less when the slots are tight, so it never touches a neighbour.
    final grow = ((geometry.pitch - d) / 2).clamp(1.0, 2.5);
    for (var i = 0; i < cells.length; i++) {
      final c = cells[i];
      final center = Offset(geometry.centerX(i), mid);
      if (c.answered) canvas.drawCircle(center, d / 2, Paint()..color = colors.ink.withValues(alpha: 0.55));
      final ring = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = c.current ? 1.5 : 1
        ..color = c.current ? colors.ink : (c.answered ? colors.ink.withValues(alpha: 0) : colors.lineStrong);
      canvas.drawCircle(center, d / 2 - ring.strokeWidth / 2 + (c.current ? grow : 0), ring);
    }
  }

  void _marks(Canvas canvas, Size size) {
    final n = cells.length;
    final mark = geometry.markWidth;
    final mid = size.height - 7;
    for (var i = 0; i < n; i++) {
      final c = cells[i];
      final x = geometry.centerX(i);
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
  bool shouldRepaint(_TrackPainter old) => old.colors != colors || old.geometry.width != geometry.width || !_same(old.cells);

  bool _same(List<SheetCell> other) {
    if (other.length != cells.length) return false;
    for (var i = 0; i < cells.length; i++) {
      if (other[i] != cells[i]) return false;
    }
    return true;
  }
}
