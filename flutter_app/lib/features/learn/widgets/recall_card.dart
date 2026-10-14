import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import 'screen_bits.dart';

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
    // One plain card (the same edge light and depth as every card in the app). It keeps a
    // minimum height with its words centred, so a short question still reads as the one thing on
    // the page instead of a strip above a hole.
    return MmSurface.plain(
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 144),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
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
    // The whole well is the target and answers a touch at once: it sinks on the press spring and
    // shows the veil, even while the tap's answer is still on its way.
    final panel = MmPressable(
      onTap: loading ? null : onTap,
      highlight: true,
      focusRadius: MmRadius.panelAll,
      pressedScale: 0.985,
      semanticsLabel: announce ? LearnCopy.tapToReveal : null,
      builder: (context, pressed, _) => DecoratedBox(
        decoration: ShapeDecoration(
          color: colors.sunken,
          shape: mmShapeBorder(
            MmRadius.panelAll,
            side: BorderSide(color: colors.line),
          ),
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
    return panel;
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
        // The answer is the strongest surface on the page in both themes: the selected fill and
        // an ink rim (Day's taupe slab read as disabled).
        decoration: ShapeDecoration(
          color: learnSelectedSurface(colors),
          shape: mmShapeBorder(
            MmRadius.panelAll,
            side: MmSelection.side(colors, selected: true),
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.all(MmRhythm.plainPad),
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
