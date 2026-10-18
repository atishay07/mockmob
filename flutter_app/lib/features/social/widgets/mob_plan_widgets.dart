import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../pro_nudge/pro_nudge.dart' show ProNudgeCopy, ProReason;
import '../copy.dart';
import '../data/mob_models.dart';
import '../data/mob_repository.dart';
import 'mob_pro_entry.dart';

/// The student's Mobs as a row of chips, the active one chosen. Any plan joins any number of Mobs by
/// invite; Free starts one and Pro up to 3, so a student who may still start one gets "Start your
/// own Mob" (none started yet) or "Start another Mob" at the end. Hidden for a student in one Mob
/// who cannot start another, so a row never holds a single chip.
class MobSwitcher extends ConsumerWidget {
  const MobSwitcher({super.key, required this.mob, required this.onStartAnother});

  final Mob mob;
  final VoidCallback onStartAnother;

  /// "Accountancy" or, when two Mobs share a subject, "Accountancy 1" and "Accountancy 2".
  static List<String> labelsFor(List<MobRef> mobs) {
    return [
      for (var i = 0; i < mobs.length; i++)
        if (mobs.where((x) => x.subjectName == mobs[i].subjectName).length > 1)
          '${mobs[i].subjectName} ${mobs.take(i + 1).where((x) => x.subjectName == mobs[i].subjectName).length}'
        else
          mobs[i].subjectName,
    ];
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mobs = mob.mobs;
    final canStart = mob.plan.canStartAnother;
    if (mobs.length < 2 && !canStart) return const SizedBox.shrink();
    final active = mobs.indexWhere((m) => m.active);
    return Padding(
      padding: const EdgeInsets.only(bottom: MmSpace.s8),
      child: ChipRail.labelled(
        labels: [...labelsFor(mobs), if (canStart) mob.plan.startedNone ? MobCopy.startOwn : MobCopy.startAnother],
        leading: [for (var i = 0; i < mobs.length; i++) null, if (canStart) LucideIcons.plus],
        selected: active < 0 ? 0 : active,
        semanticLabel: MobCopy.switcherSemantics,
        onSelected: (i) {
          if (i >= mobs.length) {
            onStartAnother();
          } else if (!mobs[i].active) {
            ref.read(mobRepositoryProvider.notifier).select(mobs[i].id);
          }
        },
      ),
    );
  }
}

/// One quiet line near the end of the page, so the paper and the ring come first. Free: what Pro adds,
/// in one sentence, no price and no count-down (T005, T009); with the Pro nudges on, one quiet See Pro
/// key under it opens the Upgrade sheet on the Mob (D80, as the website's Mob plan line does). Pro at
/// its cap of Mobs it started: the server's own sentence for it (MOB_LIMIT_PRO), where the start key would be.
class MobProNote extends StatelessWidget {
  const MobProNote({super.key, required this.mob});

  final Mob mob;

  @override
  Widget build(BuildContext context) {
    if (mob.plan.pro && !mob.plan.atProCap) return const SizedBox.shrink();
    final type = context.mmType;
    final colors = context.mmColors;
    return Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s32, MmSpace.gutter, 0),
      child: mob.plan.pro
          ? Text(MobCopy.proCapLine, style: type.small.copyWith(color: colors.ink2))
          : Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(MobCopy.proLine, style: type.small.copyWith(color: colors.ink2)),
                const MobProEntry(reason: ProReason.mob, label: ProNudgeCopy.seePro),
              ],
            ),
    );
  }
}
