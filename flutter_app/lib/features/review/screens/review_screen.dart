import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/domain/tonight_pick.dart' show isRepairBasis;
import '../../../core/motion/motion.dart';
import '../../../core/repositories/attempts_repository.dart';
import '../../../core/router/app_shell.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../insights/insights_routes.dart' show ReviewInsightsRows;
import '../../you/you_providers.dart' show lateNightLinesProvider;
import '../copy.dart';
import '../data/mistake_index.dart';
import '../data/review_providers.dart';
import '../widgets/mistake_map.dart';
import '../widgets/record_entry.dart';
import '../widgets/review_bits.dart';
import '../widgets/review_rows.dart';
import '../widgets/review_status.dart';
import '../widgets/tonight_card.dart';

/// How many chapter cards the tab shows before "See all": a list of what is due, never a pile.
const tabChapterLimit = 3;

/// The Review tab (spec 5.8, brief 12): tonight's repair as the one lit element, the mistakes
/// grouped by chapter, the skipped questions, a glimpse of the record and the past results.
class ReviewScreen extends ConsumerStatefulWidget {
  const ReviewScreen({super.key});

  @override
  ConsumerState<ReviewScreen> createState() => _ReviewScreenState();
}

class _ReviewScreenState extends ConsumerState<ReviewScreen> {
  final ScrollController _scroll = ScrollController();

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _refresh() => ref.read(attemptsRepositoryProvider.notifier).refresh(force: true);

  void _openRepair(MistakeItem item) => context.push(AppRoutes.reviewRepair(item.attemptId, item.questionId));

