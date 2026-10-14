import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:share_plus/share_plus.dart';

import '../../../core/api/api_error.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/summary_loader.dart';
import '../learn_paths.dart';
import '../models/chapter_summary.dart';
import '../widgets/idea_line.dart';
import '../widgets/lesson_block.dart';
import '../widgets/screen_bits.dart';

/// The chapter reader (web parity B2): every published lesson of one chapter in a single scroll,
/// each with its ideas and reading blocks, and a Share as text action. Opening it is what asks
/// the server for the content.
class LearnSummaryScreen extends ConsumerWidget {
  const LearnSummaryScreen({
    super.key,
    required this.subject,
    required this.chapter,
  });

  final String subject;
  final String chapter;

  void _leave(BuildContext context) =>
      context.canPop() ? context.pop() : context.go(AppRoutes.learn);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final load = ref.watch(chapterSummaryProvider((subject, chapter)));
    final summary = load.value;
    return LearnBackScope(
      fallback: AppRoutes.learn,
      child: Scaffold(
        backgroundColor: colors.ground,
        body: SafeArea(
          child: Column(
            children: [
              LearnPageHeader(
                onBack: () => _leave(context),
                backLabel: LearnCopy.backToLearn,
                trailing: summary != null && summary.lessons.isNotEmpty
                    ? IconTap(
                        icon: LucideIcons.share,
                        label: LearnCopy.shareAsText,
                        onTap: () => unawaited(
                          SharePlus.instance.share(
                            ShareParams(
                              text: summary.asText(),
                              subject: summary.chapter,
                            ),
                          ),
                        ),
                      )
                    : null,
              ),
              Expanded(
                child: load.when(
                  loading: () => const _SummarySkeleton(),
                  error: (error, _) => _error(context, ref, error),
                  data: (s) =>
                      s.lessons.isEmpty ? _empty(context) : _Reader(summary: s),
                ),
              ),
              // The one volt key: after reading, practise what was read.
              if (summary != null && summary.lessons.isNotEmpty)
                PinnedActions(
                  children: [
                    KeyButton(
                      label: LearnCopy.practiseChapter,
                      onPressed: () => unawaited(
                        context.push<void>(
                          LearnPaths.practiseChapter(subject, chapter),
                        ),
                      ),
                    ),
                  ],
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _empty(BuildContext context) => StateView(
    kind: StateViewKind.empty,
    title: LearnCopy.summaryEmptyTitle,
    message: LearnCopy.summaryEmptyMessage,
    primary: StateAction(LearnCopy.backToLearn, () => _leave(context)),
  );

  Widget _error(BuildContext context, WidgetRef ref, Object error) {
    final api = error is ApiError ? error : null;
    if (api != null && api.kind == ApiErrorKind.notFound) {
      return _empty(context);
    }
    final offline = api?.isOffline ?? false;
    return StateView(
      kind: offline ? StateViewKind.offline : StateViewKind.error,
      title: offline
          ? LearnCopy.summaryOfflineTitle
          : LearnCopy.summaryFailedTitle,
      message: offline
          ? LearnCopy.summaryOfflineMessage
          : LearnCopy.summaryFailedMessage(api),
      primary: StateAction(
        LearnCopy.tryAgain,
        () => ref.invalidate(chapterSummaryProvider((subject, chapter))),
      ),
      secondary: StateAction(LearnCopy.backToLearn, () => _leave(context)),
    );
  }
}

class _Reader extends StatelessWidget {
  const _Reader({required this.summary});

  final ChapterSummary summary;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return ListView(
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
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  LearnCopy.summaryLabel,
                  style: type.label.copyWith(color: colors.ink2),
                ),
                const SizedBox(height: MmSpace.s4),
                Semantics(
                  header: true,
                  child: Text(summary.chapter, style: type.headline),
                ),
                const SizedBox(height: MmSpace.s8),
                Text(
                  LearnCopy.summaryCount(summary.lessons.length),
                  style: type.small.copyWith(color: colors.ink2),
                ),
                for (var i = 0; i < summary.lessons.length; i++) ...[
                  if (i == 0)
                    const SizedBox(height: MmSpace.s24)
                  else
                    const SectionBreak(),
                  _LessonSection(lesson: summary.lessons[i]),
                ],
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _LessonSection extends StatelessWidget {
  const _LessonSection({required this.lesson});

  final SummaryLesson lesson;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(header: true, child: Text(lesson.title, style: type.title)),
        if (lesson.objectives.isNotEmpty) ...[
          const SizedBox(height: MmSpace.s12),
          for (var i = 0; i < lesson.objectives.length; i++)
            IdeaLine(number: i + 1, text: lesson.objectives[i]),
        ],
        for (final b in lesson.blocks) ...[
          const SizedBox(height: MmSpace.s16),
          LessonBlock(block: b),
        ],
      ],
    );
  }
}

class _SummarySkeleton extends StatelessWidget {
  const _SummarySkeleton();

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
            Skeleton.line(width: 120),
            SizedBox(height: MmSpace.s8),
            Skeleton(width: 260, height: 32),
            SizedBox(height: MmSpace.s24),
            Skeleton(width: 200, height: 24),
            SizedBox(height: MmSpace.s12),
            Skeleton.line(),
            SizedBox(height: MmSpace.s8),
            Skeleton.line(),
            SizedBox(height: MmSpace.s24),
            Skeleton(height: 140, radius: MmRadius.panel),
          ],
        ),
      ),
    );
  }
}
