import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/mob_invite_moment.dart';
import '../data/mob_models.dart';
import '../data/mob_navigator.dart';
import '../data/mob_repository.dart';
import '../data/mob_seen.dart';
import '../logic/mob_entry.dart';
import '../mob_routes.dart';
import '../screens/mob_screen.dart' show MobRingView;
import '../screens/mob_sheets.dart' show InviteSheet;
import 'mob_parts.dart';
import 'mob_pro_entry.dart';

/// The block with its 28 dp lead for Today's list. In a Mob: the card. In no Mob: nothing at all (no
/// gap either), except one inline invitation after a week's run (a study week met, or 7 saved
/// sessions), once, dismissable for good and gone after 7 days. Nothing either while the Mob is off
/// on the server or has not been read.
class MobTodayBlock extends ConsumerWidget {
  const MobTodayBlock({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (ref.watch(currentMobProvider) != null) {
      return const Padding(padding: EdgeInsets.only(top: 28), child: MobTodayCard(padding: EdgeInsets.zero));
    }
    // The Mob was read and the student is in none: the invitation, only when there is a true reason.
    if (!ref.watch(mobAvailableProvider)) return const SizedBox.shrink();
    final reason = ref.watch(mobInviteReasonProvider);
    if (reason == null) return const SizedBox.shrink();
    return Padding(padding: const EdgeInsets.only(top: 28), child: MobInviteCard(reason: reason));
  }
}

/// Today's one-time invitation for a student in no Mob: what a Mob is and why to start one, in real
/// numbers, one outlined key (the page's volt is the page's own, rule 7) and a quiet "Not now".
class MobInviteCard extends ConsumerStatefulWidget {
  const MobInviteCard({super.key, required this.reason, this.padding = EdgeInsets.zero});

  /// The true reason it shows now ("You met your study goal for a week."). It decides that the card
  /// shows; the card itself leads with what a Mob is (owner walk, 18 Oct).
  final String reason;
  final EdgeInsetsGeometry padding;

  @override
  ConsumerState<MobInviteCard> createState() => _MobInviteCardState();
}

class _MobInviteCardState extends ConsumerState<MobInviteCard> {
  bool _shown = false;
  bool _gone = false;

  @override
  void initState() {
    super.initState();
    ref.read(mobInviteMemoryProvider).visible(ref.read(nowProvider)()).then((v) {
      if (mounted) setState(() => _shown = v);
    });
  }

  Future<void> _done({required bool open}) async {
    setState(() => _gone = true);
    await ref.read(mobInviteMemoryProvider).done(ref.read(nowProvider)());
    if (open && mounted) await openMobPage(context);
  }

  @override
  Widget build(BuildContext context) {
    if (!_shown || _gone) return const SizedBox.shrink();
    final type = context.mmType;
    final colors = context.mmColors;
    return Padding(
      padding: widget.padding,
      child: MobCard(
        padding: const EdgeInsets.all(MmSpace.s16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Semantics(header: true, child: Text(MobCopy.inviteMomentTitle, style: type.title.copyWith(color: colors.ink))),
            const SizedBox(height: MmSpace.s4),
            // What a Mob is and why to start one; the moment's reason only decides when the card shows.
            Text(MobCopy.inviteMomentBody, style: type.body.copyWith(color: colors.ink2)),
            const SizedBox(height: MmSpace.s12),
            KeyButton.secondary(label: MobCopy.startKey, onPressed: () => _done(open: true)),
            KeyButton.quiet(label: MobCopy.notNow, expanded: true, onPressed: () => _done(open: false)),
          ],
        ),
      ),
    );
  }
}

/// The Today Mob card (SOCIAL-SPEC section 8): only when in a Mob. The 64 dp ring, "3 of 4 sat this
/// week", one line of what is true now, and one outlined key that does what its label says ("Sit
/// this week's paper" opens the paper, "Invite a friend" opens the invite, "See your Mob" opens the
/// page). The words are the website's entry line, from [mobEntryFor]. At most one Mobi moment a
/// week, when the ring completes. Draws nothing otherwise (no Mob, off on the server, nothing read
/// yet), so it can sit in Today's list unconditionally.
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
    if (failure != null) sayMobFailure(context, failure, ref.read(mobActionsProvider).say(failure));
  }

  Future<void> _act(Mob mob, MobEntry entry) {
    switch (entry.act) {
      case MobEntryAct.sit:
        return _sit(mob);
      case MobEntryAct.invite:
        return showMmSheet<void>(context: context, title: MobCopy.inviteTitle, builder: (_) => const InviteSheet());
      case MobEntryAct.answers:
      case MobEntryAct.openMob:
        return openMobPage(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    final mob = ref.watch(currentMobProvider);
    if (mob == null) return const SizedBox.shrink();
    final type = context.mmType;
    final colors = context.mmColors;
    final now = ref.watch(nowProvider)();
    final week = mob.week;
    final entry = mobEntryFor(MobEntryPlace.today, mob, now: now);
    if (entry == null) return const SizedBox.shrink();
    _maybeClaim(mob);
    final sit = entry.act == MobEntryAct.sit;

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
                      Text(week.size == 1 ? MobCopy.entryAloneBig : MobCopy.ringLine(week.sat, week.size), style: type.title.copyWith(color: colors.ink)),
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
            const SizedBox(height: MmSpace.s8),
            Text(entry.line, style: type.body.copyWith(color: colors.ink2)),
            const SizedBox(height: MmSpace.s12),
            // Outlined: the page's one volt key is the move above (rule 7).
            KeyButton.secondary(
              label: sit && _sitting ? MobCopy.openingPaper : (entry.key ?? MobCopy.seeMob),
              loading: sit && _sitting,
              onPressed: _sitting ? null : () => _act(mob, entry),
            ),
          ],
        ),
      ),
    );
  }
}
