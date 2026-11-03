import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/pressable.dart';
import 'chapter_model.dart';

/// "Everything in this chapter": only rows that lead somewhere, each with a plain line; what is missing is one quiet line
/// under them (A4 3.2.6). Rows are 64 dp or more; each says what it opens with a 40 dp tile and one icon (C-LEARN-CALM 2.11), and
/// spacing groups them instead of hairlines; the whole row is the target.
class ChapterShelf extends StatelessWidget {
  const ChapterShelf({super.key, required this.rows, this.missing, required this.onOpen});

  final List<ShelfRowModel> rows;

  /// "No lesson yet. No open mistakes."
  final String? missing;

  /// A row that leads somewhere was pressed.
  final ValueChanged<ShelfRowModel> onOpen;

  /// The heading the screen reads and shows.
  static const String heading = 'Everything in this chapter';

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.gutter, 0, MmSpace.gutter, MmSpace.s4),
          child: Semantics(
            header: true,
            child: Text(heading, style: type.title.copyWith(fontSize: 20, height: 1.2, letterSpacing: -0.02 * 20)),
          ),
        ),
        for (final row in rows) ShelfRow(row: row, onTap: row.link || row.action != null ? () => onOpen(row) : null),
        if (missing != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.gutter, 10, MmSpace.gutter, 0),
            child: Text(missing!, style: type.caption.copyWith(fontSize: 13, height: 1.45, color: colors.ink3, fontWeight: FontWeight.w500)),
          ),
      ],
    );
  }
}

/// One row of the shelf. [onTap] null is a quiet row that is shown and not pressed (Free's day is used).
class ShelfRow extends StatelessWidget {
  const ShelfRow({super.key, required this.row, required this.onTap});

  final ShelfRowModel row;
  final VoidCallback? onTap;

  /// The row's least height.
  static const double minHeight = 64;

  /// One icon per kind of place the row opens.
  static IconData iconFor(String id) => switch (id) {
        'cards' => LucideIcons.layers,
        'questions' => LucideIcons.circleHelp,
        'mistakes' => LucideIcons.rotateCcw,
        'lesson' => LucideIcons.bookOpen,
        _ => LucideIcons.listChecks,
      };

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final still = onTap == null;
    Widget body({bool pressed = false}) => ConstrainedBox(
      constraints: const BoxConstraints(minHeight: minHeight),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter, vertical: 10),
        child: Row(
          children: [
            ExcludeSemantics(
              child: AnimatedScale(
                scale: pressed ? 0.92 : 1,
                duration: Motion.of(context, const Duration(milliseconds: 100)),
                curve: Motion.out,
                child: SizedBox.square(
                  dimension: 40,
                  child: DecoratedBox(
                    decoration: ShapeDecoration(
                      color: colors.ink.withValues(alpha: colors.isNight ? 0.07 : 0.055),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: Icon(iconFor(row.id), size: 19, color: still ? colors.ink3 : colors.ink2),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(row.title, style: type.labelLarge.copyWith(fontSize: 15.5, height: 1.35, color: still ? colors.ink2 : colors.ink)),
                  const SizedBox(height: 3),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (row.locked) ...[
                        Padding(padding: const EdgeInsets.only(top: 3), child: Icon(LucideIcons.lock, size: 13, color: colors.ink3)),
                        const SizedBox(width: MmSpace.s6),
                      ],
                      Expanded(
                        child: Text(
                          row.line,
                          style: type.caption.copyWith(fontSize: 13.5, height: 1.4, color: still ? colors.ink3 : colors.ink2, fontWeight: FontWeight.w500),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            if (!still) ...[
              const SizedBox(width: MmSpace.s12),
              Icon(LucideIcons.chevronRight, size: 16, color: colors.ink4),
            ],
          ],
        ),
      ),
    );
    if (still) {
      return Semantics(container: true, label: '${row.title}. ${row.line}', excludeSemantics: true, child: body());
    }
    return MmPressable(
      onTap: onTap,
      pressedScale: 0.985,
      lift: false,
      focusRadius: BorderRadius.circular(12),
      haptic: MmPressHaptic.selection,
      highlight: true,
      semanticsLabel: '${row.title}. ${row.line}',
      builder: (context, pressed, focused) => body(pressed: pressed),
    );
  }
}
