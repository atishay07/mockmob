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
      return const RhythmPage(title: RhythmCopy.milestonesTitle, child: SkeletonGroup(label: 'Loading your milestones', child: _MilestoneSkeleton()));
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

/// The three paths as cards, each with its token, its steps, what lands next and how far along
/// it is where the app can count exactly, and the record behind it.
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
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: MmSpace.s16),
          child: Text(
            asOf == null ? RhythmCopy.milestonesIntro : '${RhythmCopy.asOf(asOf!)}. ${RhythmCopy.milestonesIntro}',
            style: type.caption.copyWith(color: colors.ink3),
          ),
        ),
        for (var k = 0; k < tracks.length; k++) ...[
          if (k > 0) const SizedBox(height: MmSpace.s16),
          MilestoneTrackCard(
            track: tracks[k],
            dateOf: (d) => formatAchievedDate(d, zone, now),
            progress: progress,
            freshIds: freshIds,
            onOpen: () => onOpen != null ? onOpen!(tracks[k].track.location) : context.push(tracks[k].track.location),
          ),
        ],
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
        Skeleton.line(width: 240),
        SizedBox(height: 28),
        Skeleton.line(width: 200),
        SizedBox(height: 28),
        Skeleton.line(width: 220),
      ],
    );
  }
}
