import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api_providers.dart' show nowProvider;
import '../../../core/art/art.dart' show SubjectEmblem;
import '../../../core/haptics/haptics.dart';
import '../../../core/models/models.dart' show ReplayChip;
import '../../../core/motion/motion.dart';
import '../../../core/repositories/repositories.dart' show attemptDetailProvider;
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../insights/ask_mobi.dart' show AskMobiContext, AskMobiLink, askMobiAboutMock, mockLostLines, openAskMobi;
import '../../insights/data/ask_suggestions.dart' show AskSheetCopy;
import '../../insights/data/trend.dart' show trendSeries;
import '../../insights/widgets/trend_chart.dart' show TrendSection;
import '../../paper_reel/paper_reel.dart' show PaperReel, PaperReelModel, PaperReelResultEntry, ReelMoveKind, ReelNextMove, ReelResult, reelSeenProvider;
import '../../practice/widgets/result_foot.dart';
import '../../review/your_papers_link.dart' show yourPapersLocation;
import '../../practice/widgets/top_edge_fade.dart' show BarFade;
import '../../review/data/paper_when.dart' show paperWhen;
import '../../rules/widgets/across_mocks_view.dart';
import '../../rules/widgets/rule_check_view.dart';
import '../../rules/widgets/rules_entry.dart' show LabRulesLink;
import '../../rules/widgets/same_mistakes_later_view.dart';
import '../../rules/widgets/traps_meet_view.dart';
import '../../rhythm/rhythm.dart' show BadgeEarnedRow, CelebrationMode, CelebrationScope, CelebrationSlot, celebrationControllerProvider, celebrationModeProvider;
import '../../review/data/review_providers.dart' show reviewClockProvider, reviewInputsProvider;
import '../copy.dart';
import '../data/move_state.dart';
import '../data/result_providers.dart';
import '../layers_copy.dart';
import '../model/answer_items.dart';
import '../model/ask_context.dart';
import '../model/move_inputs.dart';
import '../model/next_move.dart';
import '../model/recap_variant.dart' show RecapVariant, recapMood, recapReaction;
import '../model/time_decisions.dart';
import '../model/weak_chapters.dart';
import '../move_nav.dart';
import '../recap/recap_flow.dart' show RecapPlaceholder;
import '../recap/recap_mobi.dart' show RecapMobi;
import '../widgets/analysis_block.dart';
import '../widgets/answer_reactor.dart';
import '../widgets/evidence_link.dart';
import '../widgets/fold_section.dart';
import '../widgets/mistake_row.dart';
import '../widgets/next_move_panel.dart';
import '../widgets/result_head.dart';
import '../widgets/result_space.dart';
import '../widgets/weak_chapters_list.dart';
import 'answer_row.dart';
import '../../pro_nudge/pro_nudge.dart' show ProNudgeRow, ProNudgeSurface;
import 'full_sections.dart';
import 'replay_section.dart';
import 'summary_section.dart';
import 'swot_section.dart';
import 'time_section.dart';

/// `/result/:attemptId` (v15 spec 3, the restore of N12): the result of a full or NTA-style mock as the owner wants
/// it. (1) The reveal: Mobi's reaction beside the score with its denominator, the marks bar and the one line of what
/// happened. (2) The one next move, chosen by stated rules, as the foot's volt key, with why, what a repair gives and
/// what it costs before paying. (3) The full analysis, OPEN, in reading order: the answer sheet, where your marks went
/// (one list of the chapters that cost marks, then how the marks split), time, strengths and weaknesses, scores by
/// session. (4) The mistakes in repair order, each with paper, date and 12-hour time, its repair and Check it held
/// inline, and a saved repair opening free. What the 17 Oct fold-up put behind links (the rule and its proof) stays one
/// fold below. Reopening an old result always lands here, never on the seal. [focusQuestion] opens one answer (the
/// question tiles of the recap link here).
class FullResultScreen extends ConsumerStatefulWidget {
  const FullResultScreen({super.key, required this.attemptId, this.focusQuestion});

  final String attemptId;
  final int? focusQuestion;

  @override
  ConsumerState<FullResultScreen> createState() => _FullResultScreenState();
}

class _FullResultScreenState extends ConsumerState<FullResultScreen> {
  final Set<String> _open = {};
  final Map<String, GlobalKey> _keys = {};
  bool _seeded = false;

  /// True once the page has scrolled under the bar: a hairline then marks the bar's lower edge,
  /// so a heading that scrolls up to it never sits flush on the title.
  bool _scrolled = false;

  /// The first mistakes show; "Show all" opens the rest. The blanks and the right answers sit folded under one row each.
  static const int _firstRows = 4;
  bool _showAll = false;
  bool _blankOpen = false;
  bool _correctOpen = false;

