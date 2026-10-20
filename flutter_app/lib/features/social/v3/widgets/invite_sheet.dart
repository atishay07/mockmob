// The one Invite sheet (pass-1020 MOB-MINIMAL 3.5, A11): the WhatsApp card, "Invite on WhatsApp", "Copy the
// code" and "Works for 7 days, for up to N friends." (the seats left) Opened from the labelled open seat, the Mob-of-one card,
// the empty den's row and Mob settings (through V4Sheets.invite).

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../referrals/invite_reward.dart' show InviteRewardLine;
import '../copy_v3.dart';
import '../data/mob_v3_den.dart';
import '../data/mob_v3_models.dart';
import 'invite_card.dart';

Future<void> showInviteSheet(BuildContext context) async {
  await showMmSheet<void>(context: context, title: MobV4DenCopy.inviteTitle, builder: (sheet) => const InviteSheetBody());
}

class InviteSheetBody extends ConsumerWidget {
  const InviteSheetBody({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final type = context.mmType;
    final colors = context.mmColors;
    final view = ref.watch(denViewProvider);
    final mob = view?.mob;
    final code = mob?.invite?.code;
    return Padding(
      // showMmSheet already pads the body to the title's edge.
      padding: const EdgeInsets.only(bottom: MmSpace.s16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(MobV4DenCopy.inviteLead, style: type.body.copyWith(color: colors.ink2)),
          if (view != null && mob != null && code != null) ...[
            const SizedBox(height: MmSpace.s16),
            InviteCardPreview(youName: view.v3.you?.name ?? '', mobName: view.v3.name.text, subjectName: mob.subjectName, display: displayCode(code)),
          ],
          const SizedBox(height: MmSpace.s16),
          KeyButton(key: const ValueKey('invite-sheet-whatsapp'), label: MobV3Copy.inviteWhatsApp, onPressed: () => shareInviteCard(context)),
          const SizedBox(height: MmSpace.s8),
          KeyButton.secondary(key: const ValueKey('invite-sheet-copy'), label: MobV3Copy.copyCode, onPressed: () => copyInviteCode(context)),
          const SizedBox(height: MmSpace.s12),
          Text(MobV4DenCopy.inviteWorksFor((5 - (view?.v3.members.length ?? 1)).clamp(1, 4)), textAlign: TextAlign.center, style: type.caption.copyWith(color: colors.ink2)),
          // D165: the Mob invite link is also a friend invite (you both get 100 credits), once the server says it is live.
          const InviteRewardLine(),
        ],
      ),
    );
  }
}
