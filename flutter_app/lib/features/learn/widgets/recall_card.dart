import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';

/// The question side of a card: the idea it belongs to, the prompt, and a sentence with a gap
/// when the task has one.
class PromptCard extends StatelessWidget {
  const PromptCard({
    super.key,
    required this.prompt,
    this.sentence,
    this.objective,
  });

  final String? prompt;
  final String? sentence;
  final String? objective;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.raised,
        borderRadius: MmRadius.panelAll,
        border: Border.all(color: colors.line),
        boxShadow: colors.cardShadow,
      ),
      child: Padding(
        padding: const EdgeInsets.all(MmSpace.cardPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (objective != null) ...[
              Text(objective!, style: type.label.copyWith(color: colors.ink2)),
              const SizedBox(height: MmSpace.s12),
            ],
            if (sentence != null) ...[
              Text(sentence!, style: type.question),
              const SizedBox(height: MmSpace.s12),
            ],
            if (prompt != null)
              Text(
                prompt!,
                style: sentence != null
                    ? type.body.copyWith(color: colors.ink2)
                    : type.question,
              ),
          ],
        ),
      ),
    );
  }
}

/// The answer side, hidden until the student taps. The whole panel is the target.
class RevealPanel extends StatelessWidget {
  const RevealPanel({
    super.key,
    required this.onTap,
    this.loading = false,
    this.note,
    this.announce = true,
  });

  final VoidCallback? onTap;
  final bool loading;

  /// A plain line under the label ("Connect to see the answer.").
  final String? note;

  /// False when a pinned key on the screen already announces the same action to TalkBack.
  final bool announce;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final panel = GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: loading ? null : onTap,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: colors.sunken,
          borderRadius: MmRadius.panelAll,
          border: Border.all(color: colors.line),
        ),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 112),
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(MmSpace.s16),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (loading)
                    MmSpinner(color: colors.ink)
                  else
                    Icon(LucideIcons.eye, size: 24, color: colors.ink3),
                  const SizedBox(height: MmSpace.s8),
                  Text(
                    LearnCopy.tapToReveal,
                    style: type.body.copyWith(color: colors.ink2),
                  ),
                  if (note != null) ...[
                    const SizedBox(height: MmSpace.s4),
                    Text(
                      note!,
                      style: type.small.copyWith(color: colors.ink2),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
    if (!announce) return ExcludeSemantics(child: panel);
    return Semantics(
      button: true,
      label: LearnCopy.tapToReveal,
      excludeSemantics: true,
      onTap: loading ? null : onTap,
      child: panel,
    );
  }
}

/// The revealed answer, its explanation and the memory cue. Announced to TalkBack when it
/// appears.
class AnswerPanel extends StatelessWidget {
  const AnswerPanel({
    super.key,
    required this.answer,
    this.explanation,
    this.cue,
  });

  final String? answer;
  final String? explanation;
  final String? cue;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      liveRegion: true,
      container: true,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: colors.raised2,
          borderRadius: MmRadius.panelAll,
          border: Border.all(color: colors.lineStrong),
        ),
        child: Padding(
          padding: const EdgeInsets.all(MmSpace.cardPadding),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                LearnCopy.theAnswer,
                style: type.label.copyWith(color: colors.ink2),
              ),
              const SizedBox(height: MmSpace.s4),
              if (answer != null)
                Text(
                  answer!,
                  style: type.question.copyWith(fontWeight: FontWeight.w700),
                ),
              if (explanation != null) ...[
                const SizedBox(height: MmSpace.s12),
                Text(
                  explanation!,
                  style: type.body.copyWith(color: colors.ink2),
                ),
              ],
              if (cue != null) ...[
                const SizedBox(height: MmSpace.s12),
                Text(
                  LearnCopy.memoryCue,
                  style: type.label.copyWith(color: colors.ink2),
                ),
                Text(cue!, style: type.body),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
