import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../motion/motion.dart';
import '../../theme/theme.dart';
import 'bar_icons.dart';

/// The volt Start key in the bar's third slot (app-ia-1016.md section 4.2). It is laid out exactly
/// like a tab: a 24 dp glyph (a rounded play triangle) in the icon box at y 11 to 35, and the word
/// **Start** in the label box at y 39 to 53, on a volt pill the size and place of the lens (the
/// slot less 2 dp each side, y 6 to 58). So its glyph shares every tab icon's centre line, its
/// word every tab label's, and its pill the lens's (L31). It is an action, not a place; it opens
/// the Start sheet. No breathing: "something to resume" is the capsule's job, in words.
///
/// Pressed, it sinks to 0.94 in 100 ms, its volt deepens 16% toward `voltEdge` and a soft volt
/// glow gathers round it (anticipation); on release it overshoots a little before it settles
/// (a negative [pressed]) and an ink ring spreads out of it (380 ms). Dragged up it stretches
/// tall and narrow ([stretch], volume kept), anchored at its foot. Once per open session its
/// word slides from Start to Resume and back in the same label box ([labelShift]); the pill never
/// widens. Compact, the pill shrinks with the lens to 40 tall, the glyph moves down 15 dp and the
/// word fades with the tab labels ([labelsOut]).
class StartKeyFace extends StatelessWidget {
  const StartKeyFace({
    super.key,
    required this.collapse,
    this.labelsOut = kAlwaysDismissedAnimation,
    this.pressed = 0,
    this.ripple = 1,
    this.stretch = 0,
    this.labelShift = 0,
  });

  /// The bar's collapse, 0 expanded to 1 compact.
  final Animation<double> collapse;

  /// The labels' fade, 0 shown to 1 gone (the bar's compact state).
  final Animation<double> labelsOut;

  /// How far down the press is, 0 to 1.
  final double pressed;

  /// The ink ring after a tap, 0 to 1 (1 is gone).
  final double ripple;

  /// How far a drag up has pulled the key, 0 to 1 and a little below 0 while it settles back
  /// (a squash).
  final double stretch;

  /// 0 shows "Start", 1 shows "Resume"; between, one slides up out and the other in.
  final double labelShift;

  /// The word on the key at rest.
  static const String word = 'Start';
  static const String resumeWord = 'Resume';

  /// How far the pressed key sinks.
  static const double pressDepth = 0.06;

  /// The key's height scale and width scale for a [stretch]: tall and narrow, volume kept.
  static (double sx, double sy) squashFor(double stretch) {
    final sy = 1 + 0.16 * stretch;
    return (1 / math.sqrt(sy), sy);
  }

