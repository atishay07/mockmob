import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../credits_copy.dart';
import '../data/credit_figures.dart';
import '../data/credits_models.dart';

/// The two pools side by side, each as a tile with its name, the balance, what it pays for and
/// when it renews. Used on You and in the Account sheet; the tiles open the Credits page.
/// A balance that is not known reads "Not loaded", never 0.
class CreditTiles extends StatelessWidget {
  const CreditTiles({super.key, required this.figures, required this.onOpen, this.mobi = false, this.keyPrefix = 'credits'});

  final CreditFigures figures;

  /// Opens the Credits page.
  final VoidCallback onOpen;

  /// A small, still Mobi head beside the AI credits (these are his replies). Off on You, where
  /// he is already in the sheet at the top.
  final bool mobi;
  final String keyPrefix;

  @override
  Widget build(BuildContext context) {
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

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            child: CreditTile(
              key: ValueKey('$keyPrefix-practice'),
              pool: CreditPool.practice,
              figure: practiceFigure,
              known: figures.isPro || figures.practice != null,
              meaning: practiceMeaning,
              footnote: figures.isPro || figures.practiceRenews == null ? null : CreditsCopy.renews(figures.practiceRenews!),
              onTap: onOpen,
            ),
          ),
          const SizedBox(width: MmSpace.s12),
          Expanded(
            child: CreditTile(
              key: ValueKey('$keyPrefix-ai'),
              pool: CreditPool.ai,
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
    required this.pool,
    required this.figure,
    required this.known,
    required this.meaning,
    required this.onTap,
    this.footnote,
    this.mobi = false,
  });

  final CreditPool pool;
  final String figure;

  /// False draws the figure as a quiet line ("Not loaded"), not a number.
  final bool known;
  final String meaning;
  final String? footnote;
  final bool mobi;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final numeric = known && int.tryParse(figure) != null;
    return MmSurface.inset(
      onTap: onTap,
      semanticsLabel: '${CreditsCopy.balanceLabel(pool, figure, meaning)}. Opens Credits',
      padding: const EdgeInsets.fromLTRB(MmSpace.s12, MmSpace.s12, MmSpace.s8, MmSpace.s12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Text(pool.name, style: type.caption.copyWith(color: colors.ink2), maxLines: 1, overflow: TextOverflow.ellipsis)),
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
      ),
    );
  }
}
