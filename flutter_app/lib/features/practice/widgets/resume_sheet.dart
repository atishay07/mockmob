import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';

/// The resume card's answer sheet, painted: one small bubble for every question of the open
/// session, in the paper's order, with the ones the student has answered inked volt. The first
/// time the answers are known they ink in order, left to right (about 0.9 s at most); after that
/// the sheet is simply there. Only real answers ink: [answered] comes from the session's own
/// journal, and a question with no answer stays an empty ring. No text: the card says the number.
/// Under reduced motion it shows the final sheet at once. Decorative to TalkBack (the card's
/// figure says "12 of 50 answered").
class ResumeSheet extends StatefulWidget {
  const ResumeSheet({super.key, required this.total, required this.answered});

  /// How many questions the session has.
  final int total;

  /// Per question, in order: answered or not. Null while the journal has not been read: the
  /// sheet shows empty rings and keeps its height.
  final List<bool>? answered;

  /// The most rows the sheet takes, so a 50-question mock stays a strip, not a block.
  static const int maxRows = 3;
  static const double bubble = 9;
  static const double gap = 5;

  /// The columns that fit [width], and the rows [total] needs at that many columns (pure).
  static (int columns, int rows) gridFor(int total, double width) {
    if (total <= 0) return (0, 0);
    final fit = math.max(1, ((width + gap) / (bubble + gap)).floor());
    final columns = math.min(total, fit);
    return (columns, math.min((total / columns).ceil(), maxRows));
  }

  /// How many bubbles show at [width]: all, or what [maxRows] rows of the strip hold.
  static int shownAt(int total, double width) {
    final (c, r) = gridFor(total, width);
    return math.min(total, c * r);
  }

  /// The time (0..1) at which the [rank]-th inked bubble of [count] starts inking (pure).
  static double startOf(int rank, int count) => count <= 1 ? 0 : 0.7 * rank / (count - 1);

  @override
  State<ResumeSheet> createState() => _ResumeSheetState();
}

class _ResumeSheetState extends State<ResumeSheet> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this);
  bool _played = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _maybePlay();
  }

  @override
  void didUpdateWidget(ResumeSheet old) {
    super.didUpdateWidget(old);
    _maybePlay();
  }

  void _maybePlay() {
    final a = widget.answered;
    if (_played || a == null) return;
    final inked = a.where((v) => v).length;
    // Nothing is inked yet: the sheet is just its rings, and answers that arrive later (the
    // student comes back from the paper) still ink in order.
    if (inked == 0) {
      _c.value = 1;
      return;
    }
    _played = true;
    if (Motion.reduced(context)) {
      _c.value = 1;
      return;
    }
    _c.duration = Duration(milliseconds: math.min(900, 360 + inked * 16));
    _c.forward(from: 0);
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return ExcludeSemantics(
      child: LayoutBuilder(
        builder: (context, box) {
          final (columns, rows) = ResumeSheet.gridFor(widget.total, box.maxWidth);
          if (columns == 0) return const SizedBox.shrink();
          final height = rows * ResumeSheet.bubble + (rows - 1) * ResumeSheet.gap;
          return SizedBox(
            height: height,
            width: double.infinity,
            child: RepaintBoundary(
              child: CustomPaint(
                painter: _SheetPainter(
                  progress: _c,
                  answered: widget.answered,
                  total: widget.total,
                  columns: columns,
                  rows: rows,
                  ring: colors.lineStrong,
                  ink: colors.volt,
                  edge: colors.voltEdge,
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _SheetPainter extends CustomPainter {
  _SheetPainter({
    required this.progress,
    required this.answered,
    required this.total,
    required this.columns,
    required this.rows,
    required this.ring,
    required this.ink,
    required this.edge,
  }) : super(repaint: progress);

  final Animation<double> progress;
  final List<bool>? answered;
  final int total;
  final int columns;
  final int rows;
  final Color ring;
  final Color ink;
  final Color edge;

  @override
  void paint(Canvas canvas, Size size) {
    const d = ResumeSheet.bubble;
    const gap = ResumeSheet.gap;
    final shown = math.min(total, columns * rows);
    final flags = answered;
    final inkedCount = flags == null ? 0 : flags.take(shown).where((v) => v).length;
    final stroke = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2
      ..color = ring;
    final fill = Paint()..color = ink;
    final rim = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1
      ..color = edge;
    var rank = 0;
    for (var i = 0; i < shown; i++) {
      final cx = (i % columns) * (d + gap) + d / 2;
      final cy = (i ~/ columns) * (d + gap) + d / 2;
      final c = Offset(cx, cy);
      canvas.drawCircle(c, d / 2 - 0.6, stroke);
      if (flags != null && i < flags.length && flags[i]) {
        final start = ResumeSheet.startOf(rank++, inkedCount);
        final t = ((progress.value - start) / 0.3).clamp(0.0, 1.0);
        if (t > 0) {
          final r = (d / 2) * Curves.easeOutBack.transform(t).clamp(0.0, 1.15);
          canvas.drawCircle(c, r, fill);
          if (t >= 1) canvas.drawCircle(c, d / 2 - 0.5, rim);
        }
      }
    }
  }

  @override
  bool shouldRepaint(_SheetPainter old) =>
      old.answered != answered || old.total != total || old.columns != columns || old.rows != rows || old.ring != ring || old.ink != ink;
}
