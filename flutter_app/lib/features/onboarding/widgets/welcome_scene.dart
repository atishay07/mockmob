import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/art/scene_art.dart';

/// Where everything sits on the painted welcome room (`scene-welcome-hero-night`, 1080 by 2340),
/// for a screen of [screen] whose room (everything above the words) is [room] tall.
///
/// The painting covers the screen, aligned to the top, so it is scaled by whichever of the
/// width or height needs more. Mobi's feet go where the painter left the lit ellipse (51.2% across,
/// 53.4% down) and he is 560 px tall at 1080 wide, scaled with the painting. On a short screen
/// the painting slides up just enough that the ellipse stays above the headline, never under it.
@immutable
class WelcomeHeroLayout {
  const WelcomeHeroLayout._({required this.image, required this.feet, required this.ellipse, required this.mobiHeight});

  factory WelcomeHeroLayout.of(Size screen, {required double room, double topLimit = 0}) {
    final w = imageWidthFor(screen);
    final h = w * SceneArt.welcomeHero.aspect;
    final left = (screen.width - w) / 2;
    final footAt = footY * h;
    // Keep the ellipse (half of its 5.3% height below the feet) above the words.
    final dy = math.min(0.0, room - ellipseH / 2 * h - footAt);
    final feet = Offset(left + footX * w, footAt + dy);
    // As tall as the painting says, but never up into the wordmark.
    final mobi = math.max(0.0, math.min(mobiShare * h, feet.dy - topLimit));
    return WelcomeHeroLayout._(
      image: Rect.fromLTWH(left, dy, w, h),
      feet: feet,
      ellipse: Rect.fromCenter(center: Offset(left + ellipseX * w, ellipseY * h + dy), width: ellipseW * w, height: ellipseH * h),
      mobiHeight: mobi,
    );
  }

  /// The anchors measured on the delivered file (`final/anchors.json`).
  static const double footX = 0.512;
  static const double footY = 0.534;
  static const double ellipseX = 0.512;
  static const double ellipseY = 0.5315;
  static const double ellipseW = 0.78;
  static const double ellipseH = 0.053;

  /// Mobi's height as a share of the painting's height (560 of 2340 px).
  static const double mobiShare = 560 / 2340;

  /// Where the pinned answer sheet starts, as a share of the painting's width. Mobi's line stays
  /// left of it, over the bookshelf, so it never covers the sheet.
  static const double sheetLeft = 0.6;

  /// The width the painting is drawn (and decoded) at on [screen].
  static double imageWidthFor(Size screen) {
    final art = SceneArt.welcomeHero;
    return math.max(screen.width, screen.height / art.aspect);
  }

  /// The painting's box on the screen (it may run off the top on a short screen).
  final Rect image;

  /// The point between Mobi's feet.
  final Offset feet;

  /// The lit ellipse on the floor.
  final Rect ellipse;
  final double mobiHeight;
}

/// The welcome room: the painted lamp-lit study, and the lamp clicking on as it opens (the
/// filament catches, dips once, then the light rises over 520 ms: a dark veil lifts off the
/// painting and the floor ellipse warms up under Mobi). Nothing moves after that. Under reduced
/// motion, or with [animate] off, the room is lit from the first frame.
class WelcomeHero extends StatefulWidget {
  const WelcomeHero({super.key, required this.layout, this.animate = true});

  final WelcomeHeroLayout layout;
  final bool animate;

  /// How long the lamp takes to come on.
  static const Duration lampOn = Duration(milliseconds: 520);

  @override
  State<WelcomeHero> createState() => _WelcomeHeroState();
}

class _WelcomeHeroState extends State<WelcomeHero> with SingleTickerProviderStateMixin {
  late final AnimationController _lamp = AnimationController(vsync: this, duration: WelcomeHero.lampOn);

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_lamp.isAnimating || _lamp.value > 0) return;
    if (!widget.animate || Motion.reduced(context)) {
      _lamp.value = 1;
    } else {
      _lamp.forward();
    }
  }

  @override
  void dispose() {
    _lamp.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = widget.layout;
    final lamp = context.mmColors.lamp;
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Positioned.fromRect(rect: l.image, child: SceneImage(SceneArt.welcomeHero, width: l.image.width, height: l.image.height)),
        // The veil and the floor warmth repaint on their own layer while the lamp comes on, so
        // the decoded painting under them is never drawn again.
        Positioned.fill(
          child: IgnorePointer(
            child: RepaintBoundary(
              child: CustomPaint(painter: _LampPainter(clock: _lamp, ellipse: l.ellipse, lamp: lamp)),
            ),
          ),
        ),
      ],
    );
  }
}

class _LampPainter extends CustomPainter {
  _LampPainter({required this.clock, required this.ellipse, required this.lamp}) : super(repaint: clock);

  final Animation<double> clock;
  final Rect ellipse;
  final Color lamp;

  /// How lit the room is at [t] (0 to 1 over [WelcomeHero.lampOn]): the filament catches (to 0.6
  /// in the first 15%), dips once, then the light rises on the emphasized curve. One flicker.
  static double lit(double t) {
    final x = t.clamp(0.0, 1.0);
    if (x < 0.15) return 0.6 * (x / 0.15);
    if (x < 0.3) return 0.6 - 0.3 * ((x - 0.15) / 0.15);
    return 0.3 + 0.7 * Motion.emphasized.transform((x - 0.3) / 0.7);
  }

  @override
  void paint(Canvas canvas, Size size) {
    final on = lit(clock.value);
    if (on < 1) {
      canvas.drawRect(Offset.zero & size, Paint()..color = const Color(0xFF000000).withValues(alpha: 0.72 * (1 - on)));
    }
    // The ellipse warms a touch past the painting's own glow as the lamp lands, then rests at a
    // faint pool, so Mobi stands in light and not on a picture of it.
    final warm = on * 0.16;
    if (warm <= 0 || ellipse.isEmpty) return;
    // A circle squashed to the ellipse, so the falloff follows its shape.
    final r = ellipse.width / 2;
    canvas.save();
    canvas.translate(ellipse.center.dx, ellipse.center.dy);
    canvas.scale(1, ellipse.height * 1.6 / ellipse.width);
    canvas.drawCircle(
      Offset.zero,
      r,
      Paint()
        ..shader = RadialGradient(colors: [lamp.withValues(alpha: warm), lamp.withValues(alpha: warm * 0.4), lamp.withValues(alpha: 0)], stops: const [0, 0.5, 1])
            .createShader(Rect.fromCircle(center: Offset.zero, radius: r)),
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(_LampPainter old) => old.ellipse != ellipse || old.lamp != lamp || old.clock != clock;
}
