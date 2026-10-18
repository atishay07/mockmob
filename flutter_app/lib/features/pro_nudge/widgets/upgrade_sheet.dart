import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../billing/billing_copy.dart';
import '../../billing/data/billing_controller.dart';
import '../../billing/data/play_products.dart';
import '../../billing/widgets/billing_notice.dart';
import '../../credits/data/credit_figures.dart';
import '../copy.dart';
import '../data/pro_benefits.dart';
import '../data/pro_facts_provider.dart';
import '../data/pro_nudge_controller.dart';

/// Opens the Upgrade sheet for [reason] and returns true, or does nothing and returns false when
/// the Pro nudges are off for this student (`PLAY_BILLING` off, signed out, or already Pro). A
/// caller that gates a feature uses the answer: false means "do what you did before".
///
/// The sheet sells through Google Play Billing only: the price is Google Play's own string and the
/// purchase is the billing controller's, so nothing here can grant Pro or show another price.
bool showUpgradeSheetIfOn(BuildContext context, {required ProReason reason}) {
  final container = ProviderScope.containerOf(context, listen: false);
  if (!container.read(proNudgesOnProvider)) return false;
  unawaited(showMmSheet<void>(
    context: context,
    title: ProNudgeCopy.head(reason).title,
    builder: (sheet) => UpgradeSheetBody(reason: reason, onClose: () => Navigator.of(sheet).maybePop()),
  ));
  return true;
}

/// The Upgrade sheet's content: the headline is the sheet's title, then the line under it (why Pro is on offer here), the
/// lines that are about this student (or the plain list when there are none), Google Play's price, one
/// key to buy and Restore purchases. Every state is honest, as the Get Pro sheet's: checking Google Play,
/// Google Play unavailable, the product missing, a pending payment, the server confirming, a cancel, a
/// failure with Try again. "Pro is on" appears only after the server confirmed the purchase.
class UpgradeSheetBody extends ConsumerStatefulWidget {
  const UpgradeSheetBody({super.key, required this.reason, this.onClose});

  final ProReason reason;
  final VoidCallback? onClose;

  @override
  ConsumerState<UpgradeSheetBody> createState() => _UpgradeSheetBodyState();
}

class _UpgradeSheetBodyState extends ConsumerState<UpgradeSheetBody> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final ctl = ref.read(playBillingProvider.notifier);
      // An outcome from an earlier visit (a cancel, a failure) is old news on a fresh sheet; work in
      // progress is kept.
      ctl.clearOutcome();
      ctl.loadProducts();
    });
  }

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(playBillingProvider);
    final isPro = ref.watch(creditFiguresProvider.select((f) => f.isPro));
    final confirmed = s.stage == BillingStage.confirmed && (s.productId == PlayProducts.proId || s.productId == null);
    if (confirmed || (isPro && !s.busy)) {
      return BillingConfirmed(title: BillingCopy.proOnTitle, body: BillingCopy.proOnBody, onDone: widget.onClose ?? () {});
    }

    final colors = context.mmColors;
    final type = context.mmType;
    final ctl = ref.read(playBillingProvider.notifier);
    final facts = ref.watch(proFactsProvider);
    final personal = ProBenefits.isPersonal(facts, reason: widget.reason);
    final lines = ProBenefits.lines(facts, reason: widget.reason);
    final price = s.priceOf(PlayProducts.proId);
    final working = s.stage == BillingStage.starting || s.stage == BillingStage.verifying;
    final loadingStore = s.productsLoading || (s.store == StoreAvailability.checking && s.products.isEmpty);

    final Widget priceArea;
    if (price != null) {
      priceArea = _PriceBlock(price: price);
    } else if (loadingStore) {
      priceArea = const _PriceLoading();
    } else {
      priceArea = _Unavailable(
        message: s.store == StoreAvailability.unavailable
            ? BillingCopy.storeUnavailable
            : s.productsFailed
                ? BillingCopy.storeUnreachable
                : BillingCopy.productUnavailable,
        onRetry: () => ctl.loadProducts(force: true),
      );
    }

    return Semantics(
      label: ProNudgeCopy.sheetLabel,
      container: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(ProNudgeCopy.head(widget.reason).lede, style: type.lead.copyWith(color: colors.ink2)),
          const SizedBox(height: MmSpace.s20),
          Semantics(
            header: true,
            child: Text(personal ? ProNudgeCopy.forYouHeading : ProNudgeCopy.includesHeading, style: type.labelLarge.copyWith(color: colors.ink2)),
          ),
          const SizedBox(height: MmSpace.s8),
          for (final line in lines) _BenefitRow(text: line),
          const SizedBox(height: MmSpace.s20),
          MmOverlapSwitcher.fade(
            alignment: Alignment.topLeft,
            child: KeyedSubtree(key: ValueKey(price != null ? 'price' : (loadingStore ? 'loading' : 'unavailable')), child: priceArea),
          ),
          BillingNotice(ids: {PlayProducts.proId}, showRestore: true),
          const SizedBox(height: MmSpace.s16),
          KeyButton(
            label: BillingCopy.getPro,
            loading: working,
            onPressed: price == null || s.busy ? null : () => ctl.buy(PlayProducts.proId),
          ),
          const SizedBox(height: MmSpace.s4),
          // A Wrap, so at large text on a narrow phone the second key goes under the first instead of off the edge.
          Wrap(
            alignment: WrapAlignment.center,
            children: [
              KeyButton.quiet(label: ProNudgeCopy.notNow, onPressed: widget.onClose),
              KeyButton.quiet(label: BillingCopy.restore, onPressed: s.busy ? null : () => ctl.restore()),
            ],
          ),
          const SizedBox(height: MmSpace.s4),
          Text(BillingCopy.googlePlayNote, textAlign: TextAlign.center, style: type.caption.copyWith(color: colors.ink3)),
        ],
      ),
    );
  }
}

class _PriceBlock extends StatelessWidget {
  const _PriceBlock({required this.price});

  final String price;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      container: true,
      label: '${BillingCopy.proTitle}, $price. ${BillingCopy.proTerms}',
      excludeSemantics: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(price, style: type.figureCompact.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
          const SizedBox(height: MmSpace.s4),
          Text(BillingCopy.proTerms, style: type.small.copyWith(color: colors.ink2)),
        ],
      ),
    );
  }
}

class _PriceLoading extends StatelessWidget {
  const _PriceLoading();

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return SkeletonGroup(
      label: BillingCopy.checkingStore,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // The price's own height, so the sheet does not jump when it arrives.
          const Skeleton.line(width: 120, height: 36),
          const SizedBox(height: MmSpace.s8),
          Text(BillingCopy.checkingStore, style: context.mmType.small.copyWith(color: colors.ink2)),
        ],
      ),
    );
  }
}

class _Unavailable extends StatelessWidget {
  const _Unavailable({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Semantics(container: true, liveRegion: true, child: Text(message, style: context.mmType.body.copyWith(color: colors.ink2))),
        const SizedBox(height: MmSpace.s8),
        KeyButton.secondary(label: BillingCopy.tryAgain, expanded: false, minHeight: MmTarget.min, onPressed: onRetry),
      ],
    );
  }
}

class _BenefitRow extends StatelessWidget {
  const _BenefitRow({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: MmSpace.s4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 3),
            child: ExcludeSemantics(child: Icon(LucideIcons.check, size: 18, color: colors.ink2)),
          ),
          const SizedBox(width: MmSpace.s12),
          Expanded(child: Text(text, style: context.mmType.body)),
        ],
      ),
    );
  }
}
