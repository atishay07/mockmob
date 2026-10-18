import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../credits/data/credit_figures.dart';
import '../../credits/credits_routes.dart' show openCreditsPage;
import '../billing_copy.dart';
import '../data/billing_controller.dart';
import 'get_pro_sheet.dart';

/// True when the Get Pro entry should show: the Play flag is on and the student is not Pro.
final getProAvailableProvider = Provider<bool>((ref) {
  if (!ref.watch(playBillingEnabledProvider)) return false;
  if (ref.watch(playBillingUserIdProvider) == null) return false;
  return !ref.watch(creditFiguresProvider.select((f) => f.isPro));
});

/// The way into the Get Pro sheet from a place that says something needs Pro. Draws nothing with
/// `PLAY_BILLING` off, for a student who is already Pro, and when signed out.
class GetProEntry extends ConsumerWidget {
  /// A secondary key (a gate that stands alone).
  const GetProEntry.key({super.key, this.label = BillingCopy.getPro, this.topGap = 0, this.note}) : quiet = false;

  /// A text key (a line under other words).
  const GetProEntry.quiet({super.key, this.label = BillingCopy.getPro, this.topGap = 0, this.note}) : quiet = true;

  final String label;
  final bool quiet;

  /// Space above the entry. It belongs to the entry so that, with the flag off, no gap is left.
  final double topGap;

  /// One calm line above the key (what Pro changes here).
  final String? note;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!ref.watch(getProAvailableProvider)) return const SizedBox.shrink();
    void open() => showGetProSheet(context);
    final key = quiet ? KeyButton.quiet(label: label, onPressed: open) : KeyButton.secondary(label: label, expanded: false, minHeight: 48, onPressed: open);
    final n = note;
    return Padding(
      padding: EdgeInsets.only(top: topGap),
      child: n == null
          ? key
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(n, style: context.mmType.small.copyWith(color: context.mmColors.ink2)),
                const SizedBox(height: MmSpace.s8),
                key,
              ],
            ),
    );
  }
}

/// The way into the Wallet's top-ups from a credits-low state: Ask Mobi's out-of-credits band and
/// Practice's credits-low state. Draws nothing with the flag off, so no key ever promises a top-up
/// that is not there.
class WalletTopUpEntry extends ConsumerWidget {
  const WalletTopUpEntry({super.key, this.label = BillingCopy.getCredits});

  final String label;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!ref.watch(playBillingEnabledProvider) || ref.watch(playBillingUserIdProvider) == null) return const SizedBox.shrink();
    return KeyButton.quiet(label: label, onPressed: () => openCreditsPage(context));
  }
}
