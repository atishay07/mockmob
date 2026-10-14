import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/analytics/analytics.dart';
import '../../../core/api/api.dart';
import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/platform/review_prompt.dart';
import '../../../core/repositories/repositories.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../rhythm/rhythm.dart' show celebrationModeProvider;
import '../copy.dart';
import '../data/result_providers.dart';
import '../model/recap_model.dart';
import '../model/recap_variant.dart';
import '../result_nav.dart';
import '../widgets/result_space.dart';
import 'breakdown_card.dart';
import 'card_drag.dart';
import 'first_fix_card.dart';
import 'recap_room.dart';
import 'recap_finish.dart';
import 'record_card.dart';
import 'sheet_stage.dart';
import 'story_bar.dart';

/// The recap (spec 5.6): the sealed sheet on card 1, then where the marks went, the first thing
/// to fix, and what is recorded with the next ask. One screen, so the sheet's opening flows
/// straight into the cards. Back always lands on the full result.
class RecapFlow extends ConsumerStatefulWidget {
  const RecapFlow({super.key, required this.model, required this.entry, this.initialCard = 1, this.ritual = const RecapRitual()});

  final RecapModel model;
  final SheetEntry entry;
  final int initialCard;
  final RecapRitual ritual;

  static const int cardCount = 4;

  /// How long after the sheet opens a good result waits before the store review ask: the figure
  /// has landed and been read by then.
  static const Duration reviewAskDelay = Duration(seconds: 4);

  @override
  ConsumerState<RecapFlow> createState() => _RecapFlowState();
}

class _RecapFlowState extends ConsumerState<RecapFlow> {
  late int _card = _initial();
  bool _forward = true;
  late bool _opened = widget.entry == SheetEntry.open || widget.initialCard > 1;
  bool _finished = false;

  /// Coming back to card 1 shows the sheet as it was left: no second roll.
  late bool _visitedOtherCard = widget.initialCard > 1;
  bool _hintShown = false;
  RecapReaction? _finishReaction;
  Timer? _reviewAsk;

  RecapModel get m => widget.model;
  ResultActions get _actions => ref.read(resultActionsProvider);

  /// Held marks have no breakdown to show, so card 2 is left out (spec 5.6.4).
  List<int> get _order => m.isHeld ? const [1, 3, 4] : const [1, 2, 3, 4];

  int _initial() {
    final c = widget.initialCard.clamp(1, RecapFlow.cardCount);
    return _order.contains(c) ? c : _order.firstWhere((x) => x > c, orElse: () => _order.last);
  }

  void _next() {
    final i = _order.indexOf(_card);
    if (i < _order.length - 1) _go(_order[i + 1]);
  }

  void _back() {
    final i = _order.indexOf(_card);
    if (i > 0) _go(_order[i - 1]);
  }

  @override
  void initState() {
    super.initState();
    if (_opened) {
      scheduleMicrotask(() {
        _actions.track(AnalyticsEvents.recapOpened, {'variant': m.variant.wire, 'screen': 'card_$_card'});
        _actions.saveProgress(m.attemptId, _card);
      });
    }
  }

  @override
  void dispose() {
    _reviewAsk?.cancel();
    super.dispose();
  }

  void _onOpened() {
    setState(() => _opened = true);
    _actions.markOpened(m.attemptId, mode: m.mode, variant: m.variant.wire);
    _actions.track(AnalyticsEvents.recapOpened, {'variant': m.variant.wire, 'screen': 'card_1'});
    _actions.saveProgress(m.attemptId, 1);
    _scheduleReviewAsk();
  }

  /// A full mock that held steady or improved is a good moment for the store review ask, once
  /// the result has settled. Leaving the recap first cancels it. The prompt itself decides
  /// whether it is allowed (3 days in, once in 60 days, never in NTA mode).
  void _scheduleReviewAsk() {
    final moment = m.reviewMoment;
    if (moment == null) return;
    _reviewAsk?.cancel();
    _reviewAsk = Timer(RecapFlow.reviewAskDelay, () {
      if (mounted) unawaited(ref.read(reviewPromptProvider).maybeAsk(moment, ntaMode: m.isNta));
    });
  }

