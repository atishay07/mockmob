// `/today/why/:actionId`: the evidence behind tonight's move. A sheet body only; `MmSheetPage`
// supplies the glass frame. Every figure is a count from the student's own paper.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/copy/formatters.dart';
import '../../../core/repositories/repositories.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../insights/ask_mobi.dart' show AskMobiLink, askMobiAboutToday, openAskMobi;
import '../copy.dart';
import '../copy_pattern.dart' show PatternLine, whyLines;
import '../data/today_providers.dart';
import '../logic/why_ask.dart';
import '../logic/why_model.dart';
import '../widgets/pattern_insight.dart' show PatternLines;

class WhySheet extends ConsumerWidget {
  const WhySheet({super.key, required this.attemptId});

  final String attemptId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final attempts = ref.watch(attemptsRepositoryProvider).value ?? const [];
    final inputs = ref.watch(todayInputsProvider);
    final model = buildWhy(attempts, attemptId, toDate: inputs.date);
    final pattern = inputs.pattern;
    return WhySheetBody(
      model: model,
      learned: pattern == null ? const [] : whyLines(pattern),
      onSeeAnswers: model == null
          ? null
          : () {
              final router = GoRouter.of(context);
              Navigator.of(context).maybePop();
              router.push(model.isMock ? AppRoutes.result(model.attemptId) : AppRoutes.practiceResult(model.attemptId));
            },
      // Mobi opens over this sheet, already about it: the paper's own counts are the first answer.
      onAsk: model == null ? null : () => openAskMobi(context, askContextOfWhy(model)),
    );
  }
}

class WhySheetBody extends StatelessWidget {
  const WhySheetBody({super.key, required this.model, this.onSeeAnswers, this.onAsk, this.learned = const []});

  final WhyModel? model;

  /// What the smart layer learned that orders the moves (his most-picked mode, the cards he keeps
  /// passing on), each with "Not quite right?". Empty shows nothing.
  final List<PatternLine> learned;
  final VoidCallback? onSeeAnswers;

  /// "Ask Mobi about today": a quiet line under See my answers. Null shows nothing.
  final VoidCallback? onAsk;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final m = model;
    return Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.s20, MmSpace.s4, MmSpace.s20, MmSpace.s24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(header: true, child: Text(TodayCopy.whyTitle, style: type.title)),
          const SizedBox(height: MmSpace.s12),
          if (m == null)
            Text(TodayCopy.whyMissing, style: type.body.copyWith(color: colors.ink2))
          else ...[
            Text(TodayCopy.whyFrom(m.source, m.subject, m.date), style: type.body),
            const SizedBox(height: MmSpace.s4),
            Text(TodayCopy.whyCounts(m.wrong, m.correct, m.blank), style: type.body.copyWith(color: colors.ink2)),
            if (m.chapters.isNotEmpty) ...[
              const SizedBox(height: MmSpace.s20),
              for (final c in m.chapters) _ChapterLine(chapter: c),
            ],
            const SizedBox(height: MmSpace.s16),
            Text(TodayCopy.whyRepair, style: type.body.copyWith(color: colors.ink2)),
            if (m.early) ...[
              const SizedBox(height: MmSpace.s8),
              Text(TodayCopy.whyEarly, style: type.caption.copyWith(color: colors.ink3)),
            ],
            if (learned.isNotEmpty) ...[
              const SizedBox(height: MmSpace.s16),
              PatternLines(lines: learned),
            ],
            const SizedBox(height: MmSpace.s20),
            KeyButton.secondary(label: TodayCopy.seeMyAnswers, onPressed: onSeeAnswers),
            if (onAsk != null) ...[
              const SizedBox(height: MmSpace.s4),
              Center(child: AskMobiLink(label: askMobiAboutToday, onTap: onAsk!)),
            ],
          ],
        ],
      ),
    );
  }
}

class _ChapterLine extends StatelessWidget {
  const _ChapterLine({required this.chapter});

  final WhyChapter chapter;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final c = chapter;
    final states = [
      for (var i = 0; i < c.wrong; i++) BubbleState.wrong,
      for (var i = 0; i < c.blank; i++) BubbleState.blank,
      for (var i = 0; i < c.questions - c.wrong - c.blank; i++) BubbleState.filled,
    ];
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: MmSpace.s8),
      child: Semantics(
        container: true,
        label: '${c.chapter}: ${TodayCopy.chapterRow(c.wrong, c.blank)}, ${plural(c.questions, 'question')}',
        excludeSemantics: true,
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(c.chapter, style: type.labelLarge, maxLines: 2, overflow: TextOverflow.ellipsis),
                  Text(TodayCopy.chapterRow(c.wrong, c.blank), style: type.caption.copyWith(color: colors.ink2)),
                ],
              ),
            ),
            const SizedBox(width: MmSpace.s12),
            BubbleRow(states: states.take(10).toList(), bubbleSize: 10, gap: 3),
          ],
        ),
      ),
    );
  }
}