  /// The pill's rect inside its slot box (the bar's full 64 dp height, bottom anchored): the slot
  /// less 2 dp each side, the bar's height less its padding. The same rect as the lens on that
  /// slot ([BarLensPainter.lensRect] at rest).
  static Rect keyRect(Size slot, double collapse) {
    final barHeight = MmBar.height - (MmBar.height - MmBar.compactHeight) * collapse;
    final height = barHeight - 2 * MmBar.pad;
    final top = slot.height - barHeight + MmBar.pad;
    return Rect.fromLTWH(MmBar.pillInset, top, slot.width - 2 * MmBar.pillInset, height);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final ink = colors.voltInk;
    Widget wordText(String text) => Text(
      text,
      maxLines: 1,
      softWrap: false,
      style: type.navLabel.copyWith(
        fontSize: MmBar.labelSize,
        height: MmBar.labelHeight / MmBar.labelSize,
        fontWeight: FontWeight.w700,
        letterSpacing: 0,
        color: ink,
      ),
    );
    final shift = labelShift.clamp(0.0, 1.0);
    final label = shift <= 0
        ? wordText(word)
        : Stack(
            alignment: Alignment.center,
            children: [
              Opacity(
                opacity: (1 - shift * 1.6).clamp(0.0, 1.0),
                child: Transform.translate(offset: Offset(0, -MmBar.labelHeight * shift), child: wordText(word)),
              ),
              Opacity(
                opacity: ((shift - 0.35) * 1.6).clamp(0.0, 1.0),
                child: Transform.translate(offset: Offset(0, MmBar.labelHeight * (1 - shift)), child: wordText(resumeWord)),
              ),
            ],
          );

    return LayoutBuilder(
      builder: (context, box) {
        final size = box.biggest;
        return CustomPaint(
          painter: _StartKeyPainter(
            collapse: collapse,
            pressed: pressed,
            ripple: ripple,
            stretch: stretch,
            night: colors.isNight,
            volt: colors.volt,
            voltEdge: colors.voltEdge,
            rim: colors.isNight ? colors.voltEdge : colors.accentText.withValues(alpha: 0.45),
          ),
          child: AnimatedBuilder(
            animation: collapse,
            builder: (context, child) {
              final e = collapse.value;
              final rect = keyRect(size, e);
              final (sx, sy) = squashFor(stretch);
              final s = 1 - pressed * pressDepth;
              // Pressed about the pill's centre, then stretched about its (pressed) foot, the way
              // the painter draws the pill; the content rides down with the compact bar.
              return Transform(
                transform: Matrix4.diagonal3Values(sx, sy, 1),
                origin: Offset(rect.center.dx, rect.center.dy + rect.height * s / 2),
                child: Transform(
                  transform: Matrix4.diagonal3Values(s, s, 1),
                  origin: rect.center,
                  child: Transform.translate(offset: Offset(0, MmBar.compactShift * e), child: child),
                ),
              );
            },
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                Positioned(
                  left: (size.width - MmBar.icon) / 2,
                  top: MmBar.iconTop,
                  width: MmBar.icon,
                  height: MmBar.icon,
                  child: Icon(kStartGlyph, size: MmBar.icon, color: ink),
                ),
                Positioned(
                  left: MmBar.pillInset,
                  right: MmBar.pillInset,
                  top: MmBar.labelTop,
                  height: MmBar.labelHeight,
                  child: FadeTransition(
                    opacity: ReverseAnimation(labelsOut),
                    child: ClipRect(
                      child: Center(
                        child: FittedBox(
                          fit: BoxFit.scaleDown,
                          child: MediaQuery.withClampedTextScaling(maxScaleFactor: 1.2, child: label),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _StartKeyPainter extends CustomPainter {
  _StartKeyPainter({
    required this.collapse,
    required this.pressed,
    required this.ripple,
    required this.stretch,
    required this.night,
    required this.volt,
    required this.voltEdge,
    required this.rim,
  }) : super(repaint: collapse);

  final Animation<double> collapse;
  final double pressed;
  final double ripple;
  final double stretch;
  final bool night;
  final Color volt;
  final Color voltEdge;
  final Color rim;

  @override
  void paint(Canvas canvas, Size size) {
    var rect = StartKeyFace.keyRect(size, collapse.value);
    final scale = 1 - StartKeyFace.pressDepth * pressed;
    final (sx, sy) = StartKeyFace.squashFor(stretch);
    // Stretched (or squashed) about its foot: the bottom edge stays where it was.
    final foot = rect.bottomCenter;
    final w = rect.width * scale * sx;
    final h = rect.height * scale * sy;
    rect = Rect.fromLTWH(foot.dx - w / 2, foot.dy - (rect.height - rect.height * scale) / 2 - h, w, h);
    final rrect = RRect.fromRectAndRadius(rect, Radius.circular(math.min(rect.height, rect.width) / 2));
    final glow = pressed.clamp(0.0, 1.0);

    // The bar's one lit element: a 14% volt glow pooled 6 dp beneath the key (Night only).
    if (night) {
      canvas.drawRRect(
        rrect.shift(const Offset(0, 6)),
        Paint()
          ..color = volt.withValues(alpha: 0.14)
          ..maskFilter = MaskFilter.blur(BlurStyle.normal, Shadow.convertRadiusToSigma(14)),
      );
    }
    if (glow > 0) {
      // Anticipation: a soft halo gathers round the key while a finger is on it (both themes).
      canvas.drawRRect(
        rrect.inflate(3 + 4 * glow),
        Paint()
          ..color = volt.withValues(alpha: (night ? 0.30 : 0.38) * glow)
          ..maskFilter = MaskFilter.blur(BlurStyle.normal, Shadow.convertRadiusToSigma(10)),
      );
    }
    canvas.drawRRect(rrect, Paint()..color = Color.lerp(volt, voltEdge, 0.16 * glow)!);
    // A 1 dp rim a shade deeper, so the key reads as ink pressed into the bar.
    canvas.drawRRect(
      rrect.deflate(0.5),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..color = rim,
    );
    if (night) {
      // A 1 dp white highlight along the top.
      canvas.save();
      canvas.clipRRect(rrect);
      canvas.drawRRect(
        rrect.deflate(1),
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1
          ..shader = LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.center,
            colors: [Colors.white.withValues(alpha: 0.35), Colors.white.withValues(alpha: 0)],
          ).createShader(rect),
      );
      canvas.restore();
    }
    if (ripple < 1) {
      final t = Motion.glide.transform(ripple.clamp(0.0, 1.0));
      final grow = 14 * t;
      canvas.drawRRect(
        RRect.fromRectAndRadius(rect.inflate(grow), Radius.circular(math.min(rect.height, rect.width) / 2 + grow)),
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2 - 1.5 * t
          ..color = (night ? volt : voltEdge).withValues(alpha: 0.6 * (1 - t)),
      );
    }
  }

  @override
  bool shouldRepaint(_StartKeyPainter old) =>
      old.collapse != collapse ||
      old.pressed != pressed ||
      old.ripple != ripple ||
      old.stretch != stretch ||
      old.night != night ||
      old.volt != volt ||
      old.voltEdge != voltEdge ||
      old.rim != rim;
}
