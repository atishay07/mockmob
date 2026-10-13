import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/calendar.dart';
import '../model/answers.dart';
import '../model/choices.dart';
import '../model/deck.dart';
import 'engraved_text.dart';
import 'foil_seal.dart';
import 'sheet_lines.dart';

/// "Your sheet": the smoked-glass answer sheet at the top of every step (brief section 11).
/// Each answer inks its bubble and engraves a line; the weeks to CUET roll in once the stage is
/// known. It is the progress indicator, so there is no separate bar. [compact] keeps it to the
/// bubble row and the newest line while a step needs the room.
class AnswerSheetCard extends StatelessWidget {
  const AnswerSheetCard({
    super.key,
    required this.answers,
    required this.now,
    this.current,
    this.compact = false,
    this.full = false,
    this.sealedLine,
    this.animate = true,
    this.trackKey,
  });

  /// On the bubble row, so Mobi can point at a bubble as it inks ([bubbleCenter]).
  final GlobalKey? trackKey;

  final OnboardingAnswers answers;
  final DateTime now;

  /// The step on screen; its bubble is ringed.
  final String? current;
  final bool compact;

  /// Every engraved line, not just the newest: the sealed sheet the student is keeping.
  final bool full;

  /// "Sealed at 9:40 PM. Week one starts with Partnership.": shown with the foil seal, inside the
  /// card's bottom-right corner, once the plan is sealed.
  final String? sealedLine;
  final bool animate;

  static const BorderRadius radius = MmRadius.panelAll;

