import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../theme/theme.dart';
import 'bubble_painter.dart';

/// The answer sheet: one bubble per question in rows of [columns] (50 questions are 5 rows of
/// 10), each with its number above it, like the sheet in the exam hall.
///
/// [sealed] draws every bubble hollow and dim so nothing leaks before the sheet is opened.
/// [reveal] (0 to 1) inks the bubbles in question order for the result reveal; the bubble being
/// inked fills from its centre. [current] rings one question (the runner's palette).
///
/// The grid stretches its gaps to the width it is given, between [minGap] and [maxGap].
///
/// The numbers follow the student's text size up to [maxNumberScale] and the rows grow to fit
/// them; above it the numbers would run into their neighbours, so they are left out and the
/// sheet keeps its TalkBack summary.
class BubbleGrid extends StatelessWidget {
  const BubbleGrid({
    super.key,
    required this.states,
    this.columns = 10,
    this.bubbleSize = 18,
    this.minGap = 6,
    this.maxGap = 16,
    this.rowGap = 10,
    this.numbers = true,
    this.sealed = false,
    this.reveal,
    this.current,
    this.semanticsLabel,
  }) : assert(columns > 0);

  final List<BubbleState> states;
  final int columns;
  final double bubbleSize;
  final double minGap;
  final double maxGap;
  final double rowGap;
  final bool numbers;
  final bool sealed;
  final Animation<double>? reveal;
  final int? current;

  /// Overrides the generated summary.
  final String? semanticsLabel;

  static const double _numberHeight = 13;
  static const double _numberSize = 9.5;

  /// Above this text scale the numbers are hidden (TalkBack still reads the summary).
  static const double maxNumberScale = 1.3;

  int get _rows => (states.length / columns).ceil();

  /// The height of the number line under a row at the student's text size, or 0 when the numbers
  /// are left out ([numbers] false, or the text is above [maxNumberScale]).
  static double numberHeightFor(TextScaler scaler, {bool numbers = true}) {
    final scale = scaler.scale(_numberSize) / _numberSize;
    if (!numbers || scale > maxNumberScale) return 0;
    return (_numberHeight * (scale < 1 ? 1.0 : scale)).ceilToDouble();
  }

  /// The height of [rows] rows of [bubbleSize] bubbles with their number lines of [numberHeight]
  /// (0 for none), as the grid lays them out.
  static double heightFor({required int rows, required double bubbleSize, required double rowGap, required double numberHeight}) =>
      rows * (bubbleSize + (numberHeight > 0 ? numberHeight + 3 : 0)) + math.max(0, rows - 1) * rowGap;

  double _rowHeight(double numberHeight) => bubbleSize + (numberHeight > 0 ? numberHeight + 3 : 0);

  String _describe() {
    if (sealed) return 'Sealed answer sheet, ${states.length} questions';
    int count(BubbleState s) => states.where((e) => e == s).length;
    return [
      '${count(BubbleState.filled)} right',
      '${count(BubbleState.wrong)} wrong',
      '${count(BubbleState.blank) + count(BubbleState.hollow)} left blank',
      if (count(BubbleState.marked) > 0) '${count(BubbleState.marked)} marked',
    ].join(', ');
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final numberStyle = context.mmType.caption.copyWith(fontSize: _numberSize, height: 1, color: colors.ink3, fontWeight: FontWeight.w600);
    final scale = MediaQuery.textScalerOf(context).scale(_numberSize) / _numberSize;
    final numberHeight = numberHeightFor(MediaQuery.textScalerOf(context), numbers: numbers);
    final showNumbers = numberHeight > 0;
    final numberScale = scale < 1 ? 1.0 : scale;
    return Semantics(
      container: true,
      label: semanticsLabel ?? _describe(),
      excludeSemantics: true,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final cols = math.min(columns, math.max(states.length, 1));
          final natural = cols * bubbleSize + (cols - 1) * maxGap;
          final width = constraints.hasBoundedWidth ? math.min(constraints.maxWidth, natural) : natural;
          final gap = cols == 1 ? 0.0 : ((width - cols * bubbleSize) / (cols - 1)).clamp(minGap, maxGap);
          final height = _rows * _rowHeight(numberHeight) + math.max(0, _rows - 1) * rowGap;
          return RepaintBoundary(
            child: CustomPaint(
              size: Size(cols * bubbleSize + (cols - 1) * gap, height),
              painter: BubbleGridPainter(
                states: states,
                columns: columns,
                bubbleSize: bubbleSize,
                gap: gap,
                rowGap: rowGap,
                numberStyle: showNumbers ? numberStyle : null,
                numberHeight: numberHeight,
                textScaler: TextScaler.linear(numberScale),
                sealed: sealed,
                reveal: reveal,
                current: current,
                colors: colors,
              ),
            ),
          );
        },
      ),
    );
  }
}

