import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/repositories/remote_state.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../you/data/subject_catalog.dart' show youSubjectNames;
import '../../you/widgets/you_page.dart';
import '../../you/widgets/you_row.dart';
import '../copy.dart';
import '../data/mob_models.dart';
import '../data/mob_navigator.dart';
import '../data/mob_repository.dart';
import '../data/mob_seen.dart';
import '../logic/mob_ring.dart';
import '../widgets/mob_parts.dart';
import '../widgets/mob_ring.dart';
import 'mob_sheets.dart';

/// The Mob page (SOCIAL-SPEC sections 7 and 8): the ring, one primary action, the shared trap,
/// the members in join order, the invite, and the settings. Or, with no Mob, the start form.
class MobScreen extends ConsumerStatefulWidget {
  const MobScreen({super.key});

  @override
  ConsumerState<MobScreen> createState() => _MobScreenState();
}

class _MobScreenState extends ConsumerState<MobScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) ref.read(mobRepositoryProvider.notifier).refresh(force: true);
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(mobRepositoryProvider);
    final mob = mobDisabledError(state.error) ? null : state.value?.mob;
    return YouPage(
      title: MobCopy.title,
      children: [
        if (state.isStale)
          const Padding(
            padding: EdgeInsets.fromLTRB(youText, MmSpace.s8, youText, 0),
            child: InlineBanner.offlineStrip(),
          ),
        ..._body(context, state, mob),
      ],
    );
  }

  List<Widget> _body(BuildContext context, RemoteState<MobRead> state, Mob? mob) {
    if (state.value == null && (state.loading || (state.error == null && state.fetchedAt == null))) {
      return const [Padding(padding: youGutter, child: _MobSkeleton())];
    }
    if (state.value == null || mobDisabledError(state.error)) {
      return [Padding(padding: youGutter, child: _ErrorCard(error: state.error))];
    }
    if (mob == null) return const [StartMobForm()];
    return [MobBody(mob: mob)];
  }
}

class _MobSkeleton extends StatelessWidget {
  const _MobSkeleton();

  @override
  Widget build(BuildContext context) {
    return const SkeletonGroup(
      label: MobCopy.title,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(height: MmSpace.s16),
          Skeleton(height: 260),
          SizedBox(height: MmSpace.s16),
          Skeleton(height: 56),
          SizedBox(height: MmSpace.s24),
          Skeleton(height: 48),
          SizedBox(height: MmSpace.s8),
          Skeleton(height: 48),
          SizedBox(height: MmSpace.s8),
          Skeleton(height: 48),
        ],
      ),
    );
  }
}

class _ErrorCard extends ConsumerWidget {
  const _ErrorCard({required this.error});

  final ApiError? error;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final type = context.mmType;
    final colors = context.mmColors;
    final offline = error?.isOffline ?? false;
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s16),
      child: MobCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(offline ? MobCopy.loadFailedOffline : MobCopy.loadFailed, style: type.title.copyWith(color: colors.ink)),
            const SizedBox(height: MmSpace.s16),
            PillKey(label: MobCopy.tryAgain, onPressed: () => ref.read(mobRepositoryProvider.notifier).refresh(force: true)),
          ],
        ),
      ),
    );
  }
}

/// No Mob yet: what it is in three lines, a subject, a name and a colour, and one volt key.
class StartMobForm extends ConsumerStatefulWidget {
  const StartMobForm({super.key});

  @override
  ConsumerState<StartMobForm> createState() => _StartMobFormState();
}

