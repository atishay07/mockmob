import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_providers.dart';
import '../../core/auth/auth_state.dart';
import '../../core/copy/copy.dart';
import '../../core/motion/motion.dart';
import '../../core/repositories/repositories.dart';
import '../../core/router/external_link_opener.dart';
import '../../core/router/routes.dart';
import '../../core/sync/pending_work.dart';
import '../../core/theme/theme.dart';
import '../../core/widgets/widgets.dart';
import '../rhythm/copy.dart' show RhythmCopy;
import '../rhythm/logic/milestone_tracks.dart';
import '../rhythm/logic/tokens.dart';
import '../rhythm/logic/week_view.dart' show WeekStatus, runNote, weeksInRhythmText;
import '../rhythm/rhythm.dart';
import '../rhythm/widgets/rhythm_layout.dart' show SectionBreak;
import '../rhythm/widgets/token_shelf.dart';
import 'copy.dart';
import 'edit_copy.dart';
import 'data/student_target.dart';
import 'hub/hub_sections.dart';
import 'hub/sheet_card.dart';
import 'hub/sheet_fields.dart';
import 'widgets/you_page.dart';
import 'you_routes.dart';

/// You (brief section 12): identity first, settings second. The student's sheet for the season
/// sits in the lamp light at the top, the brass milestone tokens stand on their shelf beneath it,
/// and the calm settings panels follow. The fourth tab on the bar.
class YouHubScreen extends ConsumerStatefulWidget {
  const YouHubScreen({super.key, this.tools});

  /// The CUET tools group (the tools feature's `ToolsShelf`). Null shows the two website rows
  /// that open in a Custom Tab, so the hub works before the tools routes are registered.
  final Widget? tools;

  @override
  ConsumerState<YouHubScreen> createState() => _YouHubScreenState();
}

class _YouHubScreenState extends ConsumerState<YouHubScreen> {
  bool _openFailed = false;

  /// The website rows (only when no tools shelf is given): the page itself on www.mockmob.in,
  /// even though the ActionRouter now sends these paths to the native tools.
  Future<void> _openTool(String path) async {
    final ok = await ref.read(externalLinkOpenerProvider).open(Uri.https('www.mockmob.in', path));
    if (mounted) setState(() => _openFailed = !ok);
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
    final note = paused ? week.label : (runNote(rhythm) ?? weeksInRhythmText(rhythm));
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
    final now = ref.watch(nowProvider)();
    final off = prefs.loaded && prefs.hidden;
    final bottom = MediaQuery.viewPaddingOf(context).bottom;

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
                  child: ListView(
                    padding: EdgeInsets.only(top: MmRhythm.screenTop, bottom: MmSpace.s32 + bottom),
                    children: [
                      // The shared tab header (SPACING.md 9): the title on the gutter, no avatar,
                      // and the one side action as a 48 dp glass pill at the far end.
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
                        child: TabRootHeader(
                          title: YouCopy.hubTitle,
                          trailing: PillKey(
                            label: EditCopy.editSheet,
                            semanticsLabel: EditCopy.editSheetLabel,
                            onPressed: () => openYouPage(context, YouPaths.sheet),
                          ),
                        ),
                      ),
                      const _ExpiredWorkNotice(),
                      if (_openFailed)
                        const Padding(
                          padding: EdgeInsets.fromLTRB(MmSpace.gutter, 0, MmSpace.gutter, MmSpace.s12),
                          child: InlineBanner(message: YouCopy.toolOpenFailed, tone: BannerTone.error),
                        ),
                      const SizedBox(height: MmSpace.s16),
                      MmStaggerItem(
                        index: 0,
                        child: SheetCard(
                          name: auth.name,
                          email: auth.email,
                          target: target,
                          subjects: auth.subjects.isNotEmpty ? auth.subjects : target.subjects,
                          week: _week(snapshot, off),
                          onOpenRhythm: () => context.push(AppRoutes.youRhythm),
                          onEdit: () => openYouPage(context, YouPaths.sheet),
                          onEditSubjects: () => openYouPage(context, YouPaths.subjects),
                        ),
                      ),
                      MmStaggerItem(index: 1, child: _shelf(snapshot, now)),
                      const MmStaggerItem(
                        index: 2,
                        child: _HubSection(title: YouCopy.hubProgress, child: ProgressPanel()),
                      ),
                      const MmStaggerItem(
                        index: 3,
                        child: _HubSection(title: YouCopy.hubSettings, child: SettingsPanel()),
                      ),
                      MmStaggerItem(
                        index: 4,
                        child: _HubSection(title: YouCopy.hubTools, child: widget.tools ?? ToolsPanel(onOpen: _openTool)),
                      ),
                      const HubFooter(),
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

  Widget _shelf(RhythmSnapshot snapshot, DateTime now) {
    final colors = context.mmColors;
    final type = context.mmType;
    final failed = !snapshot.hasData && !snapshot.isInitialLoading;
    final tracks = milestoneTracks(snapshot.rhythm?.milestones ?? const []);
    final landed = tracks.fold<int>(0, (n, t) => n + t.earned.length);
    final total = tracks.fold<int>(0, (n, t) => n + t.steps.length);
    return _HubSection(
      title: YouCopy.shelfTitle,
      trailing: KeyButton.quiet(label: YouCopy.shelfSeeAll, onPressed: () => context.push(AppRoutes.youMilestones)),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
        child: failed
            // One pill on the screen retries the rhythm (the week's); this one is a quiet link,
            // so a failed hub reads as one problem with one way out, not two stacked alarms.
            ? Row(
                children: [
                  Expanded(child: Text(YouCopy.shelfLoadFailed, style: type.small.copyWith(color: colors.ink2))),
                  const SizedBox(width: MmSpace.s8),
                  KeyButton.quiet(label: YouCopy.tryAgain, onPressed: () => ref.read(rhythmRepositoryProvider.notifier).refresh(force: true)),
                ],
              )
            : Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // How many of the nine steps the server has dated, only once the rhythm has loaded.
                  if (snapshot.hasData && landed > 0)
                    Padding(
                      padding: const EdgeInsets.only(bottom: MmSpace.s12),
                      child: Text(RhythmCopy.trackCountOf(landed, total), style: type.small.copyWith(color: colors.ink2)),
                    ),
                  // The shelf is the way in to Milestones: the page grows out of it (container
                  // transform, MOTION.md C4) and shrinks back into it on back.
                  MmPressable(
                    onTap: () => context.push(AppRoutes.youMilestones),
                    captureLaunch: true,
                    haptic: MmPressHaptic.selection,
                    pressedScale: 0.99,
                    focusRadius: MmRadius.smallAll,
                    // No label of its own: every token keeps its own words for TalkBack, and "See all"
                    // above is the named way in.
                    builder: (context, pressed, focused) => TokenShelf(
                      slots: tokenSlots(snapshot.rhythm?.milestones ?? const []),
                      zone: snapshot.timezone,
                      now: now,
                      loading: snapshot.isInitialLoading,
                      freshIds: ref.watch(celebrationControllerProvider.select((s) => s.freshRows)),
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}

/// A typeset section of the hub (SPACING.md 3.1): 32 dp of air, a hairline rule, 16 dp, the title
/// in Bricolage 24 with its optional action at the far end, 12 dp, then [child]. The title sits on
/// the gutter exactly under the edge of the sheet above it.
class _HubSection extends StatelessWidget {
  const _HubSection({required this.title, required this.child, this.trailing});

  final String title;
  final Widget child;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Padding(padding: EdgeInsets.symmetric(horizontal: MmSpace.gutter), child: SectionBreak()),
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
