import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../../motion/motion.dart';
import '../../theme/theme.dart';
import '../materials/touch_light.dart';
import 'bar_icons.dart';

/// The Start key (NAV-1017 section 6): a 64 dp circle at the trailing end of the bar's row, 8 dp
/// from the capsule, the same height as the capsule, top and bottom. It is an action, not a tab;
/// it opens the quick start sheet. Its glyph (a rounded play triangle) sits in the tabs' icon box
/// at y 11 to 35 and the word **Start** in their label box at y 39 to 53, so the key shares every
/// tab's two centre lines (L31).
///
/// Its look is a function of the theme and its own press only ([MmBar.startKeyStyle]; NAV 6.8):
///
/// * [StartKeyStyle.volt] (A1, the owner's choice): filled volt with a 1 dp rim a shade deeper,
///   the glyph and word in volt ink, a top light on Night and a soft drop shadow. The one tinted
///   glass in the bar (GLASS-1017 4.2).
/// * [StartKeyStyle.glass] (A): the capsule's glass with a 1.5 dp volt ring and a volt glyph.
///
/// Pressed, it travels like a key ([travel], D56, 18 Oct): it sinks to 0.94 and 2 dp into the bar
/// in 100 ms, its top light dims, its shadow tightens and its volt deepens 16% ([pressed]); on
/// release it springs back through a small overshoot (the gel wobble), the touch light blooms
/// inside it ([light]) and an ink ring spreads out of it ([ripple], 380 ms). v13 had swapped the
/// v10 to v12 sink for a widening squash (1.04 wide, 0.95 tall), which felt soft rather than
/// pressed: the owner's "the Start button used to be something else".
///
/// The glyph is the Lucide play triangle ([kStartGlyph]) drawn **filled** ([StartGlyph]): the
/// solid play the key has had since v12, in the app's one icon family (D8). Dragged up it
/// stretches tall and narrow ([stretch], volume kept), anchored at its foot. Once per open
/// session its word slides from Start to Resume and back in the same label box ([labelShift]);
/// the key never widens. Compact, it shrinks to a 52 dp circle about its foot with the capsule,
/// the glyph moves down 15 dp to the circle's centre and the word fades with the tab labels.
class StartKeyFace extends StatelessWidget {
  const StartKeyFace({
    super.key,
    required this.collapse,
    this.labelsOut = kAlwaysDismissedAnimation,
    this.pressed = 0,
    this.ripple = 1,
    this.stretch = 0,
    this.travel = 0,
    this.labelShift = 0,
    this.light,
    this.rimBoost = 0,
    this.style = MmBar.startKeyStyle,
  });

  /// The bar's collapse, 0 expanded to 1 compact.
  final Animation<double> collapse;

  /// The labels' fade, 0 shown to 1 gone (the bar's compact state).
  final Animation<double> labelsOut;

  /// How far down the press is, 0 to 1: the volt deepens (the glass key fills with 12% volt).
  final double pressed;

  /// The ink ring after a tap, 0 to 1 (1 is gone).
  final double ripple;

  /// How far a drag up has pulled the key, 0 to 1 and a little below 0 while it settles back
  /// (a squash).
  final double stretch;

  /// The press travel: 0 at rest, 1 pressed in under the finger, a little below 0 in the
  /// overshoot back.
  final double travel;

  /// 0 shows "Start", 1 shows "Resume"; between, one slides up out and the other in.
  final double labelShift;

  /// The touch light inside the key, or null.
  final TouchLightController? light;

  /// How much a finger near the key brightens its rim (0 to 0.4; GLASS-1017 5.4, nearby glass).
  final double rimBoost;

  final StartKeyStyle style;

  /// The word on the key at rest.
  static const String word = 'Start';
  static const String resumeWord = 'Resume';

  /// The key's height scale and width scale for a [stretch]: tall and narrow, volume kept.
  static (double sx, double sy) squashFor(double stretch) {
    final sy = 1 + 0.16 * stretch;
    return (1 / math.sqrt(sy), sy);
  }

  /// How far the pressed key shrinks, and how far it moves down into the bar (dp).
  static const double pressDepth = 0.06;
  static const double pressTravel = 2;

  /// The key's scale and its downward travel for a [travel]: 0.94 and 2 dp fully pressed, a
  /// little over 1 and up in the overshoot back.
  static (double scale, double dy) travelFor(double travel) => (1 - pressDepth * travel, pressTravel * travel);

