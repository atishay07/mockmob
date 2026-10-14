import 'package:flutter/material.dart';
import '../../../core/api/api.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/motion/motion.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/practice_question.dart';
import '../data/saved_repository.dart';
import '../data/stream_catalog.dart';
import '../data/stream_controller.dart';
import '../widgets/insights_bits.dart';
import '../widgets/practice_card.dart';
import '../widgets/question_actions.dart';
import '../widgets/stream_filters.dart';

/// `/practice/stream` (website Explore): untimed questions one at a time, answer then see why,
/// kept apart from mock scores. With `source=saved` it walks the saved questions instead.
class StreamScreen extends ConsumerStatefulWidget {
  const StreamScreen({super.key, this.subject, this.chapter, this.difficulty, this.saved = false, this.startAt});

  final String? subject;
  final String? chapter;
  final String? difficulty;
  final bool saved;

  /// The saved question to begin with.
  final String? startAt;

  @override
  ConsumerState<StreamScreen> createState() => _StreamScreenState();
}

class _StreamScreenState extends ConsumerState<StreamScreen> {
  bool _opened = false;

  StreamController get _controller => ref.read(streamControllerProvider.notifier);

  @override
  void initState() {
    super.initState();
    if (!widget.saved) {
      final difficulty = const {'easy', 'medium', 'hard'}.contains(widget.difficulty) ? widget.difficulty : null;
      final filters = StreamFilters(subject: widget.subject ?? ref.read(defaultStreamSubjectProvider), chapter: widget.chapter, difficulty: difficulty);
      _opened = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _controller.open(filters);
      });
    }
  }

  void _openSavedOnce(List<PracticeQuestion> questions) {
    if (_opened) return;
    _opened = true;
    final start = widget.startAt == null ? 0 : questions.indexWhere((q) => q.id == widget.startAt);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _controller.openSaved(questions, startAt: start < 0 ? 0 : start);
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final state = ref.watch(streamControllerProvider);
    var savedFailed = false;
    if (widget.saved && !_opened) {
      final saved = ref.watch(savedRepositoryProvider);
      if (saved.value != null) _openSavedOnce(saved.value!.questions);
      savedFailed = saved.isFailedEmpty;
    }
    final filters = state.filters;
    final current = state.current;
    final pad = MediaQuery.paddingOf(context);

    return Scaffold(
      backgroundColor: colors.ground,
      body: SafeArea(
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            InsightsHeader(
              title: widget.saved ? InsightsCopy.savedStreamTitle : InsightsCopy.streamTitle,
              caption: state.answered == 0 ? null : InsightsCopy.tally(state.right, state.answered),
              fallback: widget.saved ? AppRoutes.review : AppRoutes.practice,
            ),
            if (filters != null) ...[
              StreamFilterBar(filters: filters, onChanged: _controller.open),
              const SizedBox(height: MmSpace.s8),
            ],
            Expanded(
              child: savedFailed
                  ? StateView(
                      kind: StateViewKind.error,
                      title: InsightsCopy.savedErrorTitle,
                      message: InsightsCopy.savedErrorMessage,
                      primary: StateAction(InsightsCopy.retry, () => ref.read(savedRepositoryProvider.notifier).refresh(force: true)),
                    )
                  : (current == null ? _emptyBody(context, state) : _question(context, state, current)),
            ),
            if (current != null) _BottomBar(state: state, controller: _controller, bottomInset: pad.bottom),
          ],
        ),
      ),
    );
  }

  Widget _question(BuildContext context, StreamState state, PracticeQuestion q) {
    final picked = state.pickOf(q.id);
    final reduced = Motion.reduced(context);
    return AnimatedSwitcher(
      duration: reduced ? Motion.reducedFade : Motion.glideDuration,
      switchInCurve: Motion.glide,
      switchOutCurve: Motion.exit,
      transitionBuilder: (child, animation) => FadeTransition(
        opacity: animation,
        child: reduced
            ? child
            : SlideTransition(position: Tween(begin: const Offset(0, 0.03), end: Offset.zero).animate(animation), child: child),
      ),
      child: ListView(
        key: ValueKey(q.id),
        padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, MmSpace.s24),
        children: [
          PracticeCard(question: q, picked: picked, onPick: _controller.pick),
          const SizedBox(height: MmSpace.s12),
          QuestionActions(
            question: q,
            flow: state.saved ? 'review' : 'explore',
            revealed: picked != null,
            onVote: (v) => _controller.vote(q.id, v),
          ),
          if (state.error != null && state.error!.isOffline && state.hasMore) ...[
            const SizedBox(height: MmSpace.s8),
            const InlineBanner(message: InsightsCopy.loadMoreOffline, tone: BannerTone.offline, compact: true),
          ],
        ],
      ),
    );
  }

  Widget _emptyBody(BuildContext context, StreamState state) {
    final colors = context.mmColors;
    if (state.phase == StreamPhase.loading || state.loadingMore || (widget.saved && !_opened)) {
      return const _StreamSkeleton();
    }
    void changeFilters() {
      final f = state.filters;
      if (f != null) _controller.open(StreamFilters(subject: f.subject));
    }

    return switch (state.phase) {
      // Signed out, a retry can never succeed: say so and offer the way in.
      StreamPhase.failed when state.error?.kind == ApiErrorKind.unauthorized || state.error?.kind == ApiErrorKind.forbidden => StateView(
          kind: StateViewKind.empty,
          pose: MobiPose.greet,
          title: InsightsCopy.signedOutTitle,
          message: InsightsCopy.signedOutMessage,
          primary: StateAction(InsightsCopy.signIn, () => context.push(AppRoutes.signIn)),
          secondary: StateAction(InsightsCopy.notNow, () => context.canPop() ? context.pop() : context.go(AppRoutes.practice)),
        ),
      StreamPhase.failed => StateView(
          kind: (state.error?.isOffline ?? false) ? StateViewKind.offline : StateViewKind.error,
          title: InsightsCopy.failedTitle,
          message: (state.error?.isOffline ?? false) ? InsightsCopy.failedOffline : InsightsCopy.failedMessage,
          primary: StateAction(InsightsCopy.retry, _controller.retry),
        ),
      StreamPhase.emptyPage => StateView(
          kind: StateViewKind.empty,
          pose: MobiPose.think,
          title: InsightsCopy.emptyPageTitle,
          message: InsightsCopy.emptyPageMessage,
          primary: StateAction(InsightsCopy.keepLooking, _controller.retry),
        ),
      StreamPhase.emptyFilters when widget.saved => StateView(
          kind: StateViewKind.empty,
          pose: MobiPose.read,
          title: InsightsCopy.savedEmptyTitle,
          message: InsightsCopy.savedEmptyMessage,
        ),
      StreamPhase.emptyFilters => StateView(
          kind: StateViewKind.empty,
          pose: MobiPose.think,
          title: InsightsCopy.emptyFilterTitle,
          message: InsightsCopy.emptyFilterMessage,
          primary: state.filters?.chapter != null || state.filters?.difficulty != null ? StateAction(InsightsCopy.changeFilters, changeFilters) : null,
        ),
      _ => _StreamEnd(
          answered: state.answered,
          right: state.right,
          onBack: state.questions.isEmpty ? null : _controller.previous,
          onChange: state.filters == null ? null : changeFilters,
          colors: colors,
        ),
    };
  }
}

