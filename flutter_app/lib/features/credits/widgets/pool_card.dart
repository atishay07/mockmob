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

/// The one credits balance on the Credits page (a server that keeps one balance, owner D78): "Credits",
/// the figure as the loudest thing on the card, what it pays for, this month's free credits left with the
/// day they renew, and the credits held. Every line is the server's own number; a line it did not send is
/// left out, and a balance that is not known reads "Not loaded", never 0.
class OneBalanceCard extends StatelessWidget {
  const OneBalanceCard({super.key, required this.figures});

  final CreditFigures figures;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final total = figures.total;
    final figureText = total != null ? '$total' : (figures.loading ? CreditsCopy.checking : CreditsCopy.notLoaded);
    final meaning = figures.aiPaused
        ? 'AI replies are paused'
        : (figures.isPro ? CreditsCopy.oneProMeaning : CreditsCopy.oneMeaning);
    final lines = <String>[
      if (figures.freeLeft != null && figures.freeAllowance != null) CreditsCopy.freeLeft(figures.freeLeft!, figures.freeAllowance!),
      if (figures.freeRenews != null) CreditsCopy.freeRenews(figures.freeRenews!),
      if ((figures.held ?? 0) > 0) CreditsCopy.held(figures.held!),
    ];
    final Widget figure = total != null
        ? MonumentalNumber(
            value: figureText,
            unit: total == 1 ? 'credit' : 'credits',
            style: type.figure,
            fromZeroOnFirstBuild: false,
            memoryKey: 'credits-one',
          )
        : Text(figureText, style: type.title.copyWith(color: colors.ink3));

    return MmSurface.plain(
      semanticsLabel: '${CreditsCopy.oneName}, $figureText. $meaning. ${lines.join('. ')}',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(LucideIcons.wallet, size: 18, color: colors.ink2),
              const SizedBox(width: MmSpace.s8),
              Expanded(child: Text(CreditsCopy.oneName, style: type.labelLarge.copyWith(color: colors.ink2))),
              const MobiCharacter(size: 32, head: true, still: true, shadow: false, entrance: MobiAct.idle),
            ],
          ),
          const SizedBox(height: MmSpace.s12),
          figure,
          const SizedBox(height: MmSpace.s8),
          Text(meaning, style: type.small.copyWith(color: colors.ink2)),
          for (final line in lines) ...[
            const SizedBox(height: MmSpace.s4),
            Text(line, style: type.caption.copyWith(color: colors.ink3)),
          ],
        ],
      ),
    );
  }
}
