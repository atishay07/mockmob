import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/motion/motion.dart';
import '../../../core/repositories/remote_state.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/catalog_repository.dart';
import '../data/learn_prefs.dart';
import '../data/learn_store.dart';
import '../data/lesson_loader.dart';
import '../data/run_starter.dart';
import '../learn_paths.dart';
import '../models/learn_catalog.dart';
import '../widgets/due_card.dart';
import '../widgets/how_concepts.dart';
import '../widgets/lesson_list.dart';
import '../widgets/offline_packs.dart';
import '../widgets/screen_bits.dart';
import '../widgets/untaught_chapters.dart';

/// Runs that have an event on this phone the server has not acknowledged.
final pendingRunIdsProvider = FutureProvider.autoDispose<List<String>>(
  (ref) => ref.read(learnStoreProvider).pendingRunIds(),
);

/// The Concepts screen (spec 5.9), opened from the Practice shelf: how Concepts work, the due
/// summary, the lesson to pick up, each subject's lessons with their status words and chapter
/// summaries, the chapters without a lesson yet, and the offline switches.
class LearnScreen extends ConsumerStatefulWidget {
  const LearnScreen({super.key, this.slowAfter = const Duration(seconds: 15)});

  /// How long the skeleton may stand in for a first load before it gives way to an error with Try again.
  final Duration slowAfter;

  @override
  ConsumerState<LearnScreen> createState() => _LearnScreenState();
}

class _LearnScreenState extends ConsumerState<LearnScreen> {
  final _scroll = ScrollController();
  bool _starting = false;
  String? _startMessage;
  bool _howMarked = false;

  /// The skeleton stood in for the first load: the content then arrives on the cross-fade alone.
  bool _afterSkeleton = false;

  /// Armed while the first load has nothing to show; when it fires the skeleton gives way to an error.
  Timer? _slowTimer;
  bool _slow = false;

  void _armSlow() {
    if (_slowTimer != null || _slow) return;
    _slowTimer = Timer(widget.slowAfter, () {
      _slowTimer = null;
      if (mounted) setState(() => _slow = true);
    });
  }

  void _disarmSlow() {
    _slowTimer?.cancel();
    _slowTimer = null;
    _slow = false;
  }

  void _retry() {
    setState(_disarmSlow);
    unawaited(_refresh());
  }

  @override
  void dispose() {
    _slowTimer?.cancel();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    ref.invalidate(pendingRunIdsProvider);
    await ref.read(learnCatalogProvider.notifier).refresh();
  }

  /// The pull: the same reload, but a failed one is told to the ring so it empties instead of
  /// inking as if the page were fresh.
  Future<void> _pull() async {
    await _refresh();
    if (!mounted) return;
    final error = ref.read(learnCatalogProvider).error;
    if (error != null) throw error;
  }

  Future<void> _open(String path) async {
    await context.push<void>(path);
    if (mounted) unawaited(_refresh());
  }

  Future<void> _startRecall() async {
    if (_starting) return;
    setState(() {
      _starting = true;
      _startMessage = null;
    });
    final result = await ref.read(runStarterProvider).start(mode: 'recall');
    if (!mounted) return;
    setState(() {
      _starting = false;
      _startMessage = result.message;
    });
    final run = result.run;
    if (run != null) {
      await _open(AppRoutes.learnRun(run.id));
    } else {
      unawaited(_refresh());
    }
  }

  /// While study content is switched off there is nothing to show here: leave quietly
  /// instead of drawing a "not available" screen.
  bool _leaving = false;

