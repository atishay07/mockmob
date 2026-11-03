import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/repositories/remote_state.dart';
import '../../../core/motion/motion.dart';
import '../../../core/router/app_shell.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/catalog_repository.dart';
import '../data/learn_store.dart';
import '../data/lesson_loader.dart';
import '../data/run_starter.dart';
import '../models/learn_catalog.dart';
import '../widgets/due_card.dart';
import '../widgets/lesson_list.dart';
import '../widgets/offline_packs.dart';

/// Runs that have an event on this phone the server has not acknowledged.
final pendingRunIdsProvider = FutureProvider.autoDispose<List<String>>((ref) => ref.read(learnStoreProvider).pendingRunIds());

/// The Learn tab (spec 5.9): the due summary, the run to pick up, the lessons with their
/// status words, and the offline switches.
class LearnScreen extends ConsumerStatefulWidget {
  const LearnScreen({super.key});

  @override
  ConsumerState<LearnScreen> createState() => _LearnScreenState();
}

class _LearnScreenState extends ConsumerState<LearnScreen> {
  final _scroll = ScrollController();
  bool _starting = false;
  String? _startMessage;

  static const int _learnTabIndex = 3;

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    ref.invalidate(pendingRunIdsProvider);
    await ref.read(learnCatalogProvider.notifier).refresh();
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

  @override
  Widget build(BuildContext context) {
    ref.listen(tabReselectProvider, (previous, next) {
      if (next != null && next.tabIndex == _learnTabIndex && _scroll.hasClients) {
        _scroll.animateTo(0, duration: Motion.of(context, Motion.card), curve: Motion.out);
      }
    });
    final colors = context.mmColors;
    final state = ref.watch(learnCatalogProvider);
    final catalog = state.value;

    Widget body;
    if (catalog == null) {
      body = _emptyBody(state);
    } else if (catalog.isDisabled) {
      body = StateView(
        kind: StateViewKind.empty,
        title: LearnCopy.disabledTitle,
        message: LearnCopy.disabledMessage,
        primary: StateAction(LearnCopy.disabledAction, () => context.go(AppRoutes.practice)),
      );
    } else {
      body = _content(catalog, state);
    }

    return Scaffold(
      backgroundColor: colors.ground,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            if (state.isStale && (state.error?.isOffline ?? false)) const InlineBanner.offlineStrip(),
            Expanded(child: body),
          ],
        ),
      ),
    );
  }

  Widget _emptyBody(RemoteState<LearnCatalog> state) {
    if (state.isFailedEmpty) {
      final offline = state.error?.isOffline ?? false;
      return StateView(
        kind: offline ? StateViewKind.offline : StateViewKind.error,
        title: offline ? LearnCopy.offlineTitle : LearnCopy.loadFailedTitle,
        message: offline ? LearnCopy.offlineMessage : LearnCopy.loadFailedMessage,
        primary: StateAction(LearnCopy.tryAgain, () => unawaited(_refresh())),
      );
    }
    return const _LearnSkeleton();
  }

  Widget _content(LearnCatalog catalog, RemoteState<LearnCatalog> state) {
    final colors = context.mmColors;
    final type = context.mmType;
    final pending = ref.watch(pendingRunIdsProvider).value ?? const <String>[];
    final offline = ref.watch(offlineLearnProvider).value ?? const OfflineLearnState();
    final subjects = catalog.subjectsWithLessons;
    final active = catalog.active;
    final hasResume = active != null && active.id.isNotEmpty;

    return RefreshIndicator(
      color: colors.ink,
      backgroundColor: colors.raised,
      onRefresh: _refresh,
      child: ListView(
        controller: _scroll,
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s16, MmSpace.gutter, MmSpace.s32),
        children: [
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: MmSpace.contentMaxWidth),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Padding(
                    padding: const EdgeInsets.only(left: MmSpace.s4, bottom: MmSpace.s16),
                    child: Semantics(header: true, child: Text(LearnCopy.title, style: type.headline)),
                  ),
                  if (hasResume) ...[
                    ResumeCard(
                      run: LearnActiveRun(
                        id: active.id,
                        title: active.title,
                        position: runPosition(active.mode, active.step, active.total),
                      ),
                      pendingCount: pending.contains(active.id) ? 1 : 0,
                      onContinue: () => _open(AppRoutes.learnRun(active.id)),
                    ),
                    const SizedBox(height: MmSpace.s16),
                  ],
                  DueCard(
                    queue: StudyQueueView.of(catalog),
                    recallEnabled: catalog.core.recallEnabled,
                    primary: !hasResume,
                    starting: _starting,
                    message: _startMessage,
                    onStart: _startRecall,
                  ),
                  if (!hasResume && catalog.next != null && catalog.next!.id.isNotEmpty) ...[
                    const SizedBox(height: MmSpace.s16),
                    NextLessonCard(lesson: catalog.next!, onOpen: () => _open(AppRoutes.learnUnit(catalog.next!.id))),
                  ],
                  const SizedBox(height: MmSpace.group),
                  if (catalog.units.isEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: MmSpace.s24),
                      child: Column(
                        children: [
                          Text(LearnCopy.noLessonsTitle, style: type.title, textAlign: TextAlign.center),
                          const SizedBox(height: MmSpace.s8),
                          Text(
                            LearnCopy.noLessonsMessage,
                            style: type.body.copyWith(color: colors.ink2),
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),
                    )
                  else ...[
                    for (final subject in subjects) ...[
                      SubjectLessons(
                        title: subject.title,
                        units: catalog.unitsOf(subject.id),
                        onOpen: (unit) => _open(AppRoutes.learnUnit(unit.id)),
                      ),
                      const SizedBox(height: MmSpace.s24),
                    ],
                    const SizedBox(height: MmSpace.s8),
                    OfflinePacks(
                      subjects: subjects,
                      state: offline,
                      onChanged: (subject, keep) =>
                          unawaited(ref.read(offlineLearnProvider.notifier).setKept(subject, keep: keep)),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _LearnSkeleton extends StatelessWidget {
  const _LearnSkeleton();

  @override
  Widget build(BuildContext context) {
    return const SkeletonGroup(
      child: Padding(
        padding: EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s16, MmSpace.gutter, 0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Skeleton(width: 120, height: 32),
            SizedBox(height: MmSpace.s16),
            Skeleton(height: 168, radius: MmRadius.panel),
            SizedBox(height: MmSpace.group),
            Skeleton(width: 140, height: 20),
            SizedBox(height: MmSpace.s12),
            Skeleton(height: 180, radius: MmRadius.panel),
          ],
        ),
      ),
    );
  }
}