  @override
  Widget build(BuildContext context) {
    ref.listen(tabReselectProvider, (_, event) {
      if (event?.tabIndex == 2 && _scroll.hasClients) {
        _scroll.animateTo(0, duration: const Duration(milliseconds: 360), curve: Curves.easeOutCubic);
      }
    });
    final colors = context.mmColors;
    final inputs = ref.watch(reviewInputsProvider);
    final index = ref.watch(reviewIndexProvider);
    final attempts = inputs.attempts;
    final pad = MediaQuery.paddingOf(context);

    final header = Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, MmSpace.s16),
      child: const TabRootHeader(title: ReviewCopy.title),
    );

    Widget body;
    if (index == null) {
      if (attempts.isFailedEmpty) {
        final offline = attempts.error?.isOffline ?? false;
        body = StateView(
          kind: offline ? StateViewKind.offline : StateViewKind.error,
          title: offline ? ReviewCopy.offlineTitle : ReviewCopy.loadErrorTitle,
          message: offline ? ReviewCopy.offlineMessage : ReviewCopy.loadErrorMessage,
          primary: StateAction(ReviewCopy.tryAgainKey, _refresh),
        );
      } else {
        body = const _ReviewSkeleton();
      }
      return Scaffold(
        backgroundColor: colors.ground,
        body: SafeArea(
          child: Column(
            children: [
              header,
              Expanded(child: body),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: colors.ground,
      body: Stack(
        children: [
          // The desk lamp from the upper left: environment only, faint, never under reading.
          Positioned(left: 0, right: 0, top: 0, height: 360, child: IgnorePointer(child: LightField.lamp(context, strength: 0.55))),
          SafeArea(
            bottom: false,
            child: RefreshIndicator(
              onRefresh: _refresh,
              color: colors.ink,
              backgroundColor: colors.raised,
              // One authored entrance when the loaded tab first shows: the hero, then the map, then
              // what sits under it, in reading order. Scrolling never replays it.
              child: MmStagger(
                child: ListView(
                  controller: _scroll,
                  padding: EdgeInsets.only(bottom: pad.bottom + MmSpace.s32),
                  children: [header, if (attempts.isStale) const InlineBanner.offlineStrip(), ..._content(context, index, inputs)],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  List<Widget> _content(BuildContext context, ReviewIndex index, ReviewInputs inputs) {
    final clock = ref.watch(reviewClockProvider);
    final lateNight = clock.isLateNight && ref.watch(lateNightLinesProvider);
    Widget gutter(Widget child, {double top = 0}) =>
        Padding(padding: EdgeInsets.fromLTRB(MmSpace.gutter, top, MmSpace.gutter, 0), child: child);

    final unopened = [
      for (final p in inputs.unopened)
        if (index.attempt(p.attemptId) case final a?) (p.attemptId, sourceLabel(index.attempts, a)) else (p.attemptId, 'Your mock'),
    ];
    final tonight = index.tonight;
    final groups = index.openGroups;
    final records = recordEntries(index);
    final mocks = index.mocks.take(5).toList();

    if (index.attempts.isEmpty && unopened.isEmpty) {
      return [
        SizedBox(
          height: 520,
          child: StateView(
            kind: StateViewKind.empty,
            pose: MobiPose.read,
            title: ReviewCopy.emptyTitle,
            message: ReviewCopy.emptyMessage,
            primary: StateAction(ReviewCopy.emptyAction, () => context.go(AppRoutes.practice)),
          ),
        ),
      ];
    }

    // Reading order for the entrance: the unopened result (when there is one), the hero, the map
    // with its heading, then everything under it.
    var next = 0;
    final unopenedAt = unopened.isEmpty ? 0 : next++;
    final heroAt = next++;
    final mapAt = next++;
    final belowAt = next++;
    Widget item(int at, Widget child) => MmStaggerItem(index: at, child: child);

    return [
      for (final (id, label) in unopened.take(1))
        item(unopenedAt, gutter(UnopenedResultRow(label: label, onOpen: () => context.push(AppRoutes.resultSealed(id))), top: 0)),
      if (unopened.isNotEmpty) const SizedBox(height: MmRhythm.group),
      if (tonight != null)
        item(
          heroAt,
          gutter(
            TonightCard(
              pick: tonight,
              now: clock.now(),
              lateNight: lateNight,
              onRepair: () => _openRepair(tonight.items.first),
              onShowMe: () => _showEvidence(context, index, tonight),
            ),
          ),
        )
      else if (groups.isNotEmpty)
        item(heroAt, gutter(_noTonight(index, groups, inputs)))
      else if (index.hasAnyMistake || index.attempts.isNotEmpty)
        // Only when nothing is open: a set-aside question is not a repaired one.
        item(heroAt, gutter(_AllClear(setAside: index.setAsideCount, repaired: index.repairedCount))),
      if (groups.isNotEmpty) ...[
        item(mapAt, gutter(SectionHeading(ReviewCopy.mistakesHeading, caption: mapCaptionOf(index)), top: MmRhythm.section)),
        // The progress line and its bar teach the colours of the map under it.
        item(mapAt, gutter(RepairsProgress(repaired: index.repairedCount, found: index.foundCount, setAside: index.setAsideCount))),
        const SizedBox(height: MmRhythm.item),
        item(
          mapAt,
          gutter(
            MistakeMap(
              groups: groups.take(tabChapterLimit).toList(),
              scaleTo: mapScaleOf(groups),
              showSubject: spansSubjects(groups),
              clock: clock,
              onOpen: _openRepair,
            ),
          ),
        ),
        if (groups.length > tabChapterLimit)
          gutter(
            Align(
              alignment: Alignment.centerLeft,
              child: KeyButton.quiet(
                label: ReviewCopy.seeAllChapters(groups.length),
                onPressed: () => context.push(AppRoutes.reviewMistakes),
              ),
            ),
          ),
      ],
      if (index.blanks case final blanks?) item(belowAt, gutter(NotAttemptedGroup(group: blanks), top: MmRhythm.group)),
      // The record's numbers and the saved questions (the website's analytics and saved pages).
      item(belowAt, gutter(const ReviewInsightsRows(), top: MmRhythm.section)),
      item(belowAt, gutter(SectionHeading(ReviewCopy.recordHeading), top: MmRhythm.section)),
      if (records.isEmpty)
        gutter(Text(ReviewCopy.recordPreviewEmpty, style: context.mmType.body.copyWith(color: context.mmColors.ink2)))
      else ...[
        for (var i = 0; i < records.take(2).length; i++)
          gutter(RecordEntry(item: records[i], clock: clock, first: i == 0, last: i == records.take(2).length - 1)),
        gutter(
          Align(
            alignment: Alignment.centerLeft,
            child: KeyButton.quiet(label: ReviewCopy.seeRecord, onPressed: () => context.push(AppRoutes.reviewRecord)),
          ),
        ),
      ],
      if (mocks.isNotEmpty) ...[
        gutter(SectionHeading(ReviewCopy.pastHeading), top: MmRhythm.section),
        for (final a in mocks)
          gutter(
            PastResultRow(
              attempt: a,
              label: sourceLabel(index.attempts, a),
              clock: clock,
              onOpen: () => context.push(AppRoutes.result(a.id)),
              onReplay: () => context.push(AppRoutes.resultRecap(a.id, 1)),
            ),
          ),
      ],
    ];
  }

  /// Open mistakes with no tonight pick: the reasons are in the data, so the card names them.
  Widget _noTonight(ReviewIndex index, List<ChapterGroup> groups, ReviewInputs inputs) {
    final unopenedIds = {for (final u in inputs.unopened) u.attemptId};
    var inShort = false;
    var inUnopened = false;
    PaperOpen? offer;
    for (final g in groups) {
      for (final paper in g.openByPaper) {
        final attempt = index.attempt(paper.attemptId);
        if (attempt == null) continue;
        final unopened = unopenedIds.contains(paper.attemptId);
        if (!isRepairBasis(attempt)) {
          inShort = true;
        } else if (unopened) {
          inUnopened = true;
        }
        // The repair runs from any opened paper, so the key offers the first one found.
        if (!unopened) offer ??= paper;
      }
    }
    final chosen = offer;
    return NoTonightCard(
      inShortPractice: inShort,
      inUnopenedResult: inUnopened,
      offer: chosen,
      onRepair: chosen == null ? null : () => _openRepair(chosen.items.first),
    );
  }

  void _showEvidence(BuildContext context, ReviewIndex index, TonightPick pick) {
    String text(MistakeItem item) {
      final a = index.attempt(item.attemptId);
      if (a == null) return '';
      for (final q in a.questions) {
        if (q.id == item.questionId) return q.question;
      }
      return '';
    }

    showMmSheet<void>(
      context: context,
      title: '${pick.chapter}, ${pick.source}',
      builder: (sheetContext) => EvidenceList(
        items: pick.items,
        questionText: text,
        onOpen: (item) {
          Navigator.of(sheetContext).pop();
          _openRepair(item);
        },
      ),
    );
  }
}

/// No open mistakes: the hero becomes a quiet all-clear. Mobi reading at the right, the title as the
/// headline, the truth about what comes next, and the number of mistakes repaired so far as the
/// figure (only when there are some: a set-aside question is not a repaired one).
class _AllClear extends StatelessWidget {
  const _AllClear({this.setAside = 0, this.repaired = 0});

  /// Questions waiting on an answer-key check: they are not repaired, so the card says so.
  final int setAside;
  final int repaired;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    // The tab's one hero when nothing is open: the lamp, the grain and the lit volt edge come
    // from the shared hero surface; Mobi reads at its right.
    return MmSurface.hero(
      lit: true,
      padding: EdgeInsets.zero,
      child: Stack(
        children: [
          const Positioned(
            right: 8,
            top: 12,
            child: Mobi(pose: MobiPose.read, size: 104, motion: MobiMotion.settle),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.cardPadding, MmSpace.cardPadding, MmSpace.cardPadding, MmSpace.s24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.only(right: 96),
                  child: Semantics(
                    header: true,
                    child: Text(ReviewCopy.allClearTitle, style: type.headline.copyWith(fontSize: 26, height: 29 / 26)),
                  ),
                ),
                if (repaired > 0) ...[
                  const SizedBox(height: MmRhythm.group),
                  MonumentalNumber(
                    value: '$repaired',
                    unit: 'repaired',
                    style: type.figure.copyWith(fontSize: 64, height: 58 / 64),
                    delay: Motion.enterDuration,
                    onLanded: () => mmHapticsOf(context)?.selection(),
                    semanticsLabel: '$repaired ${ReviewCopy.endingUnit(repaired)}',
                  ),
                ],
                const SizedBox(height: MmRhythm.item),
                Text(
                  setAside > 0 ? ReviewCopy.allClearSetAside(setAside) : ReviewCopy.allClearMessage,
                  style: type.body.copyWith(color: colors.ink2),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Loading: the hero's shape, then the map's heading and its rows, on the ground with the shared
/// shimmer. It mirrors the loaded tab so nothing jumps when the data lands.
class _ReviewSkeleton extends StatelessWidget {
  const _ReviewSkeleton();

  @override
  Widget build(BuildContext context) {
    return const SkeletonGroup(
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: MmSpace.gutter),
        child: SingleChildScrollView(
          physics: NeverScrollableScrollPhysics(),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              MmSkeletonCard(hero: true),
              SizedBox(height: MmRhythm.section),
              Skeleton.line(width: 200, height: 22),
              SizedBox(height: MmRhythm.tight),
              Skeleton.line(width: 150, height: 14),
              SizedBox(height: MmRhythm.group),
              MmSkeletonRows(rows: 3),
            ],
          ),
        ),
      ),
    );
  }
}