  void _leave() {
    if (_leaving) return;
    _leaving = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (context.canPop()) {
        context.pop();
      } else {
        context.go(AppRoutes.practice);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final state = ref.watch(learnCatalogProvider);
    final catalog = state.value;

    Widget body;
    String kind;
    if (catalog == null) {
      body = _emptyBody(state);
      kind = _slow || state.isFailedEmpty ? 'error' : 'skeleton';
    } else if (catalog.isDisabled) {
      _disarmSlow();
      _leave();
      body = const SizedBox.shrink();
      kind = 'leaving';
    } else {
      _disarmSlow();
      body = _content(catalog, state);
      kind = 'content';
    }

    return LearnBackScope(
      fallback: AppRoutes.practice,
      child: Scaffold(
        backgroundColor: colors.ground,
        body: Stack(
          children: [
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              height: 380,
              child: IgnorePointer(
                child: LightField.lamp(context, strength: 0.75),
              ),
            ),
            SafeArea(
              bottom: false,
              child: Column(
                children: [
                  if (state.isStale && (state.error?.isOffline ?? false))
                    const InlineBanner.offlineStrip(),
                  ConceptsHeader(
                    onBack: () => context.canPop()
                        ? context.pop()
                        : context.go(AppRoutes.practice),
                  ),
                  // Skeleton to content is one 200 ms cross-fade (MOTION.md C11); the content's own
                  // entrance is off when it follows a skeleton, so nothing fades up twice.
                  Expanded(
                    child: AnimatedSwitcher(
                      duration: Motion.of(context, Motion.ui),
                      child: KeyedSubtree(key: ValueKey(kind), child: body),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _emptyBody(RemoteState<LearnCatalog> state) {
    if (state.isFailedEmpty) {
      _disarmSlow();
      final offline = state.error?.isOffline ?? false;
      return StateView(
        kind: offline ? StateViewKind.offline : StateViewKind.error,
        title: offline ? LearnCopy.offlineTitle : LearnCopy.loadFailedTitle,
        message: offline
            ? LearnCopy.offlineMessage
            : LearnCopy.loadFailedMessage,
        primary: StateAction(LearnCopy.tryAgain, _retry),
      );
    }
    if (_slow) {
      return StateView(
        kind: StateViewKind.error,
        title: LearnCopy.loadSlowTitle,
        message: LearnCopy.loadSlowMessage,
        primary: StateAction(LearnCopy.tryAgain, _retry),
      );
    }
    _armSlow();
    _afterSkeleton = true;
    return const _LearnSkeleton();
  }

  Widget _content(LearnCatalog catalog, RemoteState<LearnCatalog> state) {
    final colors = context.mmColors;
    final type = context.mmType;
    final pending = ref.watch(pendingRunIdsProvider).value ?? const <String>[];
    final offline =
        ref.watch(offlineLearnProvider).value ?? const OfflineLearnState();
    final subjects = catalog.subjectsWithLessons;
    final shown = catalog.subjectsToShow;
    final firstVisit = !(ref.watch(conceptsHowSeenProvider).value ?? true);
    if (firstVisit && !_howMarked) {
      _howMarked = true;
      unawaited(markConceptsHowSeen(ref.read(learnPrefsStoreProvider)));
    }
    final active = catalog.active;
    final hasResume = active != null && active.id.isNotEmpty;
    final queue = StudyQueueView.of(catalog);
    final noLessons = catalog.units.isEmpty;
    // With nothing to start and no lessons the Mobi block below is the one hero: no "nothing is
    // due" card beside it.
    final showDue =
        !(noLessons &&
            queue.due == 0 &&
            queue.newReady == 0 &&
            !queue.pausedNew);
    // The suggested lesson is folded into its own row when that row is the first one in view,
    // so the same lesson is not shown twice in a screen.
    final firstListed = shown
        .map((s) => catalog.unitsOf(s.id))
        .where((u) => u.isNotEmpty)
        .firstOrNull;
    final next = catalog.next;
    final nextInList =
        next != null &&
        next.id.isNotEmpty &&
        firstListed != null &&
        firstListed.first.id == next.id;
    final showNextCard =
        !hasResume && next != null && next.id.isNotEmpty && !nextInList;

    return MmPullRefresh(
      onRefresh: _pull,
      child: ListView(
        controller: _scroll,
        physics: const AlwaysScrollableScrollPhysics(),
        padding: EdgeInsets.fromLTRB(
          MmSpace.gutter,
          MmSpace.s16,
          MmSpace.gutter,
          MmSpace.s32 + MediaQuery.paddingOf(context).bottom,
        ),
        children: [
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(
                maxWidth: MmSpace.contentMaxWidth,
              ),
              // One authored entrance when the content first arrives: the words, the card that
              // holds the one action, then the lessons in reading order. Never on scroll.
              child: MmStagger(
                enabled: !_afterSkeleton,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    MmStaggerItem(
                      index: 0,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          // One two-line intro. "How Concepts work" is the first visit's own
                          // explainer and is gone after it (SPACING-AUDIT E1).
                          Padding(
                            padding: const EdgeInsets.only(bottom: MmSpace.s16),
                            child: Text(
                              LearnCopy.subtitle,
                              style: type.body.copyWith(color: colors.ink2),
                            ),
                          ),
                          if (!noLessons && (firstVisit || _howMarked))
                            const Padding(
                              padding: EdgeInsets.only(bottom: MmSpace.s16),
                              child: HowConcepts(withMobi: true),
                            ),
                        ],
                      ),
                    ),
                    if (hasResume) ...[
                      MmStaggerItem(
                        index: 1,
                        child: ResumeCard(
                          run: LearnActiveRun(
                            id: active.id,
                            title: active.title,
                            position: runPosition(
                              active.mode,
                              active.step,
                              active.total,
                            ),
                          ),
                          pendingCount: pending.contains(active.id) ? 1 : 0,
                          onContinue: () =>
                              _open(AppRoutes.learnRun(active.id)),
                        ),
                      ),
                      const SizedBox(height: MmRhythm.item),
                    ],
                    if (showDue)
                      MmStaggerItem(
                        index: hasResume ? 2 : 1,
                        child: DueCard(
                          queue: queue,
                          recallEnabled: catalog.core.recallEnabled,
                          primary: !hasResume,
                          starting: _starting,
                          message: _startMessage,
                          onStart: _startRecall,
                          showMobi:
                              !(firstVisit || _howMarked) &&
                              catalog.units.isNotEmpty,
                        ),
                      ),
                    if (showNextCard) ...[
                      const SizedBox(height: MmRhythm.item),
                      MmStaggerItem(
                        index: 2,
                        child: NextLessonCard(
                          lesson: next,
                          onOpen: () => _open(AppRoutes.learnUnit(next.id)),
                        ),
                      ),
                    ],
                    SizedBox(height: showDue ? MmRhythm.group : MmSpace.s8),
                    if (noLessons)
                      Padding(
                        padding: const EdgeInsets.only(bottom: MmRhythm.group),
                        child: Column(
                          children: [
                            const Mobi(
                              pose: MobiPose.read,
                              size: 140,
                              say: LearnCopy.noLessonsMobi,
                            ),
                            const SizedBox(height: MmSpace.s24),
                            Semantics(
                              header: true,
                              child: Text(
                                LearnCopy.noLessonsTitle,
                                style: type.title,
                                textAlign: TextAlign.center,
                              ),
                            ),
                            const SizedBox(height: MmSpace.s8),
                            Text(
                              LearnCopy.noLessonsMessage,
                              style: type.body.copyWith(color: colors.ink2),
                              textAlign: TextAlign.center,
                            ),
                          ],
                        ),
                      ),
                    for (final (i, subject) in shown.indexed) ...[
                      MmStaggerItem(
                        index: 3 + i,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            // A new section: 32, a hairline, 16, then its heading.
                            if (i > 0) const SectionBreak(),
                            if (catalog.unitsOf(subject.id).isNotEmpty)
                              SubjectLessons(
                                subject: subject,
                                units: catalog.unitsOf(subject.id),
                                upNext: nextInList && !hasResume ? next : null,
                                onOpen: (unit) =>
                                    _open(AppRoutes.learnUnit(unit.id)),
                                onReadChapter: (chapter) => unawaited(
                                  _open(
                                    LearnPaths.summary(subject.id, chapter),
                                  ),
                                ),
                              )
                            else
                              SubjectHeader(subject: subject),
                            UntaughtChapters(
                              chapters: catalog.untaughtOf(subject.id),
                              // With no lesson anywhere, the chapters are the way forward: their
                              // Practise keys are in view, not behind a fold.
                              initiallyOpen: noLessons,
                              onPractise: (chapter) => unawaited(
                                context.push<void>(
                                  LearnPaths.practiseChapter(
                                    subject.id,
                                    chapter,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                    if (catalog.units.isNotEmpty) ...[
                      const SectionBreak(),
                      OfflinePacks(
                        subjects: subjects,
                        state: offline,
                        onChanged: (subject, keep) => unawaited(
                          ref
                              .read(offlineLearnProvider.notifier)
                              .setKept(subject, keep: keep),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// The shape of what is coming: the focal card, then a subject's heading and its rows. Bars sit
/// on the ground, one light sweeps across them.
class _LearnSkeleton extends StatelessWidget {
  const _LearnSkeleton();

  @override
  Widget build(BuildContext context) {
    return const SkeletonGroup(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          MmSpace.gutter,
          MmSpace.s16,
          MmSpace.gutter,
          0,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            MmSkeletonCard(hero: true),
            SizedBox(height: MmRhythm.section),
            MmSkeletonRows(rows: 3),
          ],
        ),
      ),
    );
  }
}
