import 'dart:async';
import 'dart:math' as math;

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
import '../../billing/widgets/pro_page.dart' show ProHeroArt, ProPageArgs, openProPage;
import '../../billing/widgets/get_pro_sheet.dart' show proMonthlyPrice, proPriceParts, proStatusOf, proStatusView;
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
  // The student chose this ask themselves: the first-session sheet never follows it (D181).
  container.read(proNudgeProvider.notifier).upgradeOpened();
  // Every upgrade opens the full-screen Pro page (owner I6, 20 Oct), headed by what asked for Pro,
  // with the lines that are about this student when there are any.
  final head = ProNudgeCopy.head(reason);
  unawaited(openProPage(
    context,
    args: ProPageArgs(
      headline: head.title,
      lede: head.lede,
      personal: (ref) {
        final facts = ref.watch(proFactsProvider);
        return ProBenefits.isPersonal(facts, reason: reason) ? ProBenefits.lines(facts, reason: reason) : const <String>[];
      },
      personalHeading: ProNudgeCopy.forYouHeading,
    ),
  ));
  return true;
}

/// The Upgrade sheet: Pro in a dismissible bottom sheet with Not now. The first-session ask uses it (D181);
/// every upgrade the student opens themselves is the full Pro page ([showUpgradeSheetIfOn]).
///
/// Visual first (D185): the Pro page's own art, one short headline and at most three one-line rows. Google
/// Play's price, Get Pro and Not now are pinned under the body ([UpgradeSheetKeys]), so on a short phone at
/// large text the way out is never below the fold.
bool showUpgradeBottomSheetIfOn(BuildContext context, {required ProReason reason}) {
  final container = ProviderScope.containerOf(context, listen: false);
  if (!container.read(proNudgesOnProvider)) return false;
  unawaited(showMmSheet<void>(
    context: context,
    // No sheet title: the art leads and the body sets the headline under it. A status (Pro is on, a
    // subscription to fix in Google Play) brings its own heading.
    builder: (sheet) => UpgradeSheetBody(reason: reason, onClose: () => Navigator.of(sheet).maybePop(), keysPinned: true),
    footer: (sheet) => UpgradeSheetKeys(onClose: () => Navigator.of(sheet).maybePop()),
  ));
  return true;
}

/// The Upgrade sheet's content: the Pro page's art, the one-line headline, and the student's own facts in
/// short (or the plain benefits when there are none), at most three rows of one line each. Every state is
/// honest, as the Get Pro sheet's: checking Google Play, Google Play unavailable, the product missing, a pending
/// payment, the server confirming, a cancel, a failure with Try again ([UpgradeSheetKeys]). "Pro is on" appears
/// only after the server confirmed the purchase.
class UpgradeSheetBody extends ConsumerStatefulWidget {
  const UpgradeSheetBody({super.key, required this.reason, this.onClose, this.keysPinned = false});

  final ProReason reason;
  final VoidCallback? onClose;

  /// The sheet draws the price, Get Pro and Not now itself, pinned under this body ([UpgradeSheetKeys]); the
  /// body leaves them out.
  final bool keysPinned;

  /// Above this text scale the sheet gives its room to the words: smaller art without its label, tighter gaps.
  static const double largeText = 1.15;

  /// The screen's height over the text scale below which the sheet shows two rows, not three (a 360 by 640 phone
  /// at 1.3x text).
  static const double shortRoom = 560;

  /// The art's height: a fifth of the screen, between 88 and 168 dp, and smaller at large text, so the
  /// headline and the rows keep their room above the pinned keys.
  static double artHeightFor(BuildContext context) {
    final screen = MediaQuery.sizeOf(context).height;
    final text = math.max(1.0, MediaQuery.textScalerOf(context).scale(1));
    return (screen * 0.2 / (text * text)).clamp(88.0, 168.0);
  }

  @override
  ConsumerState<UpgradeSheetBody> createState() => _UpgradeSheetBodyState();
}

class _UpgradeSheetBodyState extends ConsumerState<UpgradeSheetBody> with SingleTickerProviderStateMixin {
  bool _manageFailed = false;

