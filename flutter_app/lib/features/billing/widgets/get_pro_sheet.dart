import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../credits/data/credit_figures.dart';
import '../billing_copy.dart';
import '../data/billing_controller.dart';
import '../data/play_products.dart';
import 'billing_notice.dart';

/// Opens the Get Pro sheet. Does nothing with `PLAY_BILLING` off, so a caller never needs its own
/// check.
Future<void> showGetProSheet(BuildContext context) async {
  final container = ProviderScope.containerOf(context, listen: false);
  if (!container.read(playBillingEnabledProvider)) return;
  await showMmSheet<void>(
    context: context,
    title: BillingCopy.proTitle,
    builder: (sheet) => const GetProSheetBody(),
  );
}

/// What Pro includes, the price Google Play shows, one key to buy and a Restore purchases link.
/// Every state is honest: checking Google Play, Google Play unavailable, the product missing,
/// Google Play open, a pending payment, the server confirming, a cancel, a failure with Try again.
/// "Pro is on" appears only after the server confirmed the purchase.
class GetProSheetBody extends ConsumerStatefulWidget {
  const GetProSheetBody({super.key});

  @override
  ConsumerState<GetProSheetBody> createState() => _GetProSheetBodyState();
}

class _GetProSheetBodyState extends ConsumerState<GetProSheetBody> {
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

  void _close() => Navigator.of(context).maybePop();

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(playBillingProvider);
    final isPro = ref.watch(creditFiguresProvider.select((f) => f.isPro));
    final confirmed = s.stage == BillingStage.confirmed && (s.productId == PlayProducts.proId || s.productId == null);
    if (confirmed || (isPro && !s.busy)) {
      return BillingConfirmed(title: BillingCopy.proOnTitle, body: BillingCopy.proOnBody, onDone: _close);
    }

    final colors = context.mmColors;
    final type = context.mmType;
    final ctl = ref.read(playBillingProvider.notifier);
    final price = s.priceOf(PlayProducts.proId);
    final working = s.stage == BillingStage.starting || s.stage == BillingStage.verifying;
    final loadingStore = s.productsLoading || (s.store == StoreAvailability.checking && s.products.isEmpty);

    // What the price area says.
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

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        MmOverlapSwitcher.fade(
          alignment: Alignment.topLeft,
          child: KeyedSubtree(key: ValueKey(price != null ? 'price' : (loadingStore ? 'loading' : 'unavailable')), child: priceArea),
        ),
        const SizedBox(height: MmSpace.s24),
        Semantics(header: true, child: Text(BillingCopy.proIncludesHeading, style: type.labelLarge.copyWith(color: colors.ink2))),
        const SizedBox(height: MmSpace.s8),
        for (final line in BillingCopy.proIncludes) _IncludeRow(text: line),
        BillingNotice(ids: {PlayProducts.proId}, showRestore: true),
        const SizedBox(height: MmSpace.s20),
        KeyButton(
          label: BillingCopy.getPro,
          loading: working,
          onPressed: price == null || s.busy ? null : () => ctl.buy(PlayProducts.proId),
        ),
        const SizedBox(height: MmSpace.s4),
        Center(
          child: KeyButton.quiet(
            label: BillingCopy.restore,
            onPressed: s.busy ? null : () => ctl.restore(),
          ),
        ),
        const SizedBox(height: MmSpace.s4),
        Text(BillingCopy.googlePlayNote, textAlign: TextAlign.center, style: type.caption.copyWith(color: colors.ink3)),
      ],
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

class _IncludeRow extends StatelessWidget {
  const _IncludeRow({required this.text});

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
