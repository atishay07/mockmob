import 'dart:async';

import 'package:flutter/foundation.dart' show ValueListenable;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart' show RenderAbstractViewport, RenderBox, RenderObject;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_state.dart';
import '../../core/copy/copy.dart';
import '../../core/motion/motion.dart';
import '../../core/notes/sample_row.dart';
import '../../core/repositories/repositories.dart';
import '../../core/settings/changed_row.dart';
import '../../core/router/routes.dart';
import '../../core/sync/pending_work.dart';
import '../../core/theme/theme.dart';
import '../../core/widgets/widgets.dart';
import '../rhythm/copy.dart' show RhythmCopy;
import '../rhythm/logic/milestone_tracks.dart';
import '../rhythm/logic/week_view.dart' show WeekStatus, weeksInRhythmText;
import '../rhythm/rhythm.dart';
import '../rhythm/widgets/rhythm_layout.dart' show SectionBreak;
import '../rhythm/data/badges.dart';
import '../rhythm/widgets/badge_home.dart';
import '../notifications/notifications.dart' show NotificationsInvite;
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'hub/study_sections.dart';
import 'widgets/you_row.dart';
import '../rules/copy.dart';
import '../rules/data/rules_data.dart';
import '../rules/widgets/across_mocks_view.dart';
import '../social/social.dart' show MobHubRow;
import 'copy.dart';
import 'edit_copy.dart';
import 'data/student_target.dart';
import 'hub/hub_cards.dart';
import 'hub/sheet_card.dart';
import 'hub/sheet_fields.dart';
import 'widgets/you_page.dart';
import 'account/name_sheet.dart' show showNameSheet;
import 'you_routes.dart';

/// You is the student's study (IA D4, app-you-1016 A.2): the name in the lamp light, then this
/// week as "3 of 4 study days", the badges, the personal bests, across your mocks and the subjects,
/// with plan and credits as one row at the bottom. The account, the theme switch and the settings
/// live in the avatar sheet (IA D5), so nothing here repeats them above the study.
class YouHubScreen extends ConsumerStatefulWidget {
  const YouHubScreen({super.key, this.tools});

  /// The CUET tools group. Not drawn on You any more: the tools live in the Colleges tab (IA
  /// section 5). Kept so the router's call still compiles until the Shell drops it.
  final Widget? tools;

  @override
  ConsumerState<YouHubScreen> createState() => _YouHubScreenState();
}

class _YouHubScreenState extends ConsumerState<YouHubScreen> {
  // The sticky row of section chips (critic 16 Oct, finding 27): Plan, Look, Study, Alerts,
  // Colleges. Each chip scrolls to its section, and the chip of the section under the row is lit.
  final ScrollController _scroll = ScrollController();
  final GlobalKey _headerKey = GlobalKey();
  final GlobalKey _weekKey = GlobalKey();
  final List<GlobalKey> _sectionKeys = List.generate(_chipLabels.length, (_) => GlobalKey());
  final ValueNotifier<int?> _active = ValueNotifier<int?>(null);

  /// True while the page has scrolled the row to the top of the viewport, so content slides under
  /// it. A pinned header's own `overlapsContent` is false for the first pinned sliver (it only
  /// reports what an earlier sliver pushes under it), so the row measures this itself.
  final ValueNotifier<bool> _stuck = ValueNotifier<bool>(false);

