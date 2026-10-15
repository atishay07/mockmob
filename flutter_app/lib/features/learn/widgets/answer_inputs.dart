import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../models/run_item.dart';
import 'feedback_mobi.dart';
import 'screen_bits.dart';

const _letters = ['A', 'B', 'C', 'D', 'E', 'F'];

String _letter(int i) => i < _letters.length ? _letters[i] : '${i + 1}';

class OptionLetter extends StatelessWidget {
  const OptionLetter(this.letter, {super.key});

  final String letter;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return ExcludeSemantics(
      child: DecoratedBox(
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: colors.lineStrong),
        ),
        child: SizedBox(
          width: 28,
          height: 28,
          child: Center(
            child: Text(
              letter,
              style: context.mmType.label.copyWith(color: colors.ink2),
            ),
          ),
        ),
      ),
    );
  }
}

/// How a checked answer inks in, one set of numbers for the app and the website (`study.css`).
abstract final class AnswerInk {
  /// The right row's outline draws itself in.
  static const Duration ring = Duration(milliseconds: 320);

  /// The check inside the volt disc draws after the outline has begun.
  static const Duration check = Duration(milliseconds: 320);

  /// A right answer starts inking this long after the options swap to their result.
  static const Duration lead = Duration(milliseconds: 60);

  /// The check starts this long after the outline.
  static const Duration checkAfter = Duration(milliseconds: 200);

  /// The feedback panel's own check starts once the panel has risen.
  static const Duration panelCheck = Duration(milliseconds: 160);

  /// The right row waits for a miss's one nudge (an [MmShake]) before it inks.
  static Duration ringDelay({required bool afterMiss}) => afterMiss ? MmShake.duration : lead;
}

Path _keyOutline(Size size) => Path()
  ..addRRect(
    RRect.fromRectAndRadius(
      Rect.fromLTWH(1, 1, size.width - 2, size.height - 2),
      const Radius.circular(MmRadius.key - 1),
    ),
  );

/// The mark of a right answer: a volt disc with an ink check, the same in Night and Day (volt is a
/// fill with `voltInk` on it; as a bare glyph on the card it would vanish on paper). With [animate]
/// the check draws itself in after [delay]; without it the check is simply there (a step reopened
/// from a saved state).
class CorrectMark extends StatelessWidget {
  const CorrectMark({
    super.key,
    this.size = 24,
    this.animate = false,
    this.delay = Duration.zero,
  });

  final double size;
  final bool animate;
  final Duration delay;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return ExcludeSemantics(
      child: DecoratedBox(
        decoration: BoxDecoration(color: colors.volt, shape: BoxShape.circle),
        child: SizedBox.square(
          dimension: size,
          child: MmStrokeDraw(
            path: MmPaths.checkFor,
            color: colors.voltInk,
            strokeWidth: size * 0.1,
            duration: AnswerInk.check,
            delay: delay,
            animateFirst: animate,
          ),
        ),
      ),
    );
  }
}

/// Answer options before the student answers: one is selected, nothing is decided yet.
class LiveOptions extends StatelessWidget {
  const LiveOptions({
    super.key,
    required this.options,
    required this.selected,
    required this.onSelect,
  });

  final List<String> options;
  final int? selected;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      container: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var i = 0; i < options.length; i++) ...[
            if (i > 0) const SizedBox(height: MmSpace.s12),
            KeyButton.option(
              label: options[i],
              selected: selected == i,
              leading: OptionLetter(_letter(i)),
              semanticsLabel: 'Option ${_letter(i)}, ${options[i]}',
              onPressed: () => onSelect(i),
            ),
          ],
        ],
      ),
    );
  }
}

/// Answer options after feedback: the right one carries a check and an ink border, a wrong
/// choice carries a cross, "Your answer" and the wrong colours. Never colour alone.
///
/// With [animate] (the student answered on this phone just now) the result arrives with life: a
/// miss nudges its row once (an [MmShake], no haptic: nothing fires on a wrong answer), then the
/// right row's outline draws itself in and its check follows; a right answer inks at once. Without
/// it (a step reopened from a saved state) everything is simply there. Reduced motion shows the
/// finished marks.
class ResultOptions extends StatefulWidget {
  const ResultOptions({
    super.key,
    required this.options,
    required this.correct,
    required this.chosen,
    this.animate = false,
  });

  final List<String> options;
  final int? correct;
  final int? chosen;
  final bool animate;

  /// A wrong pick: something was chosen and it is not the right one.
  bool get missed => chosen != null && chosen != correct;

  @override
  State<ResultOptions> createState() => _ResultOptionsState();
}

