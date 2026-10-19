import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../wallet/data/wallet_data.dart';
import '../billing_copy.dart';
import '../data/billing_controller.dart';
import '../data/play_products.dart';
import 'billing_notice.dart';

/// The best-value maths for the credit packs, from Google Play's own raw prices (version 13, I9).
///
/// Each pack's cost per credit is its raw price over its credits. The pack with the lowest cost per
/// credit is the best value, but only when it is really cheaper per credit than the dearest pack (equal
/// packs mark nothing). Each pack cheaper per credit than the dearest one carries its saving, rounded
/// down to a whole percent, so the number on the card is never more than the maths gives.
class PackValue {
  const PackValue({this.bestId, this.savePercent = const {}});

  final String? bestId;
  final Map<String, int> savePercent;

  static PackValue of(Map<String, double> rawPrices, Map<String, int> credits) {
    final perCredit = <String, double>{
      for (final e in rawPrices.entries)
        if (e.value > 0 && (credits[e.key] ?? 0) > 0) e.key: e.value / credits[e.key]!,
    };
    if (perCredit.length < 2) return const PackValue();
    final dearest = perCredit.values.reduce((a, b) => a > b ? a : b);
    String? best;
    for (final e in perCredit.entries) {
      if (e.value >= dearest - 1e-9) continue;
      final b = best;
      if (b == null || e.value < perCredit[b]! - 1e-9 || ((e.value - perCredit[b]!).abs() < 1e-9 && credits[e.key]! > credits[b]!)) {
        best = e.key;
      }
    }
    final save = <String, int>{};
    for (final e in perCredit.entries) {
      final pct = ((1 - e.value / dearest) * 100 + 1e-9).floor();
      if (pct >= 1) save[e.key] = pct;
    }
    return PackValue(bestId: best, savePercent: save);
  }
}

/// The Wallet's top-ups: one set of credit packs for the one credits balance, as cards. Each card is
/// the credits and Google Play's own price (no "1 full mock or 50 questions" line: it undersells); the best value is marked by the real
/// maths ([PackValue]). Nothing is added until the server confirms the purchase; then the pack is named
/// and the new balance said. A balance is never edited here.
///
/// With `PLAY_BILLING` off one calm line says top-ups open soon (the Wallet does not draw this at all then).
class WalletTopUps extends ConsumerStatefulWidget {
  const WalletTopUps({super.key});

  @override
  ConsumerState<WalletTopUps> createState() => _WalletTopUpsState();
}

class _WalletTopUpsState extends ConsumerState<WalletTopUps> {
  bool get _on => ref.read(playBillingEnabledProvider);

  /// The balance when the student tapped a pack. The confirmation names the new balance only once the
  /// server's figure has moved from it, so it never says a stale number.
  int? _totalAtBuy;

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
    final boughtPack = bought != null && bought.kind == PlayProductKind.creditPack ? bought : null;
    final total = ref.watch(walletViewProvider.select((v) => v.total));
    final pro = ref.watch(walletViewProvider.select((v) => v.isPro));
    final value = PackValue.of(
      {for (final p in packs) if (s.products[p.id] != null) p.id: s.products[p.id]!.rawPrice},
      {for (final p in packs) p.id: p.credits ?? 0},
    );

    final Widget body;
    if (anyPrice) {
      body = Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final (i, pack) in packs.indexed) ...[
            if (i > 0) const SizedBox(height: MmSpace.s12),
            PackCard(
              pack: pack,
              price: s.priceOf(pack.id),
              best: value.bestId == pack.id,
              savePercent: value.savePercent[pack.id],
              enabled: !s.busy && s.priceOf(pack.id) != null,
              working: s.productId == pack.id && (s.stage == BillingStage.starting || s.stage == BillingStage.verifying || s.stage == BillingStage.pending),
              onTap: () {
                _totalAtBuy = ref.read(walletViewProvider).total;
                ctl.buy(pack.id);
              },
            ),
          ],
        ],
      );
    } else if (loading) {
      body = const SkeletonGroup(
        label: BillingCopy.checkingStore,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Skeleton(height: 84),
            SizedBox(height: MmSpace.s12),
            Skeleton(height: 84),
            SizedBox(height: MmSpace.s12),
            Skeleton(height: 84),
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
        Text(pro ? BillingCopy.topUpsLeadPro : BillingCopy.topUpsLeadFree, style: type.small.copyWith(color: colors.ink2)),
        const SizedBox(height: MmSpace.s16),
        body,
        BillingNotice(ids: ids),
        if (boughtPack != null)
          Padding(
            padding: const EdgeInsets.only(top: MmSpace.s12),
            child: _Added(credits: boughtPack.credits, total: total != null && total != _totalAtBuy ? total : null),
          ),
        const SizedBox(height: MmSpace.s12),
        Text(BillingCopy.googlePlayNote, style: type.caption.copyWith(color: colors.ink3)),
      ],
    );
  }
}

