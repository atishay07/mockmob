import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../motion/motion.dart';
import '../../theme/theme.dart';
import '../materials/glass_surface.dart';
import '../pressable.dart';

/// The Start half of the split dock: a 60 dp glass circle holding a volt disc and a play glyph,
/// the one-tap way into the core loop from anywhere. It morphs into the quick-start sheet.
///
/// Life (docs/brain/ui-blitz/motion.md 3.7): the disc presses deeper than the ring, and on a tap
/// a volt ring spreads out of it and fades (380 ms), like ink spreading into paper. It breathes
/// twice (the glow under it swells and settles, about 3 s in all) when it first appears and
/// whenever [breatheKey] changes (pass the open session's id, so it breathes when there is
/// something to resume), then rests. Never a loop; still under reduced motion.
class StartButton extends StatefulWidget {
  const StartButton({super.key, required this.onPressed, this.pressed = false, this.breathe = true, this.breatheKey});

  final VoidCallback? onPressed;

  /// Draws the pressed state without a finger (goldens).
  final bool pressed;

  /// Breathe on first appearance and when [breatheKey] changes.
  final bool breathe;
  final Object? breatheKey;

  static const String semanticsLabel = 'Start, opens quick start';

  /// Two breaths.
  static const Duration breathDuration = Duration(milliseconds: 3000);

  /// The ink ring after a tap.
  static const Duration rippleDuration = Duration(milliseconds: 380);

  @override
  State<StartButton> createState() => _StartButtonState();
}

class _StartButtonState extends State<StartButton> with TickerProviderStateMixin {
  late final AnimationController _breath = AnimationController(vsync: this, duration: StartButton.breathDuration);
  late final AnimationController _ripple = AnimationController(vsync: this, duration: StartButton.rippleDuration, value: 1);
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    _breatheOnce();
  }

  @override
  void didUpdateWidget(StartButton oldWidget) {
    super.didUpdateWidget(oldWidget);
    // A new session to resume breathes; one that ends (the key clears) does not.
    if (oldWidget.breatheKey != widget.breatheKey && widget.breatheKey != null) _breatheOnce();
  }

  void _breatheOnce() {
    if (!widget.breathe || Motion.reduced(context)) return;
    _breath.forward(from: 0);
  }

  @override
  void dispose() {
    _breath.dispose();
    _ripple.dispose();
    super.dispose();
  }

  void _tap() {
    if (!Motion.reduced(context)) _ripple.forward(from: 0);
    widget.onPressed?.call();
  }

  @override
  Widget build(BuildContext context) {
    final onPressed = widget.onPressed;
    return MmPressable(
      semanticsLabel: StartButton.semanticsLabel,
      pressedScale: Springs.pressedScale,
      onTap: onPressed == null ? null : _tap,
      builder: (context, down, _) => AnimatedBuilder(
        animation: Listenable.merge([_breath, _ripple]),
        builder: (context, _) => StartFace(
          pressed: widget.pressed || down,
          breath: _breathAt(_breath.value),
          ripple: _ripple.value,
        ),
      ),
    );
  }

  /// Two smooth breaths: 0, up, down, up, down to 0.
  static double _breathAt(double t) => t <= 0 || t >= 1 ? 0 : 0.5 - 0.5 * math.cos(2 * math.pi * 2 * t);
}

/// The visual of [StartButton], shared with the morph into the sheet: a glass ring holding a
/// volt disc (an inked answer bubble) with a dark play glyph, and a soft volt glow pooled below
/// it on Night. The disc is the light of the dock; the ring keeps it part of the glass.
class StartFace extends StatelessWidget {
  const StartFace({super.key, this.pressed = false, this.breath = 0, this.ripple = 1});

  final bool pressed;

  /// 0 at rest, 1 at the top of a breath: the glow swells and the disc grows 2.5%.
  final double breath;

  /// The ink ring after a tap, 0 to 1 (1 is gone).
  final double ripple;

