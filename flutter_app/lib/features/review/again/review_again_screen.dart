import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/copy/formatters.dart' show formatDayMonth;
import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/repositories/attempts_repository.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/review_providers.dart';
import '../widgets/question_panel.dart';
import '../widgets/review_layout.dart';
import '../widgets/review_load_failure.dart';
import '../widgets/review_state_view.dart';
import '../widgets/try_first.dart';
import 'review_again_copy.dart';
import 'review_again_data.dart';
import 'review_again_entry.dart';
import 'review_again_local.dart';

/// `/review/again`: up to ten mistakes the student has already repaired, each answered before its
/// key shows and judged on the phone. Nothing here is sent to the server and nothing here changes
/// the repair record: the questions missed only order the next set. It builds from the attempts
/// and attempt details already on the phone, so it works offline for every question whose detail
/// is cached; a question without one is left out of the set, never shown broken.
class ReviewAgainScreen extends ConsumerStatefulWidget {
  const ReviewAgainScreen({super.key, this.seed});

  /// The keys (`attemptId/questionId`) of a repair run just finished: the set is those, when given.
  final Set<String>? seed;

  @override
  ConsumerState<ReviewAgainScreen> createState() => _ReviewAgainScreenState();
}

class _ReviewAgainScreenState extends ConsumerState<ReviewAgainScreen> {
  final MobiController _mobi = MobiController();

  /// The set, fixed once it is built so a refresh behind it never reorders the run.
  List<AgainQuestion>? _set;
  int _dropped = 0;
  int _index = 0;
  int? _picked;
  bool _checked = false;
  final List<bool> _held = [];
  bool _done = false;
  bool _seeded = true;

  @override
  void dispose() {
    _mobi.dispose();
    super.dispose();
  }

  AgainQuestion get _current => _set![_index];

  void _back() => context.canPop() ? context.pop() : context.go(AppRoutes.review);