class _StartMobFormState extends ConsumerState<StartMobForm> {
  late final TextEditingController _name;
  String? _subject;
  int _colour = 0;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final full = ref.read(authSnapshotProvider).name?.trim() ?? '';
    final first = full.split(RegExp(r'\s+')).first;
    _name = TextEditingController(text: first.length > 18 ? first.substring(0, 18) : first);
    // A stable colour from the name, so two friends rarely start on the same one.
    _colour = first.isEmpty ? 0 : first.codeUnits.fold<int>(0, (a, b) => a + b) % MobColours.count;
  }

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _start() async {
    final subject = _subject;
    if (subject == null) return;
    if (!isValidMobName(_name.text)) {
      setState(() => _error = MobCopy.nameRule);
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    final failure = await ref.read(mobActionsProvider).create(subject: subject, name: _name.text, colour: _colour);
    if (!mounted) return;
    setState(() => _busy = false);
    if (failure != null) {
      setState(() => _error = MobCopy.failure(failure));
    } else {
      ref.read(hapticsProvider).confirm();
    }
  }

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final colors = context.mmColors;
    final subjects = [for (final s in ref.watch(authSnapshotProvider.select((a) => a.subjects))) if (RegExp(r'^[a-z][a-z_]{1,40}$').hasMatch(s)) s];
    _subject ??= subjects.isEmpty ? null : subjects.first;
    return Padding(
      padding: youGutter,
      child: MmStagger(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: MmSpace.s8),
            MmStaggerItem(
              index: 0,
              child: Text(MobCopy.pitch, style: type.headline.copyWith(color: colors.ink)),
            ),
            const SizedBox(height: MmSpace.s16),
            MmStaggerItem(
              index: 1,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (final line in MobCopy.promises)
                    Padding(
                      padding: const EdgeInsets.only(bottom: MmSpace.s8),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Padding(
                            padding: const EdgeInsets.only(top: 3),
                            child: Icon(LucideIcons.check, size: 18, color: colors.accentText),
                          ),
                          const SizedBox(width: MmSpace.s12),
                          Expanded(child: Text(line, style: type.body.copyWith(color: colors.ink2))),
                        ],
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: MmSpace.s24),
            MmStaggerItem(
              index: 2,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(MobCopy.subjectLabel, style: type.label.copyWith(color: colors.ink2)),
                  const SizedBox(height: MmSpace.s8),
                  if (subjects.isEmpty)
                    MobNote(MobCopy.noSubjects)
                  else
                    Wrap(
                      spacing: MmSpace.s8,
                      runSpacing: MmSpace.s4,
                      children: [
                        for (final s in subjects)
                          MmChip(label: youSubjectNames[s] ?? Mob(subject: s).subjectName, selected: _subject == s, onTap: () => setState(() => _subject = s)),
                      ],
                    ),
                  const SizedBox(height: MmSpace.s24),
                  MobNameField(controller: _name, label: MobCopy.nameLabel, error: _error, onChanged: (_) => setState(() => _error = null)),
                  const SizedBox(height: MmSpace.s4),
                  const MobNote(MobCopy.nameRule),
                  const SizedBox(height: MmSpace.s16),
                  Text(MobCopy.colourLabel, style: type.label.copyWith(color: colors.ink2)),
                  ColourPicker(value: _colour, onChanged: (c) => setState(() => _colour = c)),
                  const SizedBox(height: MmSpace.s24),
                  KeyButton(label: MobCopy.startKey, loading: _busy, onPressed: _busy || _subject == null ? null : _start),
                  const SizedBox(height: MmSpace.s12),
                  const MobNote(MobCopy.haveLink, center: true),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// In a Mob, top to bottom.
class MobBody extends ConsumerStatefulWidget {
  const MobBody({super.key, required this.mob});

  final Mob mob;

  @override
  ConsumerState<MobBody> createState() => _MobBodyState();
}

class _MobBodyState extends ConsumerState<MobBody> {
  bool _sitting = false;
  bool _nudging = false;
  String? _nudgeNote;
  bool _seenNudge = false;

  Mob get mob => widget.mob;

  Future<void> _sit() async {
    setState(() => _sitting = true);
    final failure = await ref.read(mobNavigatorProvider).sitPaper(context, ref, mob);
    if (!mounted) return;
    setState(() => _sitting = false);
    if (failure != null) showMobToast(context, MobCopy.failure(failure));
  }

  Future<void> _nudge() async {
    setState(() => _nudging = true);
    final failure = await ref.read(mobActionsProvider).nudge();
    if (!mounted) return;
    setState(() {
      _nudging = false;
      _nudgeNote = failure == null ? MobCopy.nudgeSent(1) : MobCopy.failure(failure);
    });
    // The success haptic only after the server's ack (haptic grammar).
    if (failure == null) ref.read(hapticsProvider).confirm();
  }

  Future<void> _invite() => showMmSheet<void>(context: context, title: MobCopy.inviteTitle, builder: (_) => const InviteSheet());

  Future<void> _memberMenu(MobMember m) async {
    final choice = await showMmSheet<String>(
      context: context,
      title: m.name,
      builder: (context) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.sheetSide),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            KeyButton.secondary(label: MobCopy.report, onPressed: () => Navigator.of(context).pop('report')),
            const SizedBox(height: MmSpace.s8),
            KeyButton.secondary(label: MobCopy.leaveAndBlock, onPressed: () => Navigator.of(context).pop('block')),
            if (mob.you.owner) ...[
              const SizedBox(height: MmSpace.s8),
              KeyButton.secondary(label: MobCopy.removeMember, onPressed: () => Navigator.of(context).pop('remove')),
            ],
            const SizedBox(height: MmSpace.s16),
          ],
        ),
      ),
    );
    if (!mounted || choice == null) return;
    final actions = ref.read(mobActionsProvider);
    MobFailure? failure;
    switch (choice) {
      case 'report':
        final sent = await showMmSheet<bool>(context: context, title: MobCopy.reportTitle, builder: (_) => ReportSheet(member: m));
        if (sent == true && mounted) showMobToast(context, MobCopy.reported);
        return;
      case 'block':
        if (!await confirmMobSheet(context, title: MobCopy.blockTitle(m.name), body: MobCopy.blockBody, confirm: MobCopy.leaveAndBlock)) return;
        failure = await actions.leave(block: m.memberId);
      case 'remove':
        if (!await confirmMobSheet(context, title: MobCopy.removeTitle(m.name), body: MobCopy.removeBody, confirm: MobCopy.removeMember)) return;
        failure = await actions.remove(m.memberId);
    }
    if (failure != null && mounted) showMobToast(context, MobCopy.failure(failure));
  }

  Future<void> _leave() async {
    if (!await confirmMobSheet(context, title: MobCopy.leaveTitle, body: MobCopy.leaveBody, confirm: MobCopy.leaveConfirm)) return;
    final failure = await ref.read(mobActionsProvider).leave();
    if (failure != null && mounted) showMobToast(context, MobCopy.failure(failure));
  }

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final colors = context.mmColors;
    final now = ref.watch(nowProvider)();
    final closed = mob.week.closedAt(now);
    final trap = mob.visibleTrap;
    final received = mob.week.youSat ? null : mob.nudge.receivedFrom;
    if (received != null && !_seenNudge) {
      _seenNudge = true;
      WidgetsBinding.instance.addPostFrameCallback((_) => ref.read(mobActionsProvider).nudgeSeen());
    }

    var i = 0;
    return MmStagger(
      replayKey: mob.week.key,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: MmSpace.s8),
          MmStaggerItem(
            index: i++,
            child: Padding(
              padding: youGutter,
              child: MobCard(
                padding: const EdgeInsets.fromLTRB(MmSpace.s20, MmSpace.s24, MmSpace.s20, MmSpace.s20),
                child: Column(
                  children: [
                    Text(mob.subjectName, style: type.label.copyWith(color: colors.ink2)),
                    const SizedBox(height: MmSpace.s16),
                    MobRingView(mob: mob, size: 168),
                    const SizedBox(height: MmSpace.s16),
                    SitterDiscs(sitters: ringPlan(mob).sitters),
                    const SizedBox(height: MmSpace.s12),
                    MobNote(closed ? MobCopy.closed : MobCopy.closes, center: true),
                    if (received != null) ...[
                      const SizedBox(height: MmSpace.s8),
                      Text(MobCopy.nudgeReceived(received), textAlign: TextAlign.center, style: type.body.copyWith(color: colors.ink)),
                    ],
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: MmSpace.s20),
          MmStaggerItem(index: i++, child: Padding(padding: youGutter, child: _primary(context, closed))),
          if (trap != null) ...[
            const SizedBox(height: MmSpace.s24),
            MmStaggerItem(index: i++, child: Padding(padding: youGutter, child: TrapCard(trap: trap))),
          ],
          MmStaggerItem(index: i++, child: _members(context)),
          if (mob.seatsLeft > 0 && !mob.alone)
            MmStaggerItem(
              index: i++,
              child: Padding(
                padding: const EdgeInsets.only(top: MmSpace.s8),
                child: YouPanel(
                  flat: true,
                  inset: 28 + MmSpace.s16,
                  children: [YouRow(flat: true, icon: LucideIcons.userPlus, title: MobCopy.inviteRow(mob.seatsLeft), onTap: _invite)],
                ),
              ),
            ),
          if (mob.seatsLeft == 0)
            Padding(padding: const EdgeInsets.fromLTRB(youText, MmSpace.s12, youText, 0), child: MobNote(MobCopy.full)),
          MmStaggerItem(index: i++, child: _settings(context)),
        ],
      ),
    );
  }

  Widget _primary(BuildContext context, bool closed) {
    if (mob.alone && !mob.week.youSat) {
      // Alone: the invite is the one primary action until someone joins.
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KeyButton(label: MobCopy.inviteRow(mob.seatsLeft), onPressed: _invite),
          const SizedBox(height: MmSpace.s8),
          const MobNote(MobCopy.aloneLead, center: true),
          if (!closed) ...[
            const SizedBox(height: MmSpace.s12),
            KeyButton.secondary(label: MobCopy.sitKey(mob.week.paper.count, mob.week.paper.minutes), loading: _sitting, onPressed: _sitting ? null : _sit),
          ],
        ],
      );
    }
    if (closed) {
      return mob.week.yourResultId == null
          ? const SizedBox.shrink()
          : KeyButton.secondary(label: MobCopy.seeAnswers, onPressed: () => ref.read(mobNavigatorProvider).openAnswers(context, mob.week.yourResultId!));
    }
    if (!mob.week.youSat) {
      final paper = mob.week.paper;
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KeyButton(label: MobCopy.sitKey(paper.count, paper.minutes), loading: _sitting, onPressed: _sitting ? null : _sit),
          const SizedBox(height: MmSpace.s8),
          MobNote(MobCopy.sitNote(paper.count, paper.minutes), center: true),
          MobNote(_costLine(paper.costType), center: true),
        ],
      );
    }
    final resultId = mob.week.yourResultId;
    final canNudge = mob.nudge.canSend && _nudgeNote == null;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (resultId != null) ...[
          KeyButton(label: MobCopy.seeAnswers, onPressed: () => ref.read(mobNavigatorProvider).openAnswers(context, resultId)),
          const SizedBox(height: MmSpace.s12),
        ],
        if (!mob.week.complete)
          KeyButton.secondary(
            label: MobCopy.nudgeKey,
            loading: _nudging,
            disabledReason: canNudge ? null : MobCopy.nudgeSentReason,
            onPressed: canNudge && !_nudging ? _nudge : null,
          ),
        if (_nudgeNote != null || (!mob.week.complete && !mob.nudge.canSend)) ...[
          const SizedBox(height: MmSpace.s8),
          MobNote(_nudgeNote ?? MobCopy.nudgeSentReason, center: true),
        ],
      ],
    );
  }

  static String _costLine(MobCostType t) => switch (t) {
        MobCostType.included => MobCopy.costIncluded,
        MobCostType.allowance => MobCopy.costAllowance,
        _ => MobCopy.costConfirm,
      };

  Widget _members(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const GroupHeading(MobCopy.membersTitle, top: MmSpace.s32),
        Padding(
          padding: youGutter,
          child: Column(
            children: [for (final m in mob.members) MemberRow(member: m, onMenu: m.you ? null : () => _memberMenu(m))],
          ),
        ),
      ],
    );
  }

  Widget _settings(BuildContext context) {
    final actions = ref.read(mobActionsProvider);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const GroupHeading(MobCopy.settingsTitle, top: MmSpace.s32),
        _SwitchRow(
          title: MobCopy.showScore,
          note: MobCopy.showScoreNote,
          value: mob.you.showScore,
          onChanged: (v) async {
            ref.read(hapticsProvider).toggle(v);
            final f = await actions.updateMe(showScore: v);
            if (f != null && context.mounted) showMobToast(context, MobCopy.failure(f));
          },
        ),
        _SwitchRow(
          title: MobCopy.muteNudges,
          value: mob.you.nudgesMuted,
          onChanged: (v) async {
            ref.read(hapticsProvider).toggle(v);
            final f = await actions.updateMe(nudgesMuted: v);
            if (f != null && context.mounted) showMobToast(context, MobCopy.failure(f));
          },
        ),
        YouPanel(
          flat: true,
          inset: 28 + MmSpace.s16,
          children: [
            YouRow(
              flat: true,
              icon: LucideIcons.pencil,
              title: MobCopy.changeName,
              onTap: () => showMmSheet<void>(
                context: context,
                title: MobCopy.changeName,
                builder: (_) => EditMeSheet(name: mob.you.name, colour: mob.you.colour),
              ),
            ),
            YouRow(flat: true, icon: LucideIcons.logOut, title: MobCopy.leave, destructive: true, onTap: _leave),
          ],
        ),
      ],
    );
  }
}

