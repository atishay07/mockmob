import 'dart:async';
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
/// painting and the floor ellipse warms up under Mobi). After that the room is alive and quiet:
/// the lamp breathes (a slow swell of its glow, 8 s), a few dust motes drift up through its cone,
/// and now and then the lamp flicks (the glow dips for 420 ms) and [onFlick] says where it hung,
/// so Mobi can glance up. The loop is one painter on one ticker: it stops with the route and
/// never runs under reduced motion, or with [animate] off, when the room is lit from the first
/// frame and still. It also never runs for ever: after [cycles] breaths (32 s) it fades out over
/// 1.5 s and the room rests, so a phone left on Welcome is not kept drawing, and a test that
/// waits for the screen to settle can.
class WelcomeHero extends StatefulWidget {
  const WelcomeHero({super.key, required this.layout, this.animate = true, this.onFlick});

  final WelcomeHeroLayout layout;
  final bool animate;

  /// The lamp flicked; told where it hangs, in this widget's own coordinates.
  final ValueChanged<Offset>? onFlick;

  /// Where the lamp's shade hangs in the painting, as shares of its width and height, and the
  /// cone's foot (the pinned sheet's top).
  static const double lampX = 0.774;
  static const double lampY = 0.1;
  static const double coneFootY = 0.2;

  /// The breathing and mote loop, and the first flick; later ones follow every [flickEvery].
  static const Duration loop = Duration(seconds: 8);

  /// How many breaths the room takes before it rests (32 s in all).
  static const int cycles = 4;
  static const Duration firstFlick = Duration(seconds: 9);
  static const Duration flickEvery = Duration(seconds: 17);
  static const Duration flickFor = Duration(milliseconds: 420);

  /// The whole alive span, and how long it takes to fade in and out at its two ends.
  static const Duration span = Duration(seconds: 8 * cycles);
  static const Duration fadeEnds = Duration(milliseconds: 1500);

  /// How long the lamp takes to come on.
  static const Duration lampOn = Duration(milliseconds: 520);

  @override
  State<WelcomeHero> createState() => _WelcomeHeroState();
}

class _WelcomeHeroState extends State<WelcomeHero> with TickerProviderStateMixin {
  late final AnimationController _lamp = AnimationController(vsync: this, duration: WelcomeHero.lampOn);
  late final AnimationController _loop = AnimationController(vsync: this, duration: WelcomeHero.span);
  late final AnimationController _flick = AnimationController(vsync: this, duration: WelcomeHero.flickFor);
  Timer? _flickTimer;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_lamp.isAnimating || _lamp.value > 0) return;
    if (!widget.animate || Motion.reduced(context)) {
      _lamp.value = 1;
    } else {
      _lamp.forward();
      // Once it is on, the room breathes for its span; the ticker stops with the route.
      _loop.forward();
      _flickTimer = Timer(WelcomeHero.firstFlick, _doFlick);
    }
  }

  void _doFlick() {
    if (!mounted) return;
    _flick.forward(from: 0);
    final l = widget.layout.image;
    widget.onFlick?.call(Offset(l.left + WelcomeHero.lampX * l.width, l.top + WelcomeHero.lampY * l.height));
    // The next flick only if the room is still breathing by then.
    final elapsed = Duration(milliseconds: (_loop.value * WelcomeHero.span.inMilliseconds).round());
    final left = WelcomeHero.span - WelcomeHero.fadeEnds - elapsed;
    if (left > WelcomeHero.flickEvery) _flickTimer = Timer(WelcomeHero.flickEvery, _doFlick);
  }

  @override
  void dispose() {
    _flickTimer?.cancel();
    _lamp.dispose();
    _loop.dispose();
    _flick.dispose();
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
              child: CustomPaint(painter: _LampPainter(clock: _lamp, ellipse: l.ellipse, lamp: lamp, loop: _loop, flick: _flick, image: l.image)),
            ),
          ),
        ),
      ],
    );
  }
}

class _LampPainter extends CustomPainter {
  _LampPainter({required this.clock, required this.ellipse, required this.lamp, required this.loop, required this.flick, required this.image})
      : super(repaint: Listenable.merge([clock, loop, flick]));

  final Animation<double> clock;
  final Rect ellipse;
  final Color lamp;

  /// The slow loop (breathing, motes) and the flick, 0 to 1.
  final Animation<double> loop;
  final Animation<double> flick;

  /// The painting's box: the lamp and its cone sit at shares of it.
  final Rect image;

  static const int motes = 14;

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
    // The flick: the glow dips once and comes back (the veil is only there while it runs).
    final dip = flick.isAnimating ? math.sin(math.pi * flick.value) : 0.0;
    if (dip > 0 && on >= 1) {
      canvas.drawRect(Offset.zero & size, Paint()..color = const Color(0xFF000000).withValues(alpha: 0.38 * dip));
    }
    if (on >= 1 && loop.isAnimating) _alive(canvas, dip);
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

  /// The lamp breathing and the motes in its cone. Dust is a few specks, never a snowfall.
  void _alive(Canvas canvas, double dip) {
    final w = image.width, h = image.height;
    final lampAt = Offset(image.left + WelcomeHero.lampX * w, image.top + WelcomeHero.lampY * h);
    // Where in the current breath, and how present the whole thing is: it eases in as the room
    // comes alive and out as it goes to rest, so nothing pops at either end.
    final spanMs = WelcomeHero.span.inMilliseconds;
    final elapsed = loop.value * spanMs;
    final t = (loop.value * WelcomeHero.cycles) % 1.0;
    final endMs = WelcomeHero.fadeEnds.inMilliseconds;
    final env = math.min(1.0, math.min(elapsed / endMs, (spanMs - elapsed) / endMs)).clamp(0.0, 1.0);
    // The breath: the glow under the shade swells and eases over the loop.
    final breath = 0.5 + 0.5 * math.sin(2 * math.pi * t);
    final glowR = w * 0.3;
    final a = (0.07 + 0.07 * breath) * (1 - dip) * env;
    canvas.drawCircle(
      lampAt + Offset(0, h * 0.03),
      glowR,
      Paint()
        ..shader = RadialGradient(colors: [lamp.withValues(alpha: a), lamp.withValues(alpha: 0)]).createShader(Rect.fromCircle(center: lampAt + Offset(0, h * 0.03), radius: glowR)),
    );
    // The motes: each rises through the cone on its own phase, swaying a little, fading in and
    // out so none pops. Positions are arithmetic on the index, so every run is the same.
    final top = image.top + (WelcomeHero.lampY + 0.01) * h;
    final foot = image.top + WelcomeHero.coneFootY * h;
    final paint = Paint();
    for (var i = 0; i < motes; i++) {
      final p = (t + i / motes) % 1.0;
      final y = foot + (top - foot) * p;
      final spread = ((y - (image.top + WelcomeHero.lampY * h)) / (0.1 * h)) * 0.15 * w;
      final r = ((i * 37) % 17) / 16;
      final x = lampAt.dx + (r * 2 - 1) * spread * 0.8 + math.sin(2 * math.pi * (p * 1.5 + i * 0.37)) * w * 0.006;
      final alpha = math.sin(math.pi * p) * (0.25 + 0.45 * ((i * 11) % 7) / 6) * (1 - dip) * env;
      paint.color = const Color(0xFFFFE7A8).withValues(alpha: alpha);
      canvas.drawCircle(Offset(x, y), 0.8 + 1.1 * (((i * 5) % 4) / 3), paint);
    }
  }

  @override
  bool shouldRepaint(_LampPainter old) => old.ellipse != ellipse || old.lamp != lamp || old.clock != clock || old.image != image;
}
