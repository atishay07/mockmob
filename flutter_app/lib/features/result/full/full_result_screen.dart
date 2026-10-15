import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/models/models.dart' show ReplayChip;
import '../../../core/motion/motion.dart';
import '../../../core/repositories/repositories.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../rules/widgets/across_mocks_view.dart';
import '../../rules/widgets/rule_check_view.dart';
import '../../rhythm/rhythm.dart' show CelebrationMode, CelebrationScope, CelebrationSlot, celebrationControllerProvider, celebrationModeProvider;
import '../../review/data/review_providers.dart' show reviewClockProvider;
import '../copy.dart';
import '../data/result_providers.dart';
import '../model/answer_items.dart';
import '../model/recap_variant.dart' show recapReaction;
import '../model/time_decisions.dart';
import '../recap/recap_flow.dart' show RecapPlaceholder;
import '../widgets/answer_reactor.dart';
import '../widgets/evidence_link.dart';
import 'full_sections.dart';
import 'replay_section.dart';
import 'summary_section.dart';
import 'swot_section.dart';
import 'time_section.dart';

/// `/result/:attemptId` (spec 5.7): the complete, readable result without the ritual. Reopening
/// an old result always lands here, never on the seal. [focusQuestion] opens one answer (the
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

  /// The "Not attempted" group is folded until opened (or until a link lands inside it).
  bool _blankOpen = false;

  /// The reader Mobi beside the answers heading, and the one-act-per-2.5-s reaction to the
  /// answer the student opens. Left out of the tree on an NTA result.
  final MobiController _mobi = MobiController();
  late final AnswerReactor _reactor = AnswerReactor(_mobi);

  /// The answers as last built, so a bubble of the map can find its row.
  AnswerGroups? _groups;

  /// Whether Mobi may act on an opened answer (full Celebrations, not sleepy): set by the build.
  bool _mobiAllowed = false;

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

  /// A bubble of the answer map was tapped: open that row and scroll it under the bar. A blank
  /// one sits in the folded group, so the group opens on it first.
  void _openFromMap(int number) {
    final groups = _groups;
    if (groups == null) return;
    AnswerItem? target;
    for (final a in groups.all) {
      if (a.number == number) target = a;
    }
    if (target == null) return;
    unawaited(ref.read(hapticsProvider).tick());
    final item = target;
    // A blank row inside the folded group mounts already open, so it never sees itself go from
    // folded to open: Mobi is told here instead.
    final foldedBlank = item.verdict == Verdict.blank && !_blankOpen;
    setState(() {
      _open.add(item.qid);
      if (item.verdict == Verdict.blank) _blankOpen = true;
    });
    void scrollTo() {
      if (!mounted) return;
      final ctx = _keys[item.qid]?.currentContext;
      if (ctx == null || !ctx.mounted) return;
      Scrollable.ensureVisible(
        ctx,
        alignment: 0.08,
        duration: Motion.of(context, Motion.emphasizedDuration),
        curve: Motion.emphasized,
      );
    }

    WidgetsBinding.instance.addPostFrameCallback((_) => scrollTo());
    // A row inside the folded group arrives while that group's height is still opening: look
    // again once it has settled.
    if (item.verdict == Verdict.blank) {
      Future<void>.delayed(Motion.of(context, Motion.card) + const Duration(milliseconds: 30), () {
        scrollTo();
        if (foldedBlank && mounted) _onOpened(item, allowed: _mobiAllowed);
      });
    }
  }

  /// An answer was opened after the page was up: Mobi turns to it (full Celebrations only, never
  /// under reduced motion).
  void _onOpened(AnswerItem item, {required bool allowed}) {
    _reactor.react(item.verdict, row: _keyFor(item.qid), allowed: allowed && !Motion.reduced(context));
  }

  GlobalKey _keyFor(String qid) => _keys.putIfAbsent(qid, GlobalKey.new);

  /// The "Every answer you changed" heading of Time and decisions.
  final GlobalKey _changesKey = GlobalKey();

  /// The Replay, and the chip it has on (a ledger row's "See it in the replay" sets both).
  final GlobalKey _replayKey = GlobalKey();
  final ValueNotifier<String> _replayFilter = ValueNotifier<String>(ReplayChip.all);

  /// A ledger row's "See it in the replay": the Replay with that group's chip on, under the bar.
  void _seeInReplay(String group) {
    _replayFilter.value = group;
    final ctx = _replayKey.currentContext;
    if (ctx == null || !ctx.mounted) return;
    unawaited(
      Scrollable.ensureVisible(
        ctx,
        alignment: 0.04,
        duration: Motion.of(context, Motion.emphasizedDuration),
        curve: Motion.emphasized,
      ),
    );
  }

  /// The Lab's "See every change": scroll Time and decisions' list of changes under the bar.
  void _seeChanges() {
    final ctx = _changesKey.currentContext;
    if (ctx == null || !ctx.mounted) return;
    unawaited(
      Scrollable.ensureVisible(
        ctx,
        alignment: 0.08,
        duration: Motion.of(context, Motion.emphasizedDuration),
        curve: Motion.emphasized,
      ),
    );
  }

  void _seed(AnswerGroups groups) {
    if (_seeded) return;
    _seeded = true;
    final focus = widget.focusQuestion;
    AnswerItem? target;
    if (focus != null) {
      for (final a in groups.all) {
        if (a.number == focus) target = a;
      }
    }
    target ??= groups.wrong.firstOrNull;
    if (target == null) return;
    _open.add(target.qid);
    // A linked blank question sits in the folded "Not attempted" group: open the group on it.
    if (target.verdict == Verdict.blank) _blankOpen = true;
    if (focus != null) {
      final qid = target.qid;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        final ctx = _keys[qid]?.currentContext;
        if (ctx != null && ctx.mounted) Scrollable.ensureVisible(ctx, alignment: 0.08);
      });
    }
  }

  void _toggle(String qid) => setState(() => _open.contains(qid) ? _open.remove(qid) : _open.add(qid));

  void _back() {
    if (context.canPop()) {
      context.pop();
    } else {
      context.go(AppRoutes.review);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final id = widget.attemptId;
    final data = ref.watch(recapDataProvider(id));
    final model = data.model;
    final attempt = data.attempt;
    final progress = model == null ? null : ref.watch(recapProgressProvider(id)).value;

    final Widget body;
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
      // The Replay (slice 2): the paper as a clock, the Lab's Find step, above Time and decisions.
      final replay = model.isHeld ? null : detail?.lab?.replay;
      final groups = buildAnswerGroups(
        attempt,
        detail: data.detail,
        repairedIds: {
          for (final r in ref.watch(repairLocalRecordsProvider).value ?? const <RepairLocalRecord>[])
            if (r.attemptId == id && r.isRepaired && r.isAcknowledged) r.questionId,
        },
        candidateIds: {for (final c in model.candidates) c.questionId},
        time: timeRead,
      );
      _seed(groups);
      _groups = groups;
      // The same reaction table as the recap decides whether Mobi is here at all (not on an NTA
      // result) and how it stands: late at night it sits sleepy and does not turn to answers.
      final mode = ref.watch(celebrationModeProvider);
      final reaction = recapReaction(variant: model.variant, mode: mode, isNta: model.isNta, hour: MobiRation.now().hour);
      final mobiOn = reaction != null;
      final mobiAllowed = reaction != null && mode == CelebrationMode.full && reaction.act != MobiAct.sleepy;
      _mobiAllowed = mobiAllowed;
      final keysOff = model.keysUnavailable || data.detail == null;
      // The Lab's slice 3 parts ride on the same read: the repair order and the Rule book's link in
      // the Repair step, the rule check in Prove, and Across your mocks at the Lab's end.
      final lab = model.isHeld ? null : detail?.lab;
      final fix = firstFixSection(context, model, lab: lab);
      // One authored entrance, riding the page's own transition: the figure first, then what
      // it means, then the sections in reading order. A page that is already up never moves,
      // and content that loads after the page has landed is simply there.
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
        // The first line sits 12 dp under the bar (audit X6): the recap link, then 8 to the
        // submitted line, then 12 to the figure.
        padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s12, MmSpace.gutter, MmSpace.s48),
        child: MmStagger(
          driver: MmStaggerDriver.route,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (data.stale && data.fetchedAt != null) ...[
                InlineBanner(message: ResultCopy.lastLoaded(ref.watch(reviewClockProvider).local(data.fetchedAt!)), tone: BannerTone.offline, compact: true),
                const SizedBox(height: MmRhythm.item),
              ],
              if (progress != null) ...[
                // A quiet text link, flush with the page's gutter: the score leads, this only says
                // where the recap was left.
                Align(
                  alignment: Alignment.centerLeft,
                  child: EvidenceLink(
                    label: ResultCopy.continueRecap(progress),
                    onTap: () => context.go(AppRoutes.resultRecap(id, progress)),
                  ),
                ),
                const SizedBox(height: MmSpace.s8),
              ],
              if (ref.watch(celebrationControllerProvider.select((s) => s.byScope[CelebrationScope.result(id)]?.showsMoment ?? false))) ...[
                // A moment the rhythm module fired for this result; nothing is reserved without one.
                CelebrationSlot(scope: CelebrationScope.result(id)),
                const SizedBox(height: MmSpace.s16),
              ],
              item(
                SummarySection(
                  model: model,
                  mobi: mobiOn ? _mobi : null,
                  mobiPose: reaction?.act == MobiAct.sleepy ? MobiPose.sleepy : MobiPose.read,
                  onOpenQuestion: _openFromMap,
                  arrival: widget.focusQuestion == null,
                  onPeek: (_) => unawaited(ref.read(hapticsProvider).tick()),
                ),
              ),
              ...annotations(context, model, data, onRetry: () => ref.read(attemptDetailProvider(id).notifier).refresh(force: true)),
              // The Mistake Lab right under the score (Mistake Lab v4, spec 3): where the marks went
              // (the server's ledger, or today's flow without one), then how the paper's time and
              // answer choices went, then the first fix. Time and decisions shows only with a usable
              // record: a paper without one shows no section rather than a "not recorded" line.
              if (!model.isHeld) ...[
                const SizedBox(height: MmRhythm.section),
                item(
                  whereSection(
                    context,
                    model,
                    lab: data.detail?.lab,
                    onOpenQuestion: _openFromMap,
                    onSeeChanges: timeRead != null && timeRead.isReady ? _seeChanges : null,
                    onSeeInReplay: replay == null ? null : _seeInReplay,
                  ),
                ),
              ],
              if (replay != null) ...[
                const SizedBox(height: MmRhythm.section),
                item(
                  KeyedSubtree(
                    key: _replayKey,
                    child: ReplaySection(
                      replay: replay,
                      onOpenQuestion: _openFromMap,
                      numbersOf: detail!.lab!.numbersOf,
                      filter: _replayFilter,
                    ),
                  ),
                ),
              ],
              if (timeRead != null && timeRead.isReady) ...[
                const SizedBox(height: MmRhythm.section),
                item(TimeSection(read: timeRead, onOpenQuestion: _openFromMap, changesKey: _changesKey)),
              ],
              if (fix != null) ...[const SizedBox(height: MmRhythm.section), item(fix)],
              // Prove (spec 4.8): the rule chosen before this mock, checked on its record.
              if (lab?.ruleCheck case final check?) ...[
                const SizedBox(height: MmRhythm.section),
                item(RuleCheckView(check: check)),
              ],
              // Across your mocks (spec 4.9): the record as it stood when this paper was taken.
              if (lab?.acrossMocks case final across?) ...[
                const SizedBox(height: MmRhythm.section),
                item(AcrossMocksView(across: across, seenKey: 'attempt:$id')),
              ],
              // "After this mock": the plan and the read of the paper, written by the server from
              // stored records. Nothing when the read is missing, unavailable or a practice set's.
              // It plays its own first-view entrance, so it is not one of the page's staggered items.
              if (data.detail?.swot case final swot? when swot.isVisible) ...[
                const SizedBox(height: MmRhythm.section),
                SwotSection(attemptId: id, swot: swot, onOpenQuestion: _openFromMap),
              ],
              const SizedBox(height: MmRhythm.section),
              item(
                answersSection(
                  context,
                  groups: groups,
                  keysOff: keysOff,
                  isOpen: _open.contains,
                  keyFor: _keyFor,
                  onToggle: _toggle,
                  model: model,
                  blankOpen: _blankOpen,
                  onToggleBlank: () => setState(() => _blankOpen = !_blankOpen),
                  onOpened: (item) => _onOpened(item, allowed: mobiAllowed),
                  lab: data.detail?.lab,
                ),
              ),
            ],
          ),
        ),
      ),
      );
    }

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
                    title: model?.title ?? '',
                    onBack: _back,
                    // One way back into the recap: "Continue" while it is unfinished, "Replay" once it is done.
                    onReplay: model == null || progress != null ? null : () => context.go(AppRoutes.resultRecap(id, 1)),
                  ),
                  AnimatedOpacity(
                    opacity: _scrolled ? 1 : 0,
                    duration: Motion.of(context, const Duration(milliseconds: 160)),
                    child: Divider(height: 1, thickness: 1, color: colors.line),
                  ),
                  Expanded(child: body),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _TopBar extends StatelessWidget {
  const _TopBar({required this.title, required this.onBack, this.onReplay});

  final String title;
  final VoidCallback onBack;
  final VoidCallback? onReplay;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    // The title wraps to more lines rather than losing its subject to an ellipsis: "Replay
    // recap" and the back key take the rest of the row. The bar is 56 dp for one line.
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
              child: Text(title, style: context.mmType.title.copyWith(fontSize: 20), maxLines: 3, overflow: TextOverflow.ellipsis),
            ),
          ),
          if (onReplay != null) KeyButton.quiet(label: ResultCopy.replay, onPressed: onReplay),
          const SizedBox(width: MmSpace.s4),
        ],
      ),
    );
  }
}
