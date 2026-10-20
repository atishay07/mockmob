import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../credits/credits.dart' show creditFiguresProvider, openCreditsPage;
import '../../wallet/widgets/credit_coins.dart';
import '../copy.dart';

/// What Practice says about credits, in one value (a provider of its own, so Practice reads the balance through one
/// door).
@immutable
class PracticeCreditFacts {
  const PracticeCreditFacts({this.total});

  /// A Free student's one credits balance; null on Pro, on an older two-pool server, or while unknown (never a 0).
  final int? total;
}

final practiceCreditFactsProvider = Provider<PracticeCreditFacts>((ref) {
  final figures = ref.watch(creditFiguresProvider);
  // One credits balance only (owner D78): an older server's two pools are not added into a figure it did not send.
  final total = figures.isPro || !figures.oneBalance ? null : figures.total;
  if (total == null) return const PracticeCreditFacts();
  return PracticeCreditFacts(total: total);
});

/// Practice's credit line (K6, 20 Oct: credits need "a clear, findable place"): under the ways to practise, a Free
/// student's balance with a way to the Wallet.
/// Nothing for a Pro student (practice is unlimited) and nothing while the balance is unknown (never a 0).
class PracticeCreditLine extends ConsumerWidget {
  const PracticeCreditLine({super.key, this.topGap = 0});

  /// Space above the line. It belongs to the line, so no gap is left when it draws nothing.
  final double topGap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final facts = ref.watch(practiceCreditFactsProvider);
    final total = facts.total;
    if (total == null) return const SizedBox.shrink();
    return Padding(
      padding: EdgeInsets.only(top: topGap),
      child: MmPressable(
        onTap: () => openCreditsPage(context),
        semanticsLabel: PracticeCopy.creditLineLabel(total),
        haptic: MmPressHaptic.selection,
        pressedScale: 0.99,
        focusRadius: MmRadius.smallAll,
        builder: (context, pressed, focused) => ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 48),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: MmSpace.s4),
            child: Row(
              children: [
                const CreditCoins(size: 36, coins: 2),
                const SizedBox(width: MmSpace.s12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(PracticeCopy.creditLine(total), style: type.labelLarge.copyWith(color: pressed ? colors.ink2 : colors.ink)),
                    ],
                  ),
                ),
                const SizedBox(width: MmSpace.s8),
                Text(PracticeCopy.creditLineWallet, style: type.label.copyWith(color: colors.accentText, fontWeight: FontWeight.w700)),
                const SizedBox(width: 2),
                Icon(LucideIcons.chevronRight, size: 16, color: colors.accentText),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