  void _check() {
    final picked = _picked;
    if (picked == null || _checked) return;
    final right = picked == _current.keyIndex;
    setState(() {
      _checked = true;
      _held.add(right);
    });
    unawaited(ref.read(reviewAgainMissedProvider.notifier).record(_current.key, held: right));
    if (right) ref.read(hapticsProvider).tick();
    // The verdict's Mobi mounts with this frame: he reacts once he is there.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _mobi.play(right ? MobiAct.correct : MobiAct.encourage);
    });
  }

  void _next() {
    if (_index >= _set!.length - 1) {
      setState(() => _done = true);
      return;
    }
    setState(() {
      _index++;
      _picked = null;
      _checked = false;
    });
  }

  void _again() {
    setState(() {
      _set = null;
      _index = 0;
      _picked = null;
      _checked = false;
      _held.clear();
      _done = false;
      _seeded = false;
    });
  }

  /// Builds the set once the attempts, the missed keys and the attempt details are read.
  /// Returns what to show while it is not ready, or null when [_set] is built.
  Widget? _prepare() {
    final inputs = ref.watch(reviewInputsProvider);
    final index = ref.watch(reviewIndexProvider);
    final missedRead = ref.watch(reviewAgainMissedProvider);
    if (index == null) {
      if (attemptsReadFailed(inputs.attempts)) {
        return ReviewLoadFailure(attempts: inputs.attempts, onRetry: () => ref.read(attemptsRepositoryProvider.notifier).refresh(force: true));
      }
      return _skeleton();
    }
    if (missedRead.isLoading) return _skeleton();
    final candidates = reviewAgainCandidates(
      index,
      missed: missedRead.value ?? const {},
      seed: _seeded ? widget.seed : null,
    );
    final states = {for (final id in {for (final c in candidates) c.attemptId}) id: ref.watch(attemptDetailProvider(id))};
    if (states.values.any((s) => s.isInitialLoading)) return _skeleton();
    final set = buildReviewAgainSet(
      candidates: candidates,
      attemptOf: index.attempt,
      detailOf: (id) => states[id]?.value,
    );
    _set = set;
    _dropped = candidates.length > reviewAgainLimit ? 0 : candidates.length - set.length;
    return null;
  }

  Widget _skeleton() => Center(
        child: Semantics(label: ReviewAgainCopy.buildingLabel, liveRegion: true, child: MmSpinner(color: context.mmColors.ink2)),
      );

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    Widget body;
    if (_set == null) {
      body = _prepare() ?? const SizedBox.shrink();
    } else {
      body = const SizedBox.shrink();
    }
    final set = _set;
    if (set != null) {
      if (set.isEmpty) {
        body = ReviewStateView(
          kind: StateViewKind.empty,
          pose: MobiPose.read,
          title: ReviewAgainCopy.emptyTitle,
          message: ReviewAgainCopy.emptyMessage,
          primary: StateAction(ReviewAgainCopy.emptyAction, () => context.go(AppRoutes.review)),
        );
      } else if (_done) {
        body = _End(
          result: AgainResult(
            held: _held.where((h) => h).length,
            total: _held.length,
            missedKeys: [for (var i = 0; i < _held.length; i++) if (!_held[i]) set[i].key],
          ),
          onBack: _back,
          onAnother: ref.watch(reviewAgainCountProvider) > set.length ? _again : null,
        );
      } else {
        body = _question(context, set);
      }
    }
    return Scaffold(
      backgroundColor: colors.ground,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _TopBar(
              onBack: _back,
              answered: _held.length,
              total: set?.length ?? 0,
              show: set != null && set.isNotEmpty && !_done,
            ),
            Expanded(child: MmOverlapSwitcher(duration: Motion.of(context, Motion.card), child: KeyedSubtree(key: ValueKey(_stageKey(set)), child: body))),
          ],
        ),
      ),
    );
  }

  String _stageKey(List<AgainQuestion>? set) {
    if (set == null) return 'building';
    if (set.isEmpty) return 'empty';
    return _done ? 'end' : 'q$_index';
  }

  Widget _question(BuildContext context, List<AgainQuestion> set) {
    final colors = context.mmColors;
    final type = context.mmType;
    final q = _current;
    final clock = ref.watch(reviewClockProvider);
    final right = _checked && _picked == q.keyIndex;
    final when = q.item.stageAt;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          child: ListView(
            key: PageStorageKey('again-${q.key}'),
            padding: const EdgeInsets.fromLTRB(ReviewSpace.gutter, MmSpace.s8, ReviewSpace.gutter, MmSpace.s48),
            children: [
              if (_dropped > 0 && _index == 0) ...[
                Text(ReviewAgainCopy.someNeedConnection(set.length), style: type.small.copyWith(color: colors.ink2)),
                const SizedBox(height: MmSpace.s12),
              ],
              Text(ReviewAgainCopy.whereLine(ReviewCopy.shortChapter(q.item.chapter), q.item.number, q.item.source), style: type.caption.copyWith(color: colors.ink2)),
              if (when != null) Text(ReviewAgainCopy.repairedWhen(formatDayMonth(clock.local(when))), style: type.caption.copyWith(color: colors.ink3)),
              const SizedBox(height: MmSpace.s12),
              if (!_checked) ...[
                Text(q.question.question, style: type.question),
                const SizedBox(height: MmSpace.s16),
                for (var i = 0; i < q.question.options.length; i++) ...[
                  if (i > 0) const SizedBox(height: MmSpace.s8),
                  MmSelectRow(
                    title: q.question.options[i].text,
                    letter: q.question.options[i].key,
                    selected: _picked == i,
                    onTap: () => setState(() => _picked = i),
                  ),
                ],
              ] else ...[
                QuestionPanel(question: q.question, chosen: _picked, keyIndex: q.keyIndex),
                const SizedBox(height: MmSpace.s24),
                Semantics(
                  container: true,
                  liveRegion: true,
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      ExcludeSemantics(
                        child: SizedBox.square(
                          dimension: 32,
                          child: MobiCharacter(size: 32, head: true, shadow: false, watchTaps: false, controller: _mobi, entrance: MobiAct.idle),
                        ),
                      ),
                      const SizedBox(width: MmSpace.s12),
                      Expanded(
                        child: Text(
                          TryFirst.verdictLine(_picked, q.keyIndex, q.question.options) ?? '',
                          style: type.headline.copyWith(fontSize: 18, height: 24 / 18, fontWeight: FontWeight.w600),
                        ),
                      ),
                    ],
                  ),
                ),
                if (q.explanation != null) ...[
                  const SizedBox(height: MmSpace.s12),
                  Text(ReviewAgainCopy.why, style: type.label.copyWith(color: colors.ink2)),
                  const SizedBox(height: MmSpace.s4),
                  Text(q.explanation!, style: type.body),
                ],
                if (!right)
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Transform.translate(
                      offset: const Offset(-ReviewSpace.gutter, 0),
                      child: KeyButton.quiet(
                        label: ReviewAgainCopy.repairItAgain,
                        onPressed: () => context.push(AppRoutes.reviewRepair(q.item.attemptId, q.item.questionId)),
                      ),
                    ),
                  ),
              ],
            ],
          ),
        ),
        ColoredBox(
          color: colors.ground,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s4, MmSpace.gutter, MmSpace.s16),
            child: KeyButton(
              label: !_checked
                  ? ReviewAgainCopy.check
                  : _index >= set.length - 1
                      ? ReviewAgainCopy.seeHow
                      : ReviewAgainCopy.next,
              semanticsLabel: !_checked && _picked == null ? ReviewAgainCopy.checkNeedsPick : null,
              onPressed: !_checked ? (_picked == null ? null : _check) : _next,
            ),
          ),
        ),
      ],
    );
  }
}

