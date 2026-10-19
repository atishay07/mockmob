import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/copy/formatters.dart' show formatDayMonth;
import '../../../core/models/auth_me.dart' show PlaySubscriptionInfo;
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../credits/data/credit_figures.dart';
import '../billing_copy.dart';
import '../data/billing_controller.dart';
import '../data/play_products.dart';
import '../data/play_store.dart' show billingPeriodOf;
import 'billing_notice.dart';
import 'pro_page.dart';

/// Opens the Pro page, the full screen every Get Pro and upgrade entry leads to (owner I6, 20 Oct:
/// "a separate screen for the Pro plan"). Does nothing with `PLAY_BILLING` off, so a caller never
/// needs its own check.
///
/// [reason] becomes the page's line under its headline (what the student was about to do);
/// [benefits] become lines about this moment over the showcase. Both are optional and plain
/// sentences. The price and the keys are always Google Play's.
Future<void> showGetProSheet(BuildContext context, {String? reason, List<String>? benefits}) {
  final lines = benefits == null || benefits.isEmpty ? null : benefits;
  return openProPage(
    context,
    args: ProPageArgs(
      lede: reason == null || reason.trim().isEmpty ? null : reason,
      personal: lines == null ? null : (_) => lines,
      personalHeading: lines == null ? null : BillingCopy.proIncludesHeading,
    ),
  );
}

/// The old Get Pro sheet, for a surface that still wants Pro in a sheet. Every entry now opens the
/// Pro page ([showGetProSheet]); this stays for the sheet's own states and tests.
Future<void> showGetProBottomSheet(BuildContext context, {String? reason, List<String>? benefits}) async {
  final container = ProviderScope.containerOf(context, listen: false);
  if (!container.read(playBillingEnabledProvider)) return;
  await showMmSheet<void>(
    context: context,
    // A payment problem to fix in Google Play is not framed by "Get Pro": its own heading leads.
    title: needsGooglePlay(container.read(playSubscriptionProvider)) ? null : BillingCopy.proTitle,
    builder: (sheet) => GetProSheetBody(reason: reason, benefits: benefits),
  );
}

/// What Pro includes, the monthly price Google Play shows, one key to subscribe and a Restore
/// purchases link. Every state is honest: checking Google Play, Google Play unavailable, the product
/// missing, Google Play open, a pending payment, the server confirming, a cancel, a failure with Try
/// again. "Pro is on" appears only after the server confirmed the purchase; for a Play subscriber it
/// says when the subscription renews (or that renewal is off, or that a payment is being retried)
/// and offers Manage subscription, which opens Google Play's own page. A subscription on hold or
/// paused says so and offers Manage subscription instead of a second subscription.
class GetProSheetBody extends ConsumerStatefulWidget {
  const GetProSheetBody({super.key, this.reason, this.benefits});

  /// One line above the price: why the sheet opened.
  final String? reason;

  /// Replaces the default "Pro includes" lines when non-empty.
  final List<String>? benefits;

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

  bool _manageFailed = false;

  Future<void> _manage() async {
    final opened = await ref.read(playBillingProvider.notifier).manageSubscription();
    if (mounted) setState(() => _manageFailed = !opened);
  }

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(playBillingProvider);
    final isPro = ref.watch(creditFiguresProvider.select((f) => f.isPro));
    final status = proStatusView(
      s: s,
      isPro: isPro,
      sub: ref.watch(playSubscriptionProvider),
      onDone: _close,
      onManage: _manage,
      manageFailed: _manageFailed,
    );
    if (status != null) return status;

    final colors = context.mmColors;
    final type = context.mmType;
    final ctl = ref.read(playBillingProvider.notifier);
    final price = proMonthlyPrice(s);
    final working = s.stage == BillingStage.starting || s.stage == BillingStage.verifying;
    final loadingStore = s.productsLoading || (s.store == StoreAvailability.checking && s.products.isEmpty);