  /// The reader Mobi beside the answer sheet's heading, and the one-act-per-2.5-s reaction to the answer the student
  /// opens. Left out of the tree on an NTA result.
  final MobiController _mobi = MobiController();
  late final AnswerReactor _reactor = AnswerReactor(_mobi);

  /// Whether the reader Mobi may act on an opened answer (full Celebrations): set by the build.
  bool _mobiAllowed = false;

  /// The answers as last built, so a bubble of the map can find its row.
  AnswerGroups? _groups;

  /// The mistakes in the order this page shows them, so a link knows whether its row sits past "Show all".
  List<String> _wrongOrder = const [];

  @override
  void initState() {
    super.initState();
    scheduleMicrotask(() => ref.read(resultActionsProvider).markSeen(widget.attemptId));
  }

  @override
  void dispose() {
    _reactor.dispose();
    _mobi.dispose();
    _replayFilter.dispose();
    super.dispose();
  }

  /// Opens [item] where it lives (a mistake past the first rows, the folded blanks, or the folded right answers) and
  /// scrolls it under the bar.
  void _reveal(AnswerItem item, {bool animate = true}) {
    var folded = false;
    setState(() {
      _open.add(item.qid);
      switch (item.verdict) {
        case Verdict.wrong:
          if (_wrongOrder.indexOf(item.qid) >= _firstRows) _showAll = true;
        case Verdict.blank:
          folded = !_blankOpen;
          _blankOpen = true;
        case Verdict.correct:
          folded = !_correctOpen;
          _correctOpen = true;
        case Verdict.held:
          break;
      }
    });
    void scrollTo() {
      if (!mounted) return;
      final ctx = _keys[item.qid]?.currentContext;
      if (ctx == null || !ctx.mounted) return;
      Scrollable.ensureVisible(
        ctx,
        alignment: 0.08,
        duration: animate ? Motion.of(context, Motion.emphasizedDuration) : Duration.zero,
        curve: Motion.emphasized,
      );
    }

    WidgetsBinding.instance.addPostFrameCallback((_) => scrollTo());
    // A row inside a fold arrives while the fold is still opening: look again once it has settled.
    if (folded) Future<void>.delayed(Motion.of(context, FoldSection.openDuration) + const Duration(milliseconds: 30), scrollTo);
  }

  /// A bubble of the answer map, a Q chip or a "Show me" was tapped (1-based).
  void _openFromMap(int number) {
    final groups = _groups;
    if (groups == null) return;
    AnswerItem? target;
    for (final a in groups.all) {
      if (a.number == number) target = a;
    }
    if (target == null) return;
    unawaited(ref.read(hapticsProvider).tick());
    _reveal(target);
  }

  /// An answer was opened after the page was up: the reader Mobi turns to it (full Celebrations only, never under
  /// reduced motion).
  void _onOpened(AnswerItem item) {
    _reactor.react(item.verdict, row: _keyFor(item.qid), allowed: _mobiAllowed && !Motion.reduced(context));
  }

  GlobalKey _keyFor(String qid) => _keys.putIfAbsent(qid, GlobalKey.new);

  /// The "Every answer you changed" heading of Time and decisions.
  final GlobalKey _changesKey = GlobalKey();

  /// The head of the mistakes list: where the reel's "Go through what you missed" lands.
  final GlobalKey _mistakesKey = GlobalKey();

  /// The Replay, and the chip it has on (a ledger row's "See it in the replay" sets both).
  final GlobalKey _replayKey = GlobalKey();
  final ValueNotifier<String> _replayFilter = ValueNotifier<String>(ReplayChip.all);

  /// Scrolls [key] under the bar (the time part is open, so there is nothing to unfold first).
  void _scrollTo(GlobalKey key, {double alignment = 0.08}) {
    final ctx = key.currentContext;
    if (!mounted || ctx == null || !ctx.mounted) return;
    unawaited(Scrollable.ensureVisible(ctx, alignment: alignment, duration: Motion.of(context, Motion.emphasizedDuration), curve: Motion.emphasized));
  }

  /// A ledger row's "See it in the replay": the Replay with that group's chip on, under the bar.
  void _seeInReplay(String group) {
    _replayFilter.value = group;
    _scrollTo(_replayKey, alignment: 0.04);
  }

  /// The Lab's "See every change": Time and decisions' list of changes, under the bar.
  void _seeChanges() => _scrollTo(_changesKey);

