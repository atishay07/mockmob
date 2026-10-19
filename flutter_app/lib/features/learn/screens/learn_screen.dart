import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/connectivity/connectivity.dart';
import '../../../core/motion/motion.dart';
import '../../../core/repositories/remote_state.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/catalog_repository.dart';
import '../data/concepts_pick.dart';
import '../data/learn_prefs.dart';
import '../data/learn_store.dart';
import '../data/lesson_loader.dart';
import '../data/run_starter.dart';
import '../learn_paths.dart';
import '../models/learn_catalog.dart';
import '../widgets/due_card.dart';
import '../widgets/how_concepts.dart';
import '../widgets/learn_library.dart';
import '../widgets/offline_packs.dart';
import '../widgets/screen_bits.dart';

/// Runs that have an event on this phone the server has not acknowledged.
final pendingRunIdsProvider = FutureProvider.autoDispose<List<String>>(
  (ref) => ref.read(learnStoreProvider).pendingRunIds(),
);

/// Learn, the lesson library (LEARN-REVIEW-1017 5.9, P-LR6; the name is the owner's D20), opened from Practice's
/// Learn row and shelf: one panel, Read this next, chosen from where marks are lost; the concept cards due as one
/// quiet row (they are Revise's); a search; the subject switch; Where you lose marks; every chapter of the subject
/// with its lessons, summary and practice; the study record; the offline switches.
///
/// [embedded] (19 Oct PM, D126): the library as Practice's Learn door. Practice owns the title, the pull and the scroll,
/// so the door is only the content, on Practice's gutter; switched off, it draws nothing (Practice then has no Learn door).
class LearnScreen extends ConsumerStatefulWidget {
  const LearnScreen({super.key, this.slowAfter = const Duration(seconds: 15), this.embedded = false});

  /// How long the skeleton may stand in for a first load before it gives way to an error with Try again.
  final Duration slowAfter;

  final bool embedded;

  @override
  ConsumerState<LearnScreen> createState() => _LearnScreenState();
}

class _LearnScreenState extends ConsumerState<LearnScreen> {
  final _scroll = ScrollController();
  bool _starting = false;
  String? _startMessage;
  bool _howMarked = false;

  /// The panel's lesson is starting, and what a failed start said.
  bool _startingLesson = false;
  String? _lessonMessage;

  /// The subject the student picked on the switch (null: the panel's lesson's subject).
  String? _subject;

  final _search = TextEditingController();
  String _query = '';

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
    _search.dispose();
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

  /// Opens a page over Learn and reads the catalog again when the student comes back.
  Future<void> _open(String path) async {
    await context.push<void>(path);
    if (!mounted) return;
    try {
      await _refresh();
    } on Object {
      // A failed read is shown by the screen itself.
    }
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
      if (widget.embedded) return const SizedBox.shrink();
      _leave();
      body = const SizedBox.shrink();
      kind = 'leaving';
    } else {
      _disarmSlow();
      body = _content(catalog, state);
      kind = 'content';
    }

