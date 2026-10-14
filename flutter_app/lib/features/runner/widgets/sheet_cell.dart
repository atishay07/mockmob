import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../logic/sheet_cells.dart';
import 'answered_mark.dart';

/// Paints one palette bubble with its question number (spec 5.5): answered is the runner's one
/// answered disc (solid paper ink, see [AnsweredMark]), not answered an empty ring, not visited a
/// faint dashed ring on the sunken well, the current question carries an ink ring, a mark is a
/// small flag at the top right, and an answer still on this phone a hollow ink dot at the bottom
/// right. Each fact is a shape, never colour alone, and nothing here is volt.
class SheetCellPainter extends CustomPainter {
  SheetCellPainter({required this.cell, required this.colors, required this.numberStyle, this.ink = 1, this.ringed = false});

  final SheetCell cell;
  final MmColors colors;
  final TextStyle numberStyle;

  /// How far an answer given while the palette is open has inked in (0 to 1).
  final double ink;

  /// A legend filter matches this cell: an ink ring round it.
  final bool ringed;

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final r = math.min(size.width, size.height) / 2 - 5;
    final bubbles = BubblePaint(colors);

    if (cell.answered && ink < 1) {
      // Inking in: the empty ring under the disc as it fills.
      bubbles.paint(canvas, c, r, BubbleState.hollow, emphasis: cell.current);
      canvas.saveLayer(Offset.zero & size, Paint()..color = Color.fromRGBO(0, 0, 0, ink.clamp(0.0, 1.0)));
      AnsweredMark.paint(canvas, c, r, colors, emphasis: cell.current);
      canvas.restore();
    } else if (cell.answered) {
      AnsweredMark.paint(canvas, c, r, colors, emphasis: cell.current);
    } else if (cell.visited) {
      bubbles.paint(canvas, c, r, BubbleState.hollow, emphasis: cell.current);
    } else {
      canvas.drawCircle(c, r, Paint()..color = colors.sunken);
      bubbles.paint(canvas, c, r, BubbleState.blank, emphasis: cell.current);
    }

    final number = TextPainter(
      text: TextSpan(
        text: '${cell.number}',
        style: numberStyle.copyWith(
          color: cell.answered
              ? Color.lerp(colors.ink, AnsweredMark.numberColor(colors), ink.clamp(0.0, 1.0))
              : (cell.visited ? colors.ink : colors.ink2),
        ),
      ),
      textDirection: TextDirection.ltr,
      textScaler: TextScaler.noScaling,
    )..layout();
    number.paint(canvas, c - Offset(number.width / 2, number.height / 2));

    if (ringed) {
      canvas.drawCircle(
        c,
        r + 3.5,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.5
          ..color = colors.ink,
      );
    }
    if (cell.marked) _flag(canvas, c + Offset(r * 0.78, -r * 0.82));
    if (cell.unsynced) paintUnsyncedDot(canvas, c + Offset(r * 0.8, r * 0.8), colors);
  }

  /// A small flag on a ground-coloured disc so it reads over any bubble.
  void _flag(Canvas canvas, Offset at) {
    canvas.drawCircle(at, 8, Paint()..color = colors.raised);
    canvas.drawCircle(
      at,
      8,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..color = colors.line,
    );
    final pole = Paint()
      ..color = colors.ink
      ..strokeWidth = 1.4
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(at + const Offset(-2.6, -4.2), at + const Offset(-2.6, 4.4), pole);
    final cloth = Path()
      ..moveTo(at.dx - 2.6, at.dy - 4.2)
      ..lineTo(at.dx + 4, at.dy - 2.4)
      ..lineTo(at.dx - 2.6, at.dy + 0.8)
      ..close();
    canvas.drawPath(cloth, Paint()..color = colors.ink);
  }

  /// The unsynced mark: a hollow ink dot on a ground-coloured disc, so it reads over the ink
  /// bubble it sits on. (The legend draws the same dot.)
  static void paintUnsyncedDot(Canvas canvas, Offset at, MmColors colors) {
    canvas.drawCircle(at, 5.5, Paint()..color = colors.ground);
    canvas.drawCircle(
      at,
      3,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5
        ..color = colors.ink,
    );
  }

  @override
  bool shouldRepaint(SheetCellPainter old) =>
      old.cell != cell || old.colors != colors || old.numberStyle != numberStyle || old.ink != ink || old.ringed != ringed;
}

/// A 48 dp palette cell. Tapping it goes to that question. It sinks on the press spring under the
/// finger, carries a ring while a legend filter matches it, and an answer that arrives while the
/// palette is open inks in over 160 ms.
class SheetCellKey extends StatefulWidget {
  const SheetCellKey({super.key, required this.cell, required this.onTap, this.ringed = false});

  final SheetCell cell;
  final VoidCallback onTap;
  final bool ringed;

  /// An answer inking in while the palette is open.
  static const Duration inkIn = Duration(milliseconds: 160);

  @override
  State<SheetCellKey> createState() => _SheetCellKeyState();
}

class _SheetCellKeyState extends State<SheetCellKey> with SingleTickerProviderStateMixin {
  late final AnimationController _ink = AnimationController(vsync: this, duration: SheetCellKey.inkIn, value: 1);

  @override
  void didUpdateWidget(SheetCellKey old) {
    super.didUpdateWidget(old);
    if (widget.cell.answered && !old.cell.answered && !Motion.reduced(context)) _ink.forward(from: 0);
  }

  @override
  void dispose() {
    _ink.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final style = context.mmType.label.copyWith(fontSize: 14, height: 1, fontWeight: FontWeight.w700);
    final cell = widget.cell;
    return MmPressable(
      onTap: widget.onTap,
      lift: false,
      selected: cell.current,
      focusRadius: BorderRadius.circular(26),
      semanticsLabel: RunnerCopy.cellSemantics(
        number: cell.number,
        answered: cell.answered,
        visited: cell.visited,
        marked: cell.marked,
        unsynced: cell.unsynced,
        current: cell.current,
      ),
      builder: (context, pressed, focused) => SizedBox(
        height: 52,
        child: AnimatedBuilder(
          animation: _ink,
          builder: (context, _) => CustomPaint(
            painter: SheetCellPainter(cell: cell, colors: colors, numberStyle: style, ink: _ink.value, ringed: widget.ringed),
          ),
        ),
      ),
    );
  }
}
