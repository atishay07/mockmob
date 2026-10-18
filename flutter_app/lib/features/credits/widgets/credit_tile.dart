import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../credits_copy.dart';
import '../data/credit_figures.dart';
import '../data/credits_models.dart';

/// The credits as tiles that open the Credits page. Used on You and in the Account sheet.
///
/// On a server that keeps one credits balance (owner D78, release 10): one tile, "Credits", with the one
/// figure, what it pays for and this month's free credits. On an older server: the two pools side by side,
/// each with its name, the balance, what it pays for and when it renews. A balance that is not known reads
/// "Not loaded", never 0.
class CreditTiles extends StatelessWidget {
  const CreditTiles({super.key, required this.figures, required this.onOpen, this.mobi = false, this.keyPrefix = 'credits', this.flat = false});

  final CreditFigures figures;

  /// Opens the Credits page.
  final VoidCallback onOpen;

  /// A small, still Mobi head beside the AI credits (these are his replies). Off on You, where
  /// he is already in the sheet at the top.
  final bool mobi;
  final String keyPrefix;

  /// Draws the tiles on the surface they stand on (a sheet's own glass), with a hairline between
  /// them, instead of an inset surface each: a sheet is already a card, so a card in it is a box in
  /// a box (critic 16 Oct, finding 24).
  final bool flat;

  @override
  Widget build(BuildContext context) {
    if (figures.oneBalance) {
      final total = figures.total;
      final freeLine = figures.freeLeft != null && figures.freeAllowance != null
          ? CreditsCopy.freeLeft(figures.freeLeft!, figures.freeAllowance!)
          : (figures.freeRenews != null ? CreditsCopy.freeRenews(figures.freeRenews!) : null);
      return CreditTile(
        flat: flat,
        key: ValueKey('$keyPrefix-credits'),
        name: CreditsCopy.oneName,
        figure: total != null ? '$total' : (figures.loading ? CreditsCopy.checking : CreditsCopy.notLoaded),
        known: total != null,
        meaning: figures.aiPaused ? 'AI replies are paused' : (figures.isPro ? CreditsCopy.oneProMeaning : CreditsCopy.oneMeaning),
        footnote: freeLine,
        mobi: mobi,
        onTap: onOpen,
      );
    }
    final String practiceFigure;
    final String practiceMeaning;
    if (figures.isPro) {
      practiceFigure = CreditsCopy.unlimited;
      practiceMeaning = CreditsCopy.practiceProMeaning;
    } else {
      practiceFigure = figures.practice != null ? '${figures.practice}' : (figures.loading ? CreditsCopy.checking : CreditsCopy.notLoaded);
      practiceMeaning = CreditsCopy.practiceMeaning;
    }
    final aiFigure = figures.ai != null ? '${figures.ai}' : (figures.loading ? CreditsCopy.checking : CreditsCopy.notLoaded);
    final aiMeaning = figures.aiPaused ? 'AI replies are paused' : CreditsCopy.aiMeaning;
    final aiRenews = figures.aiPaused ? null : figures.aiRenews;

    final colors = context.mmColors;
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            child: CreditTile(
              flat: flat,
              key: ValueKey('$keyPrefix-practice'),
              name: CreditPool.practice.name,
              figure: practiceFigure,
              known: figures.isPro || figures.practice != null,
              meaning: practiceMeaning,
              footnote: figures.isPro || figures.practiceRenews == null ? null : CreditsCopy.renews(figures.practiceRenews!),
              onTap: onOpen,
            ),
          ),
          if (flat)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: MmSpace.s4),
              child: VerticalDivider(width: 1, thickness: 1, color: colors.line),
            )
          else
            const SizedBox(width: MmSpace.s12),
          Expanded(
            child: CreditTile(
              flat: flat,
              key: ValueKey('$keyPrefix-ai'),
              name: CreditPool.ai.name,
              figure: aiFigure,
              known: figures.ai != null,
              meaning: aiMeaning,
              footnote: aiRenews == null ? null : CreditsCopy.renews(aiRenews),
              mobi: mobi,
              onTap: onOpen,
            ),
          ),
        ],
      ),
    );
  }
}

class CreditTile extends StatelessWidget {
  const CreditTile({
    super.key,
    required this.name,
    required this.figure,
    required this.known,
    required this.meaning,
    required this.onTap,
    this.footnote,
    this.mobi = false,
    this.flat = false,
  });

  /// "Credits", or on an older server "Practice credits" or "AI credits".
  final String name;
  final String figure;

  /// False draws the figure as a quiet line ("Not loaded"), not a number.
  final bool known;
  final String meaning;
  final String? footnote;
  final bool mobi;
  final VoidCallback onTap;

  /// No surface of its own: the tile is a pressable row of text on whatever it stands on.
  final bool flat;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final numeric = known && int.tryParse(figure) != null;
    const padding = EdgeInsets.fromLTRB(MmSpace.s12, MmSpace.s12, MmSpace.s8, MmSpace.s12);
    final semanticsLabel = '$name, $figure. $meaning. Opens Credits';
    final content = Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Text(name, style: type.caption.copyWith(color: colors.ink2), maxLines: 1, overflow: TextOverflow.ellipsis)),
              if (mobi) ...[
                const MobiCharacter(size: 22, head: true, still: true, shadow: false, entrance: MobiAct.idle),
                const SizedBox(width: MmSpace.s4),
              ],
              Icon(LucideIcons.chevronRight, size: 14, color: colors.ink3),
            ],
          ),
          const SizedBox(height: MmSpace.s8),
          Text(
            figure,
            style: numeric ? type.figureCompact.copyWith(color: colors.ink) : (known ? type.title : type.body.copyWith(color: colors.ink3)),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: MmSpace.s4),
          Text(meaning, style: type.small.copyWith(color: colors.ink2), maxLines: 3, overflow: TextOverflow.ellipsis),
          if (footnote != null) ...[
            const SizedBox(height: 2),
            Text(footnote!, style: type.caption.copyWith(color: colors.ink3), maxLines: 1, overflow: TextOverflow.ellipsis),
          ],
        ],
      );
    if (flat) {
      return MmPressable(
        onTap: onTap,
        haptic: MmPressHaptic.selection,
        highlight: true,
        pressedScale: 0.98,
        focusRadius: MmRadius.smallAll,
        semanticsLabel: semanticsLabel,
        builder: (context, pressed, focused) => Padding(padding: padding, child: content),
      );
    }
    return MmSurface.inset(onTap: onTap, semanticsLabel: semanticsLabel, padding: padding, child: content);
  }
}