    if (widget.embedded) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (state.isStale && (state.error?.isOffline ?? false)) const InlineBanner.offlineStrip(),
          // Skeleton to content is one 200 ms cross-fade, as on the page.
          AnimatedSwitcher(
            duration: Motion.of(context, Motion.ui),
            layoutBuilder: (current, previous) => Stack(alignment: Alignment.topCenter, children: [...previous, ?current]),
            child: KeyedSubtree(key: ValueKey(kind), child: kind == 'content' ? body : SizedBox(height: 460, child: body)),
          ),
        ],
      );
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

  /// Opens a lesson. From a chapter that costs marks, the lesson page says so (5.10, `?from=chapter:`).
  void _openUnit(LearnUnit unit, {bool fromMarks = false}) {
    final chapter = unit.chapter;
    final path = AppRoutes.learnUnit(unit.id);
    unawaited(
      _open(
        fromMarks && chapter != null && chapter.isNotEmpty
            ? Uri(path: path, queryParameters: {'from': 'chapter:${unit.subject}:$chapter'}).toString()
            : path,
      ),
    );
  }

  /// The panel's key: finish the lesson, start the next one, or go and practise.
  Future<void> _startPick(ConceptsPick pick) async {
    if (_startingLesson) return;
    switch (pick.kind) {
      case PickKind.finish:
        await _open(AppRoutes.learnRun(pick.runId!));
      case PickKind.practise:
        context.go(AppRoutes.practice);
      case PickKind.mistakes || PickKind.next when pick.runId != null:
        // The lesson is part way through: its own run picks up where it stopped.
        await _open(AppRoutes.learnRun(pick.runId!));
      case PickKind.mistakes || PickKind.next:
        final unit = pick.unit!;
        setState(() {
          _startingLesson = true;
          _lessonMessage = null;
        });
        final result = await ref.read(runStarterProvider).start(mode: 'learn', unitId: unit.id);
        if (!mounted) return;
        setState(() {
          _startingLesson = false;
          _lessonMessage = result.message;
        });
        final run = result.run;
        if (run != null) await _open(AppRoutes.learnRun(run.id));
    }
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
    final costs = ref.watch(learnChapterCostsProvider);
    final active = catalog.active;
    final queue = StudyQueueView.of(catalog);
    final noLessons = catalog.units.isEmpty;
    final pick = conceptsPick(catalog, costs);
    // The subject follows the lesson on the panel until the student picks one, so the two never disagree.
    final subjectIds = [for (final s in shown) s.id];
    final subject = (_subject != null && subjectIds.contains(_subject))
        ? _subject!
        : (pick.unit != null && subjectIds.contains(pick.unit!.subject)
              ? pick.unit!.subject
              : subjectIds.firstOrNull);
    final subjectInfo = shown.where((s) => s.id == subject).firstOrNull;
    final results = searchConcepts(_query, catalog);
    final recallRun = active != null && active.id.isNotEmpty && active.mode != 'learn';
    final names = {for (final s in catalog.subjects) s.id: s.title};
    final isOffline = ref.watch(networkStatusProvider) == NetworkStatus.offline;
    // Whether a lesson opens without a connection, said only when it is true: kept on this phone, or (with no
    // connection) not kept.
    String? whereOf(LearnUnit u) => offline.lessons.contains(u.id) ? LearnCopy.onThisPhone : (isOffline ? LearnCopy.needsConnection : null);
    String nameOf(String id) => names[id] ?? LearnCopy.subjectLabel(id);

    final rows = <Widget>[
      if (recallRun)
        LearnLinkRow(
          title: LearnCopy.finishRevise,
          note: LearnCopy.finishReviseNote(active.step, active.total),
          onTap: () => unawaited(_open(AppRoutes.learnRun(active.id))),
        )
      else if (catalog.core.recallEnabled && queue.due > 0)
        LearnLinkRow(
          title: LearnCopy.reviseCards(queue.due),
          note: _startMessage ?? LearnCopy.reviseCardsNote(queue.due),
          onTap: _starting ? null : _startRecall,
        )
      else if (catalog.core.recallEnabled && queue.newReady > 0)
        LearnLinkRow(
          title: LearnCopy.newReadyHeadline(queue.newReady).replaceAll('.', ''),
          note: _startMessage ?? LearnCopy.newReadyFrom,
          onTap: _starting ? null : _startRecall,
        )
      else if (queue.pausedNew)
        Padding(
          padding: const EdgeInsets.symmetric(vertical: MmSpace.s8),
          child: Text(LearnCopy.newCardsPaused, style: type.small.copyWith(color: colors.ink2)),
        ),
    ];

    Widget divider() => Divider(height: 1, thickness: 1, color: colors.line);

    final List<Widget> library;
    if (results != null) {
      final count = results.lessons.length + results.chapters.length;
      library = [
        LearnSectionHead(
          title: LearnCopy.resultsHeading,
          note: count == 0 ? null : LearnCopy.resultsCount(results.lessons.length, results.chapters.length),
        ),
        const SizedBox(height: MmSpace.s8),
        if (count == 0)
          Text(LearnCopy.nothingMatches, style: type.body.copyWith(color: colors.ink2))
        else ...[
          for (final u in results.lessons)
            LessonLine(
              unit: u,
              where: whereOf(u),
              sub: [nameOf(u.subject), ?u.chapter].join(', '),
              onOpen: () => _openUnit(u),
            ),
          for (final c in results.chapters)
            LearnLinkRow(
              title: c.name,
              note: LearnCopy.noLessonChapter(nameOf(c.subject)),
              onTap: () => unawaited(context.push<void>(LearnPaths.practiseChapter(c.subject, c.name))),
            ),
        ],
      ];
    } else if (subject == null) {
      library = const [];
    } else {
      final lose = loseMarks(catalog, costs, subject).take(4).toList();
      final all = allChapters(catalog, costs, subject);
      final subjectName = subjectInfo?.title ?? nameOf(subject);
      library = [
        if (shown.length > 1) ...[
          ChipRail(
            padding: EdgeInsets.zero,
            semanticLabel: LearnCopy.subjectSwitch,
            revealIndex: subjectIds.indexOf(subject),
            children: [
              for (final s in shown)
                MmChip(
                  label: s.title,
                  selected: s.id == subject,
                  showBubble: false,
                  onTap: () => setState(() => _subject = s.id),
                ),
            ],
          ),
          const SizedBox(height: MmRhythm.group),
        ],
        if (lose.isNotEmpty) ...[
          const LearnSectionHead(title: LearnCopy.loseHeading, note: LearnCopy.loseNote),
          const SizedBox(height: MmSpace.s4),
          for (final row in lose)
            LoseMarksBlock(
              row: row,
              whereOf: whereOf,
              onOpen: (u) => _openUnit(u, fromMarks: true),
              onPractise: () => unawaited(context.push<void>(LearnPaths.practiseChapter(subject, row.name))),
            ),
          const SectionBreak(),
        ],
        LearnSectionHead(
          title: LearnCopy.allChapters(subjectName),
          note: all.lessons > 0 ? all.head : LearnCopy.chaptersPreparing,
          subjectId: subject,
          subjectName: subjectName,
        ),
        const SizedBox(height: MmSpace.s4),
        for (final (i, row) in all.chapters.indexed) ...[
          if (i > 0) divider(),
          ChapterFold(
            key: ValueKey('chapter-$subject-${row.name}'),
            row: row,
            whereOf: whereOf,
            onOpen: (u) => _openUnit(u, fromMarks: row.marks > 0),
            onPractise: () => unawaited(context.push<void>(LearnPaths.practiseChapter(subject, row.name))),
            onSummary: () => unawaited(_open(LearnPaths.summary(subject, row.name))),
          ),
        ],
        if (all.chapters.isNotEmpty) ...[
          const SizedBox(height: MmSpace.s8),
          Text(LearnCopy.syllabusFoot, style: type.caption.copyWith(color: colors.ink3)),
        ],
      ];
    }

    final record = recordLine(catalog);

    final Widget column = Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    MmStaggerItem(
                      index: 0,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          // One line of lede. "How Learn works" is the first visit's own explainer and is gone after it.
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
                    if (noLessons)
                      Padding(
                        padding: const EdgeInsets.only(bottom: MmRhythm.group),
                        child: Column(
                          children: [
                            const Mobi(
                              pose: MobiPose.read,
                              size: 140,
                              say: LearnCopy.noLessonsMobi,
                              interactive: true,
                              tapCycle: MobiTapCycle.standard,
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
                      )
                    else
                      MmStaggerItem(
                        index: 1,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            ReadNextPanel(
                              pick: pick,
                              subjectName: pick.unit == null ? null : nameOf(pick.unit!.subject),
                              busy: _startingLesson,
                              message: _lessonMessage,
                              onStart: () => unawaited(_startPick(pick)),
                            ),
                            if (pick.kind == PickKind.finish && pending.contains(pick.runId)) ...[
                              const SizedBox(height: MmSpace.s8),
                              Text(LearnCopy.pendingOnPhone(1), style: type.small.copyWith(color: colors.ink2)),
                            ],
                          ],
                        ),
                      ),
                    if (rows.isNotEmpty)
                      MmStaggerItem(
                        index: 2,
                        child: Padding(
                          padding: const EdgeInsets.only(top: MmSpace.s8),
                          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: rows),
                        ),
                      ),
                    const SizedBox(height: MmRhythm.group),
                    if (catalog.units.isNotEmpty || catalog.subjects.any((s) => s.chapters.isNotEmpty)) ...[
                      MmStaggerItem(
                        index: 3,
                        child: LearnSearchField(
                          controller: _search,
                          onChanged: (q) => setState(() => _query = q),
                        ),
                      ),
                      const SizedBox(height: MmRhythm.group),
                    ],
                    MmStaggerItem(
                      index: 4,
                      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: library),
                    ),
                    if (!noLessons) ...[
                      const SectionBreak(),
                      Text(record.text, style: type.small.copyWith(color: colors.ink2, fontFeatures: const [FontFeature.tabularFigures()])),
                      const SizedBox(height: MmSpace.s4),
                      LearnLinkRow(
                        title: LearnCopy.fullMockTitle,
                        note: LearnCopy.fullMockNote,
                        onTap: () => context.go(AppRoutes.practice),
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
                        onRemove: (subject) => unawaited(
                          ref
                              .read(offlineLearnProvider.notifier)
                              .removeKept(subject),
                        ),
                      ),
                    ],
                  ],
                );

    // As a door: on Practice's gutter, in Practice's list; the door's own arrival is the entrance.
    if (widget.embedded) return Padding(padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter), child: column);

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
              // One authored entrance when the content first arrives: the words, the panel that holds the one
              // action, then the library in reading order. Never on scroll.
              child: MmStagger(
                enabled: !_afterSkeleton,
                child: column,
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
