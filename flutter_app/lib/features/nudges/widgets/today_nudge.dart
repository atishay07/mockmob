import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../../../core/haptics/haptics.dart' show hapticsProvider;
import '../../../core/motion/motion.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../billing/billing.dart' show showGetProSheet;
import '../../billing/widgets/get_pro_entry.dart' show getProAvailableProvider;
import '../../referrals/referral_copy.dart';
import '../../referrals/referral_data.dart' show referralStatusProvider;
import '../data/nudge_facts.dart';
import '../data/nudge_store.dart';
import '../nudge_rules.dart';
import 'nudge_card.dart';
import 'nudge_sheet.dart';

/// Shares the invite text. Replaceable in tests (the share sheet is the phone's).
final nudgeInviteSharerProvider = Provider<Future<void> Function(String text)>((ref) => (text) => SharePlus.instance.share(ShareParams(text: text)));

/// The quick practice of ten, as Today's "Practise 10" opens it.
final String nudgePractiseLocation = Uri(path: AppRoutes.practiceStart, queryParameters: const {'mode': 'quick', 'count': '10'}).toString();

/// How long Today rests before a nudge's sheet opens over it.
const Duration nudgeSheetDelay = Duration(milliseconds: 600);

/// Whether [context] is on top in every navigator above it: no page, sheet or dialog over it anywhere.
bool nudgeOnTop(BuildContext context) {
  BuildContext? at = context;
  var guard = 0;
  while (at != null && guard++ < 8) {
    final route = ModalRoute.of(at);
    if (route == null) return true;
    if (!route.isCurrent) return false;
    final navigator = route.navigator;
    if (navigator == null || !navigator.mounted) return true;
    at = navigator.context;
  }
  return true;
}

/// Mobi's note on Today (D191), under the greeting and above the lead card: the one nudge of this run, a card, or the
/// moment a sheet opens for a friend's reward or a friend's game. Draws nothing (and takes no space) otherwise.
class TodayNudge extends ConsumerStatefulWidget {
  const TodayNudge({super.key, this.bottomGap = MmSpace.s12});

  /// Space under the card, which goes with it.
  final double bottomGap;

  @override
  ConsumerState<TodayNudge> createState() => _TodayNudgeState();
}

class _TodayNudgeState extends ConsumerState<TodayNudge> {
  Timer? _sheet;
  bool _cardQueued = false;

  @override
  void dispose() {
    _sheet?.cancel();
    super.dispose();
  }

  NudgeView? _viewFor(NudgeOffer offer) {
    final facts = ref.read(nudgeFactsProvider);
    final signals = ref.read(nudgeSignalsProvider);
    if (facts == null || signals == null) return null;
    return nudgeViewFor(offer, facts, signals, getPro: ref.read(getProAvailableProvider));
  }

  /// The offer is still the one to show, nothing has been shown in this run, and Today is on top.
  bool _stillDue(NudgeOffer offer) =>
      mounted && ref.read(nudgeControllerProvider).shown == null && ref.read(nudgeOfferProvider) == offer && nudgeOnTop(context) && _viewFor(offer) != null;

  void _queue(NudgeOffer offer) {
    if (offer.surface == NudgeSurface.card) {
      if (_cardQueued) return;
      _cardQueued = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _cardQueued = false;
        if (_stillDue(offer)) ref.read(nudgeControllerProvider.notifier).markShown(offer);
      });
      return;
    }
    if (_sheet != null) return;
    _sheet = Timer(nudgeSheetDelay, () {
      _sheet = null;
      if (!_stillDue(offer)) return;
      final view = _viewFor(offer)!;
      ref.read(nudgeControllerProvider.notifier).markShown(offer);
      unawaited(ref.read(hapticsProvider).light());
      unawaited(showNudgeSheet(context, view, onKey: () => _onKey(view), onSecondary: () => _onSecondary(view)).whenComplete(_close));
    });
  }

  void _close() {
    if (mounted) ref.read(nudgeControllerProvider.notifier).close();
  }

  void _openWallet() => unawaited(GoRouter.maybeOf(context)?.push<void>(AppRoutes.youCreditsInvite) ?? Future<void>.value());

  /// The invite's share sheet when the link is in hand, else the Wallet's invite section.
  Future<void> _invite() async {
    final s = ref.read(referralStatusProvider).value;
    final link = s?.link;
    if (s == null || !s.live || link == null) {
      _openWallet();
      return;
    }
    final messenger = ScaffoldMessenger.maybeOf(context);
    try {
      await ref.read(nudgeInviteSharerProvider)(ReferralCopy.shareText(s.reward, link));
    } on Object {
      messenger?.showSnackBar(const SnackBar(content: Text(ReferralCopy.shareFailed)));
    }
  }

  void _onKey(NudgeView view) {
    final router = GoRouter.maybeOf(context);
    switch (view.kind) {
      case NudgeKind.friendPaid:
        break;
      case NudgeKind.mobGame:
        router?.go(AppRoutes.mob);
      case NudgeKind.chainRisk || NudgeKind.practiceToday:
        unawaited(router?.push<void>(nudgePractiseLocation) ?? Future<void>.value());
      case NudgeKind.repairOpen:
        router?.go(AppRoutes.reviewMistakes);
      case NudgeKind.creditsLow || NudgeKind.goodResult:
        unawaited(_invite());
      case NudgeKind.friendJoined:
        _openWallet();
    }
    _close();
  }

  void _onSecondary(NudgeView view) {
    switch (view.kind) {
      case NudgeKind.creditsLow:
        unawaited(showGetProSheet(context));
      case NudgeKind.friendPaid:
        _openWallet();
      default:
        break;
    }
    _close();
  }

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(nudgeControllerProvider);
    final offer = ref.watch(nudgeOfferProvider);
    if (offer != null && s.shown == null) _queue(offer);
    NudgeView? view;
    if (offer != null && offer == s.shown && offer.surface == NudgeSurface.card) {
      final facts = ref.watch(nudgeFactsProvider);
      final signals = ref.watch(nudgeSignalsProvider);
      if (facts != null && signals != null) view = nudgeViewFor(offer, facts, signals, getPro: ref.watch(getProAvailableProvider));
    }
    final shown = view;
    return MmSizeEase(
      duration: Motion.of(context, Motion.card),
      curve: Motion.out,
      alignment: Alignment.topCenter,
      clipBehavior: Clip.none,
      child: shown == null
          ? const SizedBox(width: double.infinity)
          : Padding(
              padding: EdgeInsets.only(bottom: widget.bottomGap),
              child: NudgeCard(
                key: ValueKey(shown.offer.eventId),
                view: shown,
                onKey: () => _onKey(shown),
                onSecondary: shown.secondary == null ? null : () => _onSecondary(shown),
                onDismiss: () => ref.read(nudgeControllerProvider.notifier).dismiss(shown.kind),
              ),
            ),
    );
  }
}
