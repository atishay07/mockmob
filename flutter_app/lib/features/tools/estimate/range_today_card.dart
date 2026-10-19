// Today's range card (owner, 19 Oct, G19 and D109: "I don't know my range"). While the student has
// no range of their own it shows the way to one: one full mock in each subject of their set, in the
// owner's own sentence ("English done, Accountancy done, Economics next"), a bar with a segment per
// subject, and one outlined key that opens the next subject's full mock. Once every subject has one,
// it shows the estimated range with its spread, how many of their colleges it makes safe or puts in
// reach (the words the Colleges rows use), and lets them take it as their range or sit more mocks
// first. Draws nothing otherwise, so Today mounts it unconditionally; on the ground like Today's
// other blocks, never a card in a card (the page's one volt key is the move above).

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/quick_start.dart' show StartLocations;
import '../../practice/data/practice_quote.dart' show practiceQuoteProvider;
import '../../practice/model/practice_selection.dart' show QuoteQuery;
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../colleges/college_rung.dart' show collegeFigureProvider;
import '../data/my_colleges_actions.dart' show myCollegesProvider;
import 'estimate.dart';
import 'estimate_copy.dart';
import 'estimate_providers.dart';
import 'estimate_sheet.dart' show showEstimateSheet;
import 'mock_estimate.dart';
import 'range_choice.dart';
import 'range_price.dart';
import 'range_steps_bar.dart';

/// Today's block: the 40 dp gap above it and the card, or nothing.
class RangeTodayBlock extends ConsumerWidget {
  const RangeTodayBlock({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final card = ref.watch(rangeCardProvider);
    return switch (card) {
      RangeCardHidden() => const SizedBox(width: double.infinity),
      RangeCardSteps(:final progress) => Padding(padding: const EdgeInsets.only(top: 40), child: RangeStepsCard(progress: progress)),
      RangeCardReady(:final progress, :final estimate) => Padding(
          padding: const EdgeInsets.only(top: 40),
          child: RangeReadyCard(progress: progress, estimate: estimate),
        ),
    };
  }
}

/// The heading of the block, in the type of Today's other headings.
class _Head extends StatelessWidget {
  const _Head(this.title);

  final String title;

  @override
  Widget build(BuildContext context) => Semantics(header: true, child: Text(title, style: context.mmType.title.copyWith(fontSize: 19)));
}

/// One full mock in each subject still to go. The key's price is the next mock's quote.
class RangeStepsCard extends ConsumerWidget {
  const RangeStepsCard({super.key, required this.progress});

  final RangeProgress progress;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final next = progress.next;
    final price = rangeMockPrice(next == null ? null : ref.watch(practiceQuoteProvider(QuoteQuery(subject: next, apiMode: 'full', count: 50))).value);
    final soFar = progress.estimate;
    final line = EstimateCopy.progressLine(
      done: [for (final id in progress.doneIds) rangeSubjectName(id)],
      next: next == null ? null : rangeSubjectName(next),
      canTotal: progress.canTotal,
      total: progress.total,
    );
    void sit() => context.push(StartLocations.fullMock(next));
    void addSubjects() => context.push(AppRoutes.youSubjects);
    void know() => showEstimateSheet(context, typeOwn: true);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        const _Head(EstimateCopy.stepsTitle),
        const SizedBox(height: MmSpace.s8),
        Text(line, style: type.body.copyWith(color: colors.ink2)),
        const SizedBox(height: MmSpace.s16),
        RangeStepsBar(progress: progress),
        if (soFar != null && next != null) ...[
          const SizedBox(height: MmSpace.s12),
          Text(EstimateCopy.soFar(soFar.estimate), style: type.small.copyWith(fontSize: 14, height: 20 / 14, color: colors.ink2)),
        ],
        if (price.kind == RangeMockPriceKind.firstFree) ...[
          const SizedBox(height: MmSpace.s12),
          Text(EstimateCopy.firstMockFree, style: type.small.copyWith(fontSize: 14, height: 20 / 14, color: colors.ink)),
        ],
        const SizedBox(height: MmSpace.s16),
        if (next != null) ...[
          KeyButton.secondary(
            label: price.isFree ? EstimateCopy.sitFreeKey(rangeSubjectName(next)) : EstimateCopy.sitKey(rangeSubjectName(next)),
            onPressed: sit,
          ),
          // Practice's own cost line, under the key, before the press (W-060); none while unknown.
          if (price.kind != RangeMockPriceKind.firstFree && price.line != null) ...[
            const SizedBox(height: MmSpace.s6),
            Text(price.line!, textAlign: TextAlign.center, style: type.caption.copyWith(color: colors.ink2)),
          ],
        ] else
          KeyButton.secondary(label: EstimateCopy.addSubjectsKey, onPressed: addSubjects),
        Center(
          child: next != null && !progress.canTotal
              ? KeyButton.quiet(label: EstimateCopy.addSubjectsKey, onPressed: addSubjects)
              : KeyButton.quiet(label: EstimateCopy.knowKey, onPressed: know),
        ),
      ],
    );
  }
}

/// Every subject has a full mock: the estimated range, honest about its spread.
class RangeReadyCard extends ConsumerWidget {
  const RangeReadyCard({super.key, required this.progress, required this.estimate});

  final RangeProgress progress;
  final MockEstimate estimate;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final e = estimate.estimate;
    final view = ref.watch(myCollegesProvider);
    final category = ref.watch(estimateCategoryProvider);
    final figures = <double?>[];
    if (view.ready) {
      for (final c in view.colleges) {
        final f = ref.watch(collegeFigureProvider((c.programmeId, c.college, category)));
        if (f.known && f.figure != null) figures.add(f.figure);
      }
    }
    final reach = reachOf(e, figures);
    final figure = type.figure.copyWith(color: colors.ink, fontFeatures: const [FontFeature.tabularFigures()]);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        const _Head(EstimateCopy.readyTitle),
        const SizedBox(height: MmSpace.s8),
        MergeSemantics(
          child: Wrap(
            crossAxisAlignment: WrapCrossAlignment.end,
            spacing: MmSpace.s8,
            children: [
              Text(estimateRange(e), style: figure),
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Text(EstimateCopy.of1000, style: type.body.copyWith(color: colors.ink2)),
              ),
            ],
          ),
        ),
        const SizedBox(height: MmSpace.s8),
        Text(EstimateCopy.readyTruth(e.mocks), style: type.small.copyWith(fontSize: 14, height: 20 / 14, color: colors.ink2)),
        const SizedBox(height: MmSpace.s12),
        Text(
          reach.total > 0 ? EstimateCopy.yourColleges(reach) : EstimateCopy.noColleges,
          style: type.body.copyWith(color: reach.total > 0 ? colors.ink : colors.ink2),
        ),
        const SizedBox(height: MmSpace.s16),
        KeyButton.secondary(label: EstimateCopy.acceptKey, onPressed: () => ref.read(rangeChoiceProvider.notifier).accept()),
        Center(child: KeyButton.quiet(label: EstimateCopy.restKey, onPressed: () => ref.read(rangeChoiceProvider.notifier).rest())),
      ],
    );
  }
}
