import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_state.dart';
import '../../core/haptics/haptics.dart';
import '../../core/motion/motion.dart';
import '../../core/router/routes.dart';
import '../../core/theme/theme.dart';
import '../../core/widgets/widgets.dart';
import '../credits/data/credit_figures.dart';
import '../wallet/widgets/credit_coins.dart';
import 'invite_share.dart';
import 'referral_copy.dart';
import 'referral_data.dart';

/// Opens the welcome-credits sheet over [context]'s root navigator (the trigger in welcome_credits_trigger.dart decides
/// when). Completes when it closes.
Future<void> showWelcomeCreditsSheet(BuildContext context) =>
    showMmSheet<void>(context: context, builder: (_) => const WelcomeCreditsSheet());

/// The figure the sheet shows: the balance the server gave (the one total, else Practice credits), else the profile's
/// balance, else the welcome figure every new account starts with.
int welcomeCreditsFigure(CreditFigures f, AuthSnapshot auth) =>
    f.total ?? f.practice ?? auth.creditBalance ?? ReferralCopy.welcomeCredits;

/// What the invite part of the sheet shows.
enum WelcomeInviteState { live, off, loading }

WelcomeInviteState welcomeInviteState(AsyncValue<ReferralStatus> status) {
  final s = status.value;
  if (s == null) return status.isLoading ? WelcomeInviteState.loading : WelcomeInviteState.off;
  return s.live && s.link != null ? WelcomeInviteState.live : WelcomeInviteState.off;
}

/// A new account's welcome (owner, 20 Oct 11:20 pm: "Free 50 welcome credits. Want to earn extra? Invite your friends.
/// Make it intuitive and interesting"). Visual first (D185): the credits are the hero (the coins and the figure rolling
/// in), one line on what a credit buys, and, while invites are live, a friend invite with Mobi cheering beside it.
///
/// Keys: "Invite a friend" opens the share sheet with the invite text and link (the Wallet's own helper), or the
/// Wallet's invite section while the status is still loading; "Not now" closes. With invites off there is one key,
/// "Start practising", which closes.
class WelcomeCreditsSheet extends ConsumerStatefulWidget {
  const WelcomeCreditsSheet({super.key, this.onOpenWallet});

  /// Opens the Wallet (its invite section) after the sheet has closed. Defaults to the router's Credits page.
  final VoidCallback? onOpenWallet;

  @override
  ConsumerState<WelcomeCreditsSheet> createState() => _WelcomeCreditsSheetState();
}

class _WelcomeCreditsSheetState extends ConsumerState<WelcomeCreditsSheet> {
  bool _busy = false;

  void _close() => Navigator.of(context).maybePop();

  Future<void> _invite(WelcomeInviteState state) async {
    if (_busy) return;
    if (state != WelcomeInviteState.live) {
      // The status has not answered yet: the Wallet shows the invite (and the link) once it does.
      final open = widget.onOpenWallet ?? _routerOpener(context);
      _close();
      open?.call();
      return;
    }
    final s = ref.read(referralStatusProvider).value!;
    setState(() => _busy = true);
    final shared = await shareInvite(context, ref, s);
    if (!mounted) return;
    setState(() => _busy = false);
    if (shared) _close();
  }

