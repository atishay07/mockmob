// One row of the student's list wherever it shows with figures: the Colleges tab, Today's card
// (through the export in tools_routes.dart) and the chooser. Rank, name, programme, the college's
// own Round 1 figure for the category out of 1000, and, once an estimate exists, the verdict in
// words with real figures.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/my_colleges.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../data/du_repository.dart';
import '../estimate/estimate.dart';
import '../estimate/estimate_providers.dart';
import '../widgets/tools_page.dart' show ToolsRowFrame;
import 'colleges_copy.dart';

/// The Round 1, 2026 figure of [college] in [programmeId] for [category]: `(known: false)` while
/// the DU files load or when they cannot, `(known: true, figure: null)` when the college had no
/// Round 1 seat for the category.
typedef CollegeFigure = ({bool known, double? figure});

final collegeFigureProvider = Provider.autoDispose.family<CollegeFigure, (String, String, String)>((ref, key) {
  final (programmeId, college, category) = key;
  final catalog = ref.watch(duCatalogProvider).value;
  final offerings = ref.watch(duOfferingsProvider(programmeId)).value;
  if (catalog == null || offerings == null) return (known: false, figure: null);
  final i = catalog.categoryIndex(category);
  for (final s in offerings.seats) {
    if (s.college != college) continue;
    final r1 = s.rounds.isEmpty ? null : s.rounds.first;
    return (known: true, figure: r1 == null || i >= r1.length ? null : r1[i]);
  }
  return (known: true, figure: null);
});

class CollegeRung extends ConsumerWidget {
  const CollegeRung({super.key, required this.college, required this.rank, this.onTap});

  final MyCollege college;

  /// 1-based place on the list.
  final int rank;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final category = ref.watch(estimateCategoryProvider);
    final fig = ref.watch(collegeFigureProvider((college.programmeId, college.college, category)));
    final estimate = ref.watch(estimateProvider);
    final verdict = estimate != null && fig.known ? verdictFor(estimate, fig.figure) : null;
    final figureText = !fig.known ? '' : (fig.figure == null ? CollegesCopy.noSeat : estimateFigure(fig.figure!));
    final semantics = [
      CollegesCopy.rungChoice(rank, college.college, college.programme),
      if (fig.known && fig.figure != null) CollegesCopy.rungFigure(estimateFigure(fig.figure!)),
      if (fig.known && fig.figure == null) CollegesCopy.noSeat,
      if (verdict != null && verdict.v != Verdict.noSeat) CollegesCopy.rungVerdict(verdictWords(verdict)),
    ].join('. ');
    final (Color ink, Color dot) = switch (verdict?.v) {
      Verdict.clears => (colors.goodText, colors.goodText),
      Verdict.within => (colors.accentText, colors.volt),
      _ => (colors.ink2, colors.ink3),
    };
    final row = Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(padding: const EdgeInsets.only(top: 2), child: RungRank(rank)),
        const SizedBox(width: MmSpace.s12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(college.college, style: type.labelLarge.copyWith(color: colors.ink)),
              if (college.programme.isNotEmpty) Text(college.programme, style: type.caption.copyWith(color: colors.ink2)),
              if (verdict != null && verdict.v != Verdict.noSeat) ...[
                const SizedBox(height: MmSpace.s4),
                AnimatedSwitcher(
                  duration: Motion.of(context, Motion.ui),
                  child: Row(
                    key: ValueKey(verdictWords(verdict)),
                    children: [
                      Container(width: 6, height: 6, decoration: BoxDecoration(color: dot, shape: BoxShape.circle)),
                      const SizedBox(width: MmSpace.s6),
                      Flexible(child: Text(verdictWords(verdict), style: type.caption.copyWith(color: ink, fontWeight: FontWeight.w600))),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(width: MmSpace.s12),
        Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            if (!fig.known)
              const Skeleton.line(width: 44)
            else
              Text(
                figureText,
                style: fig.figure == null
                    ? type.caption.copyWith(color: colors.ink2)
                    : type.figureCompact.copyWith(color: colors.ink, fontFeatures: const [FontFeature.tabularFigures()]),
              ),
            if (fig.figure != null) Text(CollegesCopy.roundOne, style: type.caption.copyWith(color: colors.ink3)),
          ],
        ),
      ],
    );
    return ToolsRowFrame(
      onTap: onTap,
      semanticsLabel: semantics,
      padding: const EdgeInsets.symmetric(horizontal: MmSpace.s16, vertical: MmSpace.s12),
      child: ConstrainedBox(constraints: const BoxConstraints(minHeight: 40), child: row),
    );
  }
}

/// The rank ring. 1 to 3 are the colleges on Today: filled volt with ink text.
class RungRank extends StatelessWidget {
  const RungRank(this.rank, {super.key});

  final int rank;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final today = rank <= 3;
    return AnimatedContainer(
      duration: Motion.of(context, Motion.ui),
      width: 24,
      height: 24,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: today ? colors.volt : null,
        border: today ? null : Border.all(color: colors.lineStrong, width: 1.4),
      ),
      alignment: Alignment.center,
      child: Text(
        '$rank',
        textScaler: TextScaler.noScaling,
        style: context.mmType.caption.copyWith(fontSize: 12, height: 1, fontWeight: FontWeight.w700, color: today ? colors.voltInk : colors.ink2),
      ),
    );
  }
}
