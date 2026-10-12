import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/analytics/analytics.dart';
import '../../core/api/api.dart';
import '../../core/models/models.dart';
import '../../core/motion/motion.dart';
import '../../core/repositories/attempts_repository.dart';
import '../../core/repositories/pending_result_repository.dart';
import '../../core/repositories/remote_state.dart';
import '../../core/router/routes.dart';
import '../../core/theme/theme.dart';
import '../../core/widgets/widgets.dart';
import 'copy.dart';
import 'data/practice_catalog.dart';
import 'data/practice_notes.dart';
import 'model/practice_result_model.dart';
import 'widgets/practice_app_bar.dart';
import 'widgets/result_header.dart';
import 'widgets/result_list.dart';

/// When the server acknowledged the attempt on this phone ("Recorded at 11:51 PM").
final resultReceivedAtProvider = FutureProvider.autoDispose.family<DateTime?, String>((ref, attemptId) async {
  final pending = await ref.watch(pendingResultRepositoryProvider).find(attemptId);
  return pending?.receivedAt;
});

/// `/practice/result/:attemptId` (spec 5.4.1): the plain ending of Quick and chapter practice.
/// Correctness appears here for the first time, because feedback while answering is off. Not the
/// recap: no sealed sheet, no Mobi, no celebration.
class PracticeResultScreen extends ConsumerStatefulWidget {
  const PracticeResultScreen({super.key, required this.attemptId});

  final String attemptId;

  @override
  ConsumerState<PracticeResultScreen> createState() => _PracticeResultScreenState();
}

class _PracticeResultScreenState extends ConsumerState<PracticeResultScreen> with SingleTickerProviderStateMixin {
  final ResultListController _list = ResultListController();
  final ScrollController _scroll = ScrollController();
  late final AnimationController _reveal;
  bool _seeded = false;
  bool _opened = false;
  bool _finished = false;
  int _nextWrong = 0;
  Timer? _leaveTimer;
  PracticeResultModel? _model;

  @override
  void initState() {
    super.initState();
    _reveal = AnimationController(vsync: this, duration: Motion.result);
  }

  @override
  void dispose() {
    _leaveTimer?.cancel();
    _reveal.dispose();
    _scroll.dispose();
    _list.dispose();
    super.dispose();
  }

