import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../logic/sheet_cells.dart';
import 'runner_motion.dart';

/// What the sheet on the submit page is showing (runner.md 5).
enum SheetPhase {
  /// The answers as the student has them, on their phone, in the runner's one answered ink. Calm.
  review,

  /// The call is in flight: a band of lamp light passes over the sheet again and again. It never
  /// shows a percentage, because nothing real backs one.
  sending,

  /// The server has the sheet: the bubbles ink volt in question order. The truth is the
  /// metaphor: paper-ink until the server holds it, volt once it does.
  inked,

  /// Not recorded (pending, closed, rejected): the pencil marks, with no light.
  held,
}

/// The whole answer sheet drawn in code (ten columns, numbers above each row, like the sheet in
/// the exam hall) for the submit page. Answered questions are the runner's answered disc (solid
/// paper ink, as on the track and the palette), unanswered ones dashed rings, marked ones a ringed dot; [SheetPhase.sending] sweeps a lamp band over it and
/// [SheetPhase.inked] inks the answered bubbles volt, left to right, row by row.
class AnswerSheetView extends StatefulWidget {
  const AnswerSheetView({super.key, required this.cells, required this.phase, this.bubbleSize = 17, this.semanticsLabel, this.animateInk = true});

  final List<SheetCell> cells;
  final SheetPhase phase;
  final double bubbleSize;
  final String? semanticsLabel;

  /// False shows the inked sheet at once (the Celebrations setting is Off): the same fact, in its
  /// end state, with no ink travelling across it.
  final bool animateInk;

  static const int columns = 10;
  static const double minGap = 6;
  static const double maxGap = 20;
  static const double rowGap = 10;

  @override
  State<AnswerSheetView> createState() => _AnswerSheetViewState();
}

