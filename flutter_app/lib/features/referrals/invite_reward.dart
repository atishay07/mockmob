import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/theme.dart';
import '../../core/widgets/widgets.dart';
import '../you/widgets/you_page.dart' show SectionTitle, youGutter, youText;
import 'invite_code_row.dart';
import 'invite_share.dart';
import 'referral_copy.dart';
import 'referral_data.dart';

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

/// The Wallet's invite: the heading, how it works, what has happened so far in counts only, and the link to share. Nothing
/// at all until the server says invites are live.
class WalletInviteSection extends ConsumerWidget {
  const WalletInviteSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(referralStatusProvider).value;
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
              Text(ReferralCopy.how(s.reward), style: type.body.copyWith(color: colors.ink2)),
              const SizedBox(height: MmSpace.s12),
              Semantics(
                liveRegion: true,
                child: Text(
                  ReferralCopy.summary(joined: s.joined, practised: s.practised, rewarded: s.rewarded, reward: s.reward),
                  style: type.body.copyWith(color: colors.ink, fontWeight: FontWeight.w700, fontFeatures: const [FontFeature.tabularFigures()]),
                ),
              ),
              for (final line in lines) ...[
                const SizedBox(height: MmSpace.s4),
                Text(line, style: type.caption.copyWith(color: colors.ink2)),
              ],
              const SizedBox(height: MmSpace.s16),
              KeyButton(label: ReferralCopy.share, onPressed: () => shareInvite(context, ref, s)),
              const SizedBox(height: MmSpace.s8),
              KeyButton.secondary(label: ReferralCopy.copy, onPressed: () => _copy(context, s.link!)),
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
