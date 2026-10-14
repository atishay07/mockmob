// `/you/milestones` (owner feedback 13 Oct: "milestones should be improved"): three paths
// (papers, repairs, weeks at your goal), each a card with its brass token, its steps on a rail,
// the next step with exactly what lands it and an exact count where the app holds the record,
// and a link to the record behind it. Never a badge wall: no locks, no guessed progress, nothing
// expires. A step that just landed is the screen's one moment (T3), played once; Mobi is on the
// page once (the landing's, or the end-of-path line) and speaks once per app run.
//
// Layout: every block sits on the 16 dp gutter (no inner 4 dp), and the paths are typeset
// sections: 32 dp of air, a hairline, 16 dp, then the path (SPACING.md 3.1, audit RH2).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api_providers.dart';
import '../../../core/haptics/haptics.dart';
import '../../../core/models/rhythm.dart';
import '../../../core/motion/motion.dart';
import '../../../core/repositories/attempts_repository.dart';
import '../../../core/repositories/rhythm_repository.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../celebration/celebration_controller.dart';
import '../copy.dart';
import '../data/rhythm_providers.dart';
import '../logic/dates.dart';
import '../logic/milestone_tracks.dart';
import '../logic/milestone_progress.dart';
import '../widgets/rhythm_layout.dart';
import '../widgets/rhythm_page.dart';
import '../widgets/medal.dart';
import '../widgets/proud_mobi.dart';
import '../widgets/milestone_track_card.dart';

class MilestoneRowData {
  const MilestoneRowData({required this.id, required this.text});

  final String id;
  final String text;
}

/// The earned milestones, newest first, with the words of each. Ids this app does not know are
/// skipped rather than printed raw.
List<MilestoneRowData> milestoneRows(List<RhythmMilestone> milestones, {required String zone, required DateTime now}) {
  final earned = [for (final m in milestones) if (m.achievedAt != null) m]
    ..sort((a, b) => b.achievedAt!.compareTo(a.achievedAt!));
  return [
    for (final m in earned)
      if (RhythmCopy.milestoneRow(m.id, formatAchievedDate(m.achievedAt!, zone, now)) case final text?)
        MilestoneRowData(id: m.id, text: text),
  ];
}

class YouMilestonesScreen extends ConsumerStatefulWidget {
  const YouMilestonesScreen({super.key});

  @override
  ConsumerState<YouMilestonesScreen> createState() => _YouMilestonesScreenState();
}

class _YouMilestonesScreenState extends ConsumerState<YouMilestonesScreen> {
  late final Set<String> _fresh = {...ref.read(celebrationControllerProvider).freshRows};

  /// Mobi speaks his line on this screen once per app run (MOTION.md 1.3). Asked once, here, never
  /// in build: asking uses the gate up.
  late final bool _mobiSpeaks;

  @override
  void initState() {
    super.initState();
    _mobiSpeaks = MobiRation.speakOnce('rhythm_milestones');
    // The fresh rows fade in once; remember nothing about them afterwards.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) ref.read(celebrationControllerProvider.notifier).clearFreshRows();
    });
  }

  @override
  Widget build(BuildContext context) {
    final snapshot = ref.watch(rhythmSnapshotProvider);
    final now = ref.watch(nowProvider)();

    if (snapshot.isInitialLoading) {
      return const RhythmPage(title: RhythmCopy.milestonesTitle, child: SkeletonGroup(label: RhythmCopy.loadingMilestones, child: _MilestoneSkeleton()));
    }
    if (!snapshot.hasData) {
      return RhythmPage(
        title: RhythmCopy.milestonesTitle,
        scrollable: false,
        child: StateView(
          kind: StateViewKind.error,
          title: RhythmCopy.milestonesLoadFailedTitle,
          message: RhythmCopy.rhythmLoadFailedBody,
          primary: StateAction(RhythmCopy.tryAgain, () => ref.read(rhythmRepositoryProvider.notifier).refresh(force: true)),
        ),
      );
    }
    return RhythmPage(
      title: RhythmCopy.milestonesTitle,
      child: MilestoneTimeline(
        milestones: snapshot.rhythm!.milestones,
        zone: snapshot.timezone,
        now: now,
        progress: milestoneProgress(attempts: ref.watch(attemptsRepositoryProvider).value, rhythm: snapshot.rhythm),
        freshIds: _fresh,
        mobiSpeaks: _mobiSpeaks,
        asOf: snapshot.stale ? snapshot.fetchedAt : null,
      ),
    );
  }
}

/// The three paths as sections of one scroll: a summary of how many steps have landed, then each
/// path with its token, its trail of coins, what lands next and how far along it is where the app
/// can count exactly, and the record behind it.
class MilestoneTimeline extends StatelessWidget {
  const MilestoneTimeline({
    super.key,
    required this.milestones,
    required this.zone,
    required this.now,
    this.progress = const {},
    this.freshIds = const {},
    this.mobiSpeaks = true,
    this.asOf,
    this.onOpen,
    this.onStart,
  });

  final List<RhythmMilestone> milestones;
  final String zone;
  final DateTime now;

  /// Exact counts toward the next step (see `milestoneProgress`).
  final Map<String, int> progress;
  final Set<String> freshIds;

