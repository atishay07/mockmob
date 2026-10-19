import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../billing_copy.dart';
import '../data/billing_controller.dart';

/// Where the purchase stands, in words, for the surface that started it. Honest about each stage:
/// Google Play opening, a payment still pending, the server checking it, a cancel, a failure with
/// a way out. It never says a purchase worked: that is the success view's job, and only after the
/// server confirmed.
///
/// [ids] are the products this surface sells; a stage about another product is not shown here.
/// A restore (no product) shows on every surface that asks for it with [showRestore].
class BillingNotice extends ConsumerWidget {
  const BillingNotice({super.key, required this.ids, this.showRestore = false});

  final Set<String> ids;
  final bool showRestore;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(playBillingProvider);
    final mine = s.productId != null ? ids.contains(s.productId) : showRestore;
    final stage = mine ? s.stage : BillingStage.idle;
    final colors = context.mmColors;
    final type = context.mmType;

    Widget? child;
    switch (stage) {
      case BillingStage.idle:
      case BillingStage.confirmed:
        child = null;
      case BillingStage.starting:
        child = _Working(text: BillingCopy.opening);
      case BillingStage.verifying:
        child = _Working(text: BillingCopy.verifying);
      case BillingStage.restoring:
        child = _Working(text: BillingCopy.restoring);
      case BillingStage.pending:
        child = Text(BillingCopy.pending, style: type.small.copyWith(color: colors.ink2));
      case BillingStage.cancelled:
        child = Text(BillingCopy.cancelled, style: type.small.copyWith(color: colors.ink2));
      case BillingStage.restoredNothing:
        child = Text(BillingCopy.nothingToRestore, style: type.small.copyWith(color: colors.ink2));
      case BillingStage.failed:
        // A final answer (another account's purchase, a refund, a pass that ended, a refusal) offers
        // no Try again: sending it again cannot change it.
        // Google Play not ready: the sheet's own Try again (beside the line that says how) is the way out.
        final finalAnswer = (s.failure?.isFinal ?? false) || s.failure == BillingFailure.notReady;
        // A subscription on hold or paused is fixed in Google Play: the way out is its own page.
        final inPlay = s.failure?.fixedInGooglePlay ?? false;
        child = InlineBanner(
          message: billingFailureMessage(s.failure),
          tone: BannerTone.error,
          actionLabel: inPlay ? BillingCopy.manageSubscription : (finalAnswer ? null : BillingCopy.tryAgain),
          onAction: inPlay
              ? () => ref.read(playManageSubscriptionProvider)()
              : (finalAnswer ? null : () => ref.read(playBillingProvider.notifier).retry()),
        );
    }

    return MmOverlapSwitcher.fade(
      alignment: Alignment.topLeft,
      child: child == null
          ? const SizedBox(key: ValueKey('billing-notice-none'), width: double.infinity)
          : Padding(
              key: ValueKey('billing-notice-$stage-${s.failure}'),
              padding: const EdgeInsets.only(top: MmSpace.s12),
              child: Semantics(container: true, liveRegion: true, child: SizedBox(width: double.infinity, child: child)),
            ),
    );
  }
}

/// The sentence for each way a purchase can fail: what happened, and how to recover.
String billingFailureMessage(BillingFailure? failure) => switch (failure) {
      BillingFailure.couldNotConfirm => BillingCopy.failCouldNotConfirm,
      BillingFailure.offline => BillingCopy.failOffline,
      BillingFailure.notReady => BillingCopy.restoreNotReady,
      BillingFailure.notOpenYet => BillingCopy.failNotOpenYet,
      BillingFailure.rateLimited => BillingCopy.failRateLimited,
      BillingFailure.otherAccount => BillingCopy.failOtherAccount,
      BillingFailure.refunded => BillingCopy.failRefunded,
      BillingFailure.ended => BillingCopy.failEnded,
      BillingFailure.refused => BillingCopy.failRefused,
      BillingFailure.subscriptionOnHold => BillingCopy.subOnHold,
      BillingFailure.subscriptionPaused => BillingCopy.subPaused,
      BillingFailure.subscriptionEnded => BillingCopy.subEnded,
      BillingFailure.store || null => BillingCopy.failStore,
    };

class _Working extends StatelessWidget {
  const _Working({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Row(
      children: [
        MmSpinner(color: colors.ink2, size: 16, strokeWidth: 2),
        const SizedBox(width: MmSpace.s12),
        Expanded(child: Text(text, style: context.mmType.small.copyWith(color: colors.ink2))),
      ],
    );
  }
}

/// A calm confirmation: a check, what happened in one line and one line of what that means. Only
/// built after the server confirmed.
class BillingConfirmed extends StatelessWidget {
  const BillingConfirmed({super.key, required this.title, required this.body, required this.onDone, this.secondaryLabel, this.onSecondary, this.note});

  final String title;
  final String body;
  final VoidCallback onDone;

  /// A quiet second key under Done (Manage subscription for a Play subscriber).
  final String? secondaryLabel;
  final VoidCallback? onSecondary;

  /// One line under the keys (what to do when Google Play did not open).
  final String? note;

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
              Icon(LucideIcons.check, size: 24, color: colors.ink),
              const SizedBox(height: MmSpace.s12),
              Semantics(header: true, child: Text(title, style: type.title)),
              const SizedBox(height: MmSpace.s8),
              Text(body, style: type.body.copyWith(color: colors.ink2)),
            ],
          ),
        ),
        const SizedBox(height: MmSpace.s24),
        KeyButton(label: BillingCopy.done, onPressed: onDone),
        if (secondaryLabel != null && onSecondary != null) ...[
          const SizedBox(height: MmSpace.s4),
          Center(child: KeyButton.quiet(label: secondaryLabel!, onPressed: onSecondary)),
        ],
        if (note != null) ...[
          const SizedBox(height: MmSpace.s8),
          Semantics(liveRegion: true, child: Text(note!, textAlign: TextAlign.center, style: type.small.copyWith(color: colors.ink2))),
        ],
      ],
    );
  }
}