  static const List<String> _chipLabels = [
    YouCopy.jumpWeek,
    YouCopy.jumpBadges,
    YouCopy.jumpBests,
    YouCopy.jumpMocks,
    YouCopy.jumpSubjects,
  ];

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_trackAfterFrame);
  }

  @override
  void dispose() {
    _scroll.removeListener(_trackAfterFrame);
    _scroll.dispose();
    _active.dispose();
    _stuck.dispose();
    super.dispose();
  }

  bool _trackQueued = false;

  /// A scroll notifies before the page is laid out at its new offset, so the sections would be
  /// measured where they were one frame ago (a jump would never be seen at all). Measure once
  /// the frame has landed.
  void _trackAfterFrame() {
    if (_trackQueued) return;
    _trackQueued = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _trackQueued = false;
      if (mounted) _trackActive();
    });
  }

  /// The section a chip was tapped for. Near the end of the page a short section cannot rise all
  /// the way to the row, so while the page rests at its end with that section on screen, its chip
  /// stays lit. Any other resting place clears it.
  int? _jumped;

  /// The chip of the last section whose top has reached the row. Nothing is lit above the first
  /// section (the row is not pinned yet).
  void _trackActive() {
    final header = _headerKey.currentContext?.findRenderObject();
    if (header is! RenderBox || !header.attached || !header.hasSize) return;
    final RenderObject? viewport = RenderAbstractViewport.maybeOf(header);
    if (viewport is RenderBox && viewport.attached && viewport.hasSize) {
      final stuck = header.localToGlobal(Offset.zero).dy <= viewport.localToGlobal(Offset.zero).dy + 0.5 && _scroll.hasClients && _scroll.offset > 0.5;
      if (_stuck.value != stuck) _stuck.value = stuck;
    }
    final line = header.localToGlobal(Offset.zero).dy + header.size.height + MmSpace.s16;
    int? active;
    for (var i = 0; i < _sectionKeys.length; i++) {
      final box = _sectionKeys[i].currentContext?.findRenderObject();
      if (box is! RenderBox || !box.attached) continue;
      if (box.localToGlobal(Offset.zero).dy <= line) active = i;
    }
    final jumped = _jumped;
    if (jumped != null && _scroll.hasClients) {
      final position = _scroll.position;
      final atEnd = position.pixels >= position.maxScrollExtent - 1;
      final box = _sectionKeys[jumped].currentContext?.findRenderObject();
      final onScreen = box is RenderBox && box.attached && box.localToGlobal(Offset.zero).dy < header.localToGlobal(Offset.zero).dy + position.viewportDimension;
      if (atEnd && onScreen && (active == null || jumped > active)) {
        active = jumped;
      } else if (!atEnd && !_scroll.position.isScrollingNotifier.value) {
        _jumped = null;
      }
    }
    if (_active.value != active) _active.value = active;
  }

  /// Scrolls so section [i] starts just under the row (or as close as the page's end allows), and
  /// lights its chip. Reduced motion jumps.
  void _jumpTo(int i) {
    final box = _sectionKeys[i].currentContext?.findRenderObject();
    if (box is! RenderBox || !_scroll.hasClients) return;
    final viewport = RenderAbstractViewport.maybeOf(box);
    if (viewport == null) return;
    final position = _scroll.position;
    // The viewport already leaves room for the pinned row when it reveals a box at its leading
    // edge, so the section lands just under the row without taking the row's height off again.
    final target = viewport.getOffsetToReveal(box, 0).offset.clamp(position.minScrollExtent, position.maxScrollExtent);
    _jumped = i;
    final duration = Motion.of(context, const Duration(milliseconds: 420));
    if (duration == Duration.zero) {
      _scroll.jumpTo(target);
    } else {
      unawaited(_scroll.animateTo(target, duration: duration, curve: Motion.glide).whenComplete(_trackAfterFrame));
    }
    _trackAfterFrame();
  }

  /// The name key on the hero: the editor, then Mobi greets the new name on Account's own page;
  /// here the row simply marks Account as changed.
  Future<void> _editName() async {
    final saved = await showNameSheet(context);
    if (saved != null && mounted) ref.read(changedSettingsRowProvider.notifier).mark(ChangedRowKeys.account);
  }

  SheetWeek _week(RhythmSnapshot snapshot, bool off) {
    if (off) return const SheetWeek.off();
    if (snapshot.isInitialLoading) return const SheetWeek.loading();
    final rhythm = snapshot.rhythm;
    final week = snapshot.week;
    if (rhythm == null || week == null) {
      return SheetWeek.failed(() => ref.read(rhythmRepositoryProvider.notifier).refresh(force: true));
    }
    final paused = week.status == WeekStatus.paused;
    final days = [for (final d in week.days) WeekBubbleDay(mark: d.studyDay ? WeekDayMark.done : WeekDayMark.open, isToday: d.isToday)];
    final note = paused
        ? week.label
        : week.studyDays == 0
            ? YouCopy.studyDayDefinition
            : rhythm.weeksMetStreak > 0
            ? YouCopy.runInARow(rhythm.weeksMetStreak)
            : (rhythm.bestRun > 0 ? RhythmCopy.bestRun(rhythm.bestRun) : weeksInRhythmText(rhythm));
    final count = YouCopy.weekCount(week.studyDays, week.goal);
    final study = [
      for (var i = 0; i < 7; i++)
        if (week.days[i].studyDay) weekdayNames[i],
    ];
    final today = week.days.indexWhere((d) => d.isToday);
    return SheetWeek.ready(
      planDays: planWeek(studied: [for (final d in week.days) d.studyDay], todayIndex: today < 0 ? null : today, planned: ref.watch(studyDayPlanProvider)),
      days: days,
      count: count,
      done: week.studyDays,
      goal: week.goal,
      paused: paused,
      note: note,
      description: [count, study.isEmpty ? 'No study days yet this week' : 'Studied ${joinWithAnd(study)}'].join('. '),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final auth = ref.watch(authSnapshotProvider);
    final snapshot = ref.watch(rhythmSnapshotProvider);
    final prefs = ref.watch(rhythmPrefsProvider);
    final target = ref.watch(studentTargetProvider);
    final off = prefs.loaded && prefs.hidden;
    final subjects = auth.subjects.isNotEmpty ? auth.subjects : target.subjects;
    final bottom = MediaQuery.viewPaddingOf(context).bottom;
    final week = _week(snapshot, off);
    final landedBadge = freshBadgeName(
      ref.watch(celebrationControllerProvider.select((s) => s.freshRows)),
      ref.watch(badgeMilestonesProvider) ?? const [],
    );

    // You is the fourth tab on the bar (DOCK.md 9.1): it uses the tab-root recipe of Practice and
    // Review. The shell has already added the bar's clearance to the bottom padding, so the list
    // clears the bar with 32 dp of air and no number of its own.
    return Scaffold(
      backgroundColor: colors.ground,
      body: Stack(
        children: [
          Positioned(
            left: 0,
            right: 0,
            top: 0,
            height: 520,
            child: IgnorePointer(child: LightField.lamp(context, center: const Alignment(-1.05, -1.0), strength: 0.9)),
          ),
          SafeArea(
            bottom: false,
            child: Align(
              alignment: Alignment.topCenter,
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: MmSpace.contentMaxWidth),
                child: MmStagger(
                  driver: MmStaggerDriver.route,
                  child: CustomScrollView(
                    controller: _scroll,
                    slivers: [
                      SliverPadding(
                        padding: const EdgeInsets.only(top: MmRhythm.screenTop),
                        sliver: SliverToBoxAdapter(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                      // The shared tab header (SPACING.md 9): the title on the gutter, no avatar,
                      // and the one side action as a 48 dp glass pill at the far end.
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
                        child: TabRootHeader(
                          title: YouCopy.hubTitle,
                          trailing: PillKey(
                            // "Edit profile", or just "Edit" once text is enlarged enough that the longer words would
                            // push the title off the row (the spoken label is the same either way).
                            label: EditCopy.editSheetShort,
                            semanticsLabel: EditCopy.editSheetLabel,
                            onPressed: () => openYouPage(context, YouPaths.sheet),
                          ),
                        ),
                      ),
                      const _ExpiredWorkNotice(),
                      // Offline with a saved read: say what the page is made of, with the time.
                      if (snapshot.stale && snapshot.fetchedAt != null)
                        Padding(
                          padding: const EdgeInsets.fromLTRB(MmSpace.gutter, 0, MmSpace.gutter, MmSpace.s12),
                          child: InlineBanner(message: YouCopy.savedOffline(snapshot.fetchedAt!), tone: BannerTone.offline, compact: true),
                        ),
                      const SizedBox(height: MmSpace.s16),
                      MmStaggerItem(
                        index: 0,
                        child: SheetCard(
                          name: auth.name,
                          // The email lives in the account sheet's identity block.
                          email: null,
                          target: target,
                          subjects: subjects,
                          week: week,
                          celebrations: prefs.mode,
                          showTarget: false,
                          // The ring and the week stand once, in the Study block below.
                          showWeek: false,
                          weekKey: _weekKey,
                          landedBadge: landedBadge,
                          onOpenRhythm: () => context.push(AppRoutes.youRhythm),
                          onEdit: () => openYouPage(context, YouPaths.sheet),
                          onEditName: _editName,
                          onEditSubjects: () => openYouPage(context, YouPaths.subjects),
                        ),
                      ),
                            ],
                          ),
                        ),
                      ),
                      SliverPersistentHeader(
                        pinned: true,
                        delegate: _ChipsHeader(headerKey: _headerKey, active: _active, stuck: _stuck, labels: _chipLabels, onSelected: _jumpTo),
                      ),
                      SliverPadding(
                        padding: EdgeInsets.only(bottom: MmSpace.s32 + bottom),
                        sliver: SliverToBoxAdapter(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                      // 1. This week: the ring says what it counts ("3 of 4 study days"), the
                      // planned week, then the goal, the planned days and the pause.
                      MmStaggerItem(
                        index: 1,
                        child: KeyedSubtree(
                          key: _sectionKeys[0],
                          child: _HubSection(
                            first: true,
                            title: YouCopy.hubWeek,
                            trailing: KeyButton.quiet(label: YouCopy.seeRhythm, onPressed: () => context.push(AppRoutes.youRhythm)),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                KeyedSubtree(key: _weekKey, child: WeekField(week: week, onOpen: () => context.push(AppRoutes.youRhythm))),
                                const StudyDaysPanel(),
                                // L19: the invitation to turn reminders on, only while they are off
                                // (the Account area's widget; it draws nothing otherwise and brings its own
                                // gutter, so it lines up with the rows above).
                                const NotificationsInvite(),
                              ],
                            ),
                          ),
                        ),
                      ),
                      // 2. Badges: the shelf of earned coins and the next one to go for.
                      MmStaggerItem(index: 2, child: KeyedSubtree(key: _sectionKeys[1], child: const BadgeHomeSection(rule: false))),
                      // 3. Personal bests, value first.
                      MmStaggerItem(
                        index: 3,
                        child: KeyedSubtree(
                          key: _sectionKeys[2],
                          child: _HubSection(
                            title: YouCopy.bestsTitle,
                            trailing: KeyButton.quiet(label: YouCopy.bestsSeeAll, onPressed: () => context.push(AppRoutes.youBests)),
                            child: const BestsRows(),
                          ),
                        ),
                      ),
                      // 4. Across your mocks (the same block as the Mistake Lab's end), then the
                      // repair record.
                      MmStaggerItem(index: 4, child: KeyedSubtree(key: _sectionKeys[3], child: const _AcrossSection())),
                      const MmStaggerItem(index: 5, child: _RepairRecordRow()),
                      // The Mob's permanent entry (SOCIAL-SPEC section 9); draws nothing while the server's switch is off.
                      const MmStaggerItem(index: 5, child: MobHubRow()),
                      // 5. My subjects, with the Aim row (course and colleges live in Colleges).
                      MmStaggerItem(
                        index: 6,
                        child: KeyedSubtree(
                          key: _sectionKeys[4],
                          child: _HubSection(
                            // Your repair record above ends on its own hairline.
                            rule: false,
                            title: YouCopy.hubSubjects,
                            trailing: KeyButton.quiet(
                              label: YouCopy.editSubjectsShort,
                              semanticsLabel: YouCopy.editSubjectsLabel,
                              onPressed: () => openYouPage(context, YouPaths.subjects),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                if (subjects.isNotEmpty)
                                  MmPressable(
                                    onTap: () => openYouPage(context, YouPaths.subjects),
                                    haptic: MmPressHaptic.selection,
                                    pressedScale: 0.99,
                                    focusRadius: MmRadius.smallAll,
                                    semanticsLabel: YouCopy.editSubjectsLabel,
                                    builder: (context, pressed, focused) => SubjectList(
                                      subjects: subjects,
                                      padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
                                    ),
                                  ),
                                const SizedBox(height: MmSpace.s8),
                                AimRow(target: target, onOpen: () => context.go(AppRoutes.colleges)),
                              ],
                            ),
                          ),
                        ),
                      ),
                      // 6. Plan and credits: one row; the tiles live in the account sheet.
                      const MmStaggerItem(
                        index: 7,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            // The Aim row above ends on a hairline and this row starts on one, so
                            // only air sits between them.
                            SizedBox(height: MmSpace.s32),
                            PlanCreditsRow(),
                          ],
                        ),
                      ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Your repair record, under Across your mocks (moved from the old Progress block).
class _RepairRecordRow extends StatelessWidget {
  const _RepairRecordRow();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s8),
      child: YouPanel(
        flat: true,
        inset: 28 + MmSpace.s16,
        children: [
          YouRow(flat: true, icon: LucideIcons.clipboardCheck, title: YouCopy.repairRecordRow, onTap: () => context.push(AppRoutes.reviewRecord)),
        ],
      ),
    );
  }
}

/// The sticky row of section chips: Plan, Look, Study, Alerts, Colleges. 56 dp tall (a 48 dp rail
/// with 4 dp above and below), clear on the ground at rest and solid with a hairline once content
/// slides under it, so it never shows text through it. A [ChipRail] gives each chip its whole
/// width, so none is cut mid-letter.
class _ChipsHeader extends SliverPersistentHeaderDelegate {
  const _ChipsHeader({required this.headerKey, required this.active, required this.stuck, required this.labels, required this.onSelected});

  static const double extent = 56;

  final GlobalKey headerKey;
  final ValueNotifier<int?> active;
  final ValueListenable<bool> stuck;
  final List<String> labels;
  final ValueChanged<int> onSelected;

  @override
  double get minExtent => extent;

  @override
  double get maxExtent => extent;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    final colors = context.mmColors;
    final clear = colors.ground.withValues(alpha: 0);
    return KeyedSubtree(
      key: headerKey,
      child: ValueListenableBuilder<bool>(
        valueListenable: stuck,
        builder: (context, isStuck, child) => AnimatedContainer(
          duration: Motion.of(context, const Duration(milliseconds: 120)),
          curve: Motion.out,
          // Clear on the ground at rest; once the row is pinned, an opaque band in the page colour
          // with a hairline under it, so nothing behind shows between or behind the chips.
          decoration: BoxDecoration(
            color: isStuck ? colors.ground : clear,
            border: Border(bottom: BorderSide(color: isStuck ? colors.line : colors.line.withValues(alpha: 0))),
          ),
          child: child,
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: MmSpace.s4),
          child: ValueListenableBuilder<int?>(
            valueListenable: active,
            builder: (context, selected, _) => ChipRail.labelled(
              labels: labels,
              selected: selected,
              onSelected: onSelected,
              semanticLabel: YouCopy.jumpLabel,
              bubbles: false,
            ),
          ),
        ),
      ),
    );
  }

  @override
  bool shouldRebuild(covariant _ChipsHeader old) => old.labels != labels || old.active != active || old.stuck != stuck || old.onSelected != onSelected;
}

