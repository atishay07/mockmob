// `/you/milestones` (owner feedback 13 Oct: "milestones should be improved"): three paths
// (papers, repairs, weeks at your goal), each a card with its brass token, its steps on a rail,
// the next step with exactly what lands it and an exact count where the app holds the record,
// and a link to the record behind it. Never a badge wall: no locks, no guessed progress, nothing
// expires. A step that just landed fades in once (L3).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api_providers.dart';
import '../../../core/models/rhythm.dart';
import '../../../core/repositories/attempts_repository.dart';
import '../../../core/repositories/rhythm_repository.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../celebration/celebration_controller.dart';
import '../copy.dart';
import '../data/rhythm_providers.dart';
import '../logic/dates.dart';
import '../logic/milestone_tracks.dart';
import '../logic/milestone_progress.dart';
import '../widgets/rhythm_page.dart';
import '../widgets/medal.dart';
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

  @override
  void initState() {
    super.initState();
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
    this.asOf,
    this.onOpen,
  });

  final List<RhythmMilestone> milestones;
  final String zone;
  final DateTime now;

  /// Exact counts toward the next step (see `milestoneProgress`).
  final Map<String, int> progress;
  final Set<String> freshIds;
  final DateTime? asOf;

  /// Opens the record behind a path; defaults to pushing its location.
  final ValueChanged<String>? onOpen;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final tracks = milestoneTracks(milestones);
    // Mobi speaks at the two ends of the paths only: before the first step, and once all landed.
    final none = tracks.every((t) => t.earned.isEmpty);
    final all = tracks.every((t) => t.complete);
    final mobiLine = none ? RhythmCopy.milestonesMobiEmpty : (all ? RhythmCopy.milestonesMobiComplete : null);
    final landed = tracks.fold<int>(0, (n, t) => n + t.earned.length);
    final total = tracks.fold<int>(0, (n, t) => n + t.steps.length);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _Summary(tracks: tracks, landed: landed, total: total),
        Padding(
          padding: const EdgeInsets.only(left: 4, top: MmSpace.s16),
          child: Text(
            asOf == null ? RhythmCopy.milestonesIntro : '${RhythmCopy.asOf(asOf!)}. ${RhythmCopy.milestonesIntro}',
            style: type.caption.copyWith(color: colors.ink3),
          ),
        ),
        if (mobiLine != null)
          Padding(
            padding: const EdgeInsets.only(top: MmSpace.s16),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Mobi(
                pose: all ? MobiPose.celebrating : MobiPose.pointing,
                size: 72,
                motion: all ? MobiMotion.hop : MobiMotion.settle,
                say: mobiLine,
              ),
            ),
          ),
        for (var k = 0; k < tracks.length; k++) ...[
          const SizedBox(height: MmSpace.s32),
          Divider(height: 1, thickness: 1, color: colors.line),
          const SizedBox(height: MmSpace.s32),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
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
    );
  }
}

/// "3 of 9 landed" as a monumental figure over nine small coins grouped by path, so the shape of
/// the whole shows at a glance. The coins are brass when the server dated the step and rings when
/// it did not.
class _Summary extends StatelessWidget {
  const _Summary({required this.tracks, required this.landed, required this.total});

  final List<TrackView> tracks;
  final int landed;
  final int total;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final colors = context.mmColors;
    return Padding(
      padding: const EdgeInsets.only(left: 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          MonumentalNumber(
            value: '$landed',
            unit: RhythmCopy.ofLanded(total),
            style: type.figure.copyWith(fontSize: 72, height: 66 / 72),
            semanticsLabel: RhythmCopy.landedSummary(landed, total),
          ),
          const SizedBox(height: MmSpace.s16),
          ExcludeSemantics(
            child: Row(
              children: [
                for (var k = 0; k < tracks.length; k++) ...[
                  if (k > 0) SizedBox(width: MmSpace.s20, child: Center(child: SizedBox(width: 1, height: 14, child: ColoredBox(color: colors.lineStrong)))),
                  for (var i = 0; i < tracks[k].steps.length; i++) ...[
                    if (i > 0) const SizedBox(width: 6),
                    Medal.plain(status: tracks[k].steps[i].status == StepStatus.earned ? MedalStatus.landed : MedalStatus.later, size: 22),
                  ],
                ],
              ],
            ),
          ),
        ],
      ),
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
        Skeleton.line(width: 240),
        SizedBox(height: 28),
        Skeleton.line(width: 200),
        SizedBox(height: 28),
        Skeleton.line(width: 220),
      ],
    );
  }
}