  /// "Play it back" (D29): this paper's reel over the whole app. Its one closing key goes where the same key goes from
  /// Today: the repair of the costliest chapter, the mistakes below, or the next mock of this subject.
  void _playBack(PaperReelModel reel, {required String subjectId, required bool isNta}) {
    unawaited(ref.read(hapticsProvider).tick());
    // Played from here: Today does not offer the same reel again.
    unawaited(ref.read(reelSeenProvider.notifier).mark(widget.attemptId));
    unawaited(PaperReel.open(context, model: reel, onNextMove: (m) => _reelMove(reel, m, subjectId: subjectId, isNta: isNta)));
  }

  void _reelMove(PaperReelModel reel, ReelNextMove m, {required String subjectId, required bool isNta}) {
    if (!mounted) return;
    switch (m.kind) {
      case ReelMoveKind.repairChapter:
        final wrong = {for (final q in reel.questions) if (q.result == ReelResult.wrong) q.qid};
        final open = [for (final q in m.qids) if (wrong.contains(q)) q];
        if (open.isEmpty) {
          _scrollTo(_mistakesKey);
        } else {
          _go(Uri(path: AppRoutes.reviewRepair(widget.attemptId, open.first), queryParameters: {'count': '${open.length}'}).toString());
        }
      case ReelMoveKind.reviewMistakes:
        _scrollTo(_mistakesKey);
      case ReelMoveKind.nextMock:
        _go(Uri(path: AppRoutes.practiceSetup(isNta ? 'nta' : 'full'), queryParameters: {'subject': subjectId}).toString());
    }
  }