/// A typeset section of the hub (SPACING.md 3.1): 32 dp of air, a hairline rule, 16 dp, the title
/// in Bricolage 24 with its optional action at the far end, 12 dp, then [child]. The title sits on
/// the gutter exactly under the edge of the sheet above it.
class _HubSection extends StatelessWidget {
  const _HubSection({required this.title, required this.child, this.trailing, this.first = false, this.rule = true});

  final String title;
  final Widget child;
  final Widget? trailing;

  /// The first section sits right under the pinned chips, which already divide it from the hero,
  /// so it takes no rule of its own (this keeps the top of Badges near the fold on a small phone).
  final bool first;

  /// False under a block that already ends on a hairline (a flat row list), so two rules never
  /// stack with air between them: the section keeps its 32 dp of air and drops its own rule.
  final bool rule;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (first)
          const SizedBox(height: MmSpace.s8)
        else
          Padding(padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter), child: SectionBreak(rule: rule)),
        SectionTitle(
          title,
          trailing: trailing,
          padding: EdgeInsets.fromLTRB(MmSpace.gutter, 0, trailing == null ? MmSpace.gutter : 0, MmSpace.s12),
        ),
        child,
      ],
    );
  }
}

/// Across your mocks on You (Mistake Lab v4 slice 3, spec 4.9): the block at the end of the Lab,
/// read from `GET /api/me/rules` so it shows the newest record. Nothing while signed out or when
/// the server sends no block; the server's own sentence before the first timed mock.
class _AcrossSection extends ConsumerWidget {
  const _AcrossSection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final state = ref.watch(rulesRepositoryProvider);
    final across = state.value?.acrossMocks;
    final Widget child;
    if (across != null) {
      child = AcrossMocksView(across: across, seenKey: 'you', titled: false);
    } else if (state.isInitialLoading) {
      child = const SkeletonGroup(
        label: RulesCopy.acrossTitle,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Skeleton.line(height: 16),
            SizedBox(height: MmSpace.s8),
            Skeleton.line(width: 220, height: 16),
            SizedBox(height: MmSpace.s20),
            Skeleton.line(height: 16),
            SizedBox(height: MmSpace.s8),
            Skeleton.line(width: 160, height: 16),
          ],
        ),
      );
    } else if (state.isFailedEmpty) {
      // One quiet way out, like the shelf's: the hub reads as one problem, not stacked alarms.
      child = Row(
        children: [
          Expanded(child: Text(RulesCopy.acrossLoadFailed, style: type.small.copyWith(color: colors.ink2))),
          const SizedBox(width: MmSpace.s8),
          KeyButton.quiet(label: YouCopy.tryAgain, onPressed: () => ref.read(rulesRepositoryProvider.notifier).refresh(force: true)),
        ],
      );
    } else if (state.value != null) {
      // Read, and nothing across mocks yet: say what will appear, show one sample row (tagged
      // "Example") and go to the next action (an empty state that teaches).
      child = Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(YouCopy.acrossEmpty, style: type.body.copyWith(color: colors.ink2)),
          const SizedBox(height: MmSpace.s12),
          const SampleRow(title: YouCopy.acrossSampleTitle, note: YouCopy.acrossSampleNote),
          const SizedBox(height: MmSpace.s4),
          Align(
            alignment: Alignment.centerLeft,
            child: KeyButton.quiet(label: YouCopy.acrossStart, onPressed: () => context.push(AppRoutes.practiceStart)),
          ),
        ],
      );
    } else {
      return const SizedBox.shrink();
    }
    return _HubSection(
      title: across?.title ?? RulesCopy.acrossTitle,
      child: Padding(padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter), child: child),
    );
  }
}

/// Study updates the outbox gave up on after a week unsent. Said once on You, then dismissed.
class _ExpiredWorkNotice extends ConsumerWidget {
  const _ExpiredWorkNotice();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final count = ref.watch(expiredWorkCountProvider).value ?? 0;
    if (count <= 0) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.gutter, 0, MmSpace.gutter, MmSpace.s12),
      child: InlineBanner(
        message: YouCopy.expiredWork(count),
        tone: BannerTone.warning,
        actionLabel: YouCopy.expiredWorkDismiss,
        onAction: () async {
          try {
            await ref.read(expiredWorkNoticeProvider).clear();
          } on Object {
            // The notice stays until it can be cleared.
          }
          ref.invalidate(expiredWorkCountProvider);
        },
      ),
    );
  }
}