  static VoidCallback? _routerOpener(BuildContext context) {
    final router = GoRouter.maybeOf(context);
    return router == null ? null : () => router.push(AppRoutes.youCreditsInvite);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final credits = welcomeCreditsFigure(ref.watch(creditFiguresProvider), ref.watch(authSnapshotProvider));
    final status = ref.watch(referralStatusProvider);
    final invite = welcomeInviteState(status);
    final reward = status.value?.reward ?? 100;
    final reduced = Motion.reduced(context);

    // The credits as the hero, centred: the coin stack beside the figure rolling in, the caption under them.
    final hero = Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            const CreditCoins(size: 72, coins: 3),
            const SizedBox(width: MmSpace.s12),
            MonumentalNumber(
              value: '$credits',
              style: type.figureHero,
              color: colors.ink,
              roll: !reduced,
              delay: const Duration(milliseconds: 260),
              semanticsLabel: ReferralCopy.welcomeSemantics(credits),
              onLanded: () => hapticsOf(context)?.light(),
            ),
          ],
        ),
        const SizedBox(height: MmSpace.s8),
        ExcludeSemantics(
          child: Text(
            ReferralCopy.welcomeUnitFor(credits),
            textAlign: TextAlign.center,
            style: type.labelLarge.copyWith(color: colors.accentText),
          ),
        ),
      ],
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        const SizedBox(height: MmSpace.s12),
        hero,
        const SizedBox(height: MmSpace.s24),
        // With no invite below, Mobi cheers beside the line instead.
        if (invite == WelcomeInviteState.off)
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(child: Text(ReferralCopy.welcomeWhat, style: type.body.copyWith(color: colors.ink2))),
              const SizedBox(width: MmSpace.s12),
              const _CheeringMobi(size: 76),
            ],
          )
        else
          // Centred, each sentence keeps a line of its own (no one-word last line).
          Text(
            ReferralCopy.welcomeWhat.replaceFirst('. ', '.\n'),
            textAlign: TextAlign.center,
            style: type.body.copyWith(color: colors.ink2),
          ),
        const SizedBox(height: MmSpace.s20),
        AnimatedSize(
          duration: reduced ? Motion.reducedFade : Motion.card,
          curve: Motion.out,
          alignment: Alignment.topCenter,
          child: MmOverlapSwitcher.fade(
            duration: reduced ? Motion.reducedFade : Motion.crossFade,
            child: switch (invite) {
              WelcomeInviteState.off => KeyButton(
                  key: const ValueKey('welcome-start'),
                  label: ReferralCopy.welcomeStart,
                  onPressed: _close,
                ),
              _ => Column(
                  key: const ValueKey('welcome-invite'),
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _InviteBlock(reward: reward, loading: invite == WelcomeInviteState.loading),
                    const SizedBox(height: MmSpace.s16),
                    KeyButton(label: ReferralCopy.welcomeInvite, loading: _busy, onPressed: () => _invite(invite)),
                    const SizedBox(height: MmSpace.s4),
                    Center(child: KeyButton.quiet(label: ReferralCopy.welcomeLater, onPressed: _close)),
                  ],
                ),
            },
          ),
        ),
      ],
    );
  }
}

/// "Bring a friend, you both get 100 more", how it works in one line, and Mobi cheering. While the status loads the
/// words wait as quiet bars (nothing about invites is promised before the server says they are live).
class _InviteBlock extends StatelessWidget {
  const _InviteBlock({required this.reward, required this.loading});

  final int reward;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final words = loading
        ? const SkeletonGroup(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Skeleton(height: 18),
                SizedBox(height: MmSpace.s8),
                Skeleton(height: 18, width: 120),
                SizedBox(height: MmSpace.s12),
                Skeleton(height: 14),
              ],
            ),
          )
        : Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Semantics(
                header: true,
                child: _TitleWithFigure(
                  text: ReferralCopy.welcomeInviteTitle(reward),
                  figure: '$reward',
                  style: type.title.copyWith(color: colors.ink),
                  figureColor: colors.accentText,
                ),
              ),
              const SizedBox(height: MmSpace.s6),
              Text(ReferralCopy.welcomeInviteHow, style: type.caption.copyWith(color: colors.ink2)),
            ],
          );
    return MmSurface.inset(
      padding: const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s16, MmSpace.s8, MmSpace.s16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(child: words),
          const SizedBox(width: MmSpace.s8),
          const _CheeringMobi(size: 76),
        ],
      ),
    );
  }
}

/// The invite's title with its figure ("100") in the accent ink, so the reward reads first.
class _TitleWithFigure extends StatelessWidget {
  const _TitleWithFigure({required this.text, required this.figure, required this.style, required this.figureColor});

  final String text;
  final String figure;
  final TextStyle style;
  final Color figureColor;

  @override
  Widget build(BuildContext context) {
    final at = text.indexOf(figure);
    if (at < 0) return Text(text, style: style);
    return Text.rich(
      TextSpan(children: [
        TextSpan(text: text.substring(0, at)),
        TextSpan(text: figure, style: TextStyle(color: figureColor, fontFeatures: const [FontFeature.tabularFigures()])),
        TextSpan(text: text.substring(at + figure.length)),
      ]),
      style: style,
    );
  }
}

/// Mobi, cheering once as the sheet opens, then at ease. A still pose under reduced motion.
class _CheeringMobi extends StatelessWidget {
  const _CheeringMobi({required this.size});

  final double size;

  @override
  Widget build(BuildContext context) => ExcludeSemantics(
        child: SizedBox(
          width: size,
          height: size,
          child: MobiStage(size: size, entrance: MobiAct.cheer, bubble: false, lamp: false),
        ),
      );
}
