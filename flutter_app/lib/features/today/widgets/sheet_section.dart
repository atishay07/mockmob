// "Recent papers" (brief 12, owner feedback 13 Oct on the dots; ui-blitz/today.md 2.3): the
// last papers typeset on the ground, one row each between hairlines, no box. Each row has a
// paper spine on its left edge (a slim vertical bar that shows where the marks went, right,
// wrong, blank, in proportion, so the rows read as a stack of papers), its marks in the
// condensed cut, and the change from the last paper of the same kind with a small up or down
// mark. Headings, spines, text and hairlines all share one left edge. A result that has not been opened stays sealed here too: no marks, no bar, so
// Today never spoils a reveal. Each row opens its result.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/copy/formatters.dart' show minusSign;
import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../logic/today_model.dart';
import 'section_heading.dart';
import 'today_entrance.dart';
import 'today_reveal.dart';
import 'today_type.dart';

class SheetSection extends StatelessWidget {
  const SheetSection({super.key, required this.rows, required this.onOpen});

  final List<SheetRow> rows;
  final void Function(TodayTarget target) onOpen;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Heading to its content: 12, which is the first row's own top padding (SPACING.md 3.1).
        TodaySectionHeading(title: TodayCopy.yourSheet, caption: TodayCopy.sheetCaption(rows.length)),
        for (var k = 0; k < rows.length; k++) ...[
          if (k > 0) Divider(height: 1, thickness: 1, color: colors.line.withValues(alpha: 0.7)),
          _PaperRow(row: rows[k], onTap: () => onOpen(rows[k].target)),
        ],
      ],
    );
  }
}

class _PaperRow extends ConsumerWidget {
  const _PaperRow({required this.row, required this.onTap});

  final SheetRow row;
  final VoidCallback onTap;

  String get _semantics {
    if (row.sealed) return '${row.label}, ${row.subject}, ${row.date}. ${TodayCopy.sealed}. Opens your sheet.';
    return '${row.label}, ${row.subject}, ${row.date}. ${row.marks} of ${row.outOf} marks. '
        '${row.right} right, ${row.wrong} wrong, ${row.blank} not attempted.${row.change == null ? '' : ' ${row.change}.'} Opens the result.';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final figure = type.paperFigure;
    return MmPressable(
      semanticsLabel: _semantics,
      onTap: () {
        ref.read(hapticsProvider).selection();
        onTap();
      },
      pressedScale: 0.985,
      focusRadius: MmRadius.smallAll,
      // The row grows into the result it opens (MOTION.md C4).
      captureLaunch: true,
      builder: (context, pressed, _) => Padding(
        padding: const EdgeInsets.symmetric(vertical: MmSpace.s12),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // The paper's spine: what the marks were made of, top to bottom. A sealed paper
              // has an empty spine, so the left edge is the same on every row.
              _Spine(right: row.right, wrong: row.wrong, blank: row.blank, sealed: row.sealed || row.states.isEmpty),
              const SizedBox(width: MmSpace.s12),
              Expanded(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(row.label, style: type.cardTitle),
                          const SizedBox(height: 2),
                          Text(
                            '${row.subject}, ${row.date}',
                            style: type.caption.copyWith(color: colors.ink2),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          if (!row.sealed && row.states.isNotEmpty) ...[
                            const SizedBox(height: MmSpace.s6),
                            Text(TodayCopy.splitLine(row.right, row.wrong, row.blank), style: type.micro.copyWith(color: colors.ink3)),
                          ],
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
                        mainAxisAlignment: MainAxisAlignment.center,
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
                          if (row.change != null) ...[
                            const SizedBox(height: 2),
                            _Change(text: row.change!),
                          ],
                        ],
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// "+33 on Mock 6" with a small mark for its direction, so the change reads before the words.
class _Change extends StatelessWidget {
  const _Change({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final up = text.startsWith('+');
    final down = text.startsWith(minusSign) || text.startsWith('-');
    final icon = up ? LucideIcons.arrowUpRight : (down ? LucideIcons.arrowDownRight : LucideIcons.minus);
    final color = up ? colors.ink : colors.ink2;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 13, color: color),
        const SizedBox(width: 2),
        Text(text, style: type.micro.copyWith(color: color, fontWeight: up ? FontWeight.w600 : FontWeight.w500)),
      ],
    );
  }
}

/// The paper's spine: a 6 dp bar the height of the row, where the marks went from the top down,
/// right in ink, wrong in coral, blank as the empty groove. It draws down the first time the row
/// comes into view. A sealed paper has the empty groove only: Today never spoils a result.
class _Spine extends StatelessWidget {
  const _Spine({required this.right, required this.wrong, required this.blank, required this.sealed});

  final int right;
  final int wrong;
  final int blank;
  final bool sealed;

  static const double width = 6;

  @override
  Widget build(BuildContext context) => TodayReveal(
        child: Builder(
          builder: (context) => ExcludeSemantics(
            child: RepaintBoundary(
              child: CustomPaint(
                size: const Size(width, 0),
                painter: _SpinePainter(
                  right: sealed ? 0 : right,
                  wrong: sealed ? 0 : wrong,
                  blank: sealed ? 0 : blank,
                  colors: context.mmColors,
                  draw: todayEnterValue(context, delay: const Duration(milliseconds: 40), length: Motion.drawIn),
                ),
              ),
            ),
          ),
        ),
      );
}

class _SpinePainter extends CustomPainter {
  _SpinePainter({required this.right, required this.wrong, required this.blank, required this.colors, required this.draw}) : super(repaint: draw);

  final int right;
  final int wrong;
  final int blank;
  final MmColors colors;
  final Animation<double> draw;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final groove = RRect.fromRectAndRadius(Offset.zero & size, Radius.circular(w / 2));
    canvas.drawRRect(groove, Paint()..color = colors.ink.withValues(alpha: colors.isNight ? 0.1 : 0.08));
    final total = right + wrong + blank;
    if (total == 0) return;
    canvas.save();
    canvas.clipRRect(groove);
    canvas.clipRect(Rect.fromLTWH(0, 0, w, size.height * draw.value));
    const gap = 2.0;
    var y = 0.0;
    void segment(int n, Color color) {
      if (n == 0) return;
      final h = size.height * n / total;
      canvas.drawRect(Rect.fromLTWH(0, y, w, (h - gap).clamp(1.0, size.height)), Paint()..color = color);
      y += h;
    }

    // Right in paper ink, not volt: the volt on Today belongs to tonight's move.
    segment(right, colors.ink.withValues(alpha: colors.isNight ? 0.72 : 0.62));
    segment(wrong, colors.wrongMark);
    canvas.restore();
  }

  @override
  bool shouldRepaint(_SpinePainter old) =>
      old.right != right || old.wrong != wrong || old.blank != blank || old.colors != colors || old.draw != draw;
}