class _StreamEnd extends StatelessWidget {
  const _StreamEnd({required this.answered, required this.right, required this.onBack, required this.onChange, required this.colors});

  final int answered;
  final int right;
  final VoidCallback? onBack;
  final VoidCallback? onChange;
  final MmColors colors;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    return ListView(
      padding: const EdgeInsets.all(MmSpace.gutter),
      children: [
        const SizedBox(height: MmSpace.s24),
        // A neutral ending: the stream is untimed practice, so no celebration whatever the tally.
        const Center(child: Mobi(pose: MobiPose.read, size: 132, motion: MobiMotion.settle)),
        const SizedBox(height: MmSpace.s16),
        Text(InsightsCopy.endTitle, style: type.title, textAlign: TextAlign.center),
        const SizedBox(height: MmSpace.s8),
        if (answered > 0) ...[
          Text(InsightsCopy.tally(right, answered), style: type.body.copyWith(color: colors.ink), textAlign: TextAlign.center),
          const SizedBox(height: MmSpace.s4),
        ],
        Text(InsightsCopy.endMessage, style: type.small.copyWith(color: colors.ink2), textAlign: TextAlign.center),
        const SizedBox(height: MmSpace.s24),
        if (onChange != null) KeyButton(label: InsightsCopy.changeFilters, onPressed: onChange),
        if (onBack != null) ...[
          const SizedBox(height: MmSpace.s8),
          Center(child: KeyButton.quiet(label: InsightsCopy.previous, onPressed: onBack)),
        ],
      ],
    );
  }
}

class _BottomBar extends StatelessWidget {
  const _BottomBar({required this.state, required this.controller, required this.bottomInset});

  final StreamState state;
  final StreamController controller;
  final double bottomInset;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final q = state.current!;
    final answered = state.pickOf(q.id) != null || !q.hasUsableKey;
    return DecoratedBox(
      decoration: BoxDecoration(color: colors.ground, border: Border(top: BorderSide(color: colors.line))),
      child: Padding(
        padding: EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s12, MmSpace.gutter, bottomInset + MmSpace.s12),
        child: Row(
          children: [
            if (state.index > 0) ...[
              KeyButton.quiet(label: InsightsCopy.previous, onPressed: controller.previous),
              const SizedBox(width: MmSpace.s8),
            ],
            Expanded(
              child: answered
                  ? KeyButton(label: InsightsCopy.next, onPressed: controller.next)
                  : KeyButton.secondary(label: InsightsCopy.skip, onPressed: controller.skip),
            ),
          ],
        ),
      ),
    );
  }
}

class _StreamSkeleton extends StatelessWidget {
  const _StreamSkeleton();

  @override
  Widget build(BuildContext context) {
    return const SkeletonGroup(
      label: 'Loading questions',
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: MmSpace.gutter, vertical: MmSpace.s8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Skeleton.line(width: 200),
            SizedBox(height: MmSpace.s12),
            Skeleton(height: 72),
            SizedBox(height: MmSpace.s20),
            Skeleton(height: 56, radius: MmRadius.key),
            SizedBox(height: MmSpace.s8),
            Skeleton(height: 56, radius: MmRadius.key),
            SizedBox(height: MmSpace.s8),
            Skeleton(height: 56, radius: MmRadius.key),
            SizedBox(height: MmSpace.s8),
            Skeleton(height: 56, radius: MmRadius.key),
          ],
        ),
      ),
    );
  }
}
