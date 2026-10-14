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
import 'glyphs.dart';
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
    this.slim = false,
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

  /// A one-line progress strip (the bubbles and "3 of 7", no title, labels or engraved line):
  /// steps 2 to 7, so the question under it keeps the room. The full card stays on the first
  /// step and wherever the sheet itself is the point (the save step). TalkBack still reads the
  /// whole sheet.
  final bool slim;

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
    // Below about 680 dp the sheet gives the answers the room: the title row and the bubbles stay
    // (that is the progress), the engraved line under them waits (TalkBack still reads it).
    final short = !full && MediaQuery.sizeOf(context).height < 680;
    final keep = short ? 0 : (full ? lines.length : (compact ? 1 : 2));
    final shown = lines.length <= keep ? lines : lines.sublist(lines.length - keep);

    if (slim) {
      return _Grow(
        child: Semantics(
        container: true,
        label: '${OnboardingCopy.sheetTitle}, $done of ${steps.length} filled. ${lines.join('. ')}',
        excludeSemantics: true,
        child: LitEdge(
          glow: true,
          borderRadius: radius,
          child: FakeGlass(
            borderRadius: radius,
            opacity: colors.isNight ? 0.62 : 0.78,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(MmSpace.s20, MmSpace.s8, MmSpace.s20, MmSpace.s8),
              child: Row(
                children: [
                  Expanded(
                    child: _BubbleTrack(key: trackKey, steps: steps, answers: answers, current: current, animate: animate, labels: false),
                  ),
                  const SizedBox(width: MmSpace.s12),
                  Text('$done of ${steps.length}', style: type.caption.copyWith(color: colors.ink2)),
                ],
              ),
            ),
          ),
        ),
      ),
      );
    }

    return _Grow(
      child: Semantics(
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
            builder: (context) => Stack(
              children: [
                // OMR timing marks down the left edge: the card reads as an answer sheet.
                Positioned(
                  left: 8,
                  top: MmSpace.s16,
                  bottom: MmSpace.s16,
                  child: TimingMarks(color: colors.ink.withValues(alpha: colors.isNight ? 0.14 : 0.18)),
                ),
                Padding(
              padding: EdgeInsets.fromLTRB(MmSpace.s20, short ? MmSpace.s12 : MmSpace.s16, MmSpace.s20, short ? MmSpace.s12 : MmSpace.s16),
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
                    SizedBox(height: short ? MmSpace.s8 : MmSpace.s12),
                    _BubbleTrack(key: trackKey, steps: steps, answers: answers, current: current, animate: animate),
                    if (!compact && !short) ...[const SizedBox(height: MmSpace.s16), _Weeks(stage: answers.stage, now: now, animate: animate)],
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
              ],
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

/// The bubbles that complete a row of the sheet (where you are, the seat, the subjects, the
/// plan): only these burst as they ink. The rest ink quietly, so the flourish is not the same
/// nine times in two minutes (MOTION.md 4.2).
const Set<String> burstSteps = {Steps.stage, Steps.course, Steps.subjects, Steps.plan};

/// One column of the answer sheet per step: a 22 dp bubble (inked when answered, dashed when
/// skipped, ringed for the step on screen) in a fixed 30 dp box, so the ring never pushes its
/// label down, and the step's label beneath ("2 of 7" above already counts). Every label has
/// the same fixed style (the column is about 44 dp, so a label that grew with the text size would
/// run into its neighbour); a long one ("Subjects") is centred on its column and runs a hair
/// past it, never shrinking, so the labels stay the same size as each other. The count beside
/// them, and the step's own headline, do follow the text size.
class _BubbleTrack extends StatelessWidget {
  const _BubbleTrack({
    super.key,
    required this.steps,
    required this.answers,
    required this.current,
    required this.animate,
    this.labels = true,
  });

  final List<DeckStep> steps;
  final OnboardingAnswers answers;
  final String? current;
  final bool animate;
  final bool labels;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    const scaler = TextScaler.noScaling;
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
                    child: _TrackBubble(
                      state: answers.isDone(steps[i].id)
                          ? BubbleState.filled
                          : (answers.isSkipped(steps[i].id) ? BubbleState.blank : BubbleState.hollow),
                      emphasis: steps[i].id == current,
                      animate: animate,
                      burst: burstSteps.contains(steps[i].id),
                    ),
                  ),
                ),
                if (labels) ...[
                  const SizedBox(height: MmSpace.s4),
                  SizedBox(
                    height: scaler.scale(11.5 * 1.15),
                    child: OverflowBox(
                      maxWidth: double.infinity,
                      child: Text(
                        steps[i].bubble,
                        maxLines: 1,
                        softWrap: false,
                        textScaler: scaler,
                        style: label.copyWith(color: steps[i].id == current || answers.isDone(steps[i].id) ? colors.ink : colors.ink2),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
      ],
    );
  }
}

/// A bubble on the sheet's track. When a [burst] bubble inks, a ring bursts out of it once (1x
/// to 2.4x, fading, 520 ms), so a finished row of the sheet is seen from anywhere on the screen;
/// any other bubble just inks. Transform-free: one painter on its own layer, ticking only while
/// the ring is out.
class _TrackBubble extends StatefulWidget {
  const _TrackBubble({required this.state, required this.emphasis, required this.animate, required this.burst});

  final BubbleState state;
  final bool emphasis;
  final bool animate;
  final bool burst;

  @override
  State<_TrackBubble> createState() => _TrackBubbleState();
}

class _TrackBubbleState extends State<_TrackBubble> with SingleTickerProviderStateMixin {
  late final AnimationController _burst = AnimationController(vsync: this, duration: const Duration(milliseconds: 520));

  @override
  void didUpdateWidget(_TrackBubble old) {
    super.didUpdateWidget(old);
    if (widget.burst && widget.animate && old.state != BubbleState.filled && widget.state == BubbleState.filled && !Motion.reduced(context)) {
      _burst.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _burst.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return CustomPaint(
      // A stroke on the ground: volt Night, olive Day (SPACING.md 8.3).
      foregroundPainter: _BurstPainter(progress: _burst, color: colors.accentText),
      child: Bubble(state: widget.state, size: 22, emphasis: widget.emphasis, inkOrigin: const Offset(-1, 0), animate: widget.animate),
    );
  }
}

class _BurstPainter extends CustomPainter {
  _BurstPainter({required this.progress, required this.color}) : super(repaint: progress);

  final Animation<double> progress;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final p = progress.value;
    if (p <= 0 || p >= 1) return;
    final e = Motion.out.transform(p);
    final r = 11 * (1 + 1.4 * e);
    canvas.drawCircle(
      size.center(Offset.zero),
      r,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2 * (1 - e) + 0.5
        ..color = color.withValues(alpha: 0.85 * (1 - p)),
    );
  }

  @override
  bool shouldRepaint(_BurstPainter old) => old.color != color || old.progress != progress;
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
