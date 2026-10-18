import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api_error.dart';
import '../../../core/models/json_helpers.dart';
import '../../../core/models/study.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../learn_paths.dart';
import '../models/learn_catalog.dart';
import '../data/catalog_repository.dart';
import '../data/concepts_pick.dart';
import '../data/lesson_loader.dart';
import '../data/run_starter.dart';
import '../widgets/idea_line.dart';
import '../widgets/lesson_block.dart';
import '../widgets/lesson_list.dart';
import '../widgets/screen_bits.dart';

/// A lesson (spec 5.9): its objectives and teaching blocks, then the way into the guided
/// lesson or the lesson's cards. Opening it is what asks the server for the content.
class LearnUnitScreen extends ConsumerStatefulWidget {
  const LearnUnitScreen({super.key, required this.unitId, this.from});

  final String unitId;

  /// Where the student came from (5.10): the page says why they are here.
  final LessonFrom? from;

  @override
  ConsumerState<LearnUnitScreen> createState() => _LearnUnitScreenState();
}

class _LearnUnitScreenState extends ConsumerState<LearnUnitScreen> {
  bool _starting = false;
  String? _message;

  /// A run was opened from here: lesson progress now comes from the catalog, never from reading
  /// the lesson again (every read of a lesson is a study exposure on the server, and offline it
  /// would replace the lesson with an error page).
  bool _ranHere = false;

  void _leave() {
    if (context.canPop()) {
      context.pop();
    } else {
      context.go(AppRoutes.learn);
    }
  }

  Future<void> _start(String mode, {String? resumeRunId}) async {
    if (_starting) return;
    if (resumeRunId != null) {
      await context.push<void>(AppRoutes.learnRun(resumeRunId));
      _afterRun();
      return;
    }
    setState(() {
      _starting = true;
      _message = null;
    });
    final result = await ref
        .read(runStarterProvider)
        .start(mode: mode, unitId: widget.unitId);
    if (!mounted) return;
    setState(() {
      _starting = false;
      _message = result.message;
    });
    final run = result.run;
    if (run != null) {
      await context.push<void>(AppRoutes.learnRun(run.id));
      _afterRun();
    }
  }

  /// The `from` block's line (5.10): a neutral hairline block, never a wash or a box.
  String? _fromLine(StudyUnit unit) {
    final from = widget.from;
    switch (from) {
      case FromChapter(:final subject, :final chapter):
        final costs = ref.watch(learnChapterCostsProvider) ?? const <ChapterCost>[];
        final open = costs.where((c) => c.subject == catalogSubjectId(subject) && nameKey(c.chapter) == nameKey(chapter)).fold(0, (n, c) => n + c.open);
        return open > 0 ? LearnCopy.fromChapter(open) : null;
      case FromQuestion(:final number):
        return LearnCopy.fromQuestion(number);
      case FromToday() || null:
        return null;
    }
  }

  /// The back link under the block, only for a question (the bar's own back covers the rest).
  String? get _backLabel => switch (widget.from) {
    FromQuestion(:final number) => LearnCopy.backToQuestion(number),
    _ => null,
  };

