import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import 'delayed_skeleton.dart';
import 'pressable.dart';
import 'sheet_glyph.dart';

/// What a mode row says about cost: still loading, nothing, or one plain line.
class ModeCost {
  const ModeCost.loading() : text = null, loading = true, emphasis = false;

  const ModeCost.none() : text = null, loading = false, emphasis = false;

  const ModeCost.text(this.text, {this.emphasis = true}) : loading = false;

  final String? text;
  final bool loading;

  /// Free and credit lines are ink and semibold; reasons and gates are quieter.
  final bool emphasis;
}

/// One way to start. The row carries a tiny blank answer sheet whose size matches the session
/// (50 cells for a mock, 10 for Quick practice, 5 for a chapter), so the modes differ by shape,
/// not just by name. The [featured] row (the Full mock) is the one raised panel; the others sit
/// on the page between hairlines, so the list is not a stack of identical cards.
class ModeRow extends StatelessWidget {
  const ModeRow({
    super.key,
    required this.title,
    required this.line,
    required this.cost,
    required this.glyphCount,
    required this.onTap,
    this.featured = false,
    this.locked = false,
    this.semanticsExtra,
  });

  final String title;
  final String line;
  final ModeCost cost;
  final int glyphCount;
  final VoidCallback onTap;
  final bool featured;

  /// A Pro-gated mode: a lock glyph before the title, and the row opens its own explanation.
  final bool locked;
  final String? semanticsExtra;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;

    final titleStyle = featured ? type.title : type.subhead;
    final text = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (locked) ...[
              Padding(
                padding: const EdgeInsets.only(top: 3),
                child: ExcludeSemantics(child: Icon(LucideIcons.lock, size: 18, color: colors.ink2)),
              ),
              const SizedBox(width: MmSpace.s8),
            ],
            Expanded(child: Text(title, style: titleStyle)),
          ],
        ),
        const SizedBox(height: MmSpace.s4),
        Text(line, style: type.small.copyWith(color: colors.ink2)),
        if (cost.loading)
          const Padding(
            padding: EdgeInsets.only(top: MmSpace.s8),
            child: DelayedSkeleton(
              height: 21,
              child: Align(alignment: Alignment.topLeft, child: Skeleton.line(width: 150, height: 14)),
            ),
          )
        else if (cost.text != null)
          Padding(
            padding: const EdgeInsets.only(top: MmSpace.s8),
            child: Text(
              cost.text!,
              style: type.small.copyWith(
                color: cost.emphasis ? colors.ink : colors.ink2,
                fontWeight: cost.emphasis ? FontWeight.w600 : FontWeight.w400,
              ),
            ),
          ),
      ],
    );

    final glyph = SheetGlyph(count: glyphCount, cellSize: featured ? 8 : 9, gap: 2);
    final label = [title, line, if (locked) 'Locked', if (cost.text != null) cost.text!].join('. ');

    if (featured) {
      return Pressable(
        onTap: onTap,
        radius: MmRadius.panel,
        semanticsLabel: label,
        minHeight: 96,
        builder: (context, pressed) => DecoratedBox(
          decoration: BoxDecoration(
            color: pressed ? colors.raised2 : colors.raised,
            borderRadius: MmRadius.panelAll,
            border: Border.all(color: colors.line),
            boxShadow: colors.cardShadow,
          ),
          child: Padding(
            padding: const EdgeInsets.all(MmSpace.cardPadding),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                text,
                const SizedBox(height: MmSpace.s16),
                glyph,
              ],
            ),
          ),
        ),
      );
    }

    return Pressable(
      onTap: onTap,
      radius: MmRadius.key,
      semanticsLabel: label,
      minHeight: 72,
      builder: (context, pressed) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.s4, vertical: MmSpace.s16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Expanded(child: text),
            const SizedBox(width: MmSpace.s16),
            glyph,
            const SizedBox(width: MmSpace.s8),
            ExcludeSemantics(child: Icon(LucideIcons.chevronRight, size: 20, color: colors.ink3)),
          ],
        ),
      ),
    );
  }
}

/// A hairline between the plain rows.
class RowDivider extends StatelessWidget {
  const RowDivider({super.key});

  @override
  Widget build(BuildContext context) => Divider(height: 1, thickness: 1, color: context.mmColors.line);
}
