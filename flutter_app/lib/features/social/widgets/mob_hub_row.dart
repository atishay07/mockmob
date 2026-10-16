import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../you/widgets/you_row.dart';
import '../copy.dart';
import '../data/mob_repository.dart';
import '../mob_routes.dart';

/// The You hub's permanent entry (SOCIAL-SPEC section 9): "Your Mob", or "Start a Mob" when not in
/// one, as a 48 dp row. Draws nothing while the server's switch is off or nothing has been read.
class MobHubRow extends ConsumerWidget {
  const MobHubRow({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!ref.watch(mobAvailableProvider)) return const SizedBox.shrink();
    final mob = ref.watch(currentMobProvider);
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s8),
      child: YouPanel(
        flat: true,
        inset: 28 + MmSpace.s16,
        children: [
          YouRow(
            flat: true,
            icon: LucideIcons.usersRound,
            title: mob == null ? MobCopy.hubStart : MobCopy.hubRow,
            note: mob == null ? MobCopy.hubStartNote : '${mob.subjectName}, ${MobCopy.ringLine(mob.week.sat, mob.week.size)}',
            onTap: () => openMobPage(context),
          ),
        ],
      ),
    );
  }
}