/// The page's top row: back, the title and "3 of 8", and under it a bar of the questions answered
/// so far (answered only: it never fills ahead of the work).
class _TopBar extends StatelessWidget {
  const _TopBar({required this.onBack, required this.answered, required this.total, required this.show});

  final VoidCallback onBack;
  final int answered;
  final int total;
  final bool show;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.s4, MmSpace.s8, MmSpace.gutter, MmSpace.s8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 48),
            child: Row(
              children: [
                IconButton(onPressed: onBack, tooltip: 'Back', icon: Icon(LucideIcons.arrowLeft, color: colors.ink)),
                const SizedBox(width: MmSpace.s8),
                Expanded(child: Semantics(header: true, child: Text(ReviewAgainCopy.title, style: type.screenTitle, maxLines: 1, overflow: TextOverflow.ellipsis))),
                if (show)
                  Semantics(
                    liveRegion: true,
                    label: ReviewAgainCopy.progressSpoken(answered, total),
                    excludeSemantics: true,
                    child: Text(ReviewAgainCopy.progress(answered, total), style: type.labelLarge.copyWith(color: colors.ink2)),
                  ),
              ],
            ),
          ),
          if (show) ...[
            const SizedBox(height: MmSpace.s4),
            Padding(
              padding: const EdgeInsets.only(left: MmSpace.s12),
              child: _AnsweredBar(answered: answered, total: total),
            ),
          ],
        ],
      ),
    );
  }
}

class _AnsweredBar extends StatelessWidget {
  const _AnsweredBar({required this.answered, required this.total});

  final int answered;
  final int total;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return ExcludeSemantics(
      child: Row(
        children: [
          for (var i = 0; i < total; i++) ...[
            if (i > 0) const SizedBox(width: 4),
            Expanded(
              child: AnimatedContainer(
                duration: Motion.of(context, Motion.ui),
                curve: Motion.out,
                height: 6,
                decoration: BoxDecoration(
                  color: i < answered ? VoltMark.fill(colors) : colors.line,
                  borderRadius: BorderRadius.circular(3),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// The end of a set: how many held, what comes back first, and the way out. Mobi's reaction is the
/// one character here (the verdict's Mobi is not on this state).
class _End extends StatefulWidget {
  const _End({required this.result, required this.onBack, this.onAnother});

  final AgainResult result;
  final VoidCallback onBack;
  final VoidCallback? onAnother;

  @override
  State<_End> createState() => _EndState();
}

class _EndState extends State<_End> {
  /// The end's own Mobi: the verdict's Mobi is leaving while this one arrives, so they never share
  /// a controller.
  final MobiController _mobi = MobiController();

  @override
  void dispose() {
    _mobi.dispose();
    super.dispose();
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _mobi.play(switch (widget.result.tone) {
        AgainTone.proud => MobiAct.proud,
        AgainTone.nod => MobiAct.nod,
        AgainTone.encourage => MobiAct.encourage,
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final r = widget.result;
    return Padding(
      padding: const EdgeInsets.fromLTRB(ReviewSpace.moment, MmSpace.s24, ReviewSpace.moment, MmSpace.s16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Align(
                  alignment: Alignment.centerRight,
                  child: ExcludeSemantics(
                    child: SizedBox.square(
                      dimension: 96,
                      child: MobiCharacter(size: 96, controller: _mobi, entrance: MobiAct.appear),
                    ),
                  ),
                ),
                Semantics(
                  header: true,
                  child: Text(ReviewAgainCopy.endTitleFor(r.tone, held: r.held, total: r.total), style: type.lead.copyWith(color: colors.ink2)),
                ),
                const SizedBox(height: MmSpace.s8),
                FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerLeft,
                  child: MonumentalNumber(
                    value: '${r.held}',
                    unit: 'of ${r.total} ${ReviewAgainCopy.heldWord}',
                    style: type.figure.copyWith(fontSize: 72, height: 64 / 72),
                    delay: Motion.enterDuration,
                    semanticsLabel: ReviewAgainCopy.endFigureSpoken(r.held, r.total),
                  ),
                ),
                if (r.missedKeys.isNotEmpty) ...[
                  const SizedBox(height: MmSpace.s12),
                  Text(ReviewAgainCopy.comeBackFirst(r.missedKeys.length), style: type.lead.copyWith(color: colors.ink2)),
                ],
              ],
            ),
          ),
          KeyButton(label: ReviewAgainCopy.backToReview, onPressed: widget.onBack),
          if (widget.onAnother != null) Align(child: KeyButton.quiet(label: ReviewAgainCopy.anotherSet, onPressed: widget.onAnother)),
        ],
      ),
    );
  }
}