class _ResultOptionsState extends State<ResultOptions> {
  final GlobalKey<MmShakeState> _nudge = GlobalKey<MmShakeState>();

  @override
  void initState() {
    super.initState();
    if (widget.animate && widget.missed) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _nudge.currentState?.shake());
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final options = widget.options;
    final ringDelay = AnswerInk.ringDelay(afterMiss: widget.missed);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < options.length; i++) ...[
          if (i > 0) const SizedBox(height: MmSpace.s12),
          Builder(
            builder: (context) {
              final isCorrect = i == widget.correct;
              final isWrongPick = i == widget.chosen && !isCorrect;
              final words = isCorrect
                  ? (i == widget.chosen
                        ? LearnCopy.yourAnswer
                        : LearnCopy.correctAnswer)
                  : (isWrongPick ? LearnCopy.yourAnswer : null);
              Widget row = Semantics(
                container: true,
                label:
                    'Option ${_letter(i)}, ${options[i]}${words == null ? '' : '. $words'}',
                excludeSemantics: true,
                child: Stack(
                  children: [
                    DecoratedBox(
                      decoration: BoxDecoration(
                        color: isWrongPick ? colors.wrongSurface : colors.raised,
                        borderRadius: MmRadius.keyAll,
                        // The right row's own border is the quiet line; its ink outline is drawn
                        // over it (below), so it can ink in and still end as a 2 dp ink border.
                        border: Border.all(
                          color: isWrongPick ? colors.wrongBorder : colors.line,
                          width: isCorrect || isWrongPick ? 2 : 1,
                        ),
                      ),
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(
                          minHeight: MmTarget.option,
                        ),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: MmSpace.s16,
                            vertical: MmSpace.s12,
                          ),
                          child: Row(
                            children: [
                              OptionLetter(_letter(i)),
                              const SizedBox(width: MmSpace.s12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      options[i],
                                      style: type.body.copyWith(
                                        fontWeight: FontWeight.w500,
                                        color: isWrongPick
                                            ? colors.wrongText
                                            : (isCorrect
                                                  ? colors.ink
                                                  : colors.ink2),
                                      ),
                                    ),
                                    if (words != null)
                                      Text(
                                        words,
                                        style: type.small.copyWith(
                                          color: isWrongPick
                                              ? colors.wrongText
                                              : colors.ink2,
                                        ),
                                      ),
                                  ],
                                ),
                              ),
                              if (isCorrect) ...[
                                const SizedBox(width: MmSpace.s8),
                                CorrectMark(
                                  animate: widget.animate,
                                  delay: ringDelay + AnswerInk.checkAfter,
                                ),
                              ],
                              if (isWrongPick) ...[
                                const SizedBox(width: MmSpace.s8),
                                Icon(
                                  LucideIcons.x,
                                  size: 24,
                                  color: colors.wrongMark,
                                ),
                              ],
                            ],
                          ),
                        ),
                      ),
                    ),
                    if (isCorrect)
                      Positioned.fill(
                        child: IgnorePointer(
                          child: MmStrokeDraw(
                            path: _keyOutline,
                            color: colors.ink,
                            strokeWidth: 2,
                            duration: AnswerInk.ring,
                            delay: ringDelay,
                            animateFirst: widget.animate,
                          ),
                        ),
                      ),
                  ],
                ),
              );
              if (isWrongPick) {
                row = MmShake(key: _nudge, haptic: false, child: row);
              }
              return row;
            },
          ),
        ],
      ],
    );
  }
}

/// A text, numeric or ratio answer. Spelling and gap tasks must not be auto-corrected.
class AnswerField extends StatelessWidget {
  const AnswerField({
    super.key,
    required this.controller,
    required this.hintText,
    required this.onSubmitted,
    this.enabled = true,
  });

  final TextEditingController controller;
  final String hintText;
  final ValueChanged<String> onSubmitted;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    OutlineInputBorder border(Color c, double w) => OutlineInputBorder(
      borderRadius: MmRadius.keyAll,
      borderSide: BorderSide(color: c, width: w),
    );
    return TextField(
      controller: controller,
      enabled: enabled,
      style: type.question,
      cursorColor: colors.ink,
      autocorrect: false,
      enableSuggestions: false,
      textInputAction: TextInputAction.done,
      onSubmitted: onSubmitted,
      decoration: InputDecoration(
        hintText: hintText,
        hintStyle: type.body.copyWith(color: colors.ink3),
        filled: true,
        fillColor: colors.raised,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: MmSpace.s16,
          vertical: MmSpace.s16,
        ),
        enabledBorder: border(colors.lineStrong, 1),
        disabledBorder: border(colors.line, 1),
        focusedBorder: border(colors.ink, 2),
      ),
    );
  }
}

