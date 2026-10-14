import 'dart:math' as math;

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
import '../widgets/page_header.dart';
import '../widgets/review_layout.dart';
import '../widgets/review_state_view.dart';
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

    // The offline line lives in the header row, which is tall enough for it: nothing below moves.
    final header = Padding(
      padding: const EdgeInsets.fromLTRB(ReviewSpace.gutter, MmSpace.s8, ReviewSpace.gutter, MmSpace.s16),
      child: ReviewTabHeader(title: ReviewCopy.title, notice: attempts.isStale ? HeaderNotice.offline : null),
    );

    Widget body;
    if (index == null) {
      if (attempts.isFailedEmpty) {
        final offline = attempts.error?.isOffline ?? false;
        body = ReviewStateView(
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
                  children: [header, ..._content(context, index, inputs)],
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
        Padding(padding: EdgeInsets.fromLTRB(ReviewSpace.gutter, top, ReviewSpace.gutter, 0), child: child);

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
          // The empty state is centred in what is left under the header and above the dock.
          height: math.max(480.0, MediaQuery.sizeOf(context).height - MediaQuery.paddingOf(context).top - 72 - 96),
          child: ReviewStateView(
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
      if (unopened.isNotEmpty) const SizedBox(height: ReviewSpace.group),
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
        item(
          heroAt,
          gutter(
            _AllClear(
              setAside: index.setAsideCount,
              repaired: index.repairedCount,
              onStart: () => context.push(Uri(path: AppRoutes.practiceSetup('quick'), queryParameters: {'count': '10'}).toString()),
            ),
          ),
        ),
      if (groups.isNotEmpty) ...[
        item(mapAt, gutter(SectionHeading(ReviewCopy.mistakesHeading, caption: mapCaptionOf(index)), top: ReviewSpace.section)),
        // The progress line and its bar teach the colours of the map under it.
        item(mapAt, gutter(RepairsProgress(repaired: index.repairedCount, found: index.foundCount, setAside: index.setAsideCount))),
        const SizedBox(height: ReviewSpace.item),
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
          gutter(FlushKey(label: ReviewCopy.seeAllChapters(groups.length), onPressed: () => context.push(AppRoutes.reviewMistakes))),
      ],
      if (index.blanks case final blanks?) item(belowAt, gutter(NotAttemptedGroup(group: blanks), top: ReviewSpace.group)),
      // The record's numbers and the saved questions (the website's analytics and saved pages).
      item(belowAt, gutter(const ReviewInsightsRows(), top: ReviewSpace.section)),
      item(belowAt, gutter(SectionHeading(ReviewCopy.recordHeading, rule: true), top: ReviewSpace.section)),
      if (records.isEmpty)
        gutter(Text(ReviewCopy.recordPreviewEmpty, style: context.mmType.body.copyWith(color: context.mmColors.ink2)))
      else ...[
        for (var i = 0; i < records.take(2).length; i++)
          gutter(RecordEntry(item: records[i], clock: clock, first: i == 0, last: i == records.take(2).length - 1)),
        gutter(FlushKey(label: ReviewCopy.seeRecord, onPressed: () => context.push(AppRoutes.reviewRecord))),
      ],
      if (mocks.isNotEmpty) ...[
        gutter(SectionHeading(ReviewCopy.pastHeading, rule: true), top: ReviewSpace.section),
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

/// No open mistakes: the same hero card as the full tab, at the same gutter. The number of
/// mistakes repaired so far is the figure (only when there are some: a set-aside question is not a
/// repaired one), the title is its small caption, Mobi reads at its right (the one character on
/// this screen), and the one volt key starts the next Quick 10, because that is the next step.
class _AllClear extends StatelessWidget {
  const _AllClear({this.setAside = 0, this.repaired = 0, required this.onStart});

  /// Questions waiting on an answer-key check: they are not repaired, so the hero says so.
  final int setAside;
  final int repaired;
  final VoidCallback onStart;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    const mobi = Mobi(pose: MobiPose.read, size: 96, motion: MobiMotion.settle);
    return MmSurface.hero(
      lit: true,
      padding: const EdgeInsets.all(ReviewSpace.heroPad),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (repaired > 0) ...[
            Semantics(header: true, child: Text(ReviewCopy.allClearTitle, style: type.caption.copyWith(color: colors.ink2))),
            const SizedBox(height: MmSpace.s8),
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    alignment: Alignment.centerLeft,
                    child: MonumentalNumber(
                      value: '$repaired',
                      unit: 'repaired',
                      style: type.figure.copyWith(fontSize: 72, height: 64 / 72),
                      delay: Motion.enterDuration,
                      onLanded: () => mmHapticsOf(context)?.selection(),
                      semanticsLabel: '$repaired ${ReviewCopy.endingUnit(repaired)}',
                    ),
                  ),
                ),
                mobi,
              ],
            ),
          ] else
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: Semantics(header: true, child: Text(ReviewCopy.allClearTitle, style: type.headline)),
                ),
                const SizedBox(width: MmSpace.s8),
                mobi,
              ],
            ),
          const SizedBox(height: MmSpace.s8),
          Text(
            setAside > 0 ? ReviewCopy.allClearSetAside(setAside) : ReviewCopy.allClearMessage,
            style: type.lead.copyWith(color: colors.ink2),
          ),
          const SizedBox(height: MmSpace.s16),
          KeyButton(label: ReviewCopy.allClearAction, onPressed: onStart),
        ],
      ),
    );
  }
}

/// Loading: the hero card's shape (overline, two title lines, the number, a line, the bubble row,
/// the key), then the map's heading and its rows, on the ground with the shared shimmer. Its
/// heights are the real tab's, so nothing jumps when the data lands.
class _ReviewSkeleton extends StatelessWidget {
  const _ReviewSkeleton();

  @override
  Widget build(BuildContext context) {
    return SkeletonGroup(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: ReviewSpace.gutter),
        child: SingleChildScrollView(
          physics: const NeverScrollableScrollPhysics(),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              MmSurface.hero(
                padding: const EdgeInsets.all(ReviewSpace.heroPad),
                child: const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Skeleton.line(width: 120, height: 12),
                    SizedBox(height: MmSpace.s8),
                    Skeleton.line(width: 160, height: 22),
                    SizedBox(height: MmSpace.s8),
                    Skeleton.line(width: 120, height: 22),
                    SizedBox(height: MmSpace.s12),
                    Skeleton(width: 120, height: 64),
                    SizedBox(height: MmSpace.s12),
                    Skeleton.line(width: 220, height: 14),
                    SizedBox(height: MmSpace.s16),
                    Skeleton.line(width: 200, height: 20),
                    SizedBox(height: MmSpace.s12),
                    Skeleton(height: 56, radius: 999),
                  ],
                ),
              ),
              const SizedBox(height: ReviewSpace.section),
              const Skeleton.line(width: 200, height: 22),
              const SizedBox(height: MmSpace.s8),
              const Skeleton.line(width: 150, height: 14),
              const SizedBox(height: ReviewSpace.group),
              const MmSkeletonRows(rows: 3),
            ],
          ),
        ),
      ),
    );
  }
}
