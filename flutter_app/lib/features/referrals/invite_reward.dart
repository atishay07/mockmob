import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/theme/theme.dart';
import '../../core/widgets/widgets.dart';
import '../you/widgets/you_page.dart' show SectionTitle, youGutter, youText;
import 'invite_code_row.dart';
import 'invite_load_failed.dart';
import 'referral_copy.dart';
import 'referral_data.dart';

/// Words only the Wallet's invite card uses (the invite's own words are ReferralCopy's).
abstract final class WalletInviteCopy {
  static const String figureLabel = 'credits each, for you and your friend';
}

/// One line under a Mob invite: the Mob link is also a friend invite, so you both get 100 credits (owner D165). Nothing
/// at all until the server says invites are live.
class InviteRewardLine extends ConsumerWidget {
  const InviteRewardLine({super.key, this.textAlign = TextAlign.center});

  final TextAlign textAlign;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final status = ref.watch(referralStatusProvider).value;
    if (status == null || !status.live) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s8),
      child: Text(
        ReferralCopy.mobLine(status.reward),
        textAlign: textAlign,
        style: context.mmType.caption.copyWith(color: context.mmColors.ink2),
      ),
    );
  }
}

/// The Wallet's invite, visual first (D185): the figure as the anchor ("100" credits, for you and your friend), one line of
/// how, the Share key, Copy link quiet and the friend's-code row. What has happened so far stays as counts when there are any;
/// with none it is one quiet caption. Nothing at all until the server says invites are live; while the read runs nothing is
/// drawn, and a read that failed for good is one quiet row that reads again (never half a section).
class WalletInviteSection extends ConsumerWidget {
  const WalletInviteSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final load = ref.watch(referralStatusProvider);
    final s = load.value;
    if (s == null && load.invitesFailed) {
      return const Padding(padding: EdgeInsets.fromLTRB(youText, MmSpace.s24, youText, 0), child: InviteLoadFailedRow());
    }
    if (s == null || !s.live || s.link == null) return const SizedBox.shrink();
    final type = context.mmType;
    final colors = context.mmColors;
    final lines = <String>[
      if (s.joined > 0 && s.earned > 0) ReferralCopy.earned(s.earned),
      if (s.joined > 0 && s.notCounted > 0) ReferralCopy.notCounted(s.notCounted),
      if (s.paused) ReferralCopy.paused else if (s.capReached) ReferralCopy.capReached(s.monthlyCap, s.reward),
      if (s.invitedRewarded) ReferralCopy.invitedRewarded(s.reward) else if (s.invitedState == 'joined') ReferralCopy.invitedJoined(s.reward),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        SectionTitle(ReferralCopy.title(s.reward), padding: const EdgeInsets.fromLTRB(youText, MmSpace.s32, youText, MmSpace.s8)),
        Padding(
          padding: youGutter,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              // The anchor: the reward, big, with what it is beside it.
              MergeSemantics(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    Text('${s.reward}', key: const ValueKey('invite-figure'), style: type.figure.copyWith(color: colors.accentText)),
                    const SizedBox(width: MmSpace.s12),
                    Flexible(child: Text(WalletInviteCopy.figureLabel, style: type.labelLarge.copyWith(color: colors.ink2))),
                  ],
                ),
              ),
              const SizedBox(height: MmSpace.s8),
              Text(ReferralCopy.how(s.reward), style: type.body.copyWith(color: colors.ink2)),
              const SizedBox(height: MmSpace.s16),
              KeyButton(label: ReferralCopy.share, onPressed: () => _share(context, s)),
              const SizedBox(height: MmSpace.s8),
              KeyButton.quiet(label: ReferralCopy.copy, expanded: true, onPressed: () => _copy(context, s.link!)),
              const SizedBox(height: MmSpace.s12),
              // What has happened: counts when there are any, one quiet caption when there are none.
              Semantics(
                liveRegion: true,
                child: s.joined > 0
                    ? Text(
                        ReferralCopy.summary(joined: s.joined, practised: s.practised, rewarded: s.rewarded, reward: s.reward),
                        style: type.body.copyWith(color: colors.ink, fontWeight: FontWeight.w700, fontFeatures: const [FontFeature.tabularFigures()]),
                      )
                    : Text(ReferralCopy.summary(joined: 0, practised: 0, rewarded: 0, reward: s.reward), style: type.caption.copyWith(color: colors.ink3)),
              ),
              for (final line in lines) ...[
                const SizedBox(height: MmSpace.s4),
                Text(line, style: type.caption.copyWith(color: colors.ink2)),
              ],
              const SizedBox(height: MmSpace.s8),
              Text(ReferralCopy.cap(s.monthlyCap), style: type.caption.copyWith(color: colors.ink3)),
              // A friend's code, for a student who was invited and did not follow the link (hidden once they joined with one).
              const SizedBox(height: MmSpace.s8),
              const InviteCodeRow(),
            ],
          ),
        ),
      ],
    );
  }

  Future<void> _share(BuildContext context, ReferralStatus s) async {
    final messenger = ScaffoldMessenger.maybeOf(context);
    try {
      await SharePlus.instance.share(ShareParams(text: ReferralCopy.shareText(s.reward, s.link!)));
    } on Object {
      messenger?.showSnackBar(const SnackBar(content: Text(ReferralCopy.shareFailed)));
    }
  }

  Future<void> _copy(BuildContext context, String link) async {
    final messenger = ScaffoldMessenger.maybeOf(context);
    try {
      await Clipboard.setData(ClipboardData(text: link));
      messenger?.showSnackBar(const SnackBar(content: Text(ReferralCopy.copied)));
    } on Object {
      // The link is still in the share sheet.
    }
  }
}
