import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/domain/tonight_pick.dart' show isRepairBasis;
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
import '../widgets/chapter_group_card.dart';
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
              child: ListView(
                controller: _scroll,
                padding: EdgeInsets.only(bottom: pad.bottom + MmSpace.s32),
                children: [header, if (attempts.isStale) const InlineBanner.offlineStrip(), ..._content(context, index, inputs)],
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

    return [
      for (final (id, label) in unopened.take(1))
        gutter(UnopenedResultRow(label: label, onOpen: () => context.push(AppRoutes.resultSealed(id))), top: 0),
      if (unopened.isNotEmpty) const SizedBox(height: MmSpace.s16),
      if (index.foundCount > 0) gutter(RepairsProgress(repaired: index.repairedCount, found: index.foundCount), top: 0),
      if (index.foundCount > 0) const SizedBox(height: MmSpace.s12),
      if (tonight != null)
        gutter(
          TonightCard(
            pick: tonight,
            now: clock.now(),
            lateNight: lateNight,
            onRepair: () => _openRepair(tonight.items.first),
            onShowMe: () => _showEvidence(context, index, tonight),
          ),
        )
      else if (groups.isNotEmpty)
        gutter(_noTonight(index, groups, inputs))
      else if (index.hasAnyMistake || index.attempts.isNotEmpty)
        // Only when nothing is open: a set-aside question is not a repaired one.
        gutter(_AllClear(setAside: index.setAsideCount)),
      if (groups.isNotEmpty) ...[
        gutter(SectionHeading(ReviewCopy.mistakesHeading, caption: mistakesSummaryOf(index)), top: MmSpace.group),
        for (final g in groups.take(tabChapterLimit)) ...[
          gutter(ChapterGroupCard(group: g, clock: clock, onOpen: _openRepair)),
          const SizedBox(height: MmSpace.s12),
        ],
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
      if (index.blanks case final blanks?) gutter(NotAttemptedGroup(group: blanks), top: MmSpace.s24),
      // The record's numbers and the saved questions (the website's analytics and saved pages).
      gutter(const ReviewInsightsRows(), top: MmSpace.group),
      gutter(SectionHeading(ReviewCopy.recordHeading), top: MmSpace.group),
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
        gutter(SectionHeading(ReviewCopy.pastHeading), top: MmSpace.group),
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

/// No open mistakes: Mobi reading, and the truth about what comes next.
class _AllClear extends StatelessWidget {
  const _AllClear({this.setAside = 0});

  /// Questions waiting on an answer-key check: they are not repaired, so the card says so.
  final int setAside;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return FakeGlass(
      child: Padding(
        padding: const EdgeInsets.all(MmSpace.cardPadding),
        child: Row(
          children: [
            const Mobi(pose: MobiPose.read, size: 72, motion: MobiMotion.settle),
            const SizedBox(width: MmSpace.s16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Semantics(header: true, child: Text(ReviewCopy.allClearTitle, style: type.cardTitle)),
                  const SizedBox(height: MmSpace.s4),
                  Text(setAside > 0 ? ReviewCopy.allClearSetAside(setAside) : ReviewCopy.allClearMessage, style: type.small.copyWith(color: colors.ink2)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ReviewSkeleton extends StatelessWidget {
  const _ReviewSkeleton();

  @override
  Widget build(BuildContext context) {
    return const SkeletonGroup(
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: MmSpace.gutter),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Skeleton(height: 280, radius: MmRadius.panel),
            SizedBox(height: MmSpace.group),
            Skeleton.line(width: 180, height: 20),
            SizedBox(height: MmSpace.s12),
            Skeleton(height: 104, radius: MmRadius.panel),
            SizedBox(height: MmSpace.s12),
            Skeleton(height: 104, radius: MmRadius.panel),
          ],
        ),
      ),
    );
  }
}
