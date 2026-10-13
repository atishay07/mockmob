import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/attempt.dart';
import '../../../core/models/question.dart';
import '../../../core/repositories/attempts_repository.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import 'question_panel.dart';

/// The sheet behind "See the answer" and "Try it again" for a skipped question. The key and
/// explanation follow the key rule of spec 5.7, read from the attempt detail. A try stays on
/// this screen: it is not sent anywhere and not recorded.
class AnswerSheetBody extends ConsumerStatefulWidget {
  const AnswerSheetBody({super.key, required this.attemptId, required this.questionId, required this.tryFirst});

  final String attemptId;
  final String questionId;

  /// "Try it again": options are live until one is chosen; then the answer shows.
  final bool tryFirst;

  @override
  ConsumerState<AnswerSheetBody> createState() => _AnswerSheetBodyState();
}

class _AnswerSheetBodyState extends ConsumerState<AnswerSheetBody> {
  int? _picked;

  SnapshotQuestion? _question(Attempt a) {
    for (final q in a.questions) {
      if (q.id == widget.questionId) return q;
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final detailState = ref.watch(attemptDetailProvider(widget.attemptId));
    final detail = detailState.value;

    if (detail == null) {
      if (detailState.isFailedEmpty) {
        return Padding(
          padding: const EdgeInsets.only(bottom: MmSpace.s16),
          child: InlineBanner(
            message: ReviewCopy.keyNeedsConnection,
            tone: BannerTone.offline,
            actionLabel: ReviewCopy.tryAgainKey,
            onAction: () => ref.read(attemptDetailProvider(widget.attemptId).notifier).refresh(),
          ),
        );
      }
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: MmSpace.s32),
        child: Center(
          child: Semantics(label: ReviewCopy.loadingAnswers, liveRegion: true, child: MmSpinner(color: colors.ink2)),
        ),
      );
    }

    final q = _question(detail.attempt);
    if (q == null) return Text(ReviewCopy.notFound, style: type.body.copyWith(color: colors.ink2));
    final keyIndex = detail.visibleKeyIndex(q.id);
    final explanation = detail.visibleExplanation(q.id)?.trim();
    final revealed = !widget.tryFirst || _picked != null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (!revealed) ...[
          Text(q.question, style: type.question),
          const SizedBox(height: MmSpace.s16),
          for (var i = 0; i < q.options.length; i++) ...[
            if (i > 0) const SizedBox(height: MmSpace.s8),
            KeyButton.option(
              label: q.options[i].text,
              selected: false,
              leading: Text(q.options[i].key, style: type.label.copyWith(color: colors.ink2)),
              onPressed: () => setState(() => _picked = i),
            ),
          ],
          const SizedBox(height: MmSpace.s12),
          Text(ReviewCopy.tryNotRecorded, style: type.caption.copyWith(color: colors.ink3)),
        ] else ...[
          QuestionPanel(question: q, chosen: _picked, keyIndex: keyIndex),
          const SizedBox(height: MmSpace.s16),
          if (keyIndex == null)
            Text(ReviewCopy.keyHidden, style: type.body.copyWith(color: colors.ink2))
          else ...[
            Text(ReviewCopy.keyExplanationLabel, style: type.label.copyWith(color: colors.ink2)),
            const SizedBox(height: MmSpace.s8),
            Text(explanation == null || explanation.isEmpty ? ReviewCopy.noKeyExplanation : explanation, style: type.body),
          ],
          if (widget.tryFirst) ...[
            const SizedBox(height: MmSpace.s12),
            Text(ReviewCopy.tryNotRecorded, style: type.caption.copyWith(color: colors.ink3)),
          ],
        ],
        const SizedBox(height: MmSpace.s8),
      ],
    );
  }
}

/// Opens [AnswerSheetBody] in a glass sheet.
Future<void> showAnswerSheet(
  BuildContext context, {
  required String attemptId,
  required String questionId,
  required int number,
  required bool tryFirst,
}) => showMmSheet<void>(
  context: context,
  title: ReviewCopy.questionLabel(number),
  builder: (context) => AnswerSheetBody(attemptId: attemptId, questionId: questionId, tryFirst: tryFirst),
);
