import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../credits_copy.dart';
import '../data/credit_figures.dart';
import '../data/credits_models.dart';

/// One pool on the Credits page: its name, the balance as the loudest thing on the card, what it
/// pays for and when it renews. A balance that is not known reads "Not loaded", never 0. Mobi
/// (still, once on the page) stands by the AI credits, because those are his replies.
class PoolCard extends StatelessWidget {
  const PoolCard({super.key, required this.pool, required this.figures, this.mobi = false});

  final CreditPool pool;
  final CreditFigures figures;
  final bool mobi;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final isPractice = pool == CreditPool.practice;
    final balance = isPractice ? figures.practice : figures.ai;
    final renews = isPractice ? figures.practiceRenews : figures.aiRenews;
    final unlimited = isPractice && figures.isPro;
    final meaning = unlimited
        ? CreditsCopy.practiceProMeaning
        : isPractice
            ? CreditsCopy.practiceMeaning
            : (figures.aiPaused ? 'AI replies are paused' : CreditsCopy.aiMeaning);
    final String figureText;
    if (unlimited) {
      figureText = CreditsCopy.unlimited;
    } else if (balance != null) {
      figureText = '$balance';
    } else {
      figureText = figures.loading ? CreditsCopy.checking : CreditsCopy.notLoaded;
    }
    final known = unlimited || balance != null;

    final Widget figure = known && !unlimited
        ? MonumentalNumber(
            value: figureText,
            unit: balance == 1 ? 'credit' : 'credits',
            style: type.figure,
            fromZeroOnFirstBuild: false,
            memoryKey: 'credits-${pool.name}',
          )
        : Text(figureText, style: known ? type.figureCompact : type.title.copyWith(color: colors.ink3));

    return MmSurface.plain(
      semanticsLabel: CreditsCopy.balanceLabel(pool, figureText, meaning),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(isPractice ? LucideIcons.layers : LucideIcons.sparkles, size: 18, color: colors.ink2),
              const SizedBox(width: MmSpace.s8),
              Expanded(child: Text(pool.name, style: type.labelLarge.copyWith(color: colors.ink2))),
              if (mobi) const MobiCharacter(size: 32, head: true, still: true, shadow: false, entrance: MobiAct.idle),
            ],
          ),
          const SizedBox(height: MmSpace.s12),
          figure,
          const SizedBox(height: MmSpace.s8),
          Text(meaning, style: type.small.copyWith(color: colors.ink2)),
          if (!unlimited && renews != null) ...[
            const SizedBox(height: MmSpace.s4),
            Text(CreditsCopy.renews(renews), style: type.caption.copyWith(color: colors.ink3)),
          ],
        ],
      ),
    );
  }
}
