import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/connectivity/connectivity.dart' show NetworkStatus, networkStatusProvider;
import '../../../core/notes/feature_note_view.dart';
import '../../../core/notes/feature_notes.dart';
import '../../../core/notes/sample_row.dart';
import '../../../core/motion/motion.dart';
import '../../../core/models/attempt.dart' show Attempt;
import '../../../core/repositories/attempts_repository.dart';
import '../../../core/router/app_shell.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/account/account_avatar.dart' show AccountLeading;
import '../../../core/widgets/widgets.dart';
import '../../insights/ask_mobi.dart';
import '../../insights/insights_routes.dart' show ReviewInsightsRows;
import '../../rules/widgets/rules_entry.dart';
import '../../social/social.dart' show MobEntryPlace, MobEntryRow;
import '../copy.dart';
import '../data/mistake_index.dart';
import '../data/paper_when.dart';
import '../data/repair_run.dart' show repairRunProvider;
import '../model/review_chapters.dart';
import '../data/review_providers.dart';
import '../data/review_chapters_provider.dart';
import '../widgets/next_from_mock.dart';
import '../again/review_again_copy.dart';
import '../again/review_again_entry.dart';
import '../widgets/review_bits.dart';
import '../widgets/review_recent_papers.dart';
import '../widgets/review_rows.dart';
import '../widgets/page_header.dart';
import '../widgets/review_layout.dart';
import '../widgets/review_load_failure.dart';
import '../widgets/review_state_view.dart';
import '../widgets/saved_repairs.dart';
import '../widgets/weak_chapters_lead.dart';

/// The Review tab, led by weak chapters (REVIEW-RESULT-1018 4, owner D18). The sentence over the papers says what they cost,
/// the open chapter is the hero with its one volt key and its mistakes (one action each), and the other chapters follow. Under
/// that lead everything the tab always had stays, in the website's order: Revise, Saved repairs, the papers, then the rows that
/// open other pages.
class ReviewScreen extends ConsumerStatefulWidget {
  const ReviewScreen({super.key});

  @override
  ConsumerState<ReviewScreen> createState() => _ReviewScreenState();
}

class _ReviewScreenState extends ConsumerState<ReviewScreen> {
  /// Results not opened yet, for the Recent papers block (their rows stay sealed).
  Set<String> _unopenedIds = const {};

  final ScrollController _scroll = ScrollController();

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _refresh() => ref.read(attemptsRepositoryProvider.notifier).refresh(force: true);