class _SwitchRow extends StatelessWidget {
  const _SwitchRow({required this.title, required this.value, required this.onChanged, this.note});

  final String title;
  final String? note;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final colors = context.mmColors;
    return MergeSemantics(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: youText + MmSpace.s4, vertical: MmSpace.s8),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: MmTarget.min),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: type.body.copyWith(color: colors.ink)),
                    if (note != null) Text(note!, style: type.small.copyWith(color: colors.ink2)),
                  ],
                ),
              ),
              const SizedBox(width: MmSpace.s12),
              MmSwitch(value: value, semanticsLabel: title, onChanged: onChanged),
            ],
          ),
        ),
      ),
    );
  }
}

/// One member, 48 dp or taller: the initial, the name, "Sat" or nothing, the score only if they
/// chose to show it, and a menu. Rows stay in join order (P5).
class MemberRow extends StatelessWidget {
  const MemberRow({super.key, required this.member, this.onMenu});

  final MobMember member;
  final VoidCallback? onMenu;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final colors = context.mmColors;
    final score = member.scoreLine;
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 56),
      child: Row(
        children: [
          InitialDisc(member: member, size: 36),
          const SizedBox(width: MmSpace.s12),
          Expanded(
            child: Text.rich(
              TextSpan(
                children: [
                  TextSpan(text: member.name, style: type.body.copyWith(color: colors.ink, fontWeight: FontWeight.w600)),
                  if (member.you) TextSpan(text: '  ${MobCopy.you}', style: type.small.copyWith(color: colors.ink3)),
                ],
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          if (score != null) ...[
            Text(score, style: type.small.copyWith(color: colors.ink2, fontFeatures: const [FontFeature.tabularFigures()])),
            const SizedBox(width: MmSpace.s12),
          ],
          if (member.sat)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: MmSpace.s8, vertical: MmSpace.s2),
              decoration: BoxDecoration(color: colors.volt, borderRadius: MmRadius.pillAll),
              child: Text(MobCopy.sat, style: type.small.copyWith(color: colors.voltInk, fontWeight: FontWeight.w700)),
            ),
          if (onMenu != null)
            IconButton(
              tooltip: MobCopy.memberMenu(member.name),
              onPressed: onMenu,
              constraints: const BoxConstraints(minWidth: MmTarget.min, minHeight: MmTarget.min),
              icon: Icon(LucideIcons.ellipsis, color: colors.ink2, size: 20),
            )
          else
            const SizedBox(width: MmTarget.min),
        ],
      ),
    );
  }
}

