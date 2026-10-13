// `/you/bests`: best and latest marks per comparable mock type (spec 6.6). Observed marks with
// their denominators; no percentile, no rank, no comparison with others. Shown only for formats
// the server returned with a comparable id, mocks only.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/copy/formatters.dart';
import '../../../core/repositories/remote_state.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../you/copy.dart' show subjectDisplayName;
import '../copy.dart';
import '../data/bests.dart';
import '../data/rhythm_providers.dart';
import '../logic/dates.dart';
import '../widgets/rhythm_page.dart';

/// "general_test" to "General test". Subject names are not in core yet, so this keeps the
/// server's own words rather than inventing new ones.
String humanizeSlug(String slug) {
  final words = slug.replaceAll(RegExp(r'[_\-:]+'), ' ').trim();
  if (words.isEmpty) return words;
  return words[0].toUpperCase() + words.substring(1);
}

String modeLabel(String mode) => switch (mode) {
      'full' => 'Full mock',
      'nta' => 'NTA mode',
      _ => humanizeSlug(mode),
    };

String modeNoun(String mode) => switch (mode) {
      'full' => 'full mock',
      'nta' => 'NTA mode mock',
      _ => 'attempt',
    };

String marksText(BestMark m) => RhythmCopy.bestMarks(formatSignedNumber(m.marks), m.max);

/// The words under a format: one attempt, or best and latest.
String bestBody(PersonalBest b) =>
    b.attempts < 2 ? RhythmCopy.bestFirst(modeNoun(b.mode)) : RhythmCopy.bestPair(marksText(b.best), marksText(b.latest));

class YouBestsScreen extends ConsumerStatefulWidget {
  const YouBestsScreen({super.key});

  @override
  ConsumerState<YouBestsScreen> createState() => _YouBestsScreenState();
}

class _YouBestsScreenState extends ConsumerState<YouBestsScreen> {
  @override
  void initState() {
    super.initState();
    // The bests are read once per session otherwise: a mock finished since then would leave the
    // old best and latest on screen. The cached marks stay visible while this reads.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) ref.read(bestsRepositoryProvider.notifier).refresh(force: true);
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(bestsRepositoryProvider);
    final mocks = ref.watch(bestMocksProvider);
    final zone = ref.watch(rhythmSnapshotProvider.select((s) => s.timezone));
    return buildBestsPage(
      state: state,
      mocks: mocks,
      zone: zone,
      onRetry: () => ref.read(bestsRepositoryProvider.notifier).refresh(force: true),
    );
  }
}

/// The page for a given state; goldens render it directly.
Widget buildBestsPage({
  required RemoteState<List<PersonalBest>> state,
  required List<PersonalBest> mocks,
  required String zone,
  required VoidCallback onRetry,
}) {
  if (state.isInitialLoading) {
    return const RhythmPage(
      title: RhythmCopy.bestsTitle,
      child: SkeletonGroup(label: RhythmCopy.loadingMarks, child: _BestsSkeleton()),
    );
  }
  if (state.isFailedEmpty) {
    return RhythmPage(
      title: RhythmCopy.bestsTitle,
      scrollable: false,
      child: StateView(
        kind: StateViewKind.error,
        title: RhythmCopy.bestsLoadFailedTitle,
        message: RhythmCopy.rhythmLoadFailedBody,
        primary: StateAction(RhythmCopy.tryAgain, onRetry),
      ),
    );
  }
  if (mocks.isEmpty) {
    return const RhythmPage(
      title: RhythmCopy.bestsTitle,
      scrollable: false,
      child: StateView(kind: StateViewKind.empty, title: RhythmCopy.bestsEmptyTitle, message: RhythmCopy.bestsEmptyBody),
    );
  }
  return RhythmPage(
    title: RhythmCopy.bestsTitle,
    child: BestsList(mocks: mocks, zone: zone, asOf: state.isStale ? state.fetchedAt : null),
  );
}

class BestsList extends StatelessWidget {
  const BestsList({super.key, required this.mocks, required this.zone, this.asOf});

  final List<PersonalBest> mocks;
  final String zone;
  final DateTime? asOf;

  String? _dates(PersonalBest b) {
    final bestAt = b.best.completedAt;
    final latestAt = b.latest.completedAt;
    if (b.attempts < 2) {
      return latestAt == null ? null : RhythmCopy.bestSingleDate(formatDayMonth(studentDate(latestAt, zone)));
    }
    if (bestAt == null || latestAt == null) return null;
    return RhythmCopy.bestDates(formatDayMonth(studentDate(bestAt, zone)), formatDayMonth(studentDate(latestAt, zone)));
  }

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
        for (var i = 0; i < mocks.length; i++) ...[
          if (i > 0) const SizedBox(height: MmSpace.s16),
          _BestPanel(best: mocks[i], dates: _dates(mocks[i]), lit: i == 0),
        ],
        Padding(
          padding: const EdgeInsets.fromLTRB(4, MmSpace.s24, 0, 0),
          child: Text(RhythmCopy.bestsFootnote, style: type.caption.copyWith(color: colors.ink2)),
        ),
      ],
    );
  }
}

/// One comparable mock type: its name, the best marks as a monumental number with the
/// denominator beside it, and the latest beneath when there are two or more.
class _BestPanel extends StatelessWidget {
  const _BestPanel({required this.best, required this.dates, required this.lit});

  final PersonalBest best;
  final String? dates;

  /// The first panel carries the screen's lit edge.
  final bool lit;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final title = RhythmCopy.bestFormat(modeLabel(best.mode), subjectDisplayName(best.subject), best.questions);
    final panel = FakeGlass(
      child: Padding(
        padding: const EdgeInsets.all(MmSpace.s20),
        child: Semantics(
          container: true,
          label: [title, bestBody(best), ?dates].join(' '),
          excludeSemantics: true,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: type.labelLarge.copyWith(fontSize: 16)),
              const SizedBox(height: MmSpace.s12),
              MonumentalNumber(
                value: formatSignedNumber(best.best.marks),
                unit: RhythmCopy.outOf(best.best.max),
                style: type.figure,
              ),
              const SizedBox(height: MmSpace.s8),
              Text(
                best.attempts < 2 ? RhythmCopy.bestFirst(modeNoun(best.mode)) : RhythmCopy.latestLine(marksText(best.latest)),
                style: type.small.copyWith(color: colors.ink2),
              ),
              if (dates != null) ...[
                const SizedBox(height: MmSpace.s4),
                Text(dates!, style: type.caption.copyWith(color: colors.ink3)),
              ],
            ],
          ),
        ),
      ),
    );
    return lit ? LitEdge(child: panel) : panel;
  }
}

class _BestsSkeleton extends StatelessWidget {
  const _BestsSkeleton();

  @override
  Widget build(BuildContext context) {
    return const Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Skeleton.line(width: 220, height: 18),
        SizedBox(height: 12),
        Skeleton.line(),
        SizedBox(height: 8),
        Skeleton.line(width: 180),
      ],
    );
  }
}
