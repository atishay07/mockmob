import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/mob_models.dart';
import '../data/mob_repository.dart';

/// The student's Mobs as a row of chips, the active one chosen (Free is in one Mob, Pro in up to 3).
/// A Pro student below 3 Mobs also gets "Start another Mob" at the end. Hidden for a student in one
/// Mob who cannot start another, so a free student never sees a row with a single chip.
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
        labels: [...labelsFor(mobs), if (canStart) MobCopy.startAnother],
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

/// Free only: one quiet block near the end of the page, so the paper and the ring come first. It
/// says what Pro includes and sells nothing: no price, no button, no count-down (T005, T009).
class MobProNote extends StatelessWidget {
  const MobProNote({super.key, required this.mob});

  final Mob mob;

  @override
  Widget build(BuildContext context) {
    if (mob.plan.pro) return const SizedBox.shrink();
    final type = context.mmType;
    final colors = context.mmColors;
    return Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s32, MmSpace.gutter, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Semantics(header: true, child: Text(MobCopy.proTitle, style: type.labelLarge.copyWith(color: colors.ink2))),
          const SizedBox(height: MmSpace.s8),
          Text(MobCopy.proIntro, style: type.small.copyWith(color: colors.ink2)),
          const SizedBox(height: MmSpace.s8),
          for (final line in MobCopy.proItems)
            Padding(
              padding: const EdgeInsets.only(bottom: MmSpace.s8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.only(top: 3),
                    child: Icon(LucideIcons.check, size: 16, color: colors.ink3),
                  ),
                  const SizedBox(width: MmSpace.s12),
                  Expanded(child: Text(line, style: type.body.copyWith(color: colors.ink2))),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
