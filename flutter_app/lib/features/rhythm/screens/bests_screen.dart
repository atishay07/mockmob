// `/you/bests`: best and latest marks per comparable mock type (spec 6.6). Observed marks with
// their denominators; no percentile, no rank, no comparison with others. Shown only for formats
// the server returned with a comparable id, mocks only. Everything sits on the 16 dp gutter; the
// hero is typeset on the page and the other formats are plain rows (SPACING.md 3.1, 4.3).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/copy/formatters.dart';
import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/repositories/remote_state.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../you/widgets/you_page.dart' show SectionTitle;
import '../../you/copy.dart' show subjectDisplayName;
import '../copy.dart';
import '../data/bests.dart';
import '../data/rhythm_providers.dart';
import '../logic/dates.dart';
import '../widgets/rhythm_layout.dart';
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

  /// The best mark as a share of its own paper's full marks: the strongest leads the page.
  static double _share(PersonalBest b) => b.best.max <= 0 ? 0 : b.best.marks / b.best.max;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    // The strongest best is the hero, on the page itself; the other mock types are plain rows.
    final ordered = [...mocks]..sort((a, b) => _share(b).compareTo(_share(a)));
    final hero = ordered.first;
    final others = ordered.skip(1).toList();
    // One entrance as the page arrives: the hero first, then the rest in reading order.
    return MmStagger(
      driver: MmStaggerDriver.route,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (asOf != null) ...[
            Padding(
              padding: const EdgeInsets.only(bottom: MmSpace.s8),
              child: Text(RhythmCopy.asOf(asOf!), style: type.caption.copyWith(color: colors.ink3)),
            ),
          ],
          MmStaggerItem(index: 0, child: _BestHero(best: hero, dates: _dates(hero))),
          if (others.isNotEmpty) ...[
            const SectionBreak(),
            MmStaggerItem(
              index: 1,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  SectionTitle(RhythmCopy.otherBests, padding: const EdgeInsets.only(bottom: MmSpace.s12)),
                  for (var i = 0; i < others.length; i++) _BestRow(best: others[i], first: i == 0),
                ],
              ),
            ),
          ],
          const SizedBox(height: MmRhythm.group),
          Text(RhythmCopy.bestsFootnote, style: type.caption.copyWith(color: colors.ink2)),
        ],
      ),
    );
  }
}

/// The strongest best of the student's mock types: its name, the best marks as a hero number with
/// the denominator beside it, and (with two or more mocks) best and latest as bars with their
/// marks at the end. On the page, no card.
class _BestHero extends ConsumerWidget {
  const _BestHero({required this.best, required this.dates});

  final PersonalBest best;
  final String? dates;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final title = RhythmCopy.bestFormat(modeLabel(best.mode), subjectDisplayName(best.subject), best.questions);
    return Semantics(
      container: true,
      label: [title, bestBody(best), ?dates].join(' '),
      excludeSemantics: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: type.labelLarge.copyWith(fontSize: 16, color: colors.ink2)),
          const SizedBox(height: MmSpace.s8),
          MonumentalNumber(
            value: formatSignedNumber(best.best.marks),
            unit: RhythmCopy.outOf(best.best.max),
            style: type.figureHero,
            delay: kNumberRollDelay,
            onLanded: () => ref.read(hapticsProvider).selection(),
          ),
          if (best.attempts >= 2) ...[
            const SizedBox(height: MmSpace.s16),
            _MarksBar(label: RhythmCopy.barBest, marks: best.best.marks, max: best.best.max, best: true),
            const SizedBox(height: MmSpace.s12),
            _MarksBar(label: RhythmCopy.barLatest, marks: best.latest.marks, max: best.latest.max, best: false),
          ],
          const SizedBox(height: MmSpace.s16),
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
    );
  }
}

/// Another mock type as one plain row: its name and what it says, the best marks at the end.
class _BestRow extends StatelessWidget {
  const _BestRow({required this.best, required this.first});

  final PersonalBest best;
  final bool first;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final title = RhythmCopy.bestFormat(modeLabel(best.mode), subjectDisplayName(best.subject), best.questions);
    final line = best.attempts < 2 ? RhythmCopy.bestFirst(modeNoun(best.mode)) : RhythmCopy.latestLine(marksText(best.latest));
    return Semantics(
      container: true,
      label: [title, bestBody(best)].join(' '),
      excludeSemantics: true,
      child: HairlineRow(
        first: first,
        padding: const EdgeInsets.symmetric(vertical: MmSpace.s12),
        trailing: Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              formatSignedNumber(best.best.marks),
              style: type.figureCompact.copyWith(fontSize: 32),
              textHeightBehavior: MmType.figureHeightBehavior,
            ),
            Text(RhythmCopy.outOf(best.best.max), style: type.caption.copyWith(color: colors.ink2)),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: type.labelLarge.copyWith(fontSize: 16)),
            const SizedBox(height: MmSpace.s2),
            Text(line, style: type.small.copyWith(color: colors.ink2)),
          ],
        ),
      ),
    );
  }
}

/// Best or latest marks as a bar out of the paper's full marks, with the marks at the end, so two
/// mocks of the same type can be read against each other at a glance. The bar is the observed
/// marks over the maximum; a negative mark draws nothing.
class _MarksBar extends StatelessWidget {
  const _MarksBar({required this.label, required this.marks, required this.max, required this.best});

  final String label;
  final num marks;
  final int max;
  final bool best;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final fraction = max <= 0 ? 0.0 : (marks / max).clamp(0.0, 1.0).toDouble();
    return Row(
      children: [
        SizedBox(width: 56, child: Text(label, style: type.caption.copyWith(color: colors.ink2))),
        Expanded(child: FillBar(fraction: fraction, volt: best)),
        const SizedBox(width: MmSpace.s12),
        SizedBox(
          width: 44,
          child: Text(
            formatSignedNumber(marks.toInt()),
            textAlign: TextAlign.end,
            style: type.small.copyWith(color: best ? colors.ink : colors.ink2, fontWeight: FontWeight.w700),
          ),
        ),
      ],
    );
  }
}

class _BestsSkeleton extends StatelessWidget {
  const _BestsSkeleton();

  @override
  Widget build(BuildContext context) {
    return const Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        MmSkeletonCard(),
        SizedBox(height: MmRhythm.group),
        MmSkeletonCard(),
      ],
    );
  }
}
