import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../logic/sheet_cells.dart';
import 'nta_copy.dart';
import 'nta_skin.dart';

/// The five exam palette states, in the precedence of the website's `chipStateFor`.
enum NtaChipState {
  answered(NtaCopy.answered),
  notAnswered(NtaCopy.notAnswered),
  notVisited(NtaCopy.notVisited),
  marked(NtaCopy.marked),
  answeredMarked(NtaCopy.answeredMarked);

  const NtaChipState(this.label);

  final String label;

  static NtaChipState of(SheetCell c) {
    if (c.marked && c.answered) return answeredMarked;
    if (c.marked) return marked;
    if (c.answered) return answered;
    if (c.visited) return notAnswered;
    return notVisited;
  }
}

/// Exclusive counts per state, the way the exam's legend shows them: they always add up to the
/// total. Pending is every question without an answer.
class NtaCounts {
  const NtaCounts(this.byState, this.total);

  factory NtaCounts.of(List<SheetCell> cells) {
    final by = {for (final s in NtaChipState.values) s: 0};
    for (final c in cells) {
      final s = NtaChipState.of(c);
      by[s] = by[s]! + 1;
    }
    return NtaCounts(by, cells.length);
  }

  final Map<NtaChipState, int> byState;
  final int total;

  int operator [](NtaChipState s) => byState[s] ?? 0;

  /// Questions with an answer, marked or not.
  int get answeredAll => this[NtaChipState.answered] + this[NtaChipState.answeredMarked];
  int get pending => total - answeredAll;
  int get markedAll => this[NtaChipState.marked] + this[NtaChipState.answeredMarked];
}

/// One exam chip with its number (or a count) drawn in: the grey tile, the orange and green
/// tilted pentagons, the purple circle and the purple circle with the green dot. Shapes differ as
/// well as colours, so the palette still reads in grayscale.
class NtaChip extends StatelessWidget {
  const NtaChip({super.key, required this.state, required this.label, this.current = false, this.size = const Size(44, 40), this.fontSize = 14});

  final NtaChipState state;
  final String label;
  final bool current;
  final Size size;
  final double fontSize;

  @override
  Widget build(BuildContext context) {
    final skin = NtaSkin.of(context);
    final circle = state == NtaChipState.marked || state == NtaChipState.answeredMarked;
    final textColor = state == NtaChipState.notVisited ? NtaSkin.notVisitedText : NtaSkin.onBar;
    return CustomPaint(
      size: size,
      painter: NtaChipPainter(state: state, current: current, ring: skin.currentRing),
      child: SizedBox.fromSize(
        size: size,
        child: Padding(
          // The pentagon narrows to the right; nudge the figure into its optical middle.
          padding: EdgeInsets.only(right: circle ? 0 : size.width * 0.04),
          child: Center(
            child: Text(
              label,
              textScaler: TextScaler.noScaling,
              maxLines: 1,
              style: TextStyle(
                fontFamily: MmFonts.hanken,
                fontSize: fontSize,
                height: 1,
                fontWeight: FontWeight.w700,
                color: textColor,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class NtaChipPainter extends CustomPainter {
  const NtaChipPainter({required this.state, required this.current, required this.ring});

  final NtaChipState state;
  final bool current;
  final Color ring;

  /// The exam's `polygon(0 0, 100% 12%, 100% 88%, 0 100%)`.
  static Path pentagon(Rect r) => Path()
    ..moveTo(r.left, r.top)
    ..lineTo(r.right, r.top + r.height * 0.12)
    ..lineTo(r.right, r.bottom - r.height * 0.12)
    ..lineTo(r.left, r.bottom)
    ..close();

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final edge = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    switch (state) {
      case NtaChipState.notVisited:
        final rr = RRect.fromRectAndRadius(rect.deflate(0.5), const Radius.circular(4));
        canvas.drawRRect(
          rr,
          Paint()
            ..shader = const LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [NtaSkin.notVisitedTop, NtaSkin.notVisitedBottom],
            ).createShader(rect),
        );
        canvas.drawRRect(rr, edge..color = NtaSkin.notVisitedEdge);
        if (current) _ring(canvas, Path()..addRRect(rr.inflate(3)));
      case NtaChipState.notAnswered || NtaChipState.answered:
        final fill = state == NtaChipState.answered ? NtaSkin.answered : NtaSkin.notAnswered;
        final line = state == NtaChipState.answered ? NtaSkin.answeredEdge : NtaSkin.notAnsweredEdge;
        final p = pentagon(rect.deflate(0.5));
        canvas.drawPath(p, Paint()..color = fill);
        canvas.drawPath(p, edge..color = line);
        if (current) _ring(canvas, pentagon(rect.inflate(3)));
      case NtaChipState.marked || NtaChipState.answeredMarked:
        final c = rect.center;
        final r = size.shortestSide / 2 - 0.5;
        canvas.drawCircle(
          c,
          r,
          Paint()
            ..shader = const RadialGradient(
              center: Alignment(-0.3, -0.5),
              radius: 0.7,
              colors: [NtaSkin.markedLight, NtaSkin.markedDeep],
            ).createShader(Rect.fromCircle(center: c, radius: r)),
        );
        canvas.drawCircle(c, r, edge..color = NtaSkin.markedEdge);
        if (state == NtaChipState.answeredMarked) {
          final dotR = (size.shortestSide * 0.13).clamp(3.0, 5.0);
          final at = c + Offset(r * 0.68, r * 0.68);
          canvas.drawCircle(at, dotR + 1, Paint()..color = const Color(0xA6000000));
          canvas.drawCircle(at, dotR, Paint()..color = NtaSkin.markedDot);
        }
        if (current) _ring(canvas, Path()..addOval(Rect.fromCircle(center: c, radius: r + 3)));
    }
  }

  void _ring(Canvas canvas, Path p) => canvas.drawPath(
    p,
    Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..color = ring,
  );

  @override
  bool shouldRepaint(NtaChipPainter old) => old.state != state || old.current != current || old.ring != ring;
}
