// "Your sheet" (brief 12): the last papers as rows of answer bubbles, one bubble per question in
// paper order, like a strip torn from an OMR sheet. Right is inked, wrong carries its cross,
// a blank is dashed. A result that has not been opened stays sealed here too: hollow bubbles and
// no marks, so Today never spoils a reveal.
import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../logic/today_model.dart';

class SheetSection extends StatelessWidget {
  const SheetSection({super.key, required this.rows, required this.onOpen});

  final List<SheetRow> rows;
  final void Function(TodayTarget target) onOpen;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(child: Semantics(header: true, child: Text(TodayCopy.yourSheet, style: type.title))),
            Text(TodayCopy.sheetCaption(rows.length), style: type.caption.copyWith(color: colors.ink3)),
          ],
        ),
        const SizedBox(height: MmSpace.s4),
        for (var k = 0; k < rows.length; k++) ...[
          if (k > 0) Divider(height: 1, thickness: 1, color: colors.line),
          _PaperRow(row: rows[k], onTap: () => onOpen(rows[k].target)),
        ],
      ],
    );
  }
}

class _PaperRow extends StatelessWidget {
  const _PaperRow({required this.row, required this.onTap});

  final SheetRow row;
  final VoidCallback onTap;

  String get _semantics {
    if (row.sealed) return '${row.label}, ${row.subject}, ${row.date}. ${TodayCopy.sealed}. Opens your sheet.';
    final right = row.states.where((s) => s == BubbleState.filled).length;
    final wrong = row.states.where((s) => s == BubbleState.wrong).length;
    final blank = row.states.where((s) => s == BubbleState.blank).length;
    return '${row.label}, ${row.subject}, ${row.date}. ${row.marks} of ${row.outOf} marks. '
        '$right right, $wrong wrong, $blank not attempted.';
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final figure = type.title.copyWith(fontSize: 20, height: 24 / 20);
    return MmPressable(
      semanticsLabel: _semantics,
      onTap: onTap,
      pressedScale: 0.985,
      focusRadius: MmRadius.smallAll,
      builder: (context, pressed, _) => Padding(
        padding: const EdgeInsets.symmetric(vertical: MmSpace.s12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Text(row.label, style: type.labelLarge),
                const SizedBox(width: MmSpace.s8),
                Expanded(
                  child: Text(
                    '${row.subject}, ${row.date}',
                    style: type.caption.copyWith(color: colors.ink2),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                if (row.sealed)
                  Text(TodayCopy.sealed, style: type.caption.copyWith(color: colors.ink2, fontWeight: FontWeight.w600))
                else ...[
                  Text('${row.marks}', style: figure),
                  const SizedBox(width: MmSpace.s4),
                  Text(TodayCopy.marksOf(row.outOf ?? 0), style: type.caption.copyWith(color: colors.ink3)),
                ],
              ],
            ),
            const SizedBox(height: MmSpace.s8),
            _BubbleStrip(states: row.states),
          ],
        ),
      ),
    );
  }
}

/// One row of bubbles sized so a 50-question paper fills the width and a 10-question check
/// stays short at the same bubble size, so the row's length tells the paper's length.
class _BubbleStrip extends StatelessWidget {
  const _BubbleStrip({required this.states});

  final List<BubbleState> states;

  static const int _fullPaper = 50;
  static const double _gapRatio = 0.32;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final slot = constraints.maxWidth / _fullPaper;
        final size = (slot / (1 + _gapRatio)).clamp(4.0, 10.0);
        return RepaintBoundary(
          child: CustomPaint(
            size: Size(constraints.maxWidth, size + 2),
            painter: _StripPainter(states: states, size: size, slot: slot, colors: context.mmColors),
          ),
        );
      },
    );
  }
}

class _StripPainter extends CustomPainter {
  _StripPainter({required this.states, required this.size, required this.slot, required this.colors});

  final List<BubbleState> states;
  final double size;
  final double slot;
  final MmColors colors;

  @override
  void paint(Canvas canvas, Size canvasSize) {
    final paint = BubblePaint(colors);
    final r = size / 2;
    for (var i = 0; i < states.length && i < 60; i++) {
      // History rows sit a step quieter than the hero: the volt belongs to tonight's move.
      paint.paint(canvas, Offset(slot * i + slot / 2, r + 1), r, states[i], dim: states[i] == BubbleState.filled ? 0.62 : 0.9);
    }
  }

  @override
  bool shouldRepaint(_StripPainter old) => old.size != size || old.slot != slot || old.colors != colors || old.states != states;
}
