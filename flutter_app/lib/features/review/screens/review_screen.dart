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
import '../../today/logic/today_builder.dart' show buildTrend;
import '../../today/logic/today_inputs.dart';
import '../../today/logic/today_model.dart' show GoTo;
import '../../today/widgets/paper_trend.dart' show PaperTrendStrip;
import '../data/mistake_index.dart';
import '../data/repair_run.dart' show repairRunProvider;
import '../model/review_chapters.dart';
import '../model/your_papers.dart';
import '../data/review_providers.dart';
import '../data/review_chapters_provider.dart';
import '../widgets/next_from_mock.dart';
import '../again/review_again_copy.dart';
import '../again/review_again_entry.dart';
import '../widgets/page_header.dart';
import '../widgets/review_layout.dart';
import '../widgets/review_load_failure.dart';
import '../widgets/review_state_view.dart';
import '../widgets/saved_repairs.dart';
import '../widgets/weak_chapters_lead.dart';
import '../widgets/your_papers.dart';

/// Your papers (19 Oct, owner D106 and G20; the Review tab, which D105 moves inside Practice). Top to bottom: the stats
/// strip (papers sat, the latest marks with their trend, open repairs), the subject filter, the papers newest first (a
/// tap opens that paper's result and answers), then Mistakes to repair by chapter (the weak-chapter lead of D18, kept:
/// the chapter that costs the most marks is the hero with its one volt key and its mistakes, the other chapters
/// follow). Under that everything the tab always had stays: Review again or Revise, Saved repairs, the notes, the next
/// step after the latest mock, and the rows that open other pages. Every number on the page reads one record, filtered
/// by the same subject, so the strip, the rows and the chapters agree. A fresh account sees one friendly first step.
///
/// [focusPaper] (a result's "See it in Your papers") opens the page on that paper's row and marks it for a moment.
class ReviewScreen extends ConsumerStatefulWidget {
  const ReviewScreen({super.key, this.focusPaper});

  final String? focusPaper;

  @override
  ConsumerState<ReviewScreen> createState() => _ReviewScreenState();
}

class _ReviewScreenState extends ConsumerState<ReviewScreen> {
  final ScrollController _scroll = ScrollController();

  /// The subject filter: a subject's name, or null for every subject.
  String? _subject;

  /// The paper "See it in Your papers" asked for, and whether the page still has to bring it into view.
  String? _focus;
  bool _focusPending = false;
  final Map<String, GlobalKey> _rowKeys = {};
  final GlobalKey _papersKey = GlobalKey(debugLabel: 'your-papers');
  final GlobalKey _mistakesKey = GlobalKey(debugLabel: 'mistakes-to-repair');

  /// Read in build: whether this page is the one on screen, and the shell's current tab (null outside a shell).
  bool _onScreen = true;
  int? _shellTab;

  @override
  void initState() {
    super.initState();
    _focus = widget.focusPaper;
    _focusPending = _focus != null;
  }

