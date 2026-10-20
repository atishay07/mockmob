import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../credits/credits.dart' show creditFiguresProvider, openCreditsPage;
import '../../wallet/data/wallet_data.dart' show firstFullMockFreeProvider;
import '../../wallet/widgets/credit_coins.dart';
import '../copy.dart';

/// Practice's credit line (K6, 20 Oct: credits need "a clear, findable place"): under the ways to practise, a Free
/// student's balance with a way to the Wallet, and, while the server's rule is on, the one free full mock per subject.
/// Nothing for a Pro student (practice is unlimited) and nothing while the balance is unknown (never a 0).
class PracticeCreditLine extends ConsumerWidget {
  const PracticeCreditLine({super.key, this.topGap = 0});

  /// Space above the line. It belongs to the line, so no gap is left when it draws nothing.
  final double topGap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final figures = ref.watch(creditFiguresProvider);
    // One credits balance only (owner D78): an older server's two pools are not added into a figure it did not send.
    final total = figures.isPro || !figures.oneBalance ? null : figures.total;
    if (total == null) return const SizedBox.shrink();
    final rule = ref.watch(firstFullMockFreeProvider);
    return Padding(
      padding: EdgeInsets.only(top: topGap),
      child: MmPressable(
        onTap: () => openCreditsPage(context),
        semanticsLabel: '${PracticeCopy.creditLineLabel(total)}${rule ? ' ${PracticeCopy.creditLineRule}' : ''}',
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
                      if (rule) ...[
                        const SizedBox(height: 2),
                        Text(PracticeCopy.creditLineRule, style: type.caption.copyWith(color: colors.ink2)),
                      ],
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
