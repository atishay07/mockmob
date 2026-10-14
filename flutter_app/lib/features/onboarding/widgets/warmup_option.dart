import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';

enum WarmupOptionState { open, right, wrong, dimmed }

/// One answer option of the warm-up question: solid, 56 dp, a lettered bubble on the left. After
/// the answer, the right option takes the lit edge and an inked bubble, a wrong pick takes the
/// wrong colours and a crossed bubble, and the rest go quiet. State is never colour alone.
///
/// The right answer inks in from where the finger touched (a circle of the selected surface
/// spreading over 380 ms, clipped to the option); a wrong one only takes its colours, and the rest
/// dim. Nothing shakes. Under reduced motion every state is shown at once.
class WarmupOption extends StatefulWidget {
  const WarmupOption({super.key, required this.letter, required this.text, required this.state, this.onTap});

  final String letter;
  final String text;
  final WarmupOptionState state;
  final VoidCallback? onTap;

  @override
  State<WarmupOption> createState() => _WarmupOptionState();
}

class _WarmupOptionState extends State<WarmupOption> with SingleTickerProviderStateMixin {
  late final AnimationController _ink = AnimationController(vsync: this, duration: const Duration(milliseconds: 380));

  /// Where the finger last touched this option, in its own coordinates.
  Offset? _touch;
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    // Seen already answered (coming back to the step): settled, not replayed.
    if (widget.state != WarmupOptionState.open) _ink.value = 1;
  }

  @override
  void didUpdateWidget(WarmupOption old) {
    super.didUpdateWidget(old);
    if (old.state == widget.state) return;
    if (widget.state == WarmupOptionState.right && !Motion.reduced(context)) {
      _ink.forward(from: 0);
    } else {
      _ink.value = 1;
    }
  }

  @override
  void dispose() {
    _ink.dispose();
    super.dispose();
  }

  String get letter => widget.letter;
  String get text => widget.text;
  WarmupOptionState get state => widget.state;
  VoidCallback? get onTap => widget.onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final wrong = state == WarmupOptionState.wrong;
    final right = state == WarmupOptionState.right;
    // The right answer is the strongest card on the page in both themes: the selected surface
    // with a 2 px ink border, never Day's darker raised2, which would read as switched off
    // (SPACING.md 8.1). Volt stays in the bubble.
    // While the ink spreads, the option is still the raised surface; the circle brings the rest.
    final inking = right && _ink.isAnimating;
    final fill = wrong ? colors.wrongSurface : (right && !inking ? colors.selectedSurface : colors.raised);
    final border = wrong ? BorderSide(color: colors.wrongBorder) : (right ? BorderSide(color: colors.ink, width: 2) : BorderSide(color: colors.line));
    final ink = wrong ? colors.wrongText : (state == WarmupOptionState.dimmed ? colors.ink3 : colors.ink);
    final suffix = switch (state) {
      WarmupOptionState.right => ', the right answer',
      WarmupOptionState.wrong => ', your answer, wrong',
      _ => '',
    };

    final option = Listener(
      behavior: HitTestBehavior.translucent,
      onPointerDown: (e) => _touch = e.localPosition,
      child: MmPressable(
      semanticsLabel: '${OnboardingCopy.optionSemantics(letter, text)}$suffix',
      pressedScale: 0.98,
      focusRadius: MmRadius.keyAll,
      onTap: onTap,
      builder: (context, pressed, _) => DecoratedBox(
        decoration: ShapeDecoration(
          color: pressed ? (colors.isNight ? colors.raised2 : colors.sunken) : fill,
          shape: mmShapeBorder(MmRadius.keyAll, side: border),
        ),
        child: Stack(
          children: [
            if (right)
              Positioned.fill(
                child: IgnorePointer(
                  child: ClipRRect(
                    borderRadius: MmRadius.keyAll,
                    child: CustomPaint(painter: _InkPainter(clock: _ink, from: _touch, color: colors.selectedSurface)),
                  ),
                ),
              ),
        ConstrainedBox(
          constraints: BoxConstraints(minHeight: state == WarmupOptionState.dimmed ? 40 : 56),
          child: Padding(
            padding: EdgeInsets.symmetric(horizontal: MmSpace.s16, vertical: state == WarmupOptionState.dimmed ? MmSpace.s8 : MmSpace.s12),
            child: Row(
              children: [
                SizedBox.square(
                  dimension: 26,
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      Bubble(
                        state: right ? BubbleState.filled : (wrong ? BubbleState.wrong : BubbleState.hollow),
                        size: 26,
                      ),
                      if (!right && !wrong)
                        Text(letter, style: type.caption.copyWith(fontSize: 11, color: colors.ink2, fontWeight: FontWeight.w700)),
                    ],
                  ),
                ),
                const SizedBox(width: MmSpace.s12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(text, style: type.body.copyWith(color: ink, fontWeight: right ? FontWeight.w600 : FontWeight.w400)),
                      if (right) Text(OnboardingCopy.correctAnswer, style: type.caption.copyWith(color: colors.ink2)),
                      if (wrong) Text(OnboardingCopy.yourAnswer, style: type.caption.copyWith(color: colors.wrongText)),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
          ],
        ),
      ),
    ));
    return option;
  }
}

/// A circle of the selected surface spreading from [from] (the touch; the bubble when there was
/// none) until it covers the option.
class _InkPainter extends CustomPainter {
  _InkPainter({required this.clock, required this.from, required this.color}) : super(repaint: clock);

  final Animation<double> clock;
  final Offset? from;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final t = Curves.easeOutCubic.transform(clock.value);
    if (t <= 0) return;
    final o = from ?? Offset(size.width * 0.08, size.height / 2);
    final far = [
      (o - Offset.zero).distance,
      (o - Offset(size.width, 0)).distance,
      (o - Offset(0, size.height)).distance,
      (o - Offset(size.width, size.height)).distance,
    ].reduce(math.max);
    canvas.drawCircle(o, far * t, Paint()..color = color);
  }

  @override
  bool shouldRepaint(_InkPainter old) => old.from != from || old.color != color;
}
