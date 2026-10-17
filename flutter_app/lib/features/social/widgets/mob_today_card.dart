import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/mob_models.dart';
import '../data/mob_navigator.dart';
import '../data/mob_repository.dart';
import '../data/mob_seen.dart';
import '../mob_routes.dart';
import '../screens/mob_screen.dart' show MobRingView;
import 'mob_parts.dart';

/// The card with its 28 dp lead for Today's list: nothing at all (no gap either) when the student is
/// not in a Mob, or the Mob is off on the server.
class MobTodayBlock extends ConsumerWidget {
  const MobTodayBlock({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (ref.watch(currentMobProvider) == null) return const SizedBox.shrink();
    return const Padding(padding: EdgeInsets.only(top: 28), child: MobTodayCard(padding: EdgeInsets.zero));
  }
}

/// The Today Mob card (SOCIAL-SPEC section 8): only when in a Mob. The 64 dp ring, "3 of 4 sat this
/// week", one action that does what its label says ("Sit this week's paper" opens the paper, "See
/// your Mob" opens the page), a received note in one line, and at most one Mobi moment a week when
/// the ring completes. Draws nothing otherwise (no Mob, off on the server, nothing read yet), so it
/// can sit in Today's list unconditionally.
class MobTodayCard extends ConsumerStatefulWidget {
  const MobTodayCard({super.key, this.padding = const EdgeInsets.symmetric(horizontal: MmSpace.gutter)});

  final EdgeInsetsGeometry padding;

  @override
  ConsumerState<MobTodayCard> createState() => _MobTodayCardState();
}

class _MobTodayCardState extends ConsumerState<MobTodayCard> {
  String? _momentWeek;
  bool _moment = false;
  bool _sitting = false;

  void _maybeClaim(Mob mob) {
    final key = '${mob.id}:${mob.week.key}';
    if (!mob.week.complete || _momentWeek == key) return;
    _momentWeek = key;
    ref.read(mobMomentProvider).claim(key).then((won) {
      if (mounted && won) setState(() => _moment = true);
    });
  }

  Future<void> _sit(Mob mob) async {
    if (_sitting) return;
    setState(() => _sitting = true);
    final failure = await ref.read(mobNavigatorProvider).sitPaper(context, ref, mob);
    if (!mounted) return;
    setState(() => _sitting = false);
    if (failure != null) showMobToast(context, MobCopy.failure(failure));
  }

  @override
  Widget build(BuildContext context) {
    final mob = ref.watch(currentMobProvider);
    if (mob == null) return const SizedBox.shrink();
    final type = context.mmType;
    final colors = context.mmColors;
    final now = ref.watch(nowProvider)();
    final week = mob.week;
    final closed = week.closedAt(now);
    final received = week.youSat || closed ? null : mob.nudge.receivedFrom;
    _maybeClaim(mob);
    // The sit key only where the paper can be sat now: not sat, open, with someone to sit it with.
    final sit = !week.youSat && !closed && !mob.alone && !week.paper.freeUsed;
    final cost = sit ? MobCopy.costLine(week.paper) : null;

    return Padding(
      padding: widget.padding,
      child: MobCard(
        padding: const EdgeInsets.all(MmSpace.s16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
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
                      Text(MobCopy.todayTitle(mob), style: type.small.copyWith(color: colors.ink2)),
                      const SizedBox(height: MmSpace.s2),
                      Text(MobCopy.ringLine(week.sat, week.size), style: type.title.copyWith(color: colors.ink)),
                      if (closed) MobNote(MobCopy.closed),
                    ],
                  ),
                ),
                if (_moment) Mobi(pose: MobiPose.proud, size: 72, semanticLabel: MobCopy.mobiComplete(week.size)),
              ],
            ),
            if (_moment) ...[
              const SizedBox(height: MmSpace.s8),
              Text(MobCopy.mobiComplete(week.size), style: type.body.copyWith(color: colors.ink)),
            ],
            if (received != null) ...[
              const SizedBox(height: MmSpace.s8),
              Text(MobCopy.nudgeReceived(received), style: type.body.copyWith(color: colors.ink)),
            ],
            const SizedBox(height: MmSpace.s12),
            if (sit) ...[
              KeyButton(
                label: _sitting ? MobCopy.openingPaper : MobCopy.sitKey(week.paper.count, week.paper.minutes),
                loading: _sitting,
                onPressed: _sitting ? null : () => _sit(mob),
              ),
              if (cost != null) ...[
                const SizedBox(height: MmSpace.s8),
                MobNote(cost, center: true),
              ],
            ] else
              KeyButton.secondary(label: MobCopy.seeMob, onPressed: () => openMobPage(context)),
          ],
        ),
      ),
    );
  }
}