    // What the price area says.
    final Widget priceArea;
    if (price != null) {
      priceArea = ProPriceBlock(parts: proPriceParts(s)!);
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
        if (widget.reason != null && widget.reason!.trim().isNotEmpty) ...[
          Text(widget.reason!, style: type.body),
          const SizedBox(height: MmSpace.s16),
        ],
        MmOverlapSwitcher.fade(
          alignment: Alignment.topLeft,
          child: KeyedSubtree(key: ValueKey(price != null ? 'price' : (loadingStore ? 'loading' : 'unavailable')), child: priceArea),
        ),
        const SizedBox(height: MmSpace.s24),
        Semantics(header: true, child: Text(BillingCopy.proIncludesHeading, style: type.labelLarge.copyWith(color: colors.ink2))),
        const SizedBox(height: MmSpace.s8),
        for (final line in (widget.benefits != null && widget.benefits!.isNotEmpty ? widget.benefits! : BillingCopy.proIncludes)) _IncludeRow(text: line),
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

/// Google Play's price for Pro with its period ("₹149.00 a month"), or null while Google Play has
/// not returned it.
String? proMonthlyPrice(PlayBillingState s) {
  final parts = proPriceParts(s);
  return parts == null ? null : BillingCopy.pricePer(parts.price, parts.period);
}

/// Google Play's price for Pro and its period words, apart, so the figure and "a month" can be set
/// in their own sizes. Null while Google Play has not returned the price.
({String price, String? period})? proPriceParts(PlayBillingState s) {
  final details = s.products[PlayProducts.proId];
  return details == null ? null : (price: details.price, period: BillingCopy.periodWords(billingPeriodOf(details)));
}

/// The price as the Pro sheets show it: Google Play's figure large, its period beside it in body
/// text, and the renewal line under it. Read aloud as one sentence.
class ProPriceBlock extends StatelessWidget {
  const ProPriceBlock({super.key, required this.parts});

  final ({String price, String? period}) parts;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final period = parts.period;
    return Semantics(
      container: true,
      label: '${BillingCopy.proTitle}, ${BillingCopy.pricePer(parts.price, period)}. ${BillingCopy.proTerms}',
      excludeSemantics: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text.rich(
            TextSpan(children: [
              TextSpan(text: parts.price, style: type.figureCompact.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
              if (period != null) TextSpan(text: ' $period', style: type.body.copyWith(color: colors.ink2)),
            ]),
          ),
          const SizedBox(height: MmSpace.s4),
          Text(BillingCopy.proTerms, style: type.small.copyWith(color: colors.ink2)),
        ],
      ),
    );
  }
}

/// A subscription Google Play holds that gives no Pro now and is fixed there (account hold, paused).
bool subscriptionHeld(PlaySubscriptionInfo? sub) => sub != null && !sub.active && (sub.onHold || sub.state == 'paused');

/// The subscription needs the student in Google Play: held (no Pro now), or a payment Google Play is
/// retrying (Pro on for now, lost when the grace period ends).
bool needsGooglePlay(PlaySubscriptionInfo? sub) => subscriptionHeld(sub) || (sub != null && sub.active && sub.inGracePeriod);

/// What a Pro sheet shows instead of selling, or null when it should sell:
/// * Pro is on (just confirmed, or already Pro): for a Play subscriber, when it renews (or that
///   renewal is off) and Manage subscription;
/// * a payment Google Play is retrying (grace period): Pro is still on, but the sheet asks the
///   student to act, with Manage subscription as its main key;
/// * a subscription Google Play holds that gives no Pro now and is fixed there (on hold, paused):
///   what happened and Manage subscription, never a second subscription.
///
/// [closeLabel] names the quiet key that leaves a payment problem ("Close" on the Get Pro sheet,
/// "Not now" on the Upgrade sheet).
Widget? proStatusView({
  required PlayBillingState s,
  required bool isPro,
  required PlaySubscriptionInfo? sub,
  required VoidCallback onDone,
  required VoidCallback onManage,
  required bool manageFailed,
  String closeLabel = BillingCopy.close,
}) {
  final status = proStatusOf(s: s, isPro: isPro, sub: sub);
  if (status == null) return null;
  switch (status.kind) {
    case ProStatusKind.grace:
      return _FixInGooglePlay(
        title: status.title,
        message: status.message,
        onManage: onManage,
        failedToOpen: manageFailed,
        closeLabel: BillingCopy.done,
        onClose: onDone,
      );
    case ProStatusKind.on:
      return BillingConfirmed(
        title: status.title,
        body: status.message,
        onDone: onDone,
        secondaryLabel: status.canManage ? BillingCopy.manageSubscription : null,
        onSecondary: status.canManage ? onManage : null,
        note: manageFailed ? BillingCopy.manageOpenFailed : null,
      );
    case ProStatusKind.held:
      return _FixInGooglePlay(
        title: status.title,
        message: status.message,
        onManage: onManage,
        failedToOpen: manageFailed,
        closeLabel: closeLabel,
        onClose: onDone,
      );
  }
}

/// What a Pro surface shows instead of selling.
enum ProStatusKind {
  /// Pro is on (server-confirmed, or the student already has it).
  on,