/// The server confirmed a pack: what was added and the new balance. Only built after the server's yes.
class _Added extends StatelessWidget {
  const _Added({required this.credits, required this.total});

  final int? credits;
  final int? total;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      container: true,
      liveRegion: true,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: colors.raised,
          borderRadius: MmRadius.smallAll,
          border: Border.all(color: colors.voltEdge),
        ),
        child: Padding(
          padding: const EdgeInsets.all(MmSpace.s16),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ExcludeSemantics(
                child: DecoratedBox(
                  decoration: BoxDecoration(color: colors.volt, shape: BoxShape.circle),
                  child: Padding(padding: const EdgeInsets.all(6), child: Icon(LucideIcons.check, size: 16, color: colors.voltInk)),
                ),
              ),
              const SizedBox(width: MmSpace.s12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(BillingCopy.creditsAddedTitle(credits), style: type.labelLarge),
                    const SizedBox(height: 2),
                    Text(total == null ? BillingCopy.creditsAddedBody : BillingCopy.balanceNow(total!), style: type.small.copyWith(color: colors.ink2)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// One credit pack: the credits big on the left, Google Play's own price on the
/// right in a key-like pill. The best-value pack wears a volt edge and its tag; a saving is said plainly.
class PackCard extends StatelessWidget {
  const PackCard({
    super.key,
    required this.pack,
    required this.price,
    required this.enabled,
    required this.working,
    required this.onTap,
    this.best = false,
    this.savePercent,
  });

  final PlayProduct pack;
  final String? price;
  final bool enabled;
  final bool working;
  final VoidCallback onTap;
  final bool best;
  final int? savePercent;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final credits = pack.credits ?? 0;
    final dim = !enabled && !working;
    final save = savePercent;
    final spoken = [
      BillingCopy.packSemantics(credits, price),
      if (best) BillingCopy.bestValue,
      if (save != null) BillingCopy.savePercent(save),
    ].join('. ');

    final card = MmSurface.plain(
      onTap: enabled ? onTap : null,
      semanticsLabel: spoken,
      padding: const EdgeInsets.fromLTRB(MmSpace.s20, MmSpace.s16, MmSpace.s16, MmSpace.s16),
      child: ExcludeSemantics(
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (best || save != null) ...[
                    Wrap(
                      spacing: MmSpace.s8,
                      runSpacing: MmSpace.s4,
                      children: [
                        if (best) _Tag(text: BillingCopy.bestValue, strong: true),
                        if (save != null) _Tag(text: BillingCopy.savePercent(save), strong: false),
                      ],
                    ),
                    const SizedBox(height: MmSpace.s8),
                  ],
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    children: [
                      Text(
                        '$credits',
                        textHeightBehavior: MmType.figureHeightBehavior,
                        style: type.figureCompact.copyWith(color: dim ? colors.ink3 : colors.ink),
                      ),
                      const SizedBox(width: MmSpace.s6),
                      Text(credits == 1 ? 'credit' : 'credits', style: type.labelLarge.copyWith(color: dim ? colors.ink3 : colors.ink2)),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(width: MmSpace.s12),
            _PricePill(price: price, enabled: enabled, working: working, strong: best),
          ],
        ),
      ),
    );
    if (!best) return card;
    return DecoratedBox(
      position: DecorationPosition.foreground,
      decoration: BoxDecoration(
        borderRadius: MmRadius.panelAll,
        border: Border.all(color: colors.voltEdge, width: 1.5),
      ),
      child: card,
    );
  }
}

class _Tag extends StatelessWidget {
  const _Tag({required this.text, required this.strong});

  final String text;
  final bool strong;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: strong ? colors.volt : null,
        borderRadius: MmRadius.pillAll,
        border: strong ? null : Border.all(color: colors.lineStrong),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.s8, vertical: 2),
        child: Text(
          text,
          style: context.mmType.caption.copyWith(color: strong ? colors.voltInk : colors.ink2, fontWeight: FontWeight.w700),
        ),
      ),
    );
  }
}

class _PricePill extends StatelessWidget {
  const _PricePill({required this.price, required this.enabled, required this.working, required this.strong});

  final String? price;
  final bool enabled;
  final bool working;
  final bool strong;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final fill = strong && enabled ? colors.volt : colors.raised2;
    final ink = strong && enabled ? colors.voltInk : (enabled ? colors.ink : colors.ink3);
    return ConstrainedBox(
      constraints: const BoxConstraints(minWidth: 88, minHeight: MmTarget.min),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: fill,
          borderRadius: MmRadius.pillAll,
          border: strong && enabled ? null : Border.all(color: colors.line),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.s16, vertical: MmSpace.s12),
          child: Center(
            widthFactor: 1,
            heightFactor: 1,
            child: working
                ? MmSpinner(color: ink, size: 18, strokeWidth: 2)
                : Text(
                    price ?? '',
                    style: type.labelLarge.copyWith(fontWeight: FontWeight.w700, fontFeatures: const [FontFeature.tabularFigures()], color: ink),
                  ),
          ),
        ),
      ),
    );
  }
}
