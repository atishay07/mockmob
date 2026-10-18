import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api_providers.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../billing/billing.dart';
import '../copy.dart';
import '../data/ask_controller.dart';
import '../data/ask_wallet.dart';
import 'insights_bits.dart';
import 'motion_bits.dart';

/// The AI credit balance in Ask's header: a glass pill with the count, which rolls down when a
/// reply is charged (the server's number, never a guess). Tap for the credit details. An unknown
/// balance says "Credits", never zero; a pause says so.
class AskCreditPill extends ConsumerWidget {
  const AskCreditPill({super.key, required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final wallet = ref.watch(askWalletProvider);
    final paused = wallet?.paused ?? false;
    final total = wallet?.total;
    final empty = wallet?.empty ?? false;
    final style = type.labelLarge.copyWith(fontSize: 14, fontWeight: FontWeight.w600, color: colors.ink);
    return MmPressable(
      semanticsLabel: InsightsCopy.walletPillLabel(total, paused: paused),
      onTap: onTap,
      builder: (context, pressed, _) => SizedBox(
        height: MmTarget.min,
        child: Center(
          child: FakeGlass(
            borderRadius: MmRadius.pillAll,
            pressed: pressed,
            grain: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(MmSpace.s12, MmSpace.s8, MmSpace.s12 + 2, MmSpace.s8),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(LucideIcons.sparkles, size: 14, color: empty || paused ? colors.ink3 : colors.ink2),
                  const SizedBox(width: MmSpace.s4 + 2),
                  if (paused)
                    Text(InsightsCopy.walletPillPaused, style: style.copyWith(color: colors.ink2))
                  else if (total == null)
                    Text(InsightsCopy.walletPillUnknown, style: style.copyWith(color: colors.ink2))
                  else ...[
                    // Counts only on a change, from the value shown: 9 rolls to 8 as the charge lands.
                    MmCountUp(
                      value: total,
                      fromZeroOnFirstBuild: false,
                      memoryKey: 'ask-ai-credits',
                      style: style.copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
                    ),
                    Text(total == 1 ? ' credit' : ' credits', style: style.copyWith(fontWeight: FontWeight.w500, color: colors.ink2)),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Opens the credit details: the balance, this month's included credits, purchased credits, when
/// they renew, how Ask spends them and what this conversation has used.
Future<void> showAskWalletSheet(BuildContext context) => showMmSheet<void>(
      context: context,
      title: InsightsCopy.walletTitle,
      builder: (sheet) => const AskWalletSheet(),
    );

class AskWalletSheet extends ConsumerWidget {
  const AskWalletSheet({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final wallet = ref.watch(askWalletProvider);
    final now = ref.watch(nowProvider)();
    final messages = ref.watch(askControllerProvider.select((s) => s.messages));
    final used = <(String, int?)>[
      for (final (i, m) in messages.indexed)
        if (m.isModel && i > 0 && messages[i - 1].fromStudent) (messages[i - 1].text, m.charged),
    ];
    final known = wallet?.known ?? false;
    final paused = wallet?.paused ?? false;

    Widget row(String label, String value) => Padding(
          padding: const EdgeInsets.symmetric(vertical: MmSpace.s8),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: Text(label, style: type.body.copyWith(color: colors.ink2))),
              const SizedBox(width: MmSpace.s12),
              Flexible(child: Text(value, textAlign: TextAlign.end, style: type.body.copyWith(fontWeight: FontWeight.w600, fontFeatures: const [FontFeature.tabularFigures()]))),
            ],
          ),
        );

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (known) ...[
          Semantics(
            label: InsightsCopy.aiCredits(wallet!.total!),
            excludeSemantics: true,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Text('${wallet.total}', style: type.display.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
                const SizedBox(width: MmSpace.s8),
                Text(wallet.total == 1 ? 'AI credit' : 'AI credits', style: type.title.copyWith(color: colors.ink2)),
              ],
            ),
          ),
          if (paused) ...[
            const SizedBox(height: MmSpace.s4),
            Text(InsightsCopy.walletPaused, style: type.small.copyWith(color: colors.ink2)),
          ],
          const SizedBox(height: MmSpace.s12),
          if (wallet.includedRemaining != null && wallet.includedMonthly != null)
            row(InsightsCopy.walletIncluded, InsightsCopy.walletIncludedValue(wallet.includedRemaining!, wallet.includedMonthly!)),
          if ((wallet.bonus ?? 0) > 0) row(InsightsCopy.walletPurchased, '${wallet.bonus}'),
          row(InsightsCopy.walletRenews, renewDay(wallet, now)),
          Text(InsightsCopy.walletRenewNote, style: type.caption.copyWith(color: colors.ink3)),
        ] else
          Text(paused ? InsightsCopy.walletPaused : InsightsCopy.walletUnknown, style: type.body.copyWith(color: colors.ink2)),
        const SizedBox(height: MmSpace.s24),
        Semantics(header: true, child: Text(InsightsCopy.walletHow, style: type.cardTitle)),
        const SizedBox(height: MmSpace.s8),
        for (final line in const [InsightsCopy.walletHowRecord, InsightsCopy.walletHowModel, InsightsCopy.walletHowFailed, InsightsCopy.walletAllowance])
          Padding(
            padding: const EdgeInsets.only(bottom: MmSpace.s4),
            child: Text(line, style: type.small.copyWith(color: colors.ink2)),
          ),
        const SizedBox(height: MmSpace.s20),
        Semantics(header: true, child: Text(InsightsCopy.walletHistory, style: type.cardTitle)),
        const SizedBox(height: MmSpace.s8),
        if (used.isEmpty)
          Text(InsightsCopy.walletHistoryEmpty, style: type.small.copyWith(color: colors.ink3))
        else
          for (final (question, charged) in used.reversed)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: MmSpace.s4),
              child: Row(
                children: [
                  Expanded(child: Text(question, maxLines: 1, overflow: TextOverflow.ellipsis, style: type.small)),
                  const SizedBox(width: MmSpace.s12),
                  Text(
                    InsightsCopy.chargedLine(charged, null),
                    style: type.caption.copyWith(color: charged == 0 ? colors.ink3 : colors.ink2, fontWeight: FontWeight.w600),
                  ),
                ],
              ),
            ),
      ],
    );
  }
}

/// Out of AI credits: a quiet band over the field that says so plainly, when they renew, that
/// record questions stay free and (on Free) what Pro includes. With `PLAY_BILLING` on a Get AI credits
/// key opens Google Play's packs (lib/features/billing); with it off there is no price and no purchase.
class AskOutOfCredits extends ConsumerWidget {
  const AskOutOfCredits({super.key, required this.onDetails});

  final VoidCallback onDetails;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final wallet = ref.watch(askWalletProvider);
    final now = ref.watch(nowProvider)();
    return RiseIn(
      dy: MmSpace.s8,
      duration: Motion.card,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(MmSpace.gutter, 0, MmSpace.gutter, MmSpace.s8),
        child: FakeGlass(
          borderRadius: MmRadius.keyAll,
          grain: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s12, MmSpace.s12, MmSpace.s4),
            child: Semantics(
              container: true,
              liveRegion: true,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(InsightsCopy.outTitle, style: type.labelLarge.copyWith(fontWeight: FontWeight.w600)),
                  const SizedBox(height: MmSpace.s2),
                  Text(
                    (wallet?.paid ?? false) ? InsightsCopy.outBody(renewDay(wallet, now)) : '${InsightsCopy.outBody(renewDay(wallet, now))} ${InsightsCopy.outPro}',
                    style: type.small.copyWith(color: colors.ink2),
                  ),
                  ActionLink(label: InsightsCopy.creditDetails, onTap: onDetails),
                  // Google Play's AI credit packs, when PLAY_BILLING is on; nothing otherwise.
                  const Align(alignment: Alignment.centerLeft, child: WalletTopUpEntry()),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