  /// Pro is on for now, but Google Play could not take the payment and is retrying.
  grace,

  /// A subscription Google Play holds that gives no Pro now (on hold, paused).
  held,
}

/// One answer of [proStatusOf]: which view, its heading and its line, and whether Manage
/// subscription (Google Play's own page) belongs on it.
class ProStatus {
  const ProStatus({required this.kind, required this.title, required this.message, required this.canManage});

  final ProStatusKind kind;
  final String title;
  final String message;
  final bool canManage;
}

/// The one decision behind every Pro surface (the sheets and the Pro page): null when it should
/// sell, otherwise what to say. "Pro is on" only after the server confirmed, or for a student who is
/// Pro already and has nothing in flight.
ProStatus? proStatusOf({required PlayBillingState s, required bool isPro, required PlaySubscriptionInfo? sub}) {
  final confirmed = s.stage == BillingStage.confirmed && (s.productId == PlayProducts.proId || s.productId == null);
  if (confirmed || (isPro && !s.busy)) {
    final playSub = sub != null && sub.active ? sub : null;
    if (playSub != null && playSub.inGracePeriod) {
      return ProStatus(kind: ProStatusKind.grace, title: BillingCopy.subGraceTitle, message: subscriptionLine(playSub), canManage: true);
    }
    return ProStatus(
      kind: ProStatusKind.on,
      title: BillingCopy.proOnTitle,
      message: playSub == null ? BillingCopy.proOnBody : subscriptionLine(playSub),
      canManage: playSub != null,
    );
  }
  if (subscriptionHeld(sub) && !s.busy) {
    return ProStatus(
      kind: ProStatusKind.held,
      title: sub!.onHold ? BillingCopy.subOnHoldTitle : BillingCopy.subPausedTitle,
      message: sub.onHold ? BillingCopy.subOnHold : BillingCopy.subPaused,
      canManage: true,
    );
  }
  return null;
}

/// The line under "Pro is on" for a Play subscriber, from Google Play's own state: renewing on a
/// date, renewal off with the date Pro stays to, or a payment Google Play is retrying. Each has its
/// own line for when the server sent no date.
String subscriptionLine(PlaySubscriptionInfo sub) {
  final until = sub.expiresAt?.toLocal();
  final date = until == null ? null : formatDayMonth(until);
  if (sub.inGracePeriod) return date == null ? BillingCopy.subGraceNoDate : BillingCopy.subGrace(date);
  if (sub.autoRenewing == false) return date == null ? BillingCopy.subRenewalOffNoDate : BillingCopy.subRenewalOff(date);
  return date == null ? BillingCopy.subRenewsNoDate : BillingCopy.subRenews(date);
}

/// A subscription that needs the student in Google Play: a payment it is retrying, or a subscription
/// it holds that gives no Pro now (account hold, paused). A warning, never a success: what happened,
/// Manage subscription (Google Play's own page) as the main key, and a quiet key to leave.
class _FixInGooglePlay extends StatelessWidget {
  const _FixInGooglePlay({
    required this.title,
    required this.message,
    required this.onManage,
    required this.failedToOpen,
    required this.closeLabel,
    required this.onClose,
  });

  final String title;
  final String message;
  final VoidCallback onManage;
  final bool failedToOpen;
  final String closeLabel;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Semantics(
          container: true,
          liveRegion: true,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ExcludeSemantics(child: Icon(LucideIcons.triangleAlert, size: 24, color: colors.warnText)),
              const SizedBox(height: MmSpace.s12),
              Semantics(header: true, child: Text(title, style: type.title)),
              const SizedBox(height: MmSpace.s8),
              Text(message, style: type.body.copyWith(color: colors.ink2)),
            ],
          ),
        ),
        const SizedBox(height: MmSpace.s24),
        KeyButton(label: BillingCopy.manageSubscription, onPressed: onManage),
        if (failedToOpen) ...[
          const SizedBox(height: MmSpace.s8),
          Semantics(liveRegion: true, child: Text(BillingCopy.manageOpenFailed, textAlign: TextAlign.center, style: type.small.copyWith(color: colors.ink2))),
        ],
        const SizedBox(height: MmSpace.s4),
        Center(child: KeyButton.quiet(label: closeLabel, onPressed: onClose)),
        const SizedBox(height: MmSpace.s4),
        Text(BillingCopy.googlePlayNote, textAlign: TextAlign.center, style: type.caption.copyWith(color: colors.ink3)),
      ],
    );
  }
}
