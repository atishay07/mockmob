// "See all N colleges" from Today (19 Oct, D104): every college on My colleges, the hardest to get
// into first, each with the marks it needs (its 2026 Round 1 closing score for the student's
// category) and, when the student has an estimate, the gap to it in the Colleges area's own words
// ("Needs 24 more", "Clears by 12"), its source named once at the top. Without an estimate the
// sheet says where to add one; it never guesses a score. Nothing the student picked is left off.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../tools/estimate/estimate.dart';
import '../../tools/estimate/estimate_providers.dart' show estimateProvider;
import '../../tools/my_colleges/my_colleges_copy.dart';
import '../copy.dart';
import '../logic/today_model.dart';
import 'glance_rows.dart' show GlanceLink;
import 'today_type.dart';

/// Opens the sheet over Today. [onOpenColleges] opens the Colleges tab (where the list is edited
/// and an estimate is typed).
Future<void> showTodayCollegesSheet(BuildContext context, {required List<LadderRung> colleges, String? category, VoidCallback? onOpenColleges}) =>
    showMmSheet<void>(
      context: context,
      title: TodayCollegesSheet.titleFor(colleges.length),
      builder: (context) => TodayCollegesSheet(colleges: colleges, category: category, onOpenColleges: onOpenColleges),
    );

class TodayCollegesSheet extends ConsumerWidget {
  const TodayCollegesSheet({super.key, required this.colleges, this.category, this.onOpenColleges});

  /// Every college, hardest to get into first.
  final List<LadderRung> colleges;
  final String? category;
  final VoidCallback? onOpenColleges;

  static String titleFor(int n) => n == 1 ? 'Your college' : 'Your $n colleges';

  /// The rows (tests find them by these).
  static Key rowKey(int index) => ValueKey('today-colleges-sheet-row-$index');

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final estimate = ref.watch(estimateProvider);
    final lede = estimate == null
        ? TodayCollegesCopy.ledeNoEstimate(TodayCopy.categoryWords(category))
        : TodayCollegesCopy.ledeWith(estimateRange(estimate), TodayCollegesCopy.sourceWords(estimate.source));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(lede, style: type.small.copyWith(fontSize: 14, height: 20 / 14, color: colors.ink2)),
        const SizedBox(height: MmSpace.s12),
        for (final (k, c) in colleges.indexed) ...[
          Divider(height: 1, thickness: 1, color: colors.line),
          _SheetRow(key: rowKey(k), index: k, rung: c, estimate: estimate),
        ],
        Divider(height: 1, thickness: 1, color: colors.line),
        const SizedBox(height: MmSpace.s8),
        Text(TodayCopy.ladderCaption(category), style: type.caption.copyWith(color: colors.ink3)),
        if (onOpenColleges != null)
          Align(
            alignment: Alignment.centerLeft,
            child: GlanceLink(
              label: estimate == null ? TodayCollegesCopy.addEstimate : TodayCollegesCopy.openColleges,
              onTap: () {
                Navigator.of(context).maybePop();
                onOpenColleges!();
              },
            ),
          ),
      ],
    );
  }
}

class _SheetRow extends StatelessWidget {
  const _SheetRow({super.key, required this.index, required this.rung, this.estimate});

  final int index;
  final LadderRung rung;
  final Estimate? estimate;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final r = rung;
    final cutoff = double.tryParse(r.score);
    final e = estimate;
    final gap = e == null || cutoff == null ? null : verdictWords(verdictFor(e, cutoff));
    final closed = cutoff == null ? MyCollegesCopy.noFigure : TodayCollegesCopy.closedAt(r.score, r.outOf);
    return Semantics(
      container: true,
      label: TodayCollegesCopy.rowSemantics(index + 1, r.college, r.course, closed, gap),
      excludeSemantics: true,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 64),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: MmSpace.s12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              SizedBox(
                width: 28,
                child: Text('${index + 1}', style: type.pickNumber.copyWith(fontSize: 22, color: index < 3 ? colors.ink : colors.ink3)),
              ),
              const SizedBox(width: MmSpace.s8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(r.college, maxLines: 2, overflow: TextOverflow.ellipsis, style: type.labelLarge.copyWith(fontSize: 16, fontWeight: FontWeight.w600, color: colors.ink)),
                    const SizedBox(height: MmSpace.s2),
                    Text(r.course, style: type.caption.copyWith(fontSize: 13.5, color: colors.ink2)),
                    if (gap != null) ...[
                      const SizedBox(height: MmSpace.s2),
                      Text(gap, style: type.caption.copyWith(fontSize: 13.5, fontWeight: FontWeight.w600, color: colors.ink)),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: MmSpace.s12),
              if (cutoff == null)
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 104),
                  child: Text(MyCollegesCopy.noFigure, textAlign: TextAlign.right, style: type.caption.copyWith(color: colors.ink3)),
                )
              else
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(r.score, style: type.scoreFigure.copyWith(fontSize: 24, color: colors.ink, fontFeatures: const [FontFeature.tabularFigures()])),
                    if (r.outOf != null) ...[
                      const SizedBox(height: MmSpace.s2),
                      Text(TodayCopy.ofDenominator(r.outOf!), style: type.micro.copyWith(color: colors.ink3)),
                    ],
                  ],
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The sheet's words: plain, every figure with its scale, the estimate's source said once.
abstract final class TodayCollegesCopy {
  static String ledeNoEstimate(String category) =>
      'The hardest to get into comes first, by its lowest Round 1 score in 2026 for $category. Add your estimate in Colleges to see how far you are from each.';
  static String ledeWith(String range, String source) => 'The hardest to get into comes first. The gap under each is against your estimate of $range, $source.';
  static String sourceWords(EstimateSource s) => switch (s) {
        EstimateSource.mocks => 'from your latest full mocks',
        EstimateSource.projection => 'from your practice projection',
        EstimateSource.typed => 'which you typed',
      };
  static String closedAt(String score, int? outOf) => outOf == null ? 'Closed at $score in Round 1' : 'Closed at $score of $outOf in Round 1';
  static const String addEstimate = 'Add your estimate in Colleges';
  static const String openColleges = 'Open Colleges';
  static String rowSemantics(int n, String college, String course, String closed, String? gap) => '${['$n. $college', course, closed, ?gap].join('. ')}.';
}