  /// The key's circle inside its 64 dp box at [collapse]: 64 across expanded, 52 compact, sharing
  /// the box's foot and its centre line.
  static Rect keyRect(Size box, double collapse) {
    final d = ui.lerpDouble(MmBar.keySize, MmBar.compactHeight, collapse)!;
    return Rect.fromLTWH((box.width - d) / 2, box.height - d, d, d);
  }

  /// The label box's width inside the key (the circle's chord at the label's lowest line, less
  /// a margin): 44 dp.
  static const double labelWidth = 44;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final volt = style == StartKeyStyle.volt;
    final glyphColor = volt ? colors.voltInk : colors.accentText;
    final wordColor = volt ? colors.voltInk : colors.ink;
    Widget wordText(String text) => Text(
      text,
      maxLines: 1,
      softWrap: false,
      style: type.navLabel.copyWith(
        fontSize: MmBar.labelSize,
        height: MmBar.labelHeight / MmBar.labelSize,
        fontWeight: FontWeight.w700,
        letterSpacing: 0,
        color: wordColor,
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
        final light = this.light;
        return AnimatedBuilder(
          animation: collapse,
          builder: (context, child) {
            final e = collapse.value;
            final rect = keyRect(size, e);
            final (sx, sy) = squashFor(stretch);
            final (s, dy) = travelFor(travel);
            // Pressed in about its centre (a key going down into the bar), then stretched about its
            // foot while dragged up.
            return Transform(
              transform: Matrix4.diagonal3Values(sx, sy, 1),
              origin: rect.bottomCenter,
              child: Transform(
                transform: Matrix4.translationValues(0, dy, 0)..multiply(Matrix4.diagonal3Values(s, s, 1)),
                origin: rect.center,
                child: Stack(
                clipBehavior: Clip.none,
                children: [
                  Positioned.fill(
                    child: CustomPaint(
                      painter: _StartKeyPainter(
                        rect: rect,
                        pressed: pressed,
                        ripple: ripple,
                        rimBoost: rimBoost,
                        style: style,
                        night: colors.isNight,
                        volt: colors.volt,
                        voltEdge: colors.voltEdge,
                        accent: colors.accentText,
                        rim: colors.isNight ? colors.voltEdge : colors.accentText.withValues(alpha: 0.45),
                      ),
                    ),
                  ),
                  if (light != null)
                    Positioned.fill(
                      child: IgnorePointer(
                        child: CustomPaint(
                          painter: TouchLightPainter(
                            light: light,
                            shape: (_) => RRect.fromRectAndRadius(rect, Radius.circular(rect.width / 2)),
                            color: volt ? const Color(0x4DFFFFFF) : TouchLightPainter.colorFor(night: colors.isNight),
                          ),
                        ),
                      ),
                    ),
                  Transform.translate(offset: Offset(0, MmBar.compactShift * e), child: child),
                ],
              ),
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
                child: StartGlyph(color: glyphColor),
              ),
              Positioned(
                left: (size.width - labelWidth) / 2,
                width: labelWidth,
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
        );
      },
    );
  }
}

class _StartKeyPainter extends CustomPainter {
  _StartKeyPainter({
    required this.rect,
    required this.pressed,
    required this.ripple,
    required this.rimBoost,
    required this.style,
    required this.night,
    required this.volt,
    required this.voltEdge,
    required this.accent,
    required this.rim,
  });

  final Rect rect;
  final double pressed;
  final double ripple;
  final double rimBoost;
  final StartKeyStyle style;
  final bool night;
  final Color volt;
  final Color voltEdge;
  final Color accent;
  final Color rim;

  @override
  void paint(Canvas canvas, Size size) {
    final circle = RRect.fromRectAndRadius(rect, Radius.circular(rect.width / 2));
    final deepen = pressed.clamp(0.0, 1.0);
    final boost = rimBoost.clamp(0.0, 0.4);

    if (style == StartKeyStyle.volt) {
      // A soft drop shadow under the key (offset, never a halo); it tightens as the key goes down,
      // the way a pressed key sits closer to its bed.
      final lift = 1 - 0.6 * deepen;
      canvas.drawRRect(
        circle.shift(Offset(0, (night ? 6 : 4) * lift)),
        Paint()
          ..color = night ? const Color(0x59000000) : const Color(0x2E526700)
          ..maskFilter = MaskFilter.blur(BlurStyle.normal, ui.Shadow.convertRadiusToSigma((night ? 14 : 10) * (0.5 + 0.5 * lift))),
      );
      canvas.drawRRect(circle, Paint()..color = Color.lerp(volt, voltEdge, 0.16 * deepen)!);
      canvas.save();
      canvas.clipRRect(circle);
      // The top light (38% to nothing over 45% of the height, dimming as the key goes down) and
      // the bottom inner shade (GLASS-1017 5.1: #526700 at 35% over the lower 35%), so the key
      // reads as a domed key of volt glass, not a flat disc.
      final top = (night ? 0.30 : 0.38) * (1 + boost) * (1 - 0.45 * deepen);
      canvas.drawRect(
        rect,
        Paint()
          ..shader = ui.Gradient.linear(rect.topCenter, Offset(rect.center.dx, rect.top + rect.height * 0.45), [
            Colors.white.withValues(alpha: top),
            Colors.white.withValues(alpha: 0),
          ]),
      );
      canvas.drawRect(
        rect,
        Paint()
          ..shader = ui.Gradient.linear(rect.bottomCenter, Offset(rect.center.dx, rect.bottom - rect.height * 0.35), [
            const Color(0x59526700),
            const Color(0x00526700),
          ]),
      );
      // The 1 dp inner highlight along the top arc (white 55%, gone by 45% of the height): the
      // bevel that catches the light on a key.
      canvas.drawRRect(
        circle.deflate(1.5),
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1
          ..shader = ui.Gradient.linear(rect.topCenter, Offset(rect.center.dx, rect.top + rect.height * 0.45), [
            Colors.white.withValues(alpha: 0.55 * (1 - 0.5 * deepen)),
            Colors.white.withValues(alpha: 0),
          ]),
      );
      canvas.restore();
      canvas.drawRRect(
        circle.deflate(0.5),
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1
          ..color = Color.lerp(rim, Colors.white, boost)!,
      );
    } else {
      // The glass key: the capsule's glass shows through (the bar paints it); a volt wash on
      // press and a 1.5 dp volt ring, 2 dp while pressed.
      if (deepen > 0) canvas.drawRRect(circle, Paint()..color = accent.withValues(alpha: 0.12 * deepen));
      canvas.drawRRect(
        circle.deflate(0.75 + 0.25 * deepen),
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.5 + 0.5 * deepen
          ..color = Color.lerp(accent, Colors.white, boost * 0.5)!,
      );
    }

    if (ripple < 1) {
      final t = Motion.glide.transform(ripple.clamp(0.0, 1.0));
      final grow = 14 * t;
      canvas.drawRRect(
        RRect.fromRectAndRadius(rect.inflate(grow), Radius.circular(rect.width / 2 + grow)),
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2 - 1.5 * t
          ..color = (night ? volt : voltEdge).withValues(alpha: 0.6 * (1 - t)),
      );
    }
  }

  @override
  bool shouldRepaint(_StartKeyPainter old) =>
      old.rect != rect ||
      old.pressed != pressed ||
      old.ripple != ripple ||
      old.rimBoost != rimBoost ||
      old.style != style ||
      old.night != night ||
      old.volt != volt ||
      old.voltEdge != voltEdge ||
      old.accent != accent ||
      old.rim != rim;
}

/// The Start key's play glyph: the Lucide play triangle ([kStartGlyph]) drawn filled, with the
/// family's 2 px round joins, in the 24 dp icon box. A filled triangle reads as "go" at a glance on
/// the volt key; the outline alone looked thin there.
class StartGlyph extends StatelessWidget {
  const StartGlyph({super.key, required this.color, this.size = MmBar.icon});

  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) => CustomPaint(size: Size.square(size), painter: StartGlyphPainter(color: color));
}

/// Paints [StartGlyph].
class StartGlyphPainter extends CustomPainter {
  StartGlyphPainter({required this.color});

  final Color color;

  /// The triangle in Lucide's 24 unit box (the play icon's corners before the round joins).
  static const List<Offset> corners = [Offset(6, 4), Offset(19.5, 12), Offset(6, 20)];

  @override
  void paint(Canvas canvas, Size size) {
    final k = size.shortestSide / 24;
    final path = Path()..addPolygon([for (final c in corners) c * k], true);
    canvas.drawPath(path, Paint()..color = color);
    canvas.drawPath(
      path,
      Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2 * k
        ..strokeJoin = StrokeJoin.round,
    );
  }

  @override
  bool shouldRepaint(StartGlyphPainter old) => old.color != color;
}
