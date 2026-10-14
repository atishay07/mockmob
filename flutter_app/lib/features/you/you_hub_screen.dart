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
import '../rhythm/logic/tokens.dart';
import '../rhythm/logic/week_view.dart' show WeekStatus, runNote, weeksInRhythmText;
import '../rhythm/rhythm.dart';
import '../rhythm/widgets/token_shelf.dart';
import 'copy.dart';
import 'data/student_target.dart';
import 'hub/hub_sections.dart';
import 'hub/sheet_card.dart';
import 'hub/sheet_fields.dart';
import 'widgets/you_page.dart';
import 'you_routes.dart';

/// You (brief section 12): identity first, settings second. The student's sheet for the season
/// sits in the lamp light at the top, the brass milestone tokens stand on their shelf beneath it,
/// and the calm settings panels follow. Opened from the avatar on every tab root.
class YouHubScreen extends ConsumerStatefulWidget {
  const YouHubScreen({super.key, this.tools});

  /// The CUET tools group (the tools feature's `ToolsShelf`). Null shows the two website rows
  /// that open in a Custom Tab, so the hub works before the tools routes are registered.
  final Widget? tools;

  @override
  ConsumerState<YouHubScreen> createState() => _YouHubScreenState();
}

class _YouHubScreenState extends ConsumerState<YouHubScreen> with SingleTickerProviderStateMixin {
  late final AnimationController _enter = AnimationController(vsync: this, duration: const Duration(milliseconds: 620));
  bool _started = false;
  bool _openFailed = false;

  /// One staggered curve per block, made once: a curve attaches a listener to [_enter], so making
  /// them in build would add five on every rebuild.
  static const int _blocks = 5;
  static const double _totalMs = 620;
  late final List<CurvedAnimation> _rises = [
    for (var i = 0; i < _blocks; i++)
      () {
        final start = (i * 60 / _totalMs).clamp(0.0, 0.6);
        final end = (start + 300 / _totalMs).clamp(0.0, 1.0);
        return CurvedAnimation(parent: _enter, curve: Interval(start, end, curve: Motion.glide));
      }(),
  ];

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (Motion.reduced(context)) {
      _enter.value = 1;
    } else {
      _enter.forward();
    }
  }

  @override
  void dispose() {
    for (final rise in _rises) {
      rise.dispose();
    }
    _enter.dispose();
    super.dispose();
  }

  /// The website rows (only when no tools shelf is given): the page itself on www.mockmob.in,
  /// even though the ActionRouter now sends these paths to the native tools.
  Future<void> _openTool(String path) async {
    final ok = await ref.read(externalLinkOpenerProvider).open(Uri.https('www.mockmob.in', path));
    if (mounted) setState(() => _openFailed = !ok);
  }

  /// One block glides up 10 dp and fades in over 300 ms, each 60 ms after the one before. It
  /// plays once when You opens and never again.
  Widget _rise(int index, Widget child) {
    final curve = _rises[index];
    return FadeTransition(
      opacity: curve,
      child: AnimatedBuilder(
        animation: curve,
        builder: (context, child) => Transform.translate(offset: Offset(0, 10 * (1 - curve.value)), child: child),
        child: child,
      ),
    );
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
    final days = [
      for (final d in week.days) WeekBubbleDay(mark: d.studyDay ? WeekDayMark.done : WeekDayMark.open, isToday: d.isToday),
    ];
    final note = paused ? week.label : (runNote(rhythm) ?? weeksInRhythmText(rhythm));
    final count = YouCopy.weekCount(week.studyDays, week.goal);
    final study = [for (var i = 0; i < 7; i++) if (week.days[i].studyDay) weekdayNames[i]];
    final today = week.days.indexWhere((d) => d.isToday);
    return SheetWeek.ready(
      planDays: planWeek(
        studied: [for (final d in week.days) d.studyDay],
        todayIndex: today < 0 ? null : today,
        planned: ref.watch(studyDayPlanProvider),
      ),
      days: days,
      count: count,
      note: note,
      description: [count, study.isEmpty ? 'No study days yet this week' : 'Studied ${joinWithAnd(study)}'].join('. '),
      // "Show me" only when there is a study day behind the count.
      onShowMe: week.studyDays > 0 ? () => context.push(AppRoutes.youRhythm) : null,
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
                child: ListView(
                  padding: EdgeInsets.only(bottom: MmSpace.s32 + bottom),
                  children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(MmSpace.s12, MmSpace.s8, MmSpace.gutter, MmSpace.s8),
                      child: Row(
                        children: [
                          const BackKey(),
                          Expanded(child: Align(alignment: Alignment.centerRight, child: _greeting(auth.name))),
                        ],
                      ),
                    ),
                    const _ExpiredWorkNotice(),
                    if (_openFailed)
                      const Padding(
                        padding: EdgeInsets.fromLTRB(MmSpace.gutter, 0, MmSpace.gutter, MmSpace.s12),
                        child: InlineBanner(message: YouCopy.toolOpenFailed, tone: BannerTone.error),
                      ),
                    _rise(
                      0,
                      Padding(
                        padding: youGutter,
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
                    ),
                    _rise(1, _shelf(snapshot, now)),
                    _rise(2, const Column(children: [GroupHeading(YouCopy.hubProgress), ProgressPanel()])),
                    _rise(3, const Column(children: [GroupHeading(YouCopy.hubSettings), SettingsPanel()])),
                    _rise(4, Column(children: [const GroupHeading(YouCopy.hubTools), widget.tools ?? ToolsPanel(onOpen: _openTool)])),
                    const HubFooter(),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Mobi greets the student by first name. A line only when the profile has a name; Mobi holds
  /// still under reduced motion.
  Widget _greeting(String? name) {
    final first = name?.trim().split(RegExp(r'\s+')).first ?? '';
    return Mobi(
      pose: MobiPose.greet,
      size: 56,
      say: first.isEmpty ? null : YouCopy.hubGreeting(first),
      interactive: true,
    );
  }

  Widget _shelf(RhythmSnapshot snapshot, DateTime now) {
    final colors = context.mmColors;
    final type = context.mmType;
    final failed = !snapshot.hasData && !snapshot.isInitialLoading;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        GroupHeading(
          YouCopy.shelfTitle,
          trailing: KeyButton.quiet(label: YouCopy.shelfSeeAll, onPressed: () => context.push(AppRoutes.youMilestones)),
        ),
        Padding(
          padding: youGutter,
          child: failed
              ? Padding(
                  // Under the heading: the words start where "Milestones" starts.
                  padding: const EdgeInsets.only(left: MmSpace.s4),
                  child: Row(
                    children: [
                      Expanded(child: Text(YouCopy.shelfLoadFailed, style: type.small.copyWith(color: colors.ink2))),
                      const SizedBox(width: MmSpace.s8),
                      PillKey(
                        label: YouCopy.tryAgain,
                        onPressed: () => ref.read(rhythmRepositoryProvider.notifier).refresh(force: true),
                      ),
                    ],
                  ),
                )
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    TokenShelf(
                      slots: tokenSlots(snapshot.rhythm?.milestones ?? const []),
                      zone: snapshot.timezone,
                      now: now,
                      loading: snapshot.isInitialLoading,
                    ),
                    // "Show me" only when a milestone has been earned.
                    if ((snapshot.rhythm?.milestones ?? const []).any((m) => m.achievedAt != null)) ...[
                      const SizedBox(height: MmSpace.s4),
                      ShowMePill(onTap: () => context.push(AppRoutes.youMilestones), semanticsLabel: YouCopy.showMeMilestones),
                    ],
                  ],
                ),
        ),
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