/// The shared trap: aggregate only (P7), with the one way to act on it.
class TrapCard extends ConsumerWidget {
  const TrapCard({super.key, required this.trap});

  final MobTrap trap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final type = context.mmType;
    final colors = context.mmColors;
    final picked = trap.youPickedIt ?? false;
    return MobCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(MobCopy.trapTitle, style: type.label.copyWith(color: colors.ink2)),
          const SizedBox(height: MmSpace.s8),
          Text(MobCopy.trapLine(trap), style: type.title.copyWith(color: colors.ink)),
          const SizedBox(height: MmSpace.s4),
          Text(MobCopy.trapName(trap), style: type.body.copyWith(color: colors.ink2)),
          const SizedBox(height: MmSpace.s16),
          PillKey(
            label: picked ? MobCopy.repairIt : MobCopy.seeWhy(trap.option),
            onPressed: () => ref.read(mobNavigatorProvider).openTrap(context, trap),
          ),
        ],
      ),
    );
  }
}

/// The ring with its centre figure, remembering which sitters this student has seen ink in.
class MobRingView extends ConsumerWidget {
  const MobRingView({super.key, required this.mob, this.size = 168, this.compact = false});

  final Mob mob;
  final double size;
  final bool compact;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final type = context.mmType;
    final colors = context.mmColors;
    final seen = ref.watch(mobSeenProvider(mob.week.key));
    final reduced = Motion.reduced(context);
    final plan = ringPlan(mob, seenSat: seen.value ?? mob.week.sat, reducedMotion: reduced || !seen.hasValue);
    final line = MobCopy.ringLine(plan.sat, plan.size);
    return MobRing(
      plan: plan,
      size: size,
      semanticsLabel: line,
      onInked: seen.hasValue && (seen.value ?? 0) != plan.sat ? () => ref.read(mobSeenProvider(mob.week.key).notifier).mark(plan.sat) : null,
      center: compact
          ? Text('${plan.sat}/${plan.size}', style: type.label.copyWith(color: colors.ink, fontWeight: FontWeight.w700))
          : Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('${plan.sat} of ${plan.size}', style: type.headline.copyWith(color: colors.ink, fontFeatures: const [FontFeature.tabularFigures()])),
                Text('sat this week', style: type.small.copyWith(color: colors.ink2)),
              ],
            ),
    );
  }
}