  /// A linked question (the recap's tiles) opens on arrival.
  void _seed(AnswerGroups groups) {
    if (_seeded) return;
    _seeded = true;
    final focus = widget.focusQuestion;
    if (focus == null) return;
    for (final a in groups.all) {
      if (a.number == focus) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) _reveal(a, animate: false);
        });
        return;
      }
    }
  }

  void _toggle(String qid) => setState(() => _open.contains(qid) ? _open.remove(qid) : _open.add(qid));

  void _go(String location) => unawaited(context.push(location));

  void _back() {
    if (context.canPop()) {
      context.pop();
    } else {
      context.go(AppRoutes.review);
    }
  }

  /// One answer row, as a mistake (with its summary face and its repair inline) when [status] is given.
  Widget _row(
    AnswerItem item, {
    required bool keysOff,
    required RecapData data,
    required String attemptId,
    MistakeStatus? status,
    String? cohort,
    String? cost,
    String? when,
  }) {
    final lab = data.detail?.lab;
    final letters = item.question.options;
    String? letter(int? i) => i == null || i < 0 ? null : (i < letters.length ? letters[i].key : letterOf(i));
    final yours = letter(item.given);
    // The free part shows the key as the key rule allows. The try before the key belongs to the repair, which opens on it,
    // so a mistake here has one action (D15), never a second "try" step beside Repair.
    final answer = keysOff || item.verdict == Verdict.held ? null : letter(item.keyIndex);
    final open = _open.contains(item.qid);
    return KeyedSubtree(
      key: _keyFor(item.qid),
      child: AnswerRow(
        item: item,
        expanded: open,
        onToggle: () => _toggle(item.qid),
        keysOff: keysOff,
        onOpened: () => _onOpened(item),
        others: lab?.othersFor(item.qid),
        othersTitle: lab?.labels.othersTitle,
        trap: lab?.traps?.tagFor(item.qid),
        // A wrong answer carries Ask Mobi as the quiet line under its repair (ASK-MOBI-1018 3).
        onAsk: item.verdict == Verdict.wrong ? () => openAskMobi(context, askContextOfAnswer(item, attemptId: attemptId)) : null,
        onRepair: item.repairable
            ? () => _go(Uri(path: AppRoutes.reviewRepair(attemptId, item.qid), queryParameters: const {'count': '1'}).toString())
            : null,
        summary: status == null
            ? null
            : MistakeSummary(
                number: item.number,
                chapter: item.question.chapter,
                when: when,
                stem: item.question.question,
                yours: yours,
                answer: answer,
                cohort: cohort,
                status: status,
                expanded: open,
                onChip: chipActionOf(
                  status,
                  onRepair: () => _go(Uri(path: AppRoutes.reviewRepair(attemptId, item.qid), queryParameters: const {'count': '1'}).toString()),
                  onOpenSaved: () => _go(AppRoutes.reviewRepair(attemptId, item.qid)),
                ),
              ),
        summarySemantics: status == null
            ? null
            : MistakeSummary.spoken(number: item.number, chapter: item.question.chapter, when: when, yours: yours, answer: answer, cohort: cohort, status: status),
        repair: status == null
            ? null
            : MistakeRepairEntry(
                number: item.number,
                status: status,
                letter: yours,
                cost: cost,
                onRepair: status == MistakeStatus.keyHeld || status == MistakeStatus.corrected
                    ? null
                    : () => _go(Uri(path: AppRoutes.reviewRepair(attemptId, item.qid), queryParameters: const {'count': '1'}).toString()),
                onOpenSaved: () => _go(AppRoutes.reviewRepair(attemptId, item.qid)),
              ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final id = widget.attemptId;
    final data = ref.watch(recapDataProvider(id));
    final model = data.model;
    final attempt = data.attempt;
    final progress = model == null ? null : ref.watch(recapProgressProvider(id)).value;

    final Widget body;
    ResultMove? footMove;
    if (model == null || attempt == null) {
      body = RecapPlaceholder(data: data, attemptId: id, page: true, onRetry: () => retryRecapData(ref, id));
    } else {
      // Time and decisions: read once the detail (and so every answer review) is known, because the
      // marks effect of a change leaves held and corrected questions out. The server's finished read
      // (`lab.time`, slice 2) is shown as sent; an older server's result is read here.
      final detail = data.detail;
      final questionById = {for (final q in attempt.questions) q.id: q};
      final timeRead = detail == null
          ? null
          : resolveTimeDecisions(
              attempt,
              serverTime: detail.lab?.time,
              answerReviews: {for (final e in detail.answerReviews.entries) e.key: e.value.state},
              letterOf: (qid, i) {
                final options = questionById[qid]?.options ?? const [];
                return i >= 0 && i < options.length ? options[i].key : String.fromCharCode(65 + i);
              },
            );
      // The Replay (slice 2): the paper as a clock, left out when the record holds too few answers to say anything (D17:
      // a fast blank paper replays as grey boxes only).
      final labReplay = model.isHeld ? null : detail?.lab?.replay;
      final replay = labReplay != null && ReplaySection.worthShowing(labReplay) ? labReplay : null;
      final rows = moveAnalysisOf(attempt);
      final state = MoveState.watch(ref, attemptId: id, wrongQids: [for (final r in rows.mistakes) r.qid]);
      final groups = buildAnswerGroups(
        attempt,
        detail: data.detail,
        repairedIds: state.repaired,
        candidateIds: {for (final c in model.candidates) c.questionId},
        time: timeRead,
      );
      _seed(groups);
      _groups = groups;
      final keysOff = model.keysUnavailable || data.detail == null;
      // The Lab's parts ride on the same read: the repair order, the Rule book's link, the rule check in Prove, and
      // Across your mocks.
      final lab = model.isHeld ? null : detail?.lab;
      final reviews = moveReviewsOf(detail);
      final order = moveOrderOf(detail?.lab?.repairOrder);
      final now = ref.watch(nowProvider)();
      final move = nextMove(
        analysis: rows,
        reviews: reviews,
        order: order,
        repaired: state.repaired,
        checks: state.checks,
        aiCredits: state.aiCredits,
        practiceCredits: state.practiceCredits,
        isPremium: state.isPro,
        mode: attempt.mode,
        subjectName: model.subjectName,
        labReady: detail?.lab != null,
        hour: now.hour,
      );
      footMove = move;
      // Already the student's own clock (see [RecapModel.recordedAt]): no second conversion, and "today" is theirs too.
      final clock = ref.watch(reviewClockProvider);
      final receipt = receiptLine(
        subjectName: model.subjectName,
        mode: attempt.mode,
        at: model.recordedAt,
        duration: timeOnPaper(attempt),
        now: clock.now(),
      );
      final when = paperWhen(clock, model.mockLabel, model.recordedAt);
      final byQid = {for (final a in groups.all) a.qid: a};
      final wrongRows = inRepairOrder(rows.mistakes.where((r) => !keyHeld(reviews, r.qid)).toList(), order);
      final wrong = [
        for (final r in wrongRows)
          if (byQid[r.qid] case final a? when a.verdict == Verdict.wrong) a,
      ];
      _wrongOrder = [for (final a in wrong) a.qid];
      final shown = _showAll ? wrong : wrong.take(_firstRows).toList();
      final repairCost = repairCostLine(state.aiCredits);
      final m = rows.marks;
      final swot = data.detail?.swot;
      final weak = weakChapters(rows, reviews: reviews);
      final timeReady = timeRead != null && timeRead.isReady;
      // Where the lost marks went, chapter by chapter, from this paper's own counts (none while the keys are held).
      final askLines = model.isHeld || model.keysUnavailable ? const <String>[] : mockLostLines(model.chapters, lost: model.breakdown.lost);
      // The paper played back (D29), always here: built from the paper's own record, nothing while its keys are held.
      final reel = model.isHeld || detail == null ? null : PaperReelModel.tryFrom(detail, subjectLabel: model.subjectName);
      final hasTime = replay != null || timeReady || lab != null;
      final hasProof = lab?.rules != null || lab?.ruleCheck != null || lab?.later != null || lab?.acrossMocks != null;

      // Mobi's reveal comes from the one reaction table (never on an NTA paper, never sleepy). It acts on the first open
      // only; a reopened result keeps Mobi at rest beside the same line. The reader Mobi by the answer sheet follows it.
      final mode = ref.watch(celebrationModeProvider);
      final reaction = recapReaction(variant: model.variant, mode: mode, isNta: model.isNta, hour: now.hour);
      _mobiAllowed = reaction != null && mode == CelebrationMode.full;
      final arrival = widget.focusQuestion == null && progress == null;
      Widget? revealMobi;
      if (reaction != null) {
        final higher = model.variant == RecapVariant.higher && mode == CelebrationMode.full;
        revealMobi = RecapMobi(
          pose: arrival && !higher ? RecapMobi.poseFor(reaction.act) : MobiPose.rest,
          size: ResultSpace.mobi,
          mood: arrival ? recapMood(model.variant, reaction) : null,
          // A higher result cheers once the figure has landed.
          actAfter: arrival && higher ? ResultHead.arrivalDuration : null,
        );
      }

      // The attempts of this paper's format, oldest first: the line "Scores by session" draws.
      final all = ref.watch(reviewInputsProvider).attempts.value ?? const [];
      final series = [
        for (final s in trendSeries(all))
          if (s.points.any((p) => p.attemptId == id)) s,
      ];

      Widget row(AnswerItem a, {MistakeStatus? status}) => _row(
        a,
        keysOff: keysOff,
        data: data,
        attemptId: id,
        status: status,
        cohort: status == null ? null : cohortLine(order, a.qid),
        cost: repairCost,
        when: status == null ? null : when,
      );

      // One authored entrance, riding the page's own transition: the figure first, then the next move, then the
      // analysis. A page that is already up never moves, and content that loads after it has landed is simply there.
      var turn = 0;
      Widget item(Widget child) => MmStaggerItem(index: turn++, child: child);
      // Built in full (not lazily), so a linked question can be scrolled into view.
      body = NotificationListener<ScrollNotification>(
        onNotification: (n) {
          if (n.depth != 0) return false;
          final scrolled = n.metrics.pixels > 4;
          if (scrolled != _scrolled) setState(() => _scrolled = scrolled);
          return false;
        },
        child: SingleChildScrollView(
          // The app owns this scroll, so it bounces (F3) instead of Android's stretch.
          physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
          padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s12, MmSpace.gutter, MmSpace.s32),
          child: MmStagger(
            driver: MmStaggerDriver.route,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (data.stale && data.fetchedAt != null) ...[
                  InlineBanner(message: ResultCopy.lastLoaded(ref.watch(reviewClockProvider).local(data.fetchedAt!)), tone: BannerTone.offline, compact: true),
                  const SizedBox(height: MmRhythm.item),
                ],
                if (ref.watch(celebrationControllerProvider.select((s) => s.byScope[CelebrationScope.result(id)]?.showsMoment ?? false))) ...[
                  // A moment the rhythm module fired for this result; nothing is reserved without one.
                  CelebrationSlot(scope: CelebrationScope.result(id)),
                  const SizedBox(height: MmSpace.s16),
                ],
                // The reveal: what happened, with Mobi.
                item(
                  model.isHeld
                      ? _HeldHead(receipt: receipt, count: model.heldCount, notice: keyNotice(reviews, (q) => byQid[q]?.number))
                      : ResultHead(
                          receipt: receipt,
                          marks: m,
                          scored: model.marks,
                          max: model.maxMarks,
                          costliest: costliestLine(rows, reviews: reviews),
                          notice: keyNotice(reviews, (q) => byQid[q]?.number),
                          arrival: arrival,
                          // The paper's subject object stands beside the figure, still: one art piece, no loop.
                          beside: SubjectEmblem(subject: model.subjectId, size: ResultSpace.emblem, framed: false, animate: false),
                          mobi: revealMobi,
                        ),
                ),
                ...annotations(context, model, data, corrected: false, onRetry: () => ref.read(attemptDetailProvider(id).notifier).restart()),
                // One quiet line under the marks: Mobi opens on where this paper's lost marks went, free.
                if (askLines.isNotEmpty)
                  item(
                    Align(
                      alignment: Alignment.centerLeft,
                      child: AskMobiLink(
                        label: askMobiAboutMock,
                        note: AskSheetCopy.free,
                        onTap: () => openAskMobi(
                          context,
                          AskMobiContext.mock(label: model.ordinal == null ? 'This mock' : 'Mock ${model.ordinal}', attemptId: id, lines: askLines),
                        ),
                      ),
                    ),
                  ),
                // A paper that has just earned a badge says so once, in one compact row (BADGES-REFINE-1018 3). It draws nothing,
                // and takes no space, for a paper that earned none or a badge already shown.
                BadgeEarnedRow(attemptId: id, completedAt: attempt.completedAt),
                // The one next move.
                const SizedBox(height: MmSpace.s24),
                item(
                  NextMovePanel(
                    move: move,
                    onAlt: switch (move.alt) {
                      final alt? => switch (MoveNav.forAlt(alt, attemptId: id, subject: model.subjectId, mock: true)) {
                        final to? => () => _go(to),
                        null => null,
                      },
                      null => null,
                    },
                  ),
                ),
                // The one Pro nudge on this page: nothing with PLAY_BILLING off or for a Pro student.
                ProNudgeRow(surface: ProNudgeSurface.result, attemptId: id, topGap: MmSpace.s8),
                if (progress != null) ...[
                  const SizedBox(height: MmSpace.s12),
                  // A quiet text link, flush with the page's gutter, under the one next move: what happened
                  // and what to do come first, this only says where the recap was left (v13 critic).
                  Align(
                    alignment: Alignment.centerLeft,
                    child: EvidenceLink(
                      label: ResultCopy.continueRecap(progress),
                      icon: LucideIcons.rotateCcw,
                      onTap: () => context.go(AppRoutes.resultRecap(id, progress)),
                    ),
                  ),
                ],
                // The full analysis, open, in reading order.
                const SizedBox(height: MmSpace.group),
                Semantics(header: true, child: Text(LayersCopy.analysis, style: type.title.copyWith(fontSize: 24, height: 30 / 24))),
                const SizedBox(height: MmSpace.s4),
                Text(LayersCopy.analysisLine, style: type.small.copyWith(color: colors.ink2)),
                const SizedBox(height: MmSpace.s20),
                // 1. The answer sheet.
                AnalysisBlock(
                  first: true,
                  title: LayersCopy.sectionAnswerSheet,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      ResultAnswersMap(
                        model: model,
                        onOpen: _openFromMap,
                        onPeek: (_) => unawaited(ref.read(hapticsProvider).tick()),
                        mobi: reaction == null ? null : _mobi,
                        arrival: arrival,
                      ),
                      // The same sheet in motion, one quiet row: the reel's length beside it.
                      if (reel != null) ...[
                        const SizedBox(height: MmSpace.s16),
                        PaperReelResultEntry(seconds: reel.seconds, onPlay: () => _playBack(reel, subjectId: model.subjectId, isNta: model.isNta)),
                      ],
                    ],
                  ),
                ),
                // 2. Where your marks went: the one list of the chapters that cost marks, then how the marks split.
                if (!model.isHeld)
                  AnalysisBlock(
                    title: LayersCopy.sectionMarksWent,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        WeakChaptersList(
                          chapters: weak,
                          onPractise: (c) => _go(MoveNav.practise(subject: model.subjectId, chapter: c.chapter)),
                        ),
                        if (detail != null && (lab != null || m.gap > 0)) ...[
                          const SizedBox(height: MmSpace.s24),
                          whereSection(
                            context,
                            model,
                            lab: lab,
                            title: LayersCopy.marksSplitTitle,
                            onOpenQuestion: _openFromMap,
                            onSeeChanges: timeReady ? _seeChanges : null,
                            onSeeInReplay: replay == null ? null : _seeInReplay,
                          ),
                        ],
                      ],
                    ),
                  )
                else
                  AnalysisBlock(title: LayersCopy.sectionMarksWent, child: Text(ResultCopy.heldBody(model.heldCount), style: type.body.copyWith(color: colors.ink2))),
                // 3. Time: the paper's clock, time per question against the paper's pace, the changed answers.
                if (hasTime)
                  AnalysisBlock(
                    title: LayersCopy.sectionTime,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (replay != null)
                          KeyedSubtree(
                            key: _replayKey,
                            child: ReplaySection(replay: replay, onOpenQuestion: _openFromMap, numbersOf: detail!.lab!.numbersOf, filter: _replayFilter),
                          ),
                        if (timeReady) ...[
                          if (replay != null) const SizedBox(height: MmRhythm.section),
                          TimeSection(read: timeRead, onOpenQuestion: _openFromMap, changesKey: _changesKey),
                        ],
                        // The traps the student keeps meeting across mocks, behind a disclosure: nothing is read until
                        // it opens.
                        if (lab != null) ...[const SizedBox(height: MmRhythm.section), const TrapsMeetView()],
                      ],
                    ),
                  ),
                // 4. Strengths and weaknesses: the plan and the read of the paper, written by the server from stored
                // records, under plain headings.
                if (swot != null && swot.isVisible)
                  AnalysisBlock(
                    title: LayersCopy.sectionStrengths,
                    child: SwotSection(attemptId: id, swot: swot, onOpenQuestion: _openFromMap, bare: true, readTitle: LayersCopy.strengthsRead),
                  ),
                // 5. Scores by session: this paper's format, session by session.
                if (series.isNotEmpty) AnalysisBlock(title: LayersCopy.sectionScores, child: TrendSection(series: series)),
                // The rule and its proof stay one tap away.
                if (hasProof)
                  FoldSection(
                    id: _Folds.proof,
                    title: LayersCopy.foldProof,
                    teaser: LayersCopy.ruleTeaser(lab?.rules?.active?.text),
                    builder: (context) => Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // The Rule book: every rule from the student's repairs and from how they take papers.
                        if (lab?.rules case final rules?) LabRulesLink(countLabel: rules.countLabel, activeRule: rules.active?.text),
                        // Prove: the rule chosen before this mock, checked on its record.
                        if (lab?.ruleCheck case final check?) ...[const SizedBox(height: MmRhythm.group), RuleCheckView(check: check)],
                        // Same mistakes later: which wrong answers come back in Revise, and when.
                        if (lab?.later case final later?) ...[const SizedBox(height: MmRhythm.group), SameMistakesLaterView(later: later)],
                        // Across your mocks: the record as it stood when this paper was taken.
                        if (lab?.acrossMocks case final across?) ...[
                          const SizedBox(height: MmRhythm.group),
                          AcrossMocksView(across: across, seenKey: 'attempt:$id'),
                        ],
                      ],
                    ),
                  ),
                // The mistakes, in repair order, each with its paper and time and its repair inline.
                const SizedBox(height: MmSpace.group),
                item(
                  Column(
                    key: _mistakesKey,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      MistakesHead(
                        count: wrong.length,
                        repairedCount: wrong.where((a) => state.repaired.contains(a.qid)).length,
                        cohort: order?.cohort ?? false,
                        nothingAnswered: m.answered == 0,
                      ),
                      const SizedBox(height: MmSpace.s8),
                      for (final a in shown) ...[
                        Divider(height: 1, thickness: 1, color: colors.line),
                        row(a, status: mistakeStatusOf(qid: a.qid, reviews: reviews, repaired: state.repaired, checks: state.checks, move: move)),
                      ],
                      if (wrong.length > _firstRows) ShowAllRow(count: wrong.length, open: _showAll, onTap: () => setState(() => _showAll = !_showAll)),
                      if (groups.held.isNotEmpty) ...[
                        const SizedBox(height: MmSpace.s16),
                        Text(LayersCopy.heldGroup(groups.held.length), style: type.label.copyWith(color: colors.ink2)),
                        for (final a in groups.held) ...[
                          Divider(height: 1, thickness: 1, color: colors.line),
                          row(a, status: MistakeStatus.keyHeld),
                        ],
                      ],
                      if (groups.blank.isNotEmpty)
                        LeftBlankRow(
                          count: groups.blank.length,
                          open: _blankOpen,
                          onTap: () => setState(() => _blankOpen = !_blankOpen),
                          children: [
                            for (final a in groups.blank) ...[Divider(height: 1, thickness: 1, color: colors.line), row(a)],
                          ],
                        ),
                      if (groups.correct.isNotEmpty)
                        RightAnswersRow(
                          count: groups.correct.length,
                          open: _correctOpen,
                          onTap: () => setState(() => _correctOpen = !_correctOpen),
                          children: [
                            for (final a in groups.correct) ...[Divider(height: 1, thickness: 1, color: colors.line), row(a)],
                          ],
                        ),
                      Divider(height: 1, thickness: 1, color: colors.line),
                    ],
                  ),
                ),
                // The next fresh paper: the bank's promise, said plainly, with a quiet key.
                const SizedBox(height: MmSpace.s32),
                Text(LayersCopy.freshTitle, style: type.cardTitle.copyWith(fontSize: 16)),
                const SizedBox(height: MmSpace.s4),
                Text(LayersCopy.freshLine, style: type.small.copyWith(color: colors.ink2)),
                const SizedBox(height: MmSpace.s12),
                // The screen's secondary is the same underlined text action as the next move's way out, not a raised pill.
                TextAction(
                  label: LayersCopy.freshKey,
                  onTap: () => _go(Uri(path: AppRoutes.practiceSetup(model.isNta ? 'nta' : 'full'), queryParameters: {'subject': model.subjectId}).toString()),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final move = footMove;
    return PopScope(
      canPop: context.canPop(),
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) context.go(AppRoutes.review);
      },
      child: Scaffold(
        backgroundColor: colors.ground,
        body: SafeArea(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: MmSpace.contentMaxWidth),
              child: Column(
                children: [
                  _TopBar(
                    title: model?.mockLabel ?? '',
                    subtitle: model?.subjectName,
                    onBack: _back,
                    // One way back into the recap: "Continue" while it is unfinished, "Replay" once it is done.
                    onReplay: model == null || progress != null ? null : () => context.go(AppRoutes.resultRecap(id, 1)),
                  ),
                  AnimatedOpacity(
                    opacity: _scrolled ? 1 : 0,
                    duration: Motion.of(context, const Duration(milliseconds: 160)),
                    child: Divider(height: 1, thickness: 1, color: colors.line),
                  ),
                  // A row that scrolls up to the bar dissolves into the page's own ground over the
                  // bar's last 24 dp, so no line of text is ever cut mid-letter under the title.
                  Expanded(
                    child: Stack(
                      children: [
                        Positioned.fill(child: body),
                        Positioned(
                          left: 0,
                          right: 0,
                          top: 0,
                          height: _scrimHeight,
                          child: IgnorePointer(
                            child: AnimatedOpacity(
                              opacity: _scrolled ? 1 : 0,
                              duration: Motion.of(context, const Duration(milliseconds: 160)),
                              child: DecoratedBox(
                                decoration: BoxDecoration(
                                  gradient: LinearGradient(
                                    begin: Alignment.topCenter,
                                    end: Alignment.bottomCenter,
                                    colors: [colors.ground, colors.ground, colors.ground.withValues(alpha: 0)],
                                    stops: const [0, 0.4, 1],
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                        if (move != null) const BarFade(),
                      ],
                    ),
                  ),
                  // The one volt on the screen: the next move, in thumb reach, with its cost and balance under it.
                  if (move != null && model != null)
                    ResultFoot(
                      primary: ResultFootAction(
                        move.label,
                        () => _go(MoveNav.forMove(move, attemptId: id, subject: model.subjectId)),
                        note: LayersCopy.footNote(move.cost),
                      ),
                      // No "Finish for now" on a mock; its one quiet key opens Your papers on this paper's row (G20).
                      showFinish: true,
                      onSeePaper: () => context.go(yourPapersLocation(id)),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The folds' names in the session's memory.
abstract final class _Folds {
  static const proof = 'mock.proof';
}

/// Layer 1 while an answer key is being re-checked: the figure is not final, so it is not shown; the receipt, the
/// plain line and the notice are.
class _HeldHead extends StatelessWidget {
  const _HeldHead({required this.receipt, required this.count, this.notice});

  final String receipt;
  final int count;
  final String? notice;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ResultReceipt(text: receipt),
        const SizedBox(height: MmSpace.s12),
        Semantics(header: true, child: Text(ResultCopy.heldTitle, style: type.headline)),
        const SizedBox(height: MmSpace.s6),
        Text(ResultCopy.heldBody(count), style: type.body.copyWith(color: colors.ink2)),
        if (notice != null) ...[
          const SizedBox(height: MmSpace.s16),
          ResultNotice(text: notice!),
        ],
      ],
    );
  }
}

/// How tall the fade under the bar is while the page is scrolled.
const double _scrimHeight = 24;

class _TopBar extends StatelessWidget {
  const _TopBar({required this.title, required this.onBack, this.subtitle, this.onReplay});

  final String title;

  /// The subject, a second line under the paper's name.
  final String? subtitle;
  final VoidCallback onBack;
  final VoidCallback? onReplay;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    // The paper's name is one line ("Mock 7") and its subject a second, smaller one, so the title
    // never wraps against "Replay recap". A screen reader hears both as one heading. The bar is
    // 56 dp.
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 56),
      child: Row(
        children: [
          const SizedBox(width: MmSpace.s4),
          MmPressable(
            onTap: onBack,
            semanticsLabel: MaterialLocalizations.of(context).backButtonTooltip,
            focusRadius: MmRadius.pillAll,
            builder: (context, pressed, _) => SizedBox.square(
              dimension: MmTarget.min,
              child: Icon(LucideIcons.arrowLeft, size: 22, color: colors.ink),
            ),
          ),
          const SizedBox(width: MmSpace.s4),
          Expanded(
            child: Semantics(
              header: true,
              label: subtitle == null ? title : '$title, $subtitle',
              excludeSemantics: true,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(title, style: context.mmType.title.copyWith(fontSize: 20), maxLines: 1, overflow: TextOverflow.ellipsis),
                  if (subtitle != null) Text(subtitle!, style: context.mmType.caption.copyWith(color: colors.ink2), maxLines: 1, overflow: TextOverflow.ellipsis),
                ],
              ),
            ),
          ),
          if (onReplay != null) KeyButton.quiet(label: ResultCopy.replay, onPressed: onReplay),
          const SizedBox(width: MmSpace.s4),
        ],
      ),
    );
  }
}