  void _afterRun() {
    if (!mounted) return;
    setState(() => _ranHere = true);
    unawaited(ref.read(learnCatalogProvider.notifier).refresh());
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final load = ref.watch(lessonProvider(widget.unitId));
    return LearnBackScope(
      fallback: AppRoutes.learn,
      child: Scaffold(
        backgroundColor: colors.ground,
        body: SafeArea(
          child: Column(
            children: [
              LearnPageHeader(
                onBack: _leave,
                backLabel: LearnCopy.backToLearn,
              ),
              if (load.value?.fromPhone ?? false)
                const InlineBanner.offlineStrip(),
              Expanded(
                child: load.when(
                  loading: () => const _UnitSkeleton(),
                  error: (error, _) => _errorBody(error),
                  data: _content,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _errorBody(Object error) {
    final api = error is ApiError ? error : null;
    if (api != null && api.kind == ApiErrorKind.notFound) {
      return StateView(
        kind: StateViewKind.empty,
        title: LearnCopy.unitMissingTitle,
        message: LearnCopy.unitMissingMessage,
        primary: StateAction(LearnCopy.backToLearn, _leave),
      );
    }
    if (api != null && api.isOffline) {
      return StateView(
        kind: StateViewKind.offline,
        title: LearnCopy.unitOfflineTitle,
        message: LearnCopy.unitOfflineMessage,
        primary: StateAction(
          LearnCopy.tryAgain,
          () => ref.invalidate(lessonProvider(widget.unitId)),
        ),
        secondary: StateAction(LearnCopy.backToLearn, _leave),
      );
    }
    return StateView(
      kind: StateViewKind.error,
      title: LearnCopy.unitMissingTitle,
      message: LearnCopy.loadFailedMessage,
      primary: StateAction(
        LearnCopy.tryAgain,
        () => ref.invalidate(lessonProvider(widget.unitId)),
      ),
      secondary: StateAction(LearnCopy.backToLearn, _leave),
    );
  }

  Widget _content(LessonLoad load) {
    final colors = context.mmColors;
    final type = context.mmType;
    final unit = StudyUnit.fromJson(load.json);
    final progress = asJson(load.json['progress']);
    var status = StudyUnitStatus.fromWire(asString(progress['status']));
    var read = asBool(progress['read']) ?? false;
    var runId = asString(asJson(progress['inProgress'])['runId']);
    if (_ranHere) {
      final units =
          ref.watch(learnCatalogProvider).value?.units ?? const <LearnUnit>[];
      final fresh = units.where((u) => u.id == widget.unitId).firstOrNull;
      if (fresh != null) {
        status = fresh.status;
        runId = fresh.runId;
        read =
            read ||
            fresh.status == StudyUnitStatus.lockIn ||
            fresh.status == StudyUnitStatus.due ||
            fresh.status == StudyUnitStatus.learned;
      }
    }
    final cards = unit.recallAvailable;
    final blocks = [
      for (final b in asJsonList(load.json['blocks']))
        if (asString(b['type']) == 'reading') b,
    ];
    final minutes = unit.estimatedMinutes;
    final meta = [
      LearnCopy.statusWord(status),
      ?(minutes == null ? null : LearnCopy.minutes(minutes)),
    ].join(', ');

    final reviewFirst = read && cards > 0;
    final lessonLabel = runId != null
        ? LearnCopy.continueLesson
        : (read ? LearnCopy.lessonAgain : LearnCopy.startLesson);
    VoidCallback? lessonTap() =>
        _starting ? null : () => unawaited(_start('learn', resumeRunId: runId));
    VoidCallback? reviewTap() =>
        _starting ? null : () => unawaited(_start('recall'));

    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(
              MmSpace.gutter,
              MmSpace.s16,
              MmSpace.gutter,
              MmSpace.s24,
            ),
            children: [
              Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(
                    maxWidth: MmSpace.contentMaxWidth,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Semantics(
                        header: true,
                        child: Text(unit.title, style: type.headline),
                      ),
                      const SizedBox(height: MmSpace.s8),
                      Text(
                        meta,
                        style: type.small.copyWith(color: colors.ink2),
                      ),
                      if (unit.summary != null) ...[
                        const SizedBox(height: MmSpace.s12),
                        Text(unit.summary!, style: type.lead),
                      ],
                      if (_fromLine(unit) case final line?) ...[
                        const SizedBox(height: MmSpace.s16),
                        _FromBlock(line: line, back: _backLabel, onBack: _leave),
                        const SizedBox(height: MmSpace.s8),
                      ],
                      // Sections are typeset: air, a hairline, then the heading (SPACING.md 3.1).
                      if (unit.objectives.isNotEmpty) ...[
                        const SectionBreak(),
                        Semantics(
                          header: true,
                          child: Text(
                            LearnCopy.unitObjectives,
                            style: type.title,
                          ),
                        ),
                        const SizedBox(height: MmSpace.s12),
                        for (var i = 0; i < unit.objectives.length; i++)
                          IdeaLine(number: i + 1, text: unit.objectives[i]),
                      ],
                      if (blocks.isNotEmpty) ...[
                        const SectionBreak(),
                        Semantics(
                          header: true,
                          child: Text(LearnCopy.unitLesson, style: type.title),
                        ),
                        const SizedBox(height: MmSpace.s12),
                        for (final b in blocks) ...[
                          LessonBlock(block: b),
                          const SizedBox(height: MmSpace.s24),
                        ],
                      ],
                      if (unit.subject != null &&
                          unit.chapter != null &&
                          unit.chapter!.isNotEmpty)
                        ChapterSummaryRow(
                          chapter: unit.chapter!,
                          onTap: () => unawaited(
                            context.push<void>(
                              LearnPaths.summary(unit.subject!, unit.chapter!),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
        PinnedActions(
          message: _message,
          children: [
            if (reviewFirst) ...[
              KeyButton(
                label: LearnCopy.reviewLessonCards(cards),
                onPressed: reviewTap(),
                loading: _starting,
              ),
              KeyButton.secondary(label: lessonLabel, onPressed: lessonTap()),
            ] else
              KeyButton(
                label: lessonLabel,
                onPressed: lessonTap(),
                loading: _starting,
              ),
          ],
        ),
      ],
    );
  }
}

class _UnitSkeleton extends StatelessWidget {
  const _UnitSkeleton();

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
            Skeleton(width: 240, height: 32),
            SizedBox(height: MmSpace.s12),
            Skeleton.line(width: 120),
            SizedBox(height: MmSpace.s24),
            Skeleton.line(),
            SizedBox(height: MmSpace.s8),
            Skeleton.line(),
            SizedBox(height: MmSpace.s8),
            Skeleton.line(width: 200),
            SizedBox(height: MmSpace.s32),
            Skeleton(height: 140, radius: MmRadius.panel),
          ],
        ),
      ),
    );
  }
}

/// Where the student came from, above the lesson: a hairline, one line, and the way back to a question.
class _FromBlock extends StatelessWidget {
  const _FromBlock({required this.line, required this.back, required this.onBack});

  final String line;
  final String? back;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return DecoratedBox(
      decoration: BoxDecoration(border: Border(top: BorderSide(color: colors.line))),
      child: Padding(
        padding: const EdgeInsets.only(top: MmSpace.s12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(line, style: type.body.copyWith(color: colors.ink2)),
            if (back != null) KeyButton.quiet(label: back!, onPressed: onBack),
          ],
        ),
      ),
    );
  }
}
