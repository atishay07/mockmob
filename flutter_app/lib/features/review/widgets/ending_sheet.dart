import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/models/attempt.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';

/// One bubble of the handed-back sheet on the repair ending.
enum SheetCell { right, wrong, blank, repaired, repairedNow }

/// The cells of [attempt] in question order. [repairedNow] are the questions this run repaired
/// (they ink during the ending); [repairedBefore] were repaired on an earlier night.
List<SheetCell> sheetCells(Attempt attempt, {required Set<String> repairedNow, required Set<String> repairedBefore}) => [
  for (final q in attempt.questions)
    switch (attempt.detailFor(q.id)) {
      null => SheetCell.blank,
      final d when d.isBlank => SheetCell.blank,
      final d when d.isCorrect == true => SheetCell.right,
      _ when repairedNow.contains(q.id) => SheetCell.repairedNow,
      _ when repairedBefore.contains(q.id) => SheetCell.repaired,
      _ => SheetCell.wrong,
    },
];

/// The student's own answer sheet, handed back on charcoal paper under the desk lamp: every
/// answer as a bubble, and the mistakes repaired tonight gaining their ring one after another
/// as [progress] runs (the signature mark of a repair). A first repair carries the brass token.
/// No sweep crosses it: the ending has one light event, the burst behind the number.
class EndingSheet extends StatelessWidget {
  const EndingSheet({super.key, required this.title, required this.cells, required this.progress, this.firstRepair = false});

  final String title;
  final List<SheetCell> cells;
  final Animation<double> progress;
  final bool firstRepair;

  /// A full paper is ten bubbles to a row. A short one (a 10-question practice) is two rows of
  /// five, drawn larger, so the sheet is a real object and not a thin strip in a hollow screen.
  static _Grid gridFor(int cells) => cells <= 10 ? const _Grid(5, 40, 12) : const _Grid(10, 22, 8);

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final grid = gridFor(cells.length);
    final rows = (cells.length / grid.columns).ceil();
    final cols = math.min(grid.columns, math.max(cells.length, 1));
    final repairedNow = cells.where((c) => c == SheetCell.repairedNow).length;

    final sheet = MmClip(
      borderRadius: MmRadius.panelAll,
      child: Stack(
        children: [
          Positioned.fill(child: ColoredBox(color: colors.raised)),
          // The lamp catching the sheet from the upper left.
          const Positioned.fill(child: LampScene(strength: 0.9)),
          Positioned.fill(child: Grain(opacity: colors.grain)),
          Padding(
            padding: const EdgeInsets.all(MmSpace.s16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: type.caption.copyWith(color: colors.ink2)),
                const SizedBox(height: MmSpace.s16),
                Center(
                  child: Semantics(
                    label: 'Answer sheet. $repairedNow repaired just now.',
                    child: RepaintBoundary(
                      child: CustomPaint(
                        size: Size(cols * grid.cell + (cols - 1) * grid.gap, rows * grid.cell + (rows - 1) * grid.gap),
                        painter: _SheetPainter(cells: cells, grid: grid, colors: colors, progress: progress),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );

    return Stack(
      clipBehavior: Clip.none,
      children: [
        DecoratedBox(
          decoration: ShapeDecoration(
            shape: mmShapeBorder(MmRadius.panelAll, side: BorderSide(color: colors.line)),
            shadows: colors.cardShadow,
          ),
          child: sheet,
        ),
        // The first-repair token sits in the card's top corner, level with the title and above the
        // grid, so it never covers a bubble or gets clipped by the edge.
        if (firstRepair)
          const Positioned(
            right: MmSpace.s12,
            top: MmSpace.s4,
            child: ArtImage(MmArt.tokenFirstRepair, width: 40, height: 40),
          ),
      ],
    );
  }
}

class _Grid {
  const _Grid(this.columns, this.cell, this.gap);

  final int columns;
  final double cell;
  final double gap;
}

class _SheetPainter extends CustomPainter {
  _SheetPainter({required this.cells, required this.grid, required this.colors, required this.progress}) : super(repaint: progress);

  final List<SheetCell> cells;
  final _Grid grid;
  final MmColors colors;
  final Animation<double> progress;

  @override
  void paint(Canvas canvas, Size size) {
    final bubbles = BubblePaint(colors);
    final cell = grid.cell, gap = grid.gap;
    final r = cell / 2 - 2;
    final ring = colors.isNight ? colors.volt : colors.accentText;
    final now = [
      for (var i = 0; i < cells.length; i++)
        if (cells[i] == SheetCell.repairedNow) i,
    ];
    final p = progress.value;

    for (var i = 0; i < cells.length; i++) {
      final c = Offset((i % grid.columns) * (cell + gap) + cell / 2, (i ~/ grid.columns) * (cell + gap) + cell / 2);
      switch (cells[i]) {
        case SheetCell.right:
          bubbles.paint(canvas, c, r, BubbleState.filled);
        case SheetCell.blank:
          bubbles.paint(canvas, c, r, BubbleState.blank);
        case SheetCell.wrong:
          // Mistakes not repaired yet sit back, so tonight's rings read first.
          bubbles.paint(canvas, c, r, BubbleState.wrong, dim: 0.4);
        case SheetCell.repaired:
          _repaired(canvas, bubbles, c, r, ring, 1);
        case SheetCell.repairedNow:
          // Each repaired bubble rings in turn, overlapping a little.
          final k = now.indexOf(i);
          final span = 1 / (now.length + 1);
          final t = ((p - k * span) / (span * 2)).clamp(0.0, 1.0);
          _repaired(canvas, bubbles, c, r, ring, Curves.easeOutCubic.transform(t));
      }
    }
  }

  void _repaired(Canvas canvas, BubblePaint bubbles, Offset c, double r, Color ring, double t) {
    bubbles.paint(canvas, c, r * (1 - 0.18 * t), BubbleState.wrong);
    if (t <= 0) return;
    canvas.drawArc(
      Rect.fromCircle(center: c, radius: r + 2),
      -math.pi / 2,
      2 * math.pi * t,
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2
        ..strokeCap = StrokeCap.round
        ..color = ring,
    );
  }

  @override
  bool shouldRepaint(_SheetPainter old) => old.colors != colors || old.grid.cell != grid.cell || old.progress != progress || !identical(old.cells, cells);
}