  @override
  Widget build(BuildContext context) {
    ref.listen(tabReselectProvider, (_, event) {
      if (event?.tabIndex == 2) unawaited(MmScroll.toTop(context, _scroll));
    });
    final colors = context.mmColors;
    final inputs = ref.watch(reviewInputsProvider);
    final index = ref.watch(reviewIndexProvider);
    final attempts = inputs.attempts;
    final pad = MediaQuery.paddingOf(context);

    // The account's saved repairs for tonight's paper (a repair made on another phone or the website)
    // are copied to the phone's record, so its mistakes read as repaired here and open free (F17).
    final tonightId = index?.tonight?.attemptId;
    if (tonightId != null) {
      final saved = ref.watch(attemptDetailProvider(tonightId).select((s) => s.value?.savedRepairs));
      if (saved != null && saved.isNotEmpty) {
        // Idempotent: a repair the phone already holds as repaired is skipped, so once copied the
        // rebuild finds nothing left to do.
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) unawaited(ref.read(repairRunProvider(tonightId).notifier).recordSaved(saved, ref.read(reviewInputsProvider).records));
        });
      }
    }

    // A scene on screen (the empty state, the all-clear hero, the load failure) carries the one
    // Mobi, so the Ask pill's face steps aside.
    final sceneMobi = index == null
        ? attemptsReadFailed(attempts)
        : (index.attempts.isEmpty && inputs.unopened.isEmpty) ||
            (index.tonight == null && index.openGroups.isEmpty && (index.hasAnyMistake || index.attempts.isNotEmpty));

    // The offline line lives in the header row, which is tall enough for it: nothing below moves.
    final header = Padding(
      padding: const EdgeInsets.fromLTRB(ReviewSpace.gutter, MmSpace.s8, ReviewSpace.gutter, MmSpace.s16),
      child: AccountLeading(child: ReviewTabHeader(
        title: ReviewCopy.title,
        notice: HeaderNotice.forAttempts(attempts, ref.watch(reviewClockProvider), offline: ref.watch(networkStatusProvider) == NetworkStatus.offline),
        // Ask answers from the record, so it lives here (DOCK.md 6), not on the bar or the Start sheet.
        onAsk: () => openAskMobi(context, const AskMobiContext.page()),
        showMobi: !sceneMobi,
      )),
    );

    Widget body;
    if (index == null) {
      if (attemptsReadFailed(attempts)) {
        body = ReviewLoadFailure(attempts: attempts, onRetry: _refresh);
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
      // No lamp wash behind the page: Night stays a flat warm ground (REVIEW-RESULT-1018 acceptance 9).
      body: SafeArea(
        bottom: false,
        // Pull to refresh is the app's own ring (MOTION C10): the page bounces down with the finger and holds a gap for the
        // ring, numbers roll from the ones they showed, and the entrance does not replay.
        child: MmPullRefresh(
          onRefresh: _refresh,
          // One authored entrance when the loaded tab first shows: the lead, then what sits under it, in reading order.
          // Scrolling never replays it.
          child: MmStagger(
            child: ListView(
              controller: _scroll,
              // The ring draws the pull, so a short page must still take a drag.
              physics: const AlwaysScrollableScrollPhysics(),
              padding: EdgeInsets.only(bottom: pad.bottom + MmSpace.s32),
              children: [header, ..._content(context, index, inputs)],
            ),
          ),
        ),
      ),
    );
  }

  List<Widget> _content(BuildContext context, ReviewIndex index, ReviewInputs inputs) {
    final clock = ref.watch(reviewClockProvider);
    Widget gutter(Widget child, {double top = 0}) =>
        Padding(padding: EdgeInsets.fromLTRB(ReviewSpace.gutter, top, ReviewSpace.gutter, 0), child: child);

    _unopenedIds = {for (final p in inputs.unopened) p.attemptId};
    final unopened = [
      for (final p in inputs.unopened)
        if (index.attempt(p.attemptId) case final a?) (p.attemptId, sourceLabel(index.attempts, a)) else (p.attemptId, 'Your mock'),
    ];
    final chapters = ref.watch(reviewChaptersProvider);
    final mocks = index.mocks.take(5).toList();

    if (index.attempts.isEmpty && unopened.isEmpty) {
      return [
        SizedBox(
          // The empty state is centred in what is left under the header and above the dock.
          height: math.max(480.0, MediaQuery.sizeOf(context).height - MediaQuery.paddingOf(context).top - 72 - 96),
          child: ReviewStateView(
            kind: StateViewKind.empty,
            pose: MobiPose.read,
            pointAtKey: true,
            title: ReviewCopy.emptyTitle,
            message: ReviewCopy.emptyMessage,
            // What will appear, drawn as it will look: the paper it came from and when it was attempted.
            sample: SampleRow(
              leading: const Bubble(state: BubbleState.wrong, size: 14, animate: false),
              title: ReviewCopy.sampleTitle,
              note: paperWhen(clock, ReviewCopy.sampleSource, clock.now().subtract(const Duration(hours: 1))),
            ),
            primary: StateAction(ReviewCopy.emptyAction, () => startQuickTen(context)),
          ),
        ),
      ];
    }

    // Reading order for the entrance: the unopened result (when there is one), the lead, then everything under it.
    var next = 0;
    final unopenedAt = unopened.isEmpty ? 0 : next++;
    final leadAt = next++;
    final belowAt = next++;
    Widget item(int at, Widget child) => MmStaggerItem(index: at, child: child);

    final hasOpenPaper = index.attempts.any((a) => !_unopenedIds.contains(a.id));
    final saved = chapters?.saved ?? const <SavedRepair>[];
    void openRepair(RowItem m) => context.push(AppRoutes.reviewRepair(m.paper, m.qid ?? ''));

    return [
      for (final (id, label) in unopened.take(1))
        item(unopenedAt, gutter(UnopenedResultRow(label: label, onOpen: () => context.push(AppRoutes.resultSealed(id))), top: 0)),
      if (unopened.isNotEmpty) const SizedBox(height: ReviewSpace.group),
      // The lead: the weak chapters. With no chapter that lost a mark the one card is the all-clear (its key starts a fresh
      // set), never an empty list.
      if (chapters != null && chapters.rows.isNotEmpty)
        item(leadAt, gutter(WeakChaptersLead(body: chapters, onRepair: openRepair)))
      else if (hasOpenPaper)
        item(
          leadAt,
          gutter(
            _AllClear(
              setAside: index.setAsideCount,
              repaired: index.repairedCount,
              onStart: () => startQuickTen(context),
              onReviewAgain: () => context.push(ReviewAgainCopy.path),
            ),
          ),
        ),
      item(belowAt, _below(context, index, chapters, saved, clock, mocks)),
    ];
  }

  /// Everything under the lead, in the website's order: Revise, Saved repairs, the papers, then the rows that open other pages.
  Widget _below(BuildContext context, ReviewIndex index, ChaptersBody? chapters, List<SavedRepair> saved, ReviewClock clock, List<Attempt> mocks) {
    Widget gutter(Widget child, {double top = 0}) =>
        Padding(padding: EdgeInsets.fromLTRB(ReviewSpace.gutter, top, ReviewSpace.gutter, 0), child: child);
    final latestMock = mocks.isEmpty ? null : mocks.first;
    // One note at a time, in order: the Lab after the first mock, then Colleges once there is a full-mock score. Stacked prompts
    // after a result are what the notes exist to avoid.
    final notes = ref.watch(featureNotesProvider);
    final labNote = latestMock != null && notes.visible(FeatureNote.lab);
    final collegesNote = latestMock != null && !labNote && notes.visible(FeatureNote.colleges);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // After the first repair: Revise, once, in the page's own flow (never a popup).
        if (index.repairedCount > 0)
          gutter(
            FeatureNoteView(
              note: FeatureNote.revise,
              lead: ReviewCopy.noteReviseLead,
              text: ReviewCopy.noteRevise,
              actionLabel: ReviewCopy.noteReviseAction,
              onAction: () => context.push(AppRoutes.reviewRevise),
            ),
            top: ReviewSpace.group,
          ),
        // Revise when it has cards due today, otherwise Review again (the repaired mistakes asked once more, key hidden).
        gutter(const ReviewAgainRow(), top: ReviewSpace.group),
        if (saved.isNotEmpty)
          gutter(
            SavedRepairs(
              saved: saved,
              summary: chapters?.savedLine ?? '',
              onOpen: (s) => context.push(AppRoutes.reviewRepair(s.item.paper, s.item.qid ?? '')),
              onRecord: () => context.push(AppRoutes.reviewRecord),
            ),
            top: ReviewSpace.section,
          ),
        if (labNote)
          gutter(
            FeatureNoteView(
              note: FeatureNote.lab,
              lead: ReviewCopy.noteLabLead,
              text: ReviewCopy.noteLab(sourceLabel(index.attempts, latestMock)),
              actionLabel: ReviewCopy.noteLabAction,
              onAction: () => context.push(AppRoutes.result(latestMock.id)),
            ),
            top: ReviewSpace.section,
          ),
        if (collegesNote)
          gutter(
            FeatureNoteView(
              note: FeatureNote.colleges,
              lead: ReviewCopy.noteCollegesLead,
              text: ReviewCopy.noteColleges,
              actionLabel: ReviewCopy.noteCollegesAction,
              onAction: () => context.go(AppRoutes.colleges),
            ),
            top: ReviewSpace.section,
          ),
        // The SWOT's next step after the latest mock (only when its read is ready with a plan).
        if (latestMock != null)
          gutter(NextFromMockBlock(attemptId: latestMock.id, label: sourceLabel(index.attempts, latestMock)), top: ReviewSpace.section),
        // Your papers: the trend and the newest papers, then the past results.
        gutter(ReviewRecentPapers(attempts: index.attempts, unopened: _unopenedIds), top: ReviewSpace.section),
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
        // The rows that open other pages: the Mob's shared trap, the record's numbers and the saved questions, the Rule book.
        gutter(
          Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const MobEntryRow(place: MobEntryPlace.review),
              const ReviewInsightsRows(),
              Divider(height: 1, color: context.mmColors.line),
              const RulesEntry(),
            ],
          ),
          top: ReviewSpace.section,
        ),
      ],
    );
  }
}