  void _go(int card) {
    final next = card.clamp(1, RecapFlow.cardCount);
    if (next == _card) return;
    setState(() {
      _forward = next > _card;
      _card = next;
      if (next > 1) _visitedOtherCard = true;
    });
    // A card snapping into place is a threshold: one selection tick.
    unawaited(ref.read(hapticsProvider).tick());
    _actions.saveProgress(m.attemptId, next);
    if (next == RecapFlow.cardCount && _showSkipHint && !_hintShown) {
      _hintShown = true;
      _actions.markSkipHintShown();
    }
  }

  /// After the third reveal, once (5.6.1).
  bool get _showSkipHint => widget.entry != SheetEntry.open && widget.ritual.sheetsOpened == 2 && !widget.ritual.skipHintShown;

  void _skip() {
    _actions.track(AnalyticsEvents.recapSkipped, {'screen': 'card_$_card'});
    ResultNav.toFullResult(context, m.attemptId);
  }

  void _withoutReveal() {
    _actions.markOpened(m.attemptId, mode: m.mode, variant: m.variant.wire);
    _actions.track(AnalyticsEvents.recapSkipped, {'screen': 'sealed'});
    ResultNav.toFullResult(context, m.attemptId);
  }

  void _finish() {
    _actions.track(AnalyticsEvents.finishForNow, {'screen': 'recap'});
    _actions.saveProgress(m.attemptId, RecapFlow.cardCount);
    // Mobi answers the result with the act the one reaction table gives it (nothing at all in
    // NTA mode); the finish screen waits for that act to end, then Today takes over.
    _finishReaction = recapReaction(
      variant: m.variant,
      mode: ref.read(celebrationModeProvider),
      isNta: m.isNta,
      hour: MobiRation.now().hour,
    );
    setState(() => _finished = true);
  }

  Widget _cardFor(int card) {
    switch (card) {
      case 1:
        return SheetStage(
          key: const ValueKey('card-1'),
          model: m,
          entry: _opened && _visitedOtherCard ? SheetEntry.settled : (_opened ? SheetEntry.open : widget.entry),
          firstEver: widget.ritual.firstEver,
          onOpened: _onOpened,
          onNext: _next,
          onWithoutReveal: _withoutReveal,
        );
      case 2:
        return BreakdownCard(key: const ValueKey('card-2'), model: m, onNext: _next, onBack: _back);
      case 3:
        return FirstFixCard(key: const ValueKey('card-3'), model: m, onNext: _next, onBack: _back);
      default:
        return RecordCard(
          key: const ValueKey('card-4'),
          model: m,
          onBack: _back,
          onFinish: _finish,
          onRetryKeys: () => ref.read(attemptDetailProvider(m.attemptId).notifier).refresh(force: true),
          showSkipHint: _showSkipHint,
        );
    }
  }

