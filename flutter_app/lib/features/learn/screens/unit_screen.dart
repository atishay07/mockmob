import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api_error.dart';
import '../../../core/models/json_helpers.dart';
import '../../../core/models/study.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/catalog_repository.dart';
import '../data/lesson_loader.dart';
import '../data/run_starter.dart';
import '../widgets/lesson_block.dart';
import '../widgets/screen_bits.dart';

/// A lesson (spec 5.9): its objectives and teaching blocks, then the way into the guided
/// lesson or the lesson's cards. Opening it is what asks the server for the content.
class LearnUnitScreen extends ConsumerStatefulWidget {
  const LearnUnitScreen({super.key, required this.unitId});

  final String unitId;

  @override
  ConsumerState<LearnUnitScreen> createState() => _LearnUnitScreenState();
}

class _LearnUnitScreenState extends ConsumerState<LearnUnitScreen> {
  bool _starting = false;
  String? _message;

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
    final result = await ref.read(runStarterProvider).start(mode: mode, unitId: widget.unitId);
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

  void _afterRun() {
    if (!mounted) return;
    ref.invalidate(lessonProvider(widget.unitId));
    unawaited(ref.read(learnCatalogProvider.notifier).refresh());
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final load = ref.watch(lessonProvider(widget.unitId));
    return Scaffold(
      backgroundColor: colors.ground,
      body: SafeArea(
        child: Column(
          children: [
            Align(alignment: Alignment.centerLeft, child: IconTap(icon: LucideIcons.arrowLeft, label: LearnCopy.backToLearn, onTap: _leave)),
            if (load.value?.fromPhone ?? false) const InlineBanner.offlineStrip(),
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
        primary: StateAction(LearnCopy.tryAgain, () => ref.invalidate(lessonProvider(widget.unitId))),
        secondary: StateAction(LearnCopy.backToLearn, _leave),
      );
    }
    return StateView(
      kind: StateViewKind.error,
      title: LearnCopy.unitMissingTitle,
      message: LearnCopy.loadFailedMessage,
      primary: StateAction(LearnCopy.tryAgain, () => ref.invalidate(lessonProvider(widget.unitId))),
      secondary: StateAction(LearnCopy.backToLearn, _leave),
    );
  }

  Widget _content(LessonLoad load) {
    final colors = context.mmColors;
    final type = context.mmType;
    final unit = StudyUnit.fromJson(load.json);
    final progress = asJson(load.json['progress']);
    final status = StudyUnitStatus.fromWire(asString(progress['status']));
    final read = asBool(progress['read']) ?? false;
    final runId = asString(asJson(progress['inProgress'])['runId']);
    final cards = unit.recallAvailable;
    final blocks = [
      for (final b in asJsonList(load.json['blocks']))
        if (asString(b['type']) == 'reading') b,
    ];
    final minutes = unit.estimatedMinutes;
    final meta = [LearnCopy.statusWord(status), ?(minutes == null ? null : LearnCopy.minutes(minutes))].join(', ');

    final reviewFirst = read && cards > 0;
    final lessonLabel = runId != null ? LearnCopy.continueLesson : (read ? LearnCopy.lessonAgain : LearnCopy.startLesson);
    VoidCallback? lessonTap() => _starting ? null : () => unawaited(_start('learn', resumeRunId: runId));
    VoidCallback? reviewTap() => _starting ? null : () => unawaited(_start('recall'));

    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, MmSpace.s24),
            children: [
              Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: MmSpace.contentMaxWidth),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Semantics(header: true, child: Text(unit.title, style: type.headline)),
                      const SizedBox(height: MmSpace.s8),
                      Text(meta, style: type.small.copyWith(color: colors.ink2)),
                      if (unit.summary != null) ...[
                        const SizedBox(height: MmSpace.s12),
                        Text(unit.summary!, style: type.lead),
                      ],
                      if (unit.objectives.isNotEmpty) ...[
                        const SizedBox(height: MmSpace.s24),
                        Semantics(header: true, child: Text(LearnCopy.unitObjectives, style: type.subhead)),
                        const SizedBox(height: MmSpace.s8),
                        for (final o in unit.objectives) _Objective(text: o),
                      ],
                      if (blocks.isNotEmpty) ...[
                        const SizedBox(height: MmSpace.group),
                        Semantics(header: true, child: Text(LearnCopy.unitLesson, style: type.title)),
                        const SizedBox(height: MmSpace.s16),
                        for (final b in blocks) ...[LessonBlock(block: b), const SizedBox(height: MmSpace.s24)],
                      ],
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
              KeyButton(label: LearnCopy.reviewLessonCards(cards), onPressed: reviewTap(), loading: _starting),
              KeyButton.secondary(label: lessonLabel, onPressed: lessonTap()),
            ] else
              KeyButton(label: lessonLabel, onPressed: lessonTap(), loading: _starting),
          ],
        ),
      ],
    );
  }
}

class _Objective extends StatelessWidget {
  const _Objective({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Padding(
      padding: const EdgeInsets.only(bottom: MmSpace.s8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 9, right: MmSpace.s12),
            child: DecoratedBox(
              decoration: BoxDecoration(color: colors.ink, shape: BoxShape.circle),
              child: const SizedBox(width: 6, height: 6),
            ),
          ),
          Expanded(child: Text(text, style: context.mmType.body)),
        ],
      ),
    );
  }
}

class _UnitSkeleton extends StatelessWidget {
  const _UnitSkeleton();

  @override
  Widget build(BuildContext context) {
    return const SkeletonGroup(
      child: Padding(
        padding: EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s16, MmSpace.gutter, 0),
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
