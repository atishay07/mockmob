import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/mob_models.dart';
import '../data/mob_repository.dart';
import '../data/mob_seen.dart';
import '../mob_routes.dart';
import '../screens/mob_screen.dart' show MobRingView;
import 'mob_parts.dart';

/// The Today Mob card (SOCIAL-SPEC section 8): only when in a Mob. The 64 dp ring, "3 of 4 sat
/// this week", one action, a received note in one line, and at most one Mobi moment a week when
/// the ring completes. Draws nothing otherwise, so it can sit in Today's list unconditionally.
class MobTodayCard extends ConsumerStatefulWidget {
  const MobTodayCard({super.key, this.padding = const EdgeInsets.symmetric(horizontal: MmSpace.gutter)});

  final EdgeInsetsGeometry padding;

  @override
  ConsumerState<MobTodayCard> createState() => _MobTodayCardState();
}

class _MobTodayCardState extends ConsumerState<MobTodayCard> {
  String? _momentWeek;
  bool _moment = false;

  void _maybeClaim(Mob mob) {
    if (!mob.week.complete || _momentWeek == mob.week.key) return;
    _momentWeek = mob.week.key;
    ref.read(mobMomentProvider).claim(mob.week.key).then((won) {
      if (mounted && won) setState(() => _moment = true);
    });
  }

  @override
  Widget build(BuildContext context) {
    final mob = ref.watch(currentMobProvider);
    if (mob == null) return const SizedBox.shrink();
    final type = context.mmType;
    final colors = context.mmColors;
    final now = ref.watch(nowProvider)();
    final closed = mob.week.closedAt(now);
    final received = mob.week.youSat || closed ? null : mob.nudge.receivedFrom;
    _maybeClaim(mob);
    final action = mob.week.youSat || closed ? MobCopy.seeMob : MobCopy.sitKey(mob.week.paper.count, mob.week.paper.minutes);

    return Padding(
      padding: widget.padding,
      child: MobCard(
        padding: const EdgeInsets.all(MmSpace.s16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                MobRingView(mob: mob, size: 64, compact: true),
                const SizedBox(width: MmSpace.s16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('${MobCopy.title}, ${mob.subjectName}', style: type.small.copyWith(color: colors.ink2)),
                      const SizedBox(height: MmSpace.s2),
                      Text(MobCopy.ringLine(mob.week.sat, mob.week.size), style: type.title.copyWith(color: colors.ink)),
                      if (closed) MobNote(MobCopy.closed),
                    ],
                  ),
                ),
                if (_moment)
                  Mobi(pose: MobiPose.proud, size: 72, semanticLabel: MobCopy.mobiComplete(mob.week.size)),
              ],
            ),
            if (_moment) ...[
              const SizedBox(height: MmSpace.s8),
              Text(MobCopy.mobiComplete(mob.week.size), style: type.body.copyWith(color: colors.ink)),
            ],
            if (received != null) ...[
              const SizedBox(height: MmSpace.s8),
              Text(MobCopy.nudgeReceived(received), style: type.body.copyWith(color: colors.ink)),
            ],
            const SizedBox(height: MmSpace.s12),
            if (mob.week.youSat || closed)
              KeyButton.secondary(label: action, onPressed: () => openMobPage(context))
            else
              KeyButton(label: action, onPressed: () => openMobPage(context)),
          ],
        ),
      ),
    );
  }
}