  /// The lamp light that crosses the seal once the sheet has risen, as on the Pro page.
  late final AnimationController _sweep = AnimationController(vsync: this, duration: const Duration(milliseconds: 1500));
  Timer? _sweepAfterRise;

  Future<void> _manage() async {
    final opened = await ref.read(playBillingProvider.notifier).manageSubscription();
    if (mounted) setState(() => _manageFailed = !opened);
  }

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
      if (Motion.reduced(context)) {
        _sweep.value = 1;
      } else {
        _sweepAfterRise = Timer(Motion.sheetIn, () {
          if (mounted) _sweep.forward();
        });
      }
    });
  }

  @override
  void dispose() {
    _sweepAfterRise?.cancel();
    _sweep.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(playBillingProvider);
    final isPro = ref.watch(creditFiguresProvider.select((f) => f.isPro));
    // Pro on (with the subscription's renewal line and Manage subscription for a Play subscriber), or a
    // subscription on hold or paused that is fixed in Google Play: the same answers as the Get Pro sheet.
    final status = proStatusView(
      s: s,
      isPro: isPro,
      sub: ref.watch(playSubscriptionProvider),
      onDone: widget.onClose ?? () {},
      onManage: _manage,
      manageFailed: _manageFailed,
      closeLabel: ProNudgeCopy.notNow,
    );
    if (status != null) return status;

    final type = context.mmType;
    final text = MediaQuery.textScalerOf(context).scale(1);
    final large = text > UpgradeSheetBody.largeText;
    // A short phone at large text keeps the two most personal rows, so nothing sits half cut above the keys.
    final room = MediaQuery.sizeOf(context).height / math.max(1.0, text);
    final rows = ProBenefits.shortLines(ref.watch(proFactsProvider), reason: widget.reason).take(room < UpgradeSheetBody.shortRoom ? 2 : ProBenefits.maxShort);

    return Semantics(
      label: ProNudgeCopy.sheetLabel,
      container: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          ProHeroArt(height: UpgradeSheetBody.artHeightFor(context), sweep: _sweep, showLabel: !large),
          SizedBox(height: large ? MmSpace.s8 : MmSpace.s12),
          Semantics(
            header: true,
            child: Text(ProNudgeCopy.sheetHeadline(widget.reason), textAlign: TextAlign.center, style: type.screenTitle.copyWith(fontSize: 24)),
          ),
          SizedBox(height: large ? MmSpace.s8 : MmSpace.s16),
          for (final row in rows) _BenefitRow(line: row, tight: large),
          if (!widget.keysPinned) ...[
            const SizedBox(height: MmSpace.s16),
            UpgradeSheetKeys(onClose: widget.onClose),
          ],
        ],
      ),
    );
  }
}

/// Get Pro and, under it, Not now and Restore purchases: the sheet's keys, under the price ([UpgradeSheetKeys]).
class UpgradeBuyKeys extends ConsumerWidget {
  const UpgradeBuyKeys({super.key, required this.onClose});

  final VoidCallback? onClose;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(playBillingProvider);
    final ctl = ref.read(playBillingProvider.notifier);
    final price = proMonthlyPrice(s);
    final working = s.stage == BillingStage.starting || s.stage == BillingStage.verifying;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
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
            KeyButton.quiet(label: ProNudgeCopy.notNow, onPressed: onClose),
            KeyButton.quiet(label: BillingCopy.restore, onPressed: s.busy ? null : () => ctl.restore()),
          ],
        ),
      ],
    );
  }
}

/// The foot of the Upgrade sheet, pinned under its body: Google Play's price as one figure with its period and
/// one line of terms (or, while it cannot sell, checking Google Play, or why not with Try again), the purchase's
/// own progress ([BillingNotice]: pending, confirming, cancelled, a failure), then [UpgradeBuyKeys]. Nothing
/// while the sheet shows a status instead (Pro is on, or a subscription is fixed in Google Play), which has its
/// own keys.
class UpgradeSheetKeys extends ConsumerWidget {
  const UpgradeSheetKeys({super.key, required this.onClose});

