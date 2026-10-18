import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/haptics/haptics.dart';
import '../../../core/models/subject.dart' show isHiddenSubject;
import '../../../core/motion/motion.dart';
import '../../../core/repositories/remote_state.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../practice/widgets/stale_subjects_banner.dart' show openEditSubjects;
import '../../you/data/subject_catalog.dart' show youSubjectNames;
import '../../you/widgets/you_page.dart';
import '../../you/widgets/you_row.dart';
import '../copy.dart';
import '../data/mob_models.dart';
import '../data/mob_navigator.dart';
import '../data/mob_repository.dart';
import '../data/mob_seen.dart';
import '../logic/mob_ring.dart';
import '../mob_routes.dart';
import '../widgets/mob_compare_card.dart';
import '../widgets/mob_extras.dart';
import '../widgets/mob_parts.dart';
import '../widgets/mob_plan_widgets.dart';
import '../widgets/mob_ring.dart';
import 'mob_sheets.dart';

/// The Mob page (SOCIAL-SPEC sections 7, 8 and 15): the ring, one primary action, what the Mob has in
/// common (the free teaser, the Pro side-by-side), the shared trap, extra papers, the members in join
/// order, the invite, and the settings. Or, with no Mob, the start form. Every state is drawn: loading,
/// failed, off, no Mob, alone, in a Mob, all sat, the week closed.
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
    if (mobDisabledError(state.error)) {
      return const [Padding(padding: youGutter, child: _OffCard())];
    }
    if (state.value == null && (state.loading || (state.error == null && state.fetchedAt == null))) {
      return const [Padding(padding: youGutter, child: _MobSkeleton())];
    }
    if (state.value == null) {
      return [Padding(padding: youGutter, child: _ErrorCard(error: state.error))];
    }
    if (mob == null) return const [StartMobForm()];
    // Keyed by Mob: another Mob starts clean, so nothing of the one before stays open.
    return [MobBody(key: ValueKey(mob.id), mob: mob)];
  }
}

class _MobSkeleton extends StatelessWidget {
  const _MobSkeleton();

  @override
  Widget build(BuildContext context) {
    return const SkeletonGroup(
      label: MobCopy.loadingMob,
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

class _OffCard extends StatelessWidget {
  const _OffCard();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s16),
      child: MobCard(child: Text(MobCopy.unavailable, style: context.mmType.body.copyWith(color: context.mmColors.ink2))),
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

/// No Mob yet (or a Pro student starting another): what it is in a few lines, a subject, a name and a
/// colour, and one volt key. [another] drops the pitch (it sits in a sheet) and leaves out the
/// subjects that already have a Mob.
class StartMobForm extends ConsumerStatefulWidget {
  const StartMobForm({super.key, this.another = false, this.skip = const [], this.onStarted});

  final bool another;
  final List<String> skip;
  final VoidCallback? onStarted;

  @override
  ConsumerState<StartMobForm> createState() => _StartMobFormState();
}

class _StartMobFormState extends ConsumerState<StartMobForm> {
  late final TextEditingController _name;
  String? _subject;
  int _colour = 0;
  bool _busy = false;
  String? _error;
  String? _nameError;

  /// The server said there is no subject to start a Mob for: the way forward is Edit subjects.
  bool _subjectsFirst = false;

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
      setState(() => _nameError = MobCopy.nameRule);
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
      _nameError = null;
      _subjectsFirst = false;
    });
    final actions = ref.read(mobActionsProvider);
    final failure = await actions.create(subject: subject, name: _name.text, colour: _colour);
    if (!mounted) return;
    setState(() => _busy = false);
    if (failure != null) {
      final nameProblem = failure == MobFailure.nameInvalid || failure == MobFailure.nameRefused;
      setState(() {
        if (nameProblem) {
          _nameError = failure == MobFailure.nameInvalid ? MobCopy.nameRule : MobCopy.failure(failure);
        } else {
          _error = actions.say(failure);
        }
        _subjectsFirst = failure.needsSubjects;
      });
    } else {
      ref.read(hapticsProvider).confirm();
      widget.onStarted?.call();
    }
  }

