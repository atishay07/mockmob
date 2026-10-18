import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../you/widgets/you_row.dart' show RowFrame, YouPanel;
import '../billing_copy.dart';
import '../data/billing_controller.dart';
import '../data/play_products.dart';
import 'billing_notice.dart';

/// The Wallet's top-ups: one set of credit packs for the one credits balance, as plain rows with
/// the credits on the left and Google Play's own price on the right. Nothing is added until the server confirms the purchase; the pack that was bought is
/// named afterwards. A balance is never edited here.
///
/// With `PLAY_BILLING` off the rows are not drawn at all: one calm line says top-ups open soon, so
/// there is no key that does nothing.
class WalletTopUps extends ConsumerStatefulWidget {
  const WalletTopUps({super.key});

  @override
  ConsumerState<WalletTopUps> createState() => _WalletTopUpsState();
}

class _WalletTopUpsState extends ConsumerState<WalletTopUps> {
  bool get _on => ref.read(playBillingEnabledProvider);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !_on) return;
      final ctl = ref.read(playBillingProvider.notifier);
      ctl.clearOutcome();
      ctl.loadProducts();
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    if (!ref.watch(playBillingEnabledProvider)) {
      return Text(BillingCopy.topUpsSoon, style: type.body.copyWith(color: colors.ink2));
    }
    final s = ref.watch(playBillingProvider);
    final ctl = ref.read(playBillingProvider.notifier);
    final packs = PlayProducts.packs;
    final ids = {for (final p in packs) p.id};
    final loading = s.productsLoading || (s.store == StoreAvailability.checking && s.products.isEmpty);
    final anyPrice = packs.any((p) => s.priceOf(p.id) != null);
    final bought = s.stage == BillingStage.confirmed ? PlayProducts.byId(s.productId ?? '') : null;
    final boughtPack = bought != null && bought.kind != PlayProductKind.pro ? bought : null;

    final Widget body;
    if (anyPrice) {
      body = Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          YouPanel(
            flat: true,
            margin: EdgeInsets.zero,
            inset: 0,
            children: [
              for (final pack in packs)
                _PackRow(
                  pack: pack,
                  price: s.priceOf(pack.id),
                  enabled: !s.busy && s.priceOf(pack.id) != null,
                  working: s.productId == pack.id && (s.stage == BillingStage.starting || s.stage == BillingStage.verifying),
                  onTap: () => ctl.buy(pack.id),
                ),
            ],
          ),
        ],
      );
    } else if (loading) {
      body = const SkeletonGroup(
        label: BillingCopy.checkingStore,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Skeleton(height: 48),
            SizedBox(height: MmSpace.s8),
            Skeleton(height: 48),
            SizedBox(height: MmSpace.s8),
            Skeleton(height: 48),
          ],
        ),
      );
    } else {
      body = Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Semantics(
            container: true,
            liveRegion: true,
            child: Text(
              s.store == StoreAvailability.unavailable
                  ? BillingCopy.storeUnavailable
                  : s.productsFailed
                      ? BillingCopy.storeUnreachable
                      : BillingCopy.productUnavailable,
              style: type.body.copyWith(color: colors.ink2),
            ),
          ),
          const SizedBox(height: MmSpace.s8),
          KeyButton.secondary(label: BillingCopy.tryAgain, expanded: false, minHeight: MmTarget.min, onPressed: () => ctl.loadProducts(force: true)),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        body,
        BillingNotice(ids: ids),
        if (boughtPack != null)
          Padding(
            padding: const EdgeInsets.only(top: MmSpace.s12),
            child: Semantics(
              container: true,
              liveRegion: true,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ExcludeSemantics(child: Icon(LucideIcons.check, size: 18, color: colors.ink)),
                  const SizedBox(width: MmSpace.s12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(BillingCopy.creditsAddedTitle(boughtPack.credits), style: type.labelLarge),
                        Text(BillingCopy.creditsAddedBody, style: type.small.copyWith(color: colors.ink2)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        const SizedBox(height: MmSpace.s8),
        Text(BillingCopy.googlePlayNote, style: type.caption.copyWith(color: colors.ink3)),
      ],
    );
  }
}

class _PackRow extends StatelessWidget {
  const _PackRow({required this.pack, required this.price, required this.enabled, required this.working, required this.onTap});

  final PlayProduct pack;
  final String? price;
  final bool enabled;
  final bool working;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final label = BillingCopy.packLabel(pack.credits ?? 0);
    return RowFrame(
      onTap: enabled ? onTap : null,
      semanticsLabel: BillingCopy.packSemantics(pack.credits ?? 0, price),
      padding: const EdgeInsets.symmetric(vertical: MmSpace.s12),
      child: Row(
        children: [
          Expanded(child: Text(label, style: type.body.copyWith(color: enabled || working ? colors.ink : colors.ink3))),
          const SizedBox(width: MmSpace.s12),
          if (working)
            MmSpinner(color: colors.ink2, size: 16, strokeWidth: 2)
          else
            Text(
              price ?? '',
              style: type.labelLarge.copyWith(fontWeight: FontWeight.w600, fontFeatures: const [FontFeature.tabularFigures()], color: enabled ? colors.ink : colors.ink3),
            ),
        ],
      ),
    );
  }
}