  static const double disc = 46;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final pressScale = pressed ? 0.93 : 1.0;
    final breathScale = 1 + 0.025 * breath;
    return SizedBox.square(
      dimension: MmDock.startSize,
      child: CustomPaint(
        painter: colors.isNight ? _GlowBelow(colors.voltGlow, swell: breath) : null,
        foregroundPainter: ripple < 1 ? _InkRing(progress: ripple, color: colors.isNight ? colors.volt : colors.voltEdge) : null,
        child: GlassSurface(
          role: GlassRole.dock,
          borderRadius: MmRadius.pillAll,
          pressed: pressed,
          // The face's press scale is MmPressable's alone (0.96 on the shared spring); the disc
          // inside sinks a little further and its ink deepens, like the volt key.
          child: Center(
            // The press eases (an implicit animation on a two-state target); the breath is
            // already a smooth curve, so it scales directly and never restarts the ease.
            child: AnimatedScale(
              scale: pressScale,
              duration: pressed ? Motion.press : Motion.release,
              curve: Motion.out,
              child: Transform.scale(
                scale: breathScale,
                child: CustomPaint(
                  size: const Size.square(disc),
                  painter: _StartDisc(
                    fill: pressed ? Color.lerp(colors.volt, colors.voltEdge, 0.16)! : colors.volt,
                    glyph: colors.voltInk,
                    rim: colors.voltEdge,
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The ink ring: spreads from the disc's edge to just past the glass and fades, 2 dp to 0.5 dp.
class _InkRing extends CustomPainter {
  const _InkRing({required this.progress, required this.color});

  final double progress;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final t = Motion.glide.transform(progress.clamp(0.0, 1.0));
    final c = size.center(Offset.zero);
    final r = StartFace.disc / 2 + (size.width * 0.62 - StartFace.disc / 2) * t;
    canvas.drawCircle(
      c,
      r,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2 - 1.5 * t
        ..color = color.withValues(alpha: 0.6 * (1 - t)),
    );
  }

  @override
  bool shouldRepaint(_InkRing old) => old.progress != progress || old.color != color;
}

/// A 14% volt glow pooled under the button, outside its glass, never behind text. It swells by
/// [swell] during a breath.
class _GlowBelow extends CustomPainter {
  const _GlowBelow(this.color, {this.swell = 0});

  final Color color;
  final double swell;

  @override
  void paint(Canvas canvas, Size size) {
    final c = Offset(size.width / 2, size.height * 0.78);
    final r = size.width * 0.62 * (1 + 0.16 * swell);
    final glow = color.withValues(alpha: (color.a * (1 + 0.8 * swell)).clamp(0.0, 1.0));
    canvas.drawCircle(
      c,
      r,
      Paint()..shader = RadialGradient(colors: [glow, glow.withValues(alpha: 0)]).createShader(Rect.fromCircle(center: c, radius: r)),
    );
  }

  @override
  bool shouldRepaint(_GlowBelow old) => old.color != color || old.swell != swell;
}

class _StartDisc extends CustomPainter {
  const _StartDisc({required this.fill, required this.glyph, required this.rim});

  final Color fill;
  final Color glyph;
  final Color rim;

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final r = size.shortestSide / 2;
    canvas.drawCircle(c, r, Paint()..color = fill);
    // A hairline rim, a shade deeper, so the disc reads as ink pressed into the sheet.
    canvas.drawCircle(
      c,
      r - 0.5,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..color = rim.withValues(alpha: 0.6),
    );
    // The play glyph, optically centred (nudged right of the geometric centre), corners rounded.
    final h = r * 0.5;
    final path = Path()
      ..moveTo(c.dx - h * 0.36, c.dy - h * 0.6)
      ..lineTo(c.dx + h * 0.62, c.dy)
      ..lineTo(c.dx - h * 0.36, c.dy + h * 0.6)
      ..close();
    canvas.drawPath(path, Paint()..color = glyph);
    canvas.drawPath(
      path,
      Paint()
        ..color = glyph
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.6
        ..strokeJoin = StrokeJoin.round,
    );
  }

  @override
  bool shouldRepaint(_StartDisc old) => old.fill != fill || old.glyph != glyph || old.rim != rim;
}
