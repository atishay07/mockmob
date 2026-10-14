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
import '../../rhythm/widgets/late_night_line.dart';
import '../copy.dart';
import '../data/result_providers.dart';
import '../model/recap_model.dart';
import '../result_nav.dart';
import 'breakdown_card.dart';
import 'first_fix_card.dart';
import 'recap_room.dart';
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
  Timer? _leave;
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
    _leave?.cancel();
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
    setState(() => _finished = true);
    // One plain line, long enough to read, then Today takes over.
    _leave = Timer(const Duration(milliseconds: 2200), () {
      if (mounted) context.go(AppRoutes.today);
    });
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
          onFirstFix: () => _go(3),
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
            transform: Matrix4.translationValues(0, -14 * dir * e, 0)..scaleByDouble(1 - 0.04 * e, 1 - 0.04 * e, 1, 1),
            child: child,
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_finished) {
      return RecapRoom(
        subjectId: m.subjectId,
        child: SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(MmSpace.s24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Semantics(liveRegion: true, child: ReceiptLine(text: ResultCopy.finishLine(m.mockLabel, m.candidates.length))),
                  const LateNightLine(),
                ],
              ),
            ),
          ),
        ),
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
                        ),
                      ),
                    ),
                  ),
                  Expanded(
                    child: AnimatedSwitcher(
                      duration: Motion.reduced(context) ? Motion.reducedFade : Motion.emphasizedDuration,
                      switchInCurve: Curves.linear,
                      switchOutCurve: Curves.linear,
                      transitionBuilder: _transition,
                      layoutBuilder: (current, previous) => Stack(fit: StackFit.expand, children: [...previous, ?current]),
                      child: KeyedSubtree(key: ValueKey('card-$_card'), child: _cardFor(_card)),
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

/// Shown while the attempt is not known yet, or could not be read.
class RecapPlaceholder extends StatelessWidget {
  const RecapPlaceholder({super.key, required this.data, required this.onRetry, required this.attemptId});

  final RecapData data;
  final VoidCallback onRetry;
  final String attemptId;

  @override
  Widget build(BuildContext context) {
    final error = data.error;
    final Widget body;
    if (error == null) {
      body = const Center(
        child: SkeletonGroup(label: ResultCopy.loading, child: Skeleton(width: 320, height: 420, radius: 12)),
      );
    } else {
      body = StateView(
        kind: error.isOffline ? StateViewKind.offline : StateViewKind.error,
        title: error.kind == ApiErrorKind.notFound ? ResultCopy.notFound : ResultCopy.loadFailed,
        primary: StateAction(ResultCopy.tryAgain, onRetry),
        secondary: StateAction(ResultCopy.backToReview, () => context.go(AppRoutes.review)),
      );
    }
    return RecapRoom(child: SafeArea(child: body));
  }
}