/// What the server said about an answer: correct, not quite or skipped, then what was given,
/// the right answer and why.
///
/// With [animate] (answered on this phone just now) the check draws itself in and Mobi stands
/// beside the headline for a moment ([FeedbackMobi]); a miss or a skip also gets one short line of
/// words under the headline, which stays whether Mobi is shown or not.
class FeedbackPanel extends StatelessWidget {
  const FeedbackPanel({
    super.key,
    required this.feedback,
    required this.item,
    this.animate = false,
  });

  final RunFeedback feedback;
  final RunItem item;
  final bool animate;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final right = feedback.correct == true;
    final headline = feedback.skipped
        ? LearnCopy.skipped
        : (right ? LearnCopy.correct : LearnCopy.notQuite);
    final showGiven =
        !right &&
        !feedback.skipped &&
        item.type != RunItemType.choice &&
        feedback.given != null;
    final showAnswer =
        !right && feedback.answer != null && item.type != RunItemType.choice;
    // A right answer needs no line (the headline and the check say it); a miss or a skip gets one.
    final nudge = right
        ? null
        : (feedback.skipped ? LearnCopy.skippedNudge : LearnCopy.missNudge);
    return Semantics(
      liveRegion: true,
      container: true,
      child: DecoratedBox(
        decoration: ShapeDecoration(
          color: right ? learnSelectedSurface(colors) : colors.wrongSurface,
          shape: mmShapeBorder(
            MmRadius.panelAll,
            side: right
                ? MmSelection.side(colors, selected: true)
                : BorderSide(color: colors.wrongBorder, width: 1.5),
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.all(MmRhythm.plainPad),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            if (right)
                              CorrectMark(
                                animate: animate,
                                delay: AnswerInk.panelCheck,
                              )
                            else
                              Icon(
                                LucideIcons.circleAlert,
                                size: 24,
                                color: colors.wrongMark,
                              ),
                            const SizedBox(width: MmSpace.s8),
                            Flexible(
                              child: Text(
                                headline,
                                style: type.subhead.copyWith(
                                  color: right ? colors.ink : colors.wrongText,
                                ),
                              ),
                            ),
                          ],
                        ),
                        if (nudge != null) ...[
                          const SizedBox(height: MmSpace.s4),
                          Text(
                            nudge,
                            style: type.body.copyWith(color: colors.ink2),
                          ),
                        ],
                      ],
                    ),
                  ),
                  if (animate) FeedbackMobi(right: right),
                ],
              ),
              if (showGiven) ...[
                const SizedBox(height: MmSpace.s12),
                Text(
                  LearnCopy.yourAnswer,
                  style: type.label.copyWith(color: colors.ink2),
                ),
                Text(feedback.given!, style: type.body),
              ],
              if (showAnswer) ...[
                const SizedBox(height: MmSpace.s12),
                Text(
                  LearnCopy.correctAnswer,
                  style: type.label.copyWith(color: colors.ink2),
                ),
                Text(
                  feedback.answer!,
                  style: type.body.copyWith(fontWeight: FontWeight.w600),
                ),
              ],
              if (feedback.whyChosen != null) ...[
                const SizedBox(height: MmSpace.s12),
                Text(feedback.whyChosen!, style: type.body),
              ],
              if (feedback.explanation != null) ...[
                const SizedBox(height: MmSpace.s12),
                Text(
                  feedback.explanation!,
                  style: type.body.copyWith(color: colors.ink2),
                ),
              ],
              if (feedback.cue != null) ...[
                const SizedBox(height: MmSpace.s12),
                Text(
                  LearnCopy.memoryCue,
                  style: type.label.copyWith(color: colors.ink2),
                ),
                Text(feedback.cue!, style: type.body),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// One gentle nudge of [child] when it first appears, for a miss on a typed or numeric answer (a
/// choice nudges its own wrong row instead). A single [MmShake], no haptic: nothing fires on a
/// wrong answer. Under reduced motion it does not move.
class MissNudge extends StatefulWidget {
  const MissNudge({super.key, required this.play, required this.child});

  final bool play;
  final Widget child;

  @override
  State<MissNudge> createState() => _MissNudgeState();
}

class _MissNudgeState extends State<MissNudge> {
  final GlobalKey<MmShakeState> _shake = GlobalKey<MmShakeState>();

  @override
  void initState() {
    super.initState();
    if (widget.play) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _shake.currentState?.shake());
    }
  }

  @override
  Widget build(BuildContext context) => MmShake(key: _shake, haptic: false, child: widget.child);
}