  @override
  void didUpdateWidget(ReviewScreen old) {
    super.didUpdateWidget(old);
    final next = widget.focusPaper;
    if (next != null && next != old.focusPaper) {
      _focus = next;
      _focusPending = true;
    }
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  /// A row's key, one per filter: while the list cross-fades from one filter to the next both lists are on screen, so a
  /// paper in both must not share a key.
  GlobalKey _rowKey(String? subject, String attemptId) =>
      _rowKeys.putIfAbsent('${subject ?? '*'}|$attemptId', () => GlobalKey(debugLabel: 'paper-$attemptId'));

  /// Scrolls [key]'s widget near the top, under the header.
  void _bringIn(GlobalKey key, {double alignment = 0.12}) {
    final at = key.currentContext;
    if (at == null || !at.mounted) return;
    unawaited(Scrollable.ensureVisible(at, alignment: alignment, duration: Motion.of(at, Motion.emphasizedDuration), curve: Motion.emphasized));
  }

  Future<void> _refresh() => ref.read(attemptsRepositoryProvider.notifier).refresh(force: true);

  @override
  Widget build(BuildContext context) {
    // A second tap on the tab that shows this page scrolls it to the top. Which tab that is depends on the bar (Review
    // was tab 2 on the old bar; under D105 Your papers lives inside Practice, and Start's slot and the Mob come after
    // it), so it is never a fixed number: the tap must be on the shell's current tab, with this page the one on screen
    // (its branch is the live one and nothing is pushed over it). A Mob re-tap no longer scrolls Your papers unseen.
    _onScreen = TickerMode.valuesOf(context).enabled && (ModalRoute.of(context)?.isCurrent ?? true);
    _shellTab = StatefulNavigationShell.maybeOf(context)?.currentIndex;
    ref.listen(tabReselectProvider, (_, event) {
      if (event == null || !_onScreen) return;
      if (_shellTab != null && event.tabIndex != _shellTab) return;
      unawaited(MmScroll.toTop(context, _scroll));
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

    final unopened = {for (final p in inputs.unopened) p.attemptId};
    final record = ref.watch(reviewRecordProvider);

    if (index.attempts.isEmpty || record == null) {
      return [
        SizedBox(
          // The first step is centred in what is left under the header and above the dock.
          height: math.max(480.0, MediaQuery.sizeOf(context).height - MediaQuery.paddingOf(context).top - 72 - 96),
          child: ReviewStateView(
            kind: StateViewKind.empty,
            pose: MobiPose.read,
            pointAtKey: true,
            title: ReviewCopy.firstPaperTitle,
            message: ReviewCopy.firstPaperMessage,
            // What will appear, drawn as it will look: a paper with its marks.
            sample: const SampleRow(
              leading: Bubble(state: BubbleState.filled, size: 14, animate: false),
              title: ReviewCopy.firstPaperSampleTitle,
              note: ReviewCopy.firstPaperSampleNote,
            ),
            primary: StateAction(ReviewCopy.firstPaperAction, () => startQuickTen(context)),
          ),
        ),
      ];
    }

    // A paper asked for by "See it in Your papers" is shown whatever the filter: a filter that would hide it is lifted.
    var subject = _subject;
    if (_focusPending && _focus != null && subject != null) {
      final a = index.attempt(_focus!);
      if (a != null && subjectName(a.subject) != subject) subject = _subject = null;
    }
    final view = buildYourPapers(attempts: index.attempts, unopened: unopened, record: record, subject: subject, local: clock.local);
    if (_focusPending && _focus != null && view.papers.any((p) => p.attemptId == _focus)) {
      _focusPending = false;
      final key = _rowKey(view.subject, _focus!);
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _bringIn(key, alignment: 0.3);
      });
    }

    // The latest marks' trend: the newest paper's kind across up to six papers (only from three, none sealed).
    final shown = [for (final a in index.attempts) if (view.subject == null || subjectName(a.subject) == view.subject) a];
    final trend = buildTrend(
      TodayInputs(
        now: clock.now(),
        timezone: clock.zone,
        attempts: shown,
        unopened: [for (final id in unopened) (attemptId: id, receivedAt: clock.now())],
      ),
    );

    final body = view.body;
    final hasOpenPaper = view.papers.any((p) => !p.sealed);
    void openRepair(RowItem m) => context.push(AppRoutes.reviewRepair(m.paper, m.qid ?? ''));
    void openPaper(PaperLine p) => context.push(p.location);
    Widget item(int at, Widget child) => MmStaggerItem(index: at, child: child);

    return [
      // 1. The strip: papers sat, the latest marks with their trend, open repairs.
      item(
        0,
        gutter(
          Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              PapersStripView(
                strip: view.strip,
                onPapers: () => _bringIn(_papersKey),
                onLatest: openPaper,
                onRepairs: () => _bringIn(_mistakesKey),
              ),
              if (trend != null) ...[
                Divider(height: 1, thickness: 1, color: context.mmColors.line.withValues(alpha: 0.7)),
                PaperTrendStrip(
                  trend: trend,
                  onOpen: (target) {
                    if (target is GoTo) unawaited(context.push(target.location));
                  },
                ),
              ],
            ],
          ),
        ),
      ),
      // 2. The subject filter, edge to edge so the next chip peeks at the screen's edge.
      if (view.subjects.isNotEmpty)
        item(
          1,
          Padding(
            padding: const EdgeInsets.only(top: ReviewSpace.item),
            child: PaperSubjectFilter(
              subjects: view.subjects,
              selected: view.subject,
              onSelected: (name) => setState(() {
                _subject = name;
                _focus = null;
              }),
            ),
          ),
        ),
      // 3. Your papers, newest first.
      item(
        2,
        gutter(
          KeyedSubtree(
            key: _papersKey,
            child: MmOverlapSwitcher(
              child: PaperList(
                key: ValueKey('papers-${view.subject ?? 'all'}'),
                papers: view.papers,
                subject: view.subject,
                focus: _focus,
                keyFor: (id) => _rowKey(view.subject, id),
                onOpen: openPaper,
              ),
            ),
          ),
          top: ReviewSpace.group,
        ),
      ),
      // 4. Mistakes to repair, by chapter: the weak-chapter lead (D18), from the same record and the same filter.
      item(
        3,
        gutter(
          KeyedSubtree(
            key: _mistakesKey,
            child: _MistakesHead(open: view.strip.toRepair, chapters: body.rows.where((r) => r.open.isNotEmpty).length, rows: body.rows.length, subject: view.subject),
          ),
          top: ReviewSpace.section,
        ),
      ),
      if (body.rows.isNotEmpty)
        item(
          4,
          gutter(
            WeakChaptersLead(key: ValueKey('chapters-${view.subject ?? 'all'}'), body: body, onRepair: openRepair, showSummary: false),
            top: ReviewSpace.item,
          ),
        )
      else if (hasOpenPaper)
        item(
          4,
          gutter(
            _AllClear(
              setAside: index.setAsideCount,
              repaired: index.repairedCount,
              onStart: () => startQuickTen(context),
              onReviewAgain: () => context.push(ReviewAgainCopy.path),
            ),
            top: ReviewSpace.item,
          ),
        ),
      item(5, _below(context, index, body.saved, body.savedLine)),
    ];
  }

  /// Everything under the chapters, in the website's order: Review again or Revise, Saved repairs, the notes, the next step
  /// after the latest mock, then the rows that open other pages. (The papers that used to sit here now lead the page.)
  Widget _below(BuildContext context, ReviewIndex index, List<SavedRepair> saved, String savedSummary) {
    Widget gutter(Widget child, {double top = 0}) =>
        Padding(padding: EdgeInsets.fromLTRB(ReviewSpace.gutter, top, ReviewSpace.gutter, 0), child: child);
    final mocks = index.mocks;
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
              summary: savedSummary,
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
              // Pushed, not gone to: under D105 Colleges is a page over the bar (no longer a tab), so Back returns here.
              onAction: () => context.push(AppRoutes.colleges),
            ),
            top: ReviewSpace.section,
          ),
        // The SWOT's next step after the latest mock (only when its read is ready with a plan).
        if (latestMock != null)
          gutter(NextFromMockBlock(attemptId: latestMock.id, label: sourceLabel(index.attempts, latestMock)), top: ReviewSpace.section),
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

/// "Mistakes to repair", with how many are open and across how many chapters: the same count as the strip above it and
/// the badge on the bar, for the same subject.
class _MistakesHead extends StatelessWidget {
  const _MistakesHead({required this.open, required this.chapters, required this.rows, this.subject});

  final int open;
  final int chapters;
  final int rows;
  final String? subject;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Divider(height: 1, thickness: 1, color: colors.line),
        const SizedBox(height: MmSpace.s16),
        Semantics(header: true, child: Text(ReviewCopy.mistakesHeading, style: type.title)),
        const SizedBox(height: MmSpace.s2),
        Text(ReviewCopy.mistakesCaption(open, chapters, subject, rows: rows), style: type.small.copyWith(color: colors.ink2)),
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
