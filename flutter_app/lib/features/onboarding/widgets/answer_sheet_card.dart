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
    this.animate = true,
  });

  final OnboardingAnswers answers;
  final DateTime now;

  /// The step on screen; its bubble is ringed.
  final String? current;
  final bool compact;

  /// Every engraved line, not just the newest: the sealed sheet the student is keeping.
  final bool full;
  final bool animate;

  static const BorderRadius radius = MmRadius.panelAll;

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
          child: CustomPaint(
            foregroundPainter: _TimingMarks(colors.ink4.withValues(alpha: colors.isNight ? 0.5 : 0.35)),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(MmSpace.s20, MmSpace.s16, MmSpace.s24, MmSpace.s16),
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
                    _BubbleTrack(steps: steps, answers: answers, current: current, animate: animate),
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

/// One labelled bubble per step, spread across the card: inked when answered, dashed when
/// skipped, ringed for the step on screen.
class _BubbleTrack extends StatelessWidget {
  const _BubbleTrack({required this.steps, required this.answers, required this.current, required this.animate});

  final List<DeckStep> steps;
  final OnboardingAnswers answers;
  final String? current;
  final bool animate;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final label = context.mmType.caption.copyWith(fontSize: 10, height: 1.1, fontWeight: FontWeight.w600);
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        for (final s in steps)
          Expanded(
            child: Column(
              children: [
                Bubble(
                  state: answers.isDone(s.id) ? BubbleState.filled : (answers.isSkipped(s.id) ? BubbleState.blank : BubbleState.hollow),
                  size: 18,
                  emphasis: s.id == current,
                  inkOrigin: const Offset(-1, 0),
                  animate: animate,
                ),
                const SizedBox(height: 5),
                Text(
                  s.bubble,
                  maxLines: 1,
                  overflow: TextOverflow.clip,
                  softWrap: false,
                  textScaler: TextScaler.noScaling,
                  style: label.copyWith(color: s.id == current || answers.isDone(s.id) ? colors.ink2 : colors.ink3),
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
    final caption = s == null
        ? 'Weeks to CUET print here'
        : (weeks == null ? OnboardingCopy.datesNotOut : OnboardingCopy.weeksUnit(s.cuetYear));
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        if (weeks != null)
          MonumentalNumber(value: '$weeks', style: type.figure, roll: animate, semanticsLabel: '$weeks weeks')
        else
          Text('--', style: type.figure.copyWith(color: colors.ink4)),
        const SizedBox(width: MmSpace.s12),
        Expanded(
          child: Text(caption, style: type.small.copyWith(color: s == null ? colors.ink3 : colors.ink2, height: 1.3)),
        ),
      ],
    );
  }
}

/// The black timing marks down the edge of a real OMR sheet, printed faintly.
class _TimingMarks extends CustomPainter {
  const _TimingMarks(this.color);

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = color;
    const w = 6.0, h = 2.0, gap = 9.0;
    final x = size.width - 12;
    for (var y = 28.0; y < size.height - 20; y += gap) {
      canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(x, y, w, h), const Radius.circular(1)), paint);
    }
  }

  @override
  bool shouldRepaint(_TimingMarks old) => old.color != color;
}