  @override
  Widget build(BuildContext context) {
    final subjects = [
      for (final s in ref.watch(authSnapshotProvider.select((a) => a.subjects)))
        if (RegExp(r'^[a-z][a-z_]{1,40}$').hasMatch(s) && !isHiddenSubject(s) && !widget.skip.contains(s)) s,
    ];
    if (_subject == null || !subjects.contains(_subject)) _subject = subjects.isEmpty ? null : subjects.first;
    // No subject to start a Mob for: one sentence and the one way forward, never a dead Start key.
    final noSubject = subjects.isEmpty;
    final form = noSubject
        ? Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              MobNote(widget.skip.isEmpty ? MobCopy.noSubjects : MobCopy.everySubjectHasMob),
              const SizedBox(height: MmSpace.s16),
              if (widget.skip.isEmpty)
                KeyButton(label: MobCopy.chooseSubjects, onPressed: () => openEditSubjects(context))
              else
                KeyButton.secondary(label: MobCopy.addSubject, onPressed: () => openEditSubjects(context)),
              if (!widget.another) ...[
                const SizedBox(height: MmSpace.s12),
                const MobNote(MobCopy.haveLink, center: true),
              ],
            ],
          )
        : _formColumn(context, subjects);
    if (widget.another) return Padding(padding: const EdgeInsets.symmetric(horizontal: MmSpace.sheetSide), child: form);
    return _startPage(context, form);
  }

  Widget _formColumn(BuildContext context, List<String> subjects) {
    final type = context.mmType;
    final colors = context.mmColors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(MobCopy.subjectLabel, style: type.label.copyWith(color: colors.ink2)),
        const SizedBox(height: MmSpace.s8),
        Wrap(
          spacing: MmSpace.s8,
          runSpacing: MmSpace.s4,
          children: [
            for (final s in subjects)
              MmChip(label: youSubjectNames[s] ?? Mob(subject: s).subjectName, selected: _subject == s, onTap: () => setState(() => _subject = s)),
          ],
        ),
        const SizedBox(height: MmSpace.s24),
        MobNameField(controller: _name, label: MobCopy.nameLabel, error: _nameError, onChanged: (_) => setState(() => _nameError = null)),
        const SizedBox(height: MmSpace.s4),
        const MobNote(MobCopy.nameNote),
        const SizedBox(height: MmSpace.s16),
        Text(MobCopy.colourLabel, style: type.label.copyWith(color: colors.ink2)),
        ColourPicker(value: _colour, onChanged: (c) => setState(() => _colour = c)),
        const SizedBox(height: MmSpace.s24),
        KeyButton(label: _busy ? 'Starting your Mob' : MobCopy.startKey, loading: _busy, onPressed: _busy || _subject == null ? null : _start),
        const SizedBox(height: MmSpace.s8),
        const MobNote(MobCopy.startCost, center: true),
        if (_error != null) ...[
          const SizedBox(height: MmSpace.s12),
          InlineBanner(message: _error!, tone: BannerTone.error),
          if (_subjectsFirst) ...[
            const SizedBox(height: MmSpace.s8),
            KeyButton.secondary(label: MobCopy.chooseSubjects, onPressed: () => openEditSubjects(context)),
          ],
        ],
        if (!widget.another) ...[
          const SizedBox(height: MmSpace.s12),
          const MobNote(MobCopy.haveLink, center: true),
        ],
      ],
    );
  }

  Widget _startPage(BuildContext context, Widget form) {
    final type = context.mmType;
    final colors = context.mmColors;
    return Padding(
      padding: youGutter,
      child: MmStagger(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: MmSpace.s8),
            MmStaggerItem(index: 0, child: Text(MobCopy.pitch, style: type.headline.copyWith(color: colors.ink))),
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
                          Padding(padding: const EdgeInsets.only(top: 3), child: Icon(LucideIcons.check, size: 18, color: colors.accentText)),
                          const SizedBox(width: MmSpace.s12),
                          Expanded(child: Text(line, style: type.body.copyWith(color: colors.ink2))),
                        ],
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: MmSpace.s24),
            MmStaggerItem(index: 2, child: form),
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
  /// The paper being opened: the week's (`'week'`) or an extra paper's id. One start runs at a time.
  String? _sitting;
  bool _nudging = false;
  String? _nudgeNote;
  bool _seenNudge = false;

  Mob get mob => widget.mob;

  /// The sentence for a failed write: the server's own when it says a real figure (the wait of a 429).
  String _say(MobFailure f) => ref.read(mobActionsProvider).say(f);

  Future<void> _sit({MobExtra? extra}) async {
    if (_sitting != null) return;
    setState(() => _sitting = extra?.id ?? 'week');
    final failure = await ref.read(mobNavigatorProvider).sitPaper(context, ref, mob, extra: extra);
    if (!mounted) return;
    setState(() => _sitting = null);
    if (failure != null) showMobToast(context, MobCopy.failure(failure));
  }

  Future<void> _nudge() async {
    setState(() => _nudging = true);
    final failure = await ref.read(mobActionsProvider).nudge();
    if (!mounted) return;
    setState(() {
      _nudging = false;
      _nudgeNote = failure == null ? MobCopy.nudgeSentNote : _say(failure);
    });
    // The success haptic only after the server's ack (haptic grammar).
    if (failure == null) ref.read(hapticsProvider).confirm();
  }

  Future<void> _invite() => showMmSheet<void>(context: context, title: MobCopy.inviteTitle, builder: (_) => const InviteSheet());

  Future<void> _startAnother() => showMmSheet<void>(
        context: context,
        title: mob.plan.startedNone ? MobCopy.startOwnTitle : MobCopy.startAnotherTitle,
        builder: (sheet) => StartMobForm(another: true, skip: [for (final m in mob.mobs) m.subject], onStarted: () => Navigator.of(sheet).pop()),
      );

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
        if (!await confirmMobSheet(context, title: MobCopy.blockTitle(m.name), body: MobCopy.blockBody(m.name), confirm: MobCopy.leaveAndBlock)) return;
        failure = await actions.leave(block: m.memberId);
      case 'remove':
        if (!await confirmMobSheet(context, title: MobCopy.removeTitle(m.name), body: MobCopy.removeBody(m.name), confirm: MobCopy.removeMember)) return;
        failure = await actions.remove(m.memberId);
    }
    if (failure != null && mounted) showMobToast(context, _say(failure));
  }

  Future<void> _leave() async {
    if (!await confirmMobSheet(context, title: MobCopy.leaveTitle(mob.several, mob.subjectName), body: MobCopy.leaveBody, confirm: MobCopy.leaveConfirm)) return;
    final failure = await ref.read(mobActionsProvider).leave();
    if (failure != null && mounted) showMobToast(context, _say(failure));
  }

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final colors = context.mmColors;
    final now = ref.watch(nowProvider)();
    final closed = mob.week.closedAt(now);
    final trap = mob.visibleTrap;
    final received = mob.week.youSat ? null : mob.nudge.receivedFrom;
    final together = mob.week.youSat && !mob.alone ? mob.together : null;
    final compare = mob.week.youSat && !mob.alone ? mob.compare : null;

    var i = 0;
    return MmStagger(
      replayKey: '${mob.id}:${mob.week.key}',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: MmSpace.s8),
          MmStaggerItem(index: i++, child: MobSwitcher(mob: mob, onStartAnother: _startAnother)),
          MmStaggerItem(
            index: i++,
            child: Padding(
              padding: youGutter,
              child: MobCard(
                padding: const EdgeInsets.fromLTRB(MmSpace.s20, MmSpace.s24, MmSpace.s20, MmSpace.s20),
                child: Column(
                  children: [
                    Text(MobCopy.paperLine(mob.subjectName, mob.week.paper.count), style: type.label.copyWith(color: colors.ink2)),
                    const SizedBox(height: MmSpace.s16),
                    MobRingView(mob: mob, size: 168),
                    const SizedBox(height: MmSpace.s16),
                    SitterDiscs(sitters: ringPlan(mob).sitters),
                    const SizedBox(height: MmSpace.s12),
                    MobNote(closed ? MobCopy.closed : MobCopy.closes, center: true),
                    if (received != null) ...[
                      const SizedBox(height: MmSpace.s8),
                      Text(MobCopy.nudgeReceived(received), textAlign: TextAlign.center, style: type.body.copyWith(color: colors.ink)),
                      KeyButton.quiet(label: MobCopy.gotIt, onPressed: _gotIt),
                    ],
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: MmSpace.s20),
          MmStaggerItem(index: i++, child: Padding(padding: youGutter, child: _primary(context, closed))),
          if (compare != null) ...[
            const SizedBox(height: MmSpace.s24),
            MmStaggerItem(index: i++, child: Padding(padding: youGutter, child: MobCompareCard(mob: mob, summary: compare, week: mob.week.key))),
          ],
          if (trap != null) ...[
            const SizedBox(height: MmSpace.s12),
            MmStaggerItem(index: i++, child: Padding(padding: youGutter, child: TrapCard(trap: trap, resultId: mob.week.yourResultId))),
          ],
          if (together != null) ...[
            const SizedBox(height: MmSpace.s12),
            MmStaggerItem(index: i++, child: Padding(padding: youGutter, child: MobTogetherCard(together: together))),
          ],
          MmStaggerItem(index: i++, child: MobExtrasSection(mob: mob, busyExtra: _sitting == 'week' ? null : _sitting, onSit: (x) => _sit(extra: x))),
          MmStaggerItem(index: i++, child: _members(context)),
          // The owner's stop rule paused new invites: say so plainly and offer no invite key.
          if (mob.seatsLeft > 0 && mob.invitesPaused)
            Padding(padding: const EdgeInsets.fromLTRB(youText, MmSpace.s12, youText, 0), child: const MobNote(MobCopy.invitesPaused)),
          if (mob.canInvite && !mob.alone)
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
          if (mob.plan.pro && mob.pastWeeks > 0)
            MmStaggerItem(
              index: i++,
              child: Padding(
                padding: const EdgeInsets.only(top: MmSpace.s24),
                child: YouPanel(
                  flat: true,
                  inset: 28 + MmSpace.s16,
                  children: [
                    YouRow(
                      flat: true,
                      icon: LucideIcons.history,
                      title: MobCopy.historyTitle,
                      note: MobCopy.historyCount(mob.pastWeeks),
                      onTap: () => openMobHistory(context),
                    ),
                  ],
                ),
              ),
            ),
          MmStaggerItem(index: i++, child: MobProNote(mob: mob)),
          MmStaggerItem(index: i++, child: _settings(context)),
        ],
      ),
    );
  }

  void _gotIt() {
    if (_seenNudge) return;
    _seenNudge = true;
    ref.read(mobActionsProvider).nudgeSeen();
  }

  Widget _primary(BuildContext context, bool closed) {
    final paper = mob.week.paper;
    final sitting = _sitting == 'week';
    if (mob.alone && !mob.week.youSat && mob.canInvite) {
      // Alone: the invite is the one primary action until someone joins (when invites are paused the
      // paper is the primary action, like any Mob).
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KeyButton(label: MobCopy.inviteRow(mob.seatsLeft), onPressed: _invite),
          const SizedBox(height: MmSpace.s8),
          const MobNote(MobCopy.aloneLead, center: true),
          if (!closed && !paper.freeUsed) ...[
            const SizedBox(height: MmSpace.s12),
            KeyButton.secondary(label: sitting ? MobCopy.openingPaper : MobCopy.sitKey(paper.count, paper.minutes), loading: sitting, onPressed: _sitting != null ? null : _sit),
          ],
          if (paper.freeUsed && !closed) ..._freeUsed(),
        ],
      );
    }
    if (closed && !mob.week.youSat) return const SizedBox.shrink();
    if (!mob.week.youSat) {
      if (paper.freeUsed) return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: _freeUsed());
      final cost = MobCopy.costLine(paper);
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KeyButton(label: sitting ? MobCopy.openingPaper : MobCopy.sitKey(paper.count, paper.minutes), loading: sitting, onPressed: _sitting != null ? null : _sit),
          const SizedBox(height: MmSpace.s8),
          MobNote(MobCopy.sitNote(paper.count, paper.minutes), center: true),
          // The contract: a null cost draws nothing (mob-v1 rules).
          if (cost != null) MobNote(cost, center: true),
        ],
      );
    }
    final resultId = mob.week.yourResultId;
    final reason = MobCopy.nudgeReason(mob.nudge.reason);
    final canNudge = mob.nudge.canSend && _nudgeNote == null;
    final showNudge = !mob.alone && mob.nudge.reason != MobNudgeReason.everyoneSat && !closed;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (resultId != null)
          if (closed)
            KeyButton.secondary(label: MobCopy.seeAnswers, onPressed: () => ref.read(mobNavigatorProvider).openAnswers(context, resultId))
          else
            KeyButton(label: MobCopy.seeAnswers, onPressed: () => ref.read(mobNavigatorProvider).openAnswers(context, resultId)),
        if (showNudge) ...[
          const SizedBox(height: MmSpace.s12),
          KeyButton.secondary(
            label: MobCopy.nudgeKey,
            loading: _nudging,
            // The reason is the line under the key (drawn once, below): the key speaks only when nothing else does.
            disabledReason: canNudge || reason != null || _nudgeNote != null ? null : MobCopy.nudgeSentReason,
            onPressed: canNudge && !_nudging ? _nudge : null,
          ),
        ],
        // Everyone has sat: no dead key, only the line that says so.
        if (_nudgeNote != null || (!mob.alone && reason != null)) ...[
          const SizedBox(height: MmSpace.s8),
          MobNote(_nudgeNote ?? reason!, center: true),
        ],
      ],
    );
  }

  /// A free student's one weekly Mob paper went to another of their Mobs: say so, and sell nothing.
  List<Widget> _freeUsed() => [
        const SizedBox(height: MmSpace.s12),
        const MobNote(MobCopy.freeUsed, center: true),
      ];

  Widget _members(BuildContext context) {
    final type = context.mmType;
    final colors = context.mmColors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        GroupHeading(
          MobCopy.membersTitle,
          top: MmSpace.s32,
          trailing: Padding(
            padding: const EdgeInsets.only(right: MmSpace.gutter - MmSpace.s4),
            child: Text(MobCopy.membersCount(mob.members.length), style: type.small.copyWith(color: colors.ink2, fontFeatures: const [FontFeature.tabularFigures()])),
          ),
        ),
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
    Future<void> toggle(Future<MobFailure?> Function() write, bool v) async {
      ref.read(hapticsProvider).toggle(v);
      final f = await write();
      if (f != null && context.mounted) showMobToast(context, actions.say(f));
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const GroupHeading(MobCopy.settingsTitle, top: MmSpace.s32),
        // A Mob of one has nobody to show a score to or to be nudged by: the two switches arrive with the first friend.
        if (!mob.alone) ...[
          MobSwitchRow(
            title: MobCopy.shareLabel,
            note: MobCopy.showScoreNote,
            value: mob.you.showScore,
            onChanged: (v) => toggle(() => actions.updateMe(showScore: v), v),
          ),
          MobSwitchRow(
            title: MobCopy.muteNudges,
            note: MobCopy.muteNudgesNote,
            value: mob.you.nudgesMuted,
            onChanged: (v) => toggle(() => actions.updateMe(nudgesMuted: v), v),
          ),
        ],
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

/// One member, 56 dp tall: the initial, the name, the score only if they chose to show it, and a
/// menu. Rows stay in join order (P5) and carry no sitting state, so no row reads as "has not sat"
/// (P6): the ring names the sitters.
class MemberRow extends StatelessWidget {
  const MemberRow({super.key, required this.member, this.onMenu});

  final MobMember member;
  final VoidCallback? onMenu;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final colors = context.mmColors;
    final score = member.sat ? member.scoreLine : null;
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
            const SizedBox(width: MmSpace.s4),
          ],
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
  const TrapCard({super.key, required this.trap, this.resultId});

  final MobTrap trap;
  final String? resultId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final type = context.mmType;
    final colors = context.mmColors;
    return MobCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Semantics(header: true, child: Text(MobCopy.trapTitle, style: type.label.copyWith(color: colors.ink2))),
          const SizedBox(height: MmSpace.s8),
          Text(MobCopy.trapLine(trap), style: type.title.copyWith(color: colors.ink)),
          const SizedBox(height: MmSpace.s4),
          Text(MobCopy.trapName(trap), style: type.body.copyWith(color: colors.ink2)),
          const SizedBox(height: MmSpace.s16),
          PillKey(
            label: trap.youGotItRight ? MobCopy.seeWhy(trap.option) : MobCopy.repairIt,
            onPressed: () => ref.read(mobNavigatorProvider).openTrap(context, trap, resultId: resultId),
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
    final key = '${mob.id}:${mob.week.key}';
    final seen = ref.watch(mobSeenProvider(key));
    final reduced = Motion.reduced(context);
    final plan = ringPlan(mob, seenSat: seen.value ?? mob.week.sat, reducedMotion: reduced || !seen.hasValue);
    final line = MobCopy.ringLine(plan.sat, plan.size);
    return MobRing(
      plan: plan,
      size: size,
      semanticsLabel: line,
      onInked: seen.hasValue && (seen.value ?? 0) != plan.sat ? () => ref.read(mobSeenProvider(key).notifier).mark(plan.sat) : null,
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