/// No open mistakes: the same hero card as the full tab, at the same gutter. The number of
/// mistakes repaired so far is the figure (only when there are some: a set-aside question is not a
/// repaired one), the title is its small caption, Mobi reads at its right (the one character on
/// this screen), and the one volt key starts the next Quick 10, because that is the next step.
class _AllClear extends StatelessWidget {
  const _AllClear({this.setAside = 0, this.repaired = 0, required this.onStart, required this.onReviewAgain});

  /// Questions waiting on an answer-key check: they are not repaired, so the hero says so.
  final int setAside;
  final int repaired;
  final VoidCallback onStart;

  /// The key when something was repaired: ask those again, with the key hidden.
  final VoidCallback onReviewAgain;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    // Proud once something was repaired; reading otherwise. The one Mobi of the screen.
    final mobi = Mobi(pose: repaired > 0 ? MobiPose.proud : MobiPose.read, size: 96, motion: MobiMotion.settle);
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
          // Review again when there is a repaired mistake to ask once more; otherwise a fresh set.
          KeyButton(
            label: repaired > 0 ? ReviewAgainCopy.title : ReviewCopy.allClearAction,
            onPressed: repaired > 0 ? onReviewAgain : onStart,
          ),
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
              // The sentence over the papers.
              const Skeleton.line(width: double.infinity, height: 14),
              const SizedBox(height: MmSpace.s8),
              const Skeleton.line(width: 220, height: 14),
              const SizedBox(height: ReviewSpace.item + 4),
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