  /// Mobi says his line at the two ends of the paths. False after he has said it once this app run:
  /// he is still there, in the same pose, without the bubble.
  final bool mobiSpeaks;
  final DateTime? asOf;

  /// Opens the record behind a path; defaults to pushing its location.
  final ValueChanged<String>? onOpen;

  /// The volt key of a student with nothing landed yet ("Start a scored set"); defaults to
  /// opening Practice.
  final VoidCallback? onStart;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final tracks = milestoneTracks(milestones);
    // Mobi speaks at the two ends of the paths only: before the first step, and once all landed.
    final none = tracks.every((t) => t.earned.isEmpty);
    final all = tracks.every((t) => t.complete);
    // One Mobi on the page: when a step has just landed he stands beside that token, so the
    // end-of-path Mobi stays away.
    final landing = [for (final t in tracks) for (final s in t.earned) if (freshIds.contains(s.step.id)) s].isNotEmpty;
    final mobiLine = landing ? null : (none ? RhythmCopy.milestonesMobiEmpty : (all ? RhythmCopy.milestonesMobiComplete : null));
    final landed = tracks.fold<int>(0, (n, t) => n + t.earned.length);
    final total = tracks.fold<int>(0, (n, t) => n + t.steps.length);
    // One entrance as the page arrives: the summary, Mobi at the ends, then each path in order.
    return MmStagger(
      driver: MmStaggerDriver.route,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          MmStaggerItem(index: 0, child: _Summary(tracks: tracks, landed: landed, total: total)),
          if (asOf != null)
            Padding(
              padding: const EdgeInsets.only(top: MmSpace.s8),
              child: Text(RhythmCopy.asOf(asOf!), style: type.caption.copyWith(color: colors.ink3)),
            ),
          if (mobiLine != null)
            Padding(
              padding: const EdgeInsets.only(top: MmSpace.s16),
              child: Align(
                alignment: Alignment.centerLeft,
                child: all
                    ? ProudMobi(size: 72, say: mobiSpeaks ? mobiLine : null, delay: kNumberLanded)
                    : Mobi(pose: MobiPose.pointing, size: 72, motion: MobiMotion.settle, say: mobiSpeaks ? mobiLine : null),
              ),
            ),
          // Before the first step the one thing to do is a scored set, so it is the one volt key.
          if (none)
            Padding(
              padding: const EdgeInsets.only(top: MmSpace.s16),
              child: KeyButton(
                label: RhythmCopy.startSet,
                onPressed: onStart ?? () => GoRouter.maybeOf(context)?.push(AppRoutes.practiceStart),
              ),
            ),
          for (var k = 0; k < tracks.length; k++) ...[
            const SectionBreak(),
            MmStaggerItem(
              index: k + 1,
              child: MilestoneTrackCard(
                track: tracks[k],
                dateOf: (d) => formatAchievedDate(d, zone, now),
                progress: progress,
                freshIds: freshIds,
                onOpen: () => onOpen != null ? onOpen!(tracks[k].track.location) : context.push(tracks[k].track.location),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// "3 of 9 landed" as a monumental figure over nine small coins grouped by path, so the shape of
/// the whole shows at a glance. The coins are brass when the server dated the step and rings when
/// it did not.
class _Summary extends ConsumerWidget {
  const _Summary({required this.tracks, required this.landed, required this.total});

  final List<TrackView> tracks;
  final int landed;
  final int total;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final type = context.mmType;
    return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          MonumentalNumber(
            value: '$landed',
            unit: RhythmCopy.ofLanded(total),
            style: type.figure.copyWith(fontSize: 72),
            semanticsLabel: RhythmCopy.landedSummary(landed, total),
            delay: kNumberRollDelay,
            onLanded: () => ref.read(hapticsProvider).selection(),
          ),
          const SizedBox(height: MmSpace.s16),
          // Nine coins grouped 3 | 4 | 2. One even gap inside a group and exactly double between
          // groups, and the coins are sized so the row runs the whole width, edge to edge.
          ExcludeSemantics(
            child: LayoutBuilder(
              builder: (context, box) {
                const gap = 8.0;
                const groupGap = gap * 2;
                final steps = tracks.fold<int>(0, (n, t) => n + t.steps.length);
                final fixed = gap * (steps - tracks.length) + groupGap * (tracks.length - 1);
                final coin = ((box.maxWidth - fixed) / steps).clamp(16.0, 30.0);
                return Row(
                  mainAxisAlignment: MainAxisAlignment.start,
                  children: [
                    for (var k = 0; k < tracks.length; k++) ...[
                      if (k > 0) const SizedBox(width: groupGap),
                      for (var i = 0; i < tracks[k].steps.length; i++) ...[
                        if (i > 0) const SizedBox(width: gap),
                        Medal.plain(status: tracks[k].steps[i].status == StepStatus.earned ? MedalStatus.landed : MedalStatus.later, size: coin),
                      ],
                    ],
                  ],
                );
              },
            ),
          ),
        ],
    );
  }
}

class _MilestoneSkeleton extends StatelessWidget {
  const _MilestoneSkeleton();

  @override
  Widget build(BuildContext context) {
    return const Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // The summary figure, then a path's trail: a coin, its step name and what lands it.
        Skeleton.line(width: 96, height: 56),
        SizedBox(height: MmRhythm.group),
        MmSkeletonRows(rows: 4),
      ],
    );
  }
}