  Widget _transition(Widget child, Animation<double> animation) {
    final incoming = child.key == ValueKey('card-$_card');
    final reduced = Motion.reduced(context);
    // Cards are a stack the student moves through. The arriving card rises 40 dp into place on
    // the emphasized curve while it fades in; the leaving card sinks back (scale 0.96) and fades
    // out on the exit curve in the first half. Going back reverses the direction.
    final dir = _forward ? 1.0 : -1.0;
    return AnimatedBuilder(
      animation: animation,
      child: child,
      builder: (context, child) {
        final v = animation.value;
        if (reduced) return Opacity(opacity: v, child: child);
        if (incoming) {
          if (v >= 1) return child!;
          final t = Motion.emphasized.transform(v);
          return Opacity(
            opacity: Motion.glide.transform((v / 0.6).clamp(0.0, 1.0)),
            child: Transform.translate(offset: Offset(0, 40 * dir * (1 - t)), child: child),
          );
        }
        final e = Motion.exit.transform(((1 - v) / 0.5).clamp(0.0, 1.0));
        return Opacity(
          opacity: 1 - e,
          child: Transform(
            alignment: Alignment.topCenter,
            transform: Matrix4.translationValues(0, -12 * dir * e, 0)..scaleByDouble(1 - 0.04 * e, 1 - 0.04 * e, 1, 1),
            child: child,
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_finished) {
      return RecapFinish(
        model: m,
        reaction: _finishReaction,
        onDone: () {
          if (mounted) context.go(AppRoutes.today);
        },
      );
    }

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) ResultNav.toFullResult(context, m.attemptId);
      },
      child: RecapRoom(
        subjectId: m.subjectId,
        calm: !m.variant.celebratory,
        child: SafeArea(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: MmSpace.contentMaxWidth),
              child: Column(
                children: [
                  AnimatedOpacity(
                    opacity: _opened ? 1 : 0,
                    duration: Motion.of(context, const Duration(milliseconds: 360)),
                    curve: const Interval(0.3, 1, curve: Motion.glide),
                    child: IgnorePointer(
                      ignoring: !_opened,
                      child: ExcludeSemantics(
                        excluding: !_opened,
                        child: StoryBar(
                          card: _order.indexOf(_card) + 1,
                          count: _order.length,
                          onSkip: _skip,
                          onBack: _order.indexOf(_card) > 0 ? _back : null,
                          titles: [for (final c in _order) ResultCopy.cardNames[c] ?? ''],
                          onJump: (i) => _go(_order[i]),
                        ),
                      ),
                    ),
                  ),
                  Expanded(
                    child: CardDrag(
                      // The sealed sheet is not a card yet: its sideways drags are its own.
                      enabled: _opened,
                      onNext: _order.indexOf(_card) < _order.length - 1 ? _next : null,
                      onBack: _order.indexOf(_card) > 0 ? _back : null,
                      onThreshold: () => unawaited(ref.read(hapticsProvider).tick()),
                      child: AnimatedSwitcher(
                      duration: Motion.reduced(context) ? Motion.reducedFade : Motion.emphasizedDuration,
                      switchInCurve: Curves.linear,
                      switchOutCurve: Curves.linear,
                      transitionBuilder: _transition,
                      layoutBuilder: (current, previous) => Stack(fit: StackFit.expand, children: [...previous, ?current]),
                      child: KeyedSubtree(key: ValueKey('card-$_card'), child: _cardFor(_card)),
                      ),
                    ),
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

/// Shown while the attempt is not known yet, or could not be read. Loading takes the shape of
/// what will arrive: the folded sheet on the recap, the summary, the sheet and the answer rows on
/// the full result ([page]). A load still running after [slowAfter] says so, with "Try again" and
/// the way to Review (robustness result-03: each read can take up to 45 s, retried twice, and the
/// skeleton alone gave no way on).
class RecapPlaceholder extends StatefulWidget {
  const RecapPlaceholder({super.key, required this.data, required this.onRetry, required this.attemptId, this.page = false});

  final RecapData data;
  final VoidCallback onRetry;
  final String attemptId;

  /// The full result's shape instead of the sealed sheet's.
  final bool page;

  static const Duration slowAfter = Duration(seconds: 6);

  @override
  State<RecapPlaceholder> createState() => _RecapPlaceholderState();
}

class _RecapPlaceholderState extends State<RecapPlaceholder> {
  Timer? _timer;
  bool _slow = false;
  bool _retried = false;

  /// Mobi waits below the skeleton, at 60%: a quiet loading loop, never a second thing to read.
  /// It is pinned under the skeleton's own box, so it never lands on a placeholder block and
  /// never pushes the skeleton off a short screen: it is left out where there is no room.
  static const Widget _waiting = Padding(
    padding: EdgeInsets.symmetric(vertical: MmSpace.s12),
    child: Center(
      child: Opacity(opacity: 0.6, child: Mobi(pose: MobiPose.loading, size: 56)),
    ),
  );

  /// The shortest area (dp) that still holds the skeleton and Mobi under it: the full result's
  /// skeleton scrolls out of view and clips, the sealed sheet's cannot give way.
  static const double _roomPage = 480;
  static const double _roomSealed = 620;

  @override
  void initState() {
    super.initState();
    _arm();
  }

  void _arm() {
    _timer?.cancel();
    _timer = Timer(RecapPlaceholder.slowAfter, () {
      if (mounted) setState(() => _slow = true);
    });
  }

  void _retry() {
    _retried = true;
    setState(() => _slow = false);
    _arm();
    widget.onRetry();
  }

  @override
  void dispose() {
    _timer?.cancel();
    // A retry that ended in the result being here settles Mobi: the next failure is a new run and
    // may shrug again (the state view's own gate). Leaving while the error is still on screen is
    // not a recovery.
    if (_retried && widget.data.error == null) MobiRation.recovered('state-view');
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final data = widget.data;
    final page = widget.page;
    final error = data.error;
    Widget body;
    if (error == null && _slow) {
      // Mobi in the state's own slot, thinking quietly: it is waiting with the student, not
      // reacting to a failure.
      body = StateView(
        kind: StateViewKind.error,
        pose: MobiPose.think,
        title: ResultCopy.slowTitle,
        message: ResultCopy.slowBody,
        primary: StateAction(ResultCopy.tryAgain, _retry),
        secondary: StateAction(ResultCopy.backToReview, () => context.go(AppRoutes.review)),
      );
    } else if (error == null && page) {
      // The shape of the result: the date, the big figure beside the subject's emblem, its meter,
      // the two lines under it, the answers as rows of bubbles, then a section heading and rows.
      // One soft light sweeps across it where the app lights its skeletons.
      body = SkeletonGroup(
        label: ResultCopy.loading,
        child: SingleChildScrollView(
          physics: const NeverScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmRhythm.screenTop, MmSpace.gutter, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Skeleton.line(width: 190, height: 12),
                        SizedBox(height: MmSpace.s16),
                        Skeleton(width: 210, height: 84, radius: 12),
                      ],
                    ),
                  ),
                  SizedBox(width: MmSpace.s8),
                  Skeleton.circle(size: ResultSpace.emblem),
                ],
              ),
              const SizedBox(height: MmSpace.s12),
              const Skeleton(height: 4, radius: 2),
              const SizedBox(height: MmSpace.s16),
              const Skeleton.line(width: 260, height: 16),
              const SizedBox(height: MmSpace.s8),
              const Skeleton.line(width: 230, height: 12),
              const SizedBox(height: MmSpace.s24),
              for (var r = 0; r < 5; r++) ...[
                if (r > 0) const SizedBox(height: MmSpace.s12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [for (var c = 0; c < 10; c++) const Skeleton.circle(size: 22)],
                ),
              ],
              const SizedBox(height: MmRhythm.section),
              const Skeleton.line(width: 200, height: 22),
              const SizedBox(height: MmSpace.s16),
              const MmSkeletonRows(rows: 3),
            ],
          ),
        ),
      );
    } else if (error == null) {
      // The sealed screen's shape: the headline lines at the top, the folded sheet in the middle
      // of the band below them, and the key under it.
      body = const SkeletonGroup(
        label: ResultCopy.loading,
        child: Padding(
          padding: EdgeInsets.fromLTRB(ResultSpace.moment, MmSpace.s24 + 56, ResultSpace.moment, MmSpace.s32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Skeleton(width: 250, height: 34, radius: 12),
              SizedBox(height: MmSpace.s12),
              Skeleton.line(width: 160, height: 14),
              Spacer(),
              Skeleton(height: 280, radius: 12),
              Spacer(),
              Skeleton(height: 56, radius: 28),
            ],
          ),
        ),
      );
    } else {
      body = StateView(
        kind: error.isOffline ? StateViewKind.offline : StateViewKind.error,
        title: error.kind == ApiErrorKind.notFound ? ResultCopy.notFound : ResultCopy.loadFailed,
        primary: StateAction(ResultCopy.tryAgain, _retry),
        secondary: StateAction(ResultCopy.backToReview, () => context.go(AppRoutes.review)),
      );
    }
    if (error == null && !_slow) {
      final skeleton = body;
      // Mobi waits only when the paper is known not to be an NTA mock: NTA results are exam-faithful,
      // with no Mobi at all, and the mode is not known until the attempt is.
      final mode = data.attempt?.mode;
      final mobiOk = mode != null && mode != 'nta';
      body = LayoutBuilder(
        builder: (context, c) => Column(
          children: [
            Expanded(child: skeleton),
            if (mobiOk && c.maxHeight >= (page ? _roomPage : _roomSealed)) _waiting,
          ],
        ),
      );
    }
    return RecapRoom(child: SafeArea(child: body));
  }
}