class _AnswerSheetViewState extends State<AnswerSheetView> with TickerProviderStateMixin {
  late final AnimationController _ink = AnimationController(vsync: this, duration: RunnerMotion.inkInOrder);
  late final AnimationController _scan = AnimationController(vsync: this, duration: RunnerMotion.scan);
  bool _firstDependencies = true;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_firstDependencies) {
      _firstDependencies = false;
      _apply(widget.phase, first: true);
    }
  }

  @override
  void didUpdateWidget(AnswerSheetView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.phase != widget.phase) _apply(widget.phase, first: false);
  }

  void _apply(SheetPhase phase, {required bool first}) {
    final reduced = RunnerMotion.reduced(context);
    switch (phase) {
      case SheetPhase.sending:
        _ink.value = 0;
        if (!reduced) _scan.repeat();
      case SheetPhase.inked:
        _scan.stop();
        _scan.value = 0;
        if (reduced || !widget.animateInk) {
          _ink.value = 1;
        } else {
          _ink.forward(from: 0);
        }
      case SheetPhase.review || SheetPhase.held:
        _scan.stop();
        _scan.value = 0;
        _ink.value = 0;
    }
  }

  @override
  void dispose() {
    _ink.dispose();
    _scan.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final scaler = MediaQuery.textScalerOf(context);
    final numberHeight = BubbleGrid.numberHeightFor(scaler);
    final scale = scaler.scale(9.5) / 9.5;
    final style = context.mmType.caption.copyWith(fontSize: 9.5, height: 1, color: colors.ink3, fontWeight: FontWeight.w600);
    final cells = widget.cells;
    final rows = (cells.length / AnswerSheetView.columns).ceil();
    final rowHeight = widget.bubbleSize + (numberHeight > 0 ? numberHeight + 3 : 0);
    final height = rows * rowHeight + math.max(0, rows - 1) * AnswerSheetView.rowGap;
    return Semantics(
      container: true,
      label: widget.semanticsLabel,
      excludeSemantics: true,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final cols = math.min(AnswerSheetView.columns, math.max(cells.length, 1));
          final natural = cols * widget.bubbleSize + (cols - 1) * AnswerSheetView.maxGap;
          final width = constraints.hasBoundedWidth ? math.min(constraints.maxWidth, natural) : natural;
          final gap = cols == 1 ? 0.0 : ((width - cols * widget.bubbleSize) / (cols - 1)).clamp(AnswerSheetView.minGap, AnswerSheetView.maxGap);
          return RepaintBoundary(
            child: CustomPaint(
              size: Size(cols * widget.bubbleSize + (cols - 1) * gap, height),
              painter: _SheetPainter(
                cells: cells,
                colors: colors,
                bubbleSize: widget.bubbleSize,
                gap: gap,
                numberStyle: numberHeight > 0 ? style : null,
                numberHeight: numberHeight,
                textScaler: TextScaler.linear(scale < 1 ? 1.0 : scale),
                ink: _ink,
                scan: _scan,
                phase: widget.phase,
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
    required this.cells,
    required this.colors,
    required this.bubbleSize,
    required this.gap,
    required this.numberStyle,
    required this.numberHeight,
    required this.textScaler,
    required this.ink,
    required this.scan,
    required this.phase,
  }) : super(repaint: Listenable.merge([ink, scan]));

  final List<SheetCell> cells;
  final MmColors colors;
  final double bubbleSize;
  final double gap;
  final TextStyle? numberStyle;
  final double numberHeight;
  final TextScaler textScaler;
  final Animation<double> ink;
  final Animation<double> scan;
  final SheetPhase phase;

  final Map<int, TextPainter> _numbers = {};

  TextPainter _number(int n) => _numbers.putIfAbsent(
    n,
    () => TextPainter(text: TextSpan(text: '$n', style: numberStyle), textDirection: TextDirection.ltr, textScaler: textScaler)..layout(),
  );

  @override
  void paint(Canvas canvas, Size size) {
    final bubbles = BubblePaint(colors);
    final r = bubbleSize / 2;
    final numberSpace = numberStyle == null ? 0.0 : numberHeight + 3;
    final inking = phase == SheetPhase.inked;
    // The eased 0..1 position of the ink front, in cells: the wave runs across the whole sheet.
    final exact = inking ? Curves.easeInOut.transform(ink.value) * (cells.length + 1) : -1.0;
    final pencilColor = colors.ink;
    final pencil = Paint()..color = pencilColor;
    // While sending, a band of warm light travels the sheet and each answered bubble warms as it
    // passes (no hard-edged panel over the paper: the light lives in the marks themselves).
    final bandX = phase == SheetPhase.sending ? _bandCentre(size) : double.nan;

    for (var i = 0; i < cells.length; i++) {
      final c = cells[i];
      final col = i % AnswerSheetView.columns;
      final row = i ~/ AnswerSheetView.columns;
      final top = row * (bubbleSize + numberSpace + AnswerSheetView.rowGap);
      final center = Offset(col * (bubbleSize + gap) + r, top + numberSpace + r);
      if (numberStyle != null) {
        final label = _number(i + 1);
        label.paint(canvas, Offset(center.dx - label.width / 2, top));
      }
      if (c.answered) {
        final lit = bandX.isNaN ? 0.0 : _lit(center.dx, bandX);
        if (lit > 0) {
          canvas.drawCircle(center, r + 4 * lit, Paint()..color = colors.lamp.withValues(alpha: 0.14 * lit));
          canvas.drawCircle(center, r - 0.5 + 0.8 * lit, Paint()..color = Color.lerp(pencilColor, colors.lamp, lit * 0.75)!);
        } else {
          canvas.drawCircle(center, r - 0.5, pencil);
        }
        if (inking) {
          final fill = (exact - i).clamp(0.0, 1.0);
          if (fill > 0) bubbles.paint(canvas, center, r, BubbleState.filled, fill: fill);
        }
        if (c.marked) {
          canvas.drawCircle(
            center,
            r + 2.6,
            Paint()
              ..style = PaintingStyle.stroke
              ..strokeWidth = 1.2
              ..color = colors.ink2,
          );
        }
      } else {
        bubbles.paint(canvas, center, r, c.marked ? BubbleState.marked : BubbleState.blank);
      }
    }
  }

  /// How far the lamp band's centre has travelled: in from the left edge, out past the right.
  double _bandCentre(Size size) => -_band + (size.width + 2 * _band) * Curves.easeInOut.transform(scan.value);

  static const double _band = 70;

  /// 0 to 1: how strongly the band lights something at [x] (a smooth bell, so no hard edge).
  double _lit(double x, double centre) {
    final d = ((x - centre).abs() / _band).clamp(0.0, 1.0);
    final t = 1 - d;
    return t * t * (3 - 2 * t);
  }

  @override
  bool shouldRepaint(_SheetPainter old) =>
      old.colors != colors ||
      old.phase != phase ||
      old.bubbleSize != bubbleSize ||
      old.gap != gap ||
      old.numberStyle != numberStyle ||
      old.numberHeight != numberHeight ||
      old.textScaler != textScaler ||
      !_same(old.cells);

  bool _same(List<SheetCell> other) {
    if (other.length != cells.length) return false;
    for (var i = 0; i < cells.length; i++) {
      if (other[i] != cells[i]) return false;
    }
    return true;
  }
}