  /// First data: open the first wrong answer, fill the sheet in order, and mark the result as
  /// opened so Today and the Review tab stop pointing at it.
  void _onFirstData(Attempt attempt, PracticeResultModel model) {
    if (_seeded) return;
    _seeded = true;
    final wrong = model.wrong;
    if (wrong.isNotEmpty) _list.open.add(wrong.first.qid);
    // With nothing wrong or blank the correct group is the whole list, so it starts open.
    if (wrong.isEmpty && model.blank.isEmpty) _list.correctGroupOpen = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (Motion.reduced(context)) {
        _reveal.value = 1;
      } else {
        _reveal.forward();
      }
    });
    if (!_opened) {
      _opened = true;
      scheduleMicrotask(() async {
        // Bookkeeping must never break the screen: the result is already on display.
        try {
          await ref.read(pendingResultRepositoryProvider).markOpened(widget.attemptId);
        } on Object {
          // The review dot clears on the next successful open.
        }
        _track(AnalyticsEvents.resultOpened, {'mode': attempt.mode ?? 'quick', 'variant': 'practice'});
      });
    }
  }

  void _track(String event, Map<String, Object?> props) {
    try {
      unawaited(ref.read(analyticsClientProvider).track(event, props: props).catchError((_) => false));
    } on Object {
      // Usage data is optional and never blocks the student.
    }
  }

  void _jumpTo(ResultQuestion q) {
    _list.reveal(q);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final ctx = _list.keyFor(q.qid).currentContext;
      if (ctx != null && ctx.mounted) {
        Scrollable.ensureVisible(ctx, duration: Motion.of(ctx, Motion.card), curve: Motion.out, alignment: 0.08);
      }
    });
  }

  void _reviewWrong(PracticeResultModel model) {
    final wrong = model.wrong;
    if (wrong.isEmpty) return;
    _jumpTo(wrong[_nextWrong % wrong.length]);
    _nextWrong++;
  }

  void _tapCell(int index) {
    final model = _model;
    if (model == null || index >= model.questions.length) return;
    _jumpTo(model.questions[index]);
  }

  String _publicSubject(Attempt attempt) {
    final catalog = ref.read(practiceSubjectsProvider).value;
    for (final s in catalog ?? const <Subject>[]) {
      if (s.internalId == attempt.subject) return s.id;
    }
    return attempt.subject == 'gat' ? 'general_test' : attempt.subject;
  }

  void _finish(DateTime at) {
    _track(AnalyticsEvents.finishForNow, {'screen': 'practice_result'});
    setState(() => _finished = true);
    // The ending is one plain line. It stays long enough to read, then Today takes over.
    _leaveTimer = Timer(const Duration(milliseconds: 1600), () {
      if (mounted) context.go(AppRoutes.today);
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final id = widget.attemptId;
    final detailState = ref.watch(attemptDetailProvider(id));
    final cached = ref.watch(attemptsRepositoryProvider.select((s) => s.value?.where((a) => a.id == id).firstOrNull));
    final detail = detailState.value;
    final attempt = detail?.attempt ?? cached;
    final received = ref.watch(resultReceivedAtProvider(id)).value;

    if (attempt == null) {
      return _NoAttempt(state: detailState, onRetry: () => ref.read(attemptDetailProvider(id).notifier).refresh(force: true));
    }

    final model = PracticeResultModel.from(attempt);
    _model = model;
    _onFirstData(attempt, model);
    final recordedAt = (received ?? attempt.completedAt).toLocal();
    final note = ref.watch(practiceNoteProvider(id)).value;
    final chapter = note?.chapter;

    if (_finished) return _Closing(text: PracticeCopy.finished(recordedAt));

    final large = MediaQuery.textScalerOf(context).scale(1) >= kSheetFullPageTextScale;
    final failedKeys = detail == null && detailState.error != null && !detailState.loading;

    return PopScope(
      // Opened by link or straight after a session there is nothing to go back to: back
      // leads to the Practice tab instead of leaving the app.
      canPop: context.canPop(),
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) context.go(AppRoutes.practice);
      },
      child: Scaffold(
        backgroundColor: colors.ground,
        body: SafeArea(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: MmSpace.contentMaxWidth),
              child: Column(
                children: [
                  const PracticeAppBar(title: PracticeCopy.resultTitle),
                  Expanded(
                    child: ListView(
                      controller: _scroll,
                      padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s20, MmSpace.gutter, MmSpace.s24),
                      children: [
                        ResultHeader(
                          correct: attempt.correct,
                          total: attempt.total,
                          wrong: attempt.wrong,
                          blank: attempt.unattempted,
                          cells: model.cells,
                          recordedAt: recordedAt,
                          chapter: chapter,
                          reveal: _reveal,
                          onCellTap: model.hasRows ? _tapCell : null,
                        ),
                        if (detailState.isStale && detailState.fetchedAt != null) ...[
                          const SizedBox(height: MmSpace.s12),
                          Text(
                            PracticeCopy.lastLoaded(detailState.fetchedAt!.toLocal()),
                            style: context.mmType.small.copyWith(color: colors.ink3),
                          ),
                        ],
                        if (failedKeys) ...[
                          const SizedBox(height: MmSpace.s20),
                          _LoadFailed(onRetry: () => ref.read(attemptDetailProvider(id).notifier).refresh(force: true)),
                        ],
                        if (model.hasRows && !failedKeys) ...[
                          const SizedBox(height: MmSpace.group),
                          ResultList(model: model, controller: _list, keyFor: (qid) => KeyView.of(detail, qid)),
                        ],
                        if (large) ...[
                          const SizedBox(height: MmSpace.s24),
                          KeyButton.quiet(label: PracticeCopy.finishForNow, onPressed: () => _finish(recordedAt)),
                        ],
                      ],
                    ),
                  ),
                  _Foot(
                    showFinish: !large,
                    primaryLabel: model.wrong.isNotEmpty
                        ? PracticeCopy.reviewWrong(model.wrong.length)
                        : PracticeCopy.practiseAnotherChapter,
                    onPrimary: model.wrong.isNotEmpty
                        ? () => _reviewWrong(model)
                        : () => context.go(
                            Uri(path: AppRoutes.practiceSetup('chapter'), queryParameters: {'subject': _publicSubject(attempt)}).toString(),
                          ),
                    onFinish: () => _finish(recordedAt),
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

class _Foot extends StatelessWidget {
  const _Foot({required this.primaryLabel, required this.onPrimary, required this.onFinish, required this.showFinish});

  final String primaryLabel;
  final VoidCallback onPrimary;
  final VoidCallback onFinish;

  /// At large text sizes the quiet key moves into the scrolling page so the pinned foot stays small.
  final bool showFinish;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.ground,
        border: Border(top: BorderSide(color: colors.line)),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s12, MmSpace.gutter, MmSpace.s8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            KeyButton(label: primaryLabel, onPressed: onPrimary),
            if (showFinish) ...[
              const SizedBox(height: MmSpace.s4),
              Align(
                child: KeyButton.quiet(label: PracticeCopy.finishForNow, onPressed: onFinish),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _LoadFailed extends StatelessWidget {
  const _LoadFailed({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Semantics(
          liveRegion: true,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: ExcludeSemantics(child: Icon(LucideIcons.circleAlert, size: 20, color: colors.badText)),
              ),
              const SizedBox(width: MmSpace.s12),
              Expanded(child: Text(PracticeCopy.resultLoadFailed, style: context.mmType.body)),
            ],
          ),
        ),
        const SizedBox(height: MmSpace.s8),
        KeyButton.secondary(label: PracticeCopy.retry, expanded: false, onPressed: onRetry),
      ],
    );
  }
}

/// The ending after "Finish for now": one plain line and nothing else.
class _Closing extends StatelessWidget {
  const _Closing({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Scaffold(
      backgroundColor: colors.ground,
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(MmSpace.s24),
            child: Semantics(liveRegion: true, child: ReceiptLine(text: text)),
          ),
        ),
      ),
    );
  }
}

/// No attempt to show yet: loading, another account's result, offline, or a failed read.
class _NoAttempt extends StatelessWidget {
  const _NoAttempt({required this.state, required this.onRetry});

  final RemoteState<AttemptDetail> state;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final error = state.error;
    final Widget body;
    if (error == null) {
      body = const Padding(
        padding: EdgeInsets.all(MmSpace.gutter),
        child: SkeletonGroup(
          label: PracticeCopy.loadingAnswers,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Skeleton(width: 200, height: 44),
              SizedBox(height: MmSpace.s12),
              Skeleton.line(width: 160),
              SizedBox(height: MmSpace.s24),
              Skeleton(height: 24),
              SizedBox(height: MmSpace.s24),
              Skeleton(height: 56),
              SizedBox(height: MmSpace.s8),
              Skeleton(height: 56),
            ],
          ),
        ),
      );
    } else if (error.kind == ApiErrorKind.notFound) {
      body = StateView(
        kind: StateViewKind.error,
        title: PracticeCopy.otherAccount,
        primary: StateAction(PracticeCopy.backToPractice, () => context.go(AppRoutes.practice)),
      );
    } else if (error.isOffline) {
      body = StateView(
        kind: StateViewKind.offline,
        title: PracticeCopy.resultLoadFailedUnknown,
        primary: StateAction(PracticeCopy.retry, onRetry),
        secondary: StateAction(PracticeCopy.backToPractice, () => context.go(AppRoutes.practice)),
      );
    } else {
      body = StateView(
        kind: StateViewKind.error,
        title: PracticeCopy.resultLoadFailedUnknown,
        primary: StateAction(PracticeCopy.retry, onRetry),
        secondary: StateAction(PracticeCopy.backToPractice, () => context.go(AppRoutes.practice)),
      );
    }
    return Scaffold(
      backgroundColor: colors.ground,
      body: SafeArea(
        child: Column(
          children: [
            const PracticeAppBar(title: PracticeCopy.resultTitle),
            Expanded(child: body),
          ],
        ),
      ),
    );
  }
}
