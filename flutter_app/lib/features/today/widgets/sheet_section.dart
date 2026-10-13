// "Recent papers" (brief 12, owner feedback 13 Oct on the dots): the last papers, each with its
// marks, the change from the last paper of the same kind, and one bar that shows where the
// marks went (right, wrong, blank) in proportion. The bar replaces a row of fifty tiny bubbles
// that repeated the number beside it. A result that has not been opened stays sealed here too:
// no marks, no bar, so Today never spoils a reveal. Each row opens its result.
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

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
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.s4),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(child: Semantics(header: true, child: Text(TodayCopy.yourSheet, style: type.title))),
              Text(TodayCopy.sheetCaption(rows.length), style: type.caption.copyWith(color: colors.ink3)),
            ],
          ),
        ),
        const SizedBox(height: MmSpace.s12),
        FakeGlass(
          borderRadius: MmRadius.panelAll,
          child: Column(
            children: [
              for (var k = 0; k < rows.length; k++) ...[
                if (k > 0) Padding(padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter), child: Divider(height: 1, thickness: 1, color: colors.line)),
                _PaperRow(row: rows[k], onTap: () => onOpen(rows[k].target)),
              ],
            ],
          ),
        ),
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
    return '${row.label}, ${row.subject}, ${row.date}. ${row.marks} of ${row.outOf} marks. '
        '${row.right} right, ${row.wrong} wrong, ${row.blank} not attempted.${row.change == null ? '' : ' ${row.change}.'} Opens the result.';
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final figure = type.title.copyWith(fontSize: 22, height: 26 / 22);
    return MmPressable(
      semanticsLabel: _semantics,
      onTap: onTap,
      pressedScale: 0.985,
      focusRadius: MmRadius.smallAll,
      builder: (context, pressed, _) => Padding(
        padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s12 + 2, MmSpace.gutter, MmSpace.s12 + 2),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(row.label, style: type.labelLarge.copyWith(fontSize: 16)),
                      const SizedBox(height: 2),
                      Text(
                        '${row.subject}, ${row.date}',
                        style: type.caption.copyWith(color: colors.ink2),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: MmSpace.s12),
                if (row.sealed)
                  Row(
                    children: [
                      Icon(LucideIcons.mail, size: 16, color: colors.ink2),
                      const SizedBox(width: MmSpace.s6),
                      Text(TodayCopy.sealed, style: type.caption.copyWith(color: colors.ink2, fontWeight: FontWeight.w600)),
                    ],
                  )
                else
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.baseline,
                        textBaseline: TextBaseline.alphabetic,
                        children: [
                          Text('${row.marks}', style: figure),
                          const SizedBox(width: MmSpace.s4),
                          Text(TodayCopy.marksOf(row.outOf ?? 0), style: type.caption.copyWith(color: colors.ink3)),
                        ],
                      ),
                      if (row.change != null)
                        Text(row.change!, style: type.caption.copyWith(fontSize: 12, height: 16 / 12, color: colors.ink2)),
                    ],
                  ),
              ],
            ),
            if (!row.sealed && row.states.isNotEmpty) ...[
              const SizedBox(height: MmSpace.s12),
              _SplitBar(right: row.right, wrong: row.wrong, blank: row.blank),
              const SizedBox(height: MmSpace.s6),
              Text(
                TodayCopy.splitLine(row.right, row.wrong, row.blank),
                style: type.caption.copyWith(fontSize: 12, height: 16 / 12, color: colors.ink3),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Where the marks went, in proportion: right in ink, wrong in coral, blank as an empty groove.
class _SplitBar extends StatelessWidget {
  const _SplitBar({required this.right, required this.wrong, required this.blank});

  final int right;
  final int wrong;
  final int blank;

  @override
  Widget build(BuildContext context) {
    return RepaintBoundary(
      child: CustomPaint(
        size: const Size(double.infinity, 6),
        painter: _SplitPainter(right: right, wrong: wrong, blank: blank, colors: context.mmColors),
      ),
    );
  }
}

class _SplitPainter extends CustomPainter {
  _SplitPainter({required this.right, required this.wrong, required this.blank, required this.colors});

  final int right;
  final int wrong;
  final int blank;
  final MmColors colors;

  @override
  void paint(Canvas canvas, Size size) {
    final total = right + wrong + blank;
    if (total == 0) return;
    final h = size.height;
    final groove = RRect.fromRectAndRadius(Offset.zero & size, Radius.circular(h / 2));
    canvas.drawRRect(groove, Paint()..color = colors.isNight ? colors.ink.withValues(alpha: 0.08) : colors.ink.withValues(alpha: 0.07));
    canvas.save();
    canvas.clipRRect(groove);
    const gap = 2.0;
    var x = 0.0;
    void segment(int n, Color color) {
      if (n == 0) return;
      final w = size.width * n / total;
      canvas.drawRect(Rect.fromLTWH(x, 0, (w - gap).clamp(1.0, size.width), h), Paint()..color = color);
      x += w;
    }

    // Right in paper ink, not volt: the volt on Today belongs to tonight's move.
    segment(right, colors.ink.withValues(alpha: colors.isNight ? 0.72 : 0.62));
    segment(wrong, colors.wrongMark);
    canvas.restore();
  }

  @override
  bool shouldRepaint(_SplitPainter old) =>
      old.right != right || old.wrong != wrong || old.blank != blank || old.colors != colors;
}