class BubbleGridPainter extends CustomPainter {
  BubbleGridPainter({
    required this.states,
    required this.columns,
    required this.bubbleSize,
    required this.gap,
    required this.rowGap,
    required this.numberStyle,
    required this.sealed,
    required this.colors,
    this.reveal,
    this.current,
    this.numberHeight = BubbleGrid._numberHeight,
    this.textScaler = TextScaler.noScaling,
  }) : super(repaint: reveal);

  final List<BubbleState> states;
  final int columns;
  final double bubbleSize;
  final double gap;
  final double rowGap;
  final TextStyle? numberStyle;
  final bool sealed;
  final MmColors colors;
  final Animation<double>? reveal;
  final int? current;

  /// The height of the number line above each row of bubbles (already scaled).
  final double numberHeight;

  /// Scales the numbers with the student's text size.
  final TextScaler textScaler;

  final Map<int, TextPainter> _numbers = {};

  TextPainter _number(int n) => _numbers.putIfAbsent(
        n,
        () => TextPainter(
          text: TextSpan(text: '$n', style: numberStyle),
          textDirection: TextDirection.ltr,
          textScaler: textScaler,
        )..layout(),
      );

  @override
  void paint(Canvas canvas, Size size) {
    final bubbles = BubblePaint(colors);
    final r = bubbleSize / 2;
    final numberSpace = numberStyle == null ? 0.0 : numberHeight + 3;
    final progress = reveal?.value;
    final exact = progress == null ? double.infinity : progress * states.length;

    for (var i = 0; i < states.length; i++) {
      final col = i % columns;
      final row = i ~/ columns;
      final top = row * (bubbleSize + numberSpace + rowGap);
      final center = Offset(col * (bubbleSize + gap) + r, top + numberSpace + r);

      if (numberStyle != null) {
        final label = _number(i + 1);
        label.paint(canvas, Offset(center.dx - label.width / 2, top));
      }

      if (sealed) {
        bubbles.paint(canvas, center, r, BubbleState.hollow, dim: 0.55);
        continue;
      }
      final state = states[i];
      final fill = (exact - i).clamp(0.0, 1.0);
      if (fill <= 0) {
        bubbles.paint(canvas, center, r, BubbleState.hollow, emphasis: current == i);
      } else if (state == BubbleState.filled || state == BubbleState.wrong) {
        bubbles.paint(canvas, center, r, state, fill: fill, emphasis: current == i);
      } else {
        bubbles.paint(canvas, center, r, state, dim: fill, emphasis: current == i);
      }
    }
  }

  @override
  bool shouldRepaint(BubbleGridPainter old) =>
      old.colors != colors ||
      old.sealed != sealed ||
      old.columns != columns ||
      old.bubbleSize != bubbleSize ||
      old.gap != gap ||
      old.current != current ||
      old.reveal != reveal ||
      old.numberStyle != numberStyle ||
      old.numberHeight != numberHeight ||
      old.textScaler != textScaler ||
      !_same(old.states);

  bool _same(List<BubbleState> other) {
    if (identical(other, states)) return true;
    if (other.length != states.length) return false;
    for (var i = 0; i < states.length; i++) {
      if (other[i] != states[i]) return false;
    }
    return true;
  }
}
