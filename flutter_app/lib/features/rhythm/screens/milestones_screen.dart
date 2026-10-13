// `/you/milestones`: the brass token shelf, then dated rows on a thread of bubbles. Never a badge wall: no locked items, no
// counts to chase, nothing unlocks. A row that just arrived fades in once (L3).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_providers.dart';
import '../../../core/models/rhythm.dart';
import '../../../core/motion/motion.dart';
import '../../../core/repositories/rhythm_repository.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../celebration/celebration_controller.dart';
import '../copy.dart';
import '../data/rhythm_providers.dart';
import '../logic/dates.dart';
import '../../you/widgets/you_row.dart' show YouPanel;
import '../logic/tokens.dart';
import '../widgets/rhythm_page.dart';
import '../widgets/token_shelf.dart';

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
    final rows = milestoneRows(snapshot.rhythm!.milestones, zone: snapshot.timezone, now: now);
    return RhythmPage(
      title: RhythmCopy.milestonesTitle,
      child: MilestoneTimeline(
        rows: rows,
        slots: tokenSlots(snapshot.rhythm!.milestones),
        zone: snapshot.timezone,
        now: now,
        freshIds: _fresh,
        asOf: snapshot.stale ? snapshot.fetchedAt : null,
      ),
    );
  }
}

/// The shelf of brass tokens, then every milestone as a dated row on a thread of inked bubbles.
class MilestoneTimeline extends StatelessWidget {
  const MilestoneTimeline({
    super.key,
    required this.rows,
    required this.slots,
    required this.zone,
    required this.now,
    this.freshIds = const {},
    this.asOf,
  });

  final List<MilestoneRowData> rows;
  final List<TokenSlot> slots;
  final String zone;
  final DateTime now;
  final Set<String> freshIds;
  final DateTime? asOf;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (asOf != null) ...[
          Padding(
            padding: const EdgeInsets.only(left: 4, bottom: MmSpace.s8),
            child: Text(RhythmCopy.asOf(asOf!), style: type.caption.copyWith(color: colors.ink3)),
          ),
        ],
        TokenShelf(slots: slots, zone: zone, now: now),
        const SizedBox(height: MmSpace.s32),
        const GroupHeading(RhythmCopy.timelineTitle),
        if (rows.isEmpty)
          Padding(
            padding: const EdgeInsets.only(left: 4),
            child: Text(RhythmCopy.milestonesNone, style: type.body.copyWith(color: colors.ink2)),
          )
        else
          YouPanel(
            margin: EdgeInsets.zero,
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter, vertical: MmSpace.s8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    for (var i = 0; i < rows.length; i++)
                      _MilestoneRow(
                        key: ValueKey(rows[i].id),
                        data: rows[i],
                        isFirst: i == 0,
                        isLast: i == rows.length - 1,
                        fresh: freshIds.contains(rows[i].id),
                      ),
                  ],
                ),
              ),
            ],
          ),
      ],
    );
  }
}

class _MilestoneRow extends StatefulWidget {
  const _MilestoneRow({super.key, required this.data, required this.isFirst, required this.isLast, required this.fresh});

  final MilestoneRowData data;
  final bool isFirst;
  final bool isLast;
  final bool fresh;

  @override
  State<_MilestoneRow> createState() => _MilestoneRowState();
}

class _MilestoneRowState extends State<_MilestoneRow> with SingleTickerProviderStateMixin {
  late final AnimationController _fade = AnimationController(vsync: this, duration: Motion.milestone);
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (!widget.fresh || Motion.reduced(context)) {
      _fade.value = 1;
    } else {
      _fade.forward();
    }
  }

  @override
  void dispose() {
    _fade.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final row = Semantics(
      container: true,
      label: widget.data.text,
      excludeSemantics: true,
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SizedBox(
              width: 24,
              child: Column(
                children: [
                  SizedBox(width: 1.5, height: 16, child: widget.isFirst ? null : ColoredBox(color: colors.lineStrong)),
                  const Bubble(state: BubbleState.filled, size: 16),
                  if (!widget.isLast) Expanded(child: SizedBox(width: 1.5, child: ColoredBox(color: colors.lineStrong))),
                ],
              ),
            ),
            const SizedBox(width: MmSpace.s12),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: MmSpace.s12),
                child: Text(widget.data.text, style: type.labelLarge.copyWith(fontSize: 16, fontWeight: FontWeight.w500)),
              ),
            ),
          ],
        ),
      ),
    );
    return FadeTransition(opacity: CurvedAnimation(parent: _fade, curve: Motion.out), child: row);
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