  /// The global centre of [step]'s bubble on the track carrying [trackKey], or null when it is
  /// not laid out. The track gives each visible step an equal column; the bubble sits in a 30 dp
  /// box at its top.
  static Offset? bubbleCenter(GlobalKey trackKey, OnboardingAnswers answers, String step) {
    final box = trackKey.currentContext?.findRenderObject();
    if (box is! RenderBox || !box.hasSize) return null;
    final steps = kOnboardingDeck.sheetSteps.where((s) => s.visibleFor(answers)).toList();
    final i = steps.indexWhere((s) => s.id == step);
    if (i < 0) return null;
    final column = box.size.width / steps.length;
    return box.localToGlobal(Offset(column * (i + 0.5), 15));
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final steps = kOnboardingDeck.sheetSteps.where((s) => s.visibleFor(answers)).toList();
    final done = steps.where((s) => answers.isDone(s.id)).length;
    final lines = sheetLines(answers);
    final keep = full ? lines.length : (compact ? 1 : 2);
    final shown = lines.length <= keep ? lines : lines.sublist(lines.length - keep);

    return Semantics(
      container: true,
      label: '${OnboardingCopy.sheetTitle}, $done of ${steps.length} filled. ${lines.join('. ')}',
      excludeSemantics: true,
      child: LitEdge(
        glow: true,
        borderRadius: radius,
        child: FakeGlass(
          borderRadius: radius,
          opacity: colors.isNight ? 0.62 : 0.78,
          child: Builder(
            builder: (context) => Padding(
              padding: const EdgeInsets.fromLTRB(MmSpace.s20, MmSpace.s16, MmSpace.s20, MmSpace.s16),
              child: _Grow(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(OnboardingCopy.sheetTitle, style: type.label.copyWith(color: colors.ink2)),
                        ),
                        Text('$done of ${steps.length}', style: type.caption.copyWith(color: colors.ink3)),
                      ],
                    ),
                    const SizedBox(height: MmSpace.s12),
                    _BubbleTrack(key: trackKey, steps: steps, answers: answers, current: current, animate: animate),
                    if (!compact) ...[const SizedBox(height: MmSpace.s16), _Weeks(stage: answers.stage, now: now, animate: animate)],
                    if (shown.isNotEmpty) ...[
                      const SizedBox(height: MmSpace.s12),
                      Container(height: 1, color: colors.line),
                      const SizedBox(height: MmSpace.s8),
                      for (final line in shown)
                        Padding(
                          padding: const EdgeInsets.only(top: 2),
                          child: EngravedText(
                            line,
                            key: ValueKey(line),
                            animate: animate && line == lines.last,
                            maxLines: 2,
                            style: type.small.copyWith(
                              color: line == lines.last || full ? colors.ink : colors.ink2,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                    ],
                    if (sealedLine != null) ...[
                      const SizedBox(height: MmSpace.s12),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Expanded(
                            child: Padding(
                              padding: const EdgeInsets.only(bottom: MmSpace.s4),
                              child: Text(sealedLine!, style: type.caption.copyWith(color: colors.ink2)),
                            ),
                          ),
                          const SizedBox(width: MmSpace.s12),
                          FoilSeal(sealed: true, animate: animate),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Grows and shrinks with its content on the emphasized curve; at once under reduced motion
/// (an AnimatedSize with a zero duration trips over itself, so it is left out then).
class _Grow extends StatelessWidget {
  const _Grow({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (Motion.reduced(context)) return child;
    return AnimatedSize(duration: Motion.glideDuration, curve: Motion.emphasized, alignment: Alignment.topCenter, child: child);
  }
}

/// One column of the answer sheet per step: a 22 dp bubble (inked when answered, dashed when
/// skipped, ringed for the step on screen) in a fixed 30 dp box, so the ring never pushes its
/// label down, and the step's label beneath ("2 of 7" above already counts). Labels grow with
/// the text size up to 1.3x and shrink rather than clip.
class _BubbleTrack extends StatelessWidget {
  const _BubbleTrack({super.key, required this.steps, required this.answers, required this.current, required this.animate});

  final List<DeckStep> steps;
  final OnboardingAnswers answers;
  final String? current;
  final bool animate;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final scaler = MediaQuery.textScalerOf(context).clamp(maxScaleFactor: 1.3);
    final label = type.caption.copyWith(fontSize: 11.5, height: 1.15, fontWeight: FontWeight.w600);
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        for (var i = 0; i < steps.length; i++)
          Expanded(
            child: Column(
              children: [
                SizedBox(
                  height: 30,
                  child: Center(
                    child: Bubble(
                      state: answers.isDone(steps[i].id)
                          ? BubbleState.filled
                          : (answers.isSkipped(steps[i].id) ? BubbleState.blank : BubbleState.hollow),
                      size: 22,
                      emphasis: steps[i].id == current,
                      inkOrigin: const Offset(-1, 0),
                      animate: animate,
                    ),
                  ),
                ),
                const SizedBox(height: 4),
                FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Text(
                    steps[i].bubble,
                    maxLines: 1,
                    softWrap: false,
                    textScaler: scaler,
                    style: label.copyWith(color: steps[i].id == current || answers.isDone(steps[i].id) ? colors.ink : colors.ink2),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

/// The weeks to the expected window, rolled in condensed type, or a quiet placeholder.
class _Weeks extends StatelessWidget {
  const _Weeks({required this.stage, required this.now, required this.animate});

  final Stage? stage;
  final DateTime now;
  final bool animate;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final s = stage;
    final weeks = s == null ? null : CuetCalendar.weeksTo(s.cuetYear, now);
    if (s == null) {
      return Text(OnboardingCopy.weeksPlaceholder, style: type.small.copyWith(color: colors.ink3));
    }
    final caption = weeks == null ? OnboardingCopy.datesNotOut : OnboardingCopy.weeksUnit(s.cuetYear);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        if (weeks != null)
          MonumentalNumber(value: '$weeks', style: type.figure, roll: animate, semanticsLabel: '$weeks weeks')
        else
          Text('--', style: type.figure.copyWith(color: colors.ink4)),
        const SizedBox(width: MmSpace.s12),
        Expanded(
          child: Text(caption, style: type.small.copyWith(color: colors.ink2, height: 1.3)),
        ),
      ],
    );
  }
}