  final VoidCallback? onClose;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(playBillingProvider);
    final status = proStatusOf(
      s: s,
      isPro: ref.watch(creditFiguresProvider.select((f) => f.isPro)),
      sub: ref.watch(playSubscriptionProvider),
    );
    if (status != null) return const SizedBox.shrink();
    final ctl = ref.read(playBillingProvider.notifier);
    final parts = proPriceParts(s);
    final loadingStore = s.productsLoading || (s.store == StoreAvailability.checking && s.products.isEmpty);

    final Widget priceArea;
    if (parts != null) {
      priceArea = _SheetPrice(parts: parts);
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
          child: KeyedSubtree(key: ValueKey(parts != null ? 'price' : (loadingStore ? 'loading' : 'unavailable')), child: priceArea),
        ),
        BillingNotice(ids: {PlayProducts.proId}, showRestore: true),
        const SizedBox(height: MmSpace.s12),
        UpgradeBuyKeys(onClose: onClose),
      ],
    );
  }
}

/// Google Play's price, once: the figure with its period beside it, and the one line of terms. Read aloud as
/// one sentence.
class _SheetPrice extends StatelessWidget {
  const _SheetPrice({required this.parts});

  final ({String price, String? period}) parts;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final period = parts.period;
    return Semantics(
      container: true,
      excludeSemantics: true,
      label: '${BillingCopy.proPageLabel}, ${BillingCopy.pricePer(parts.price, period)}. ${ProNudgeCopy.cancelAnytime}',
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text.rich(
            TextSpan(children: [
              TextSpan(text: parts.price, style: type.title.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
              if (period != null) TextSpan(text: ' $period', style: type.body.copyWith(color: colors.ink2)),
            ]),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: MmSpace.s2),
          Text(ProNudgeCopy.cancelAnytime, textAlign: TextAlign.center, style: type.caption.copyWith(color: colors.ink2)),
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
        mainAxisSize: MainAxisSize.min,
        children: [
          // The price's own height, so the sheet does not jump when it arrives.
          const Skeleton.line(width: 140, height: 27),
          const SizedBox(height: MmSpace.s2),
          Text(BillingCopy.checkingStore, textAlign: TextAlign.center, style: context.mmType.caption.copyWith(color: colors.ink2)),
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
      mainAxisSize: MainAxisSize.min,
      children: [
        Semantics(
          container: true,
          liveRegion: true,
          child: Text(message, textAlign: TextAlign.center, style: context.mmType.small.copyWith(color: colors.ink2)),
        ),
        const SizedBox(height: MmSpace.s4),
        KeyButton.secondary(label: BillingCopy.tryAgain, expanded: false, minHeight: MmTarget.min, onPressed: onRetry),
      ],
    );
  }
}

/// One row: the benefit's icon on a soft chip, and its one line.
class _BenefitRow extends StatelessWidget {
  const _BenefitRow({required this.line, this.tight = false});

  final ProBenefitLine line;

  /// Less air between rows, at large text.
  final bool tight;

  static IconData iconFor(String id) => switch (id) {
        'weakest' || 'plain-smart' => LucideIcons.crosshair,
        'left' || 'used' || 'plain-credits' => LucideIcons.coins,
        'mocks' || 'plain-mocks' => LucideIcons.infinity,
        'subjects' || 'plain-nta' => LucideIcons.monitor,
        'colleges' => LucideIcons.compass,
        _ => LucideIcons.users,
      };

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final ink = colors.isNight ? colors.volt : colors.accentText;
    return Padding(
      padding: EdgeInsets.symmetric(vertical: tight ? MmSpace.s4 : MmSpace.s6),
      child: Row(
        children: [
          ExcludeSemantics(
            child: Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: ink.withValues(alpha: colors.isNight ? 0.12 : 0.1),
                borderRadius: BorderRadius.circular(MmSpace.s12),
              ),
              child: Icon(iconFor(line.id), size: 18, color: ink),
            ),
          ),
          const SizedBox(width: MmSpace.s12),
          Expanded(child: Text(line.text, style: context.mmType.body)),
        ],
      ),
    );
  }
}
