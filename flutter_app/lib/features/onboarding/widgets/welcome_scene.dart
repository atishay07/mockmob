import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/art/scene_art.dart';
import '../../../core/widgets/art/scene_life.dart';

/// Where everything sits on the painted welcome room, for a screen of [screen] whose room
/// (everything above the words) is [room] tall.
///
/// Night ([WelcomeHeroLayout.of]) is `scene-welcome-hero-night`: the painted room only, 1296 by
/// 1620, drawn at least the width of the screen from the top; under it the ground, which the
/// painting's foot melts into. Mobi's feet go where the painter left the lit ellipse (50.4%
/// across, 85.7% down the painting) and he is 51.85% of the painting's width tall, scaled with
/// the painting. The floor reaches down to the words (design critic 3: no dead band under the
/// scene): the painting grows, up to [maxGrow] of the screen's width (its sides run off the
/// screen, never anything in the middle), until the ellipse sits [floorGap] above the words;
/// on a taller phone it then slides down, at most [maxSlide], its dark top melting into the
/// ground. On a short screen it slides up just enough that the ellipse stays above the headline.
///
/// Day ([WelcomeHeroLayout.day]) is the same room lit by day, the painting every all-clear state
/// uses (`scene-empty-allclear-day`, 3:2, feathered to the Day ground on every edge): drawn
/// [dayGrow] times the screen's width, centred (the feathered sides run off the screen), its
/// floor running into the words, the window, the lamp and the pinned sheet in view, and the
/// wall rising into the ground above it, where Mobi's line sits.
@immutable
class WelcomeHeroLayout {
  const WelcomeHeroLayout._({
    required this.art,
    required this.image,
    required this.feet,
    required this.ellipse,
    required this.mobiHeight,
    required this.sheetX,
    this.topFade = 0,
  });

  factory WelcomeHeroLayout.of(Size screen, {required double room, double topLimit = 0}) {
    final base = imageWidthFor(screen);
    final aspect = SceneArt.welcomeHero.aspect;
    // Where the ellipse's foot falls, as a share of the painting's height.
    const floor = footY + ellipseH / 2;
    // Grow until the ellipse sits [floorGap] above the words (never shrink, never past maxGrow).
    final want = (room - floorGap) / (floor * aspect);
    final w = want.clamp(base, base * maxGrow);
    final h = w * aspect;
    final left = (screen.width - w) / 2;
    final footAt = footY * h;
    final gap = room - floorGap - floor * h;
    // Short: slide up so the ellipse stays above the words. Tall: slide down, a little.
    final dy = gap < 0 ? math.min(0.0, room - ellipseH / 2 * h - footAt) : math.min(gap, maxSlide);
    final feet = Offset(left + footX * w, footAt + dy);
    // As tall as the painting says, but never up into the wordmark.
    final mobi = math.max(0.0, math.min(mobiWidthShare * w, feet.dy - topLimit));
    return WelcomeHeroLayout._(
      art: SceneArt.welcomeHero,
      image: Rect.fromLTWH(left, dy, w, h),
      feet: feet,
      ellipse: Rect.fromCenter(center: Offset(left + ellipseX * w, ellipseY * h + dy), width: ellipseW * w, height: ellipseH * h),
      mobiHeight: mobi,
      sheetX: left + sheetLeft * w,
      topFade: dy > 0 ? math.min(dy + MmSpace.s32, 96.0) : 0,
    );
  }

  /// The daylight room (see the class comment).
  factory WelcomeHeroLayout.day(Size screen, {required double room, double topLimit = 0}) {
    final art = SceneArt.welcomeRoom(night: false);
    final w = screen.width * dayGrow;
    final h = w * art.aspect;
    final left = (screen.width - w) / 2;
    // The painting's feathered foot runs a little under the words' top padding, so the floor
    // reaches them; on a short phone it slides up no further than keeps Mobi under the wordmark.
    final top = room + dayOverlap - h;
    final feet = Offset(left + dayFootX * w, top + dayFootY * h);
    final mobi = math.max(0.0, math.min(dayMobiShare * h, feet.dy - topLimit));
    return WelcomeHeroLayout._(
      art: art,
      image: Rect.fromLTWH(left, top, w, h),
      feet: feet,
      ellipse: Rect.fromCenter(center: Offset(left + dayEllipseX * w, top + dayEllipseY * h), width: dayEllipseW * w, height: dayEllipseH * h),
      mobiHeight: mobi,
      sheetX: left + daySheetLeft * w,
    );
  }

  /// The anchors measured on the delivered file, as shares of the painting
  /// (`shared/scene-anchors.json`, `welcome`; a test keeps the two equal).
  static const double footX = 0.504;
  static const double footY = 0.857;
  static const double ellipseX = 0.504;
  static const double ellipseY = 0.853;
  static const double ellipseW = 0.771;
  static const double ellipseH = 0.092;

  /// Mobi's height as a share of the painting's width.
  static const double mobiWidthShare = 560 / 1080;

  /// Where the pinned answer sheet starts, as a share of the painting's width (it is at 60.9%).
  /// Mobi's line stays left of it, over the bookshelf, so it never covers the sheet.
  static const double sheetLeft = 0.6;

  /// Night: how far above the words the ellipse's foot may sit before the painting grows, the
  /// most it grows (as a share of the screen's width) and the most it then slides down.
  static const double floorGap = MmSpace.s32;
  static const double maxGrow = 1.15;
  static const double maxSlide = MmSpace.s48;

  /// Day: the daylight room's anchors are the all-clear room's own (Mobi's feet and the sunlit
  /// pool, [SceneAnchor] and the floor-lamp [SceneLifeSpec]); the pool's height and the sheet's
  /// left edge are measured on the same file.
  static const double dayFootX = 0.514;
  static const double dayFootY = 0.796;
  static const double dayEllipseX = 0.514;
  static const double dayEllipseY = 0.785;
  static const double dayEllipseW = 0.55;
  static const double dayEllipseH = 0.17;
  static const double daySheetLeft = 0.61;

  /// Day: the painting's width as a share of the screen's (its feathered sides and the plant
  /// run off the edges; the window, the lamp, the pool and the sheet stay in view), how far its
  /// feathered foot runs under the words, and Mobi's height as a share of its height.
  static const double dayGrow = 1.3;
  static const double dayOverlap = MmSpace.s16;
  static const double dayMobiShare = 0.48;

  /// The width the night painting is drawn (and decoded) at on [screen], before it grows: the
  /// screen's.
  static double imageWidthFor(Size screen) => screen.width;

  /// The painting drawn.
  final SceneArt art;

  /// The painting's box on the screen (it may run off the top on a short screen, and off both
  /// sides when it grows).
  final Rect image;

  /// The point between Mobi's feet.
  final Offset feet;

  /// The lit ellipse on the floor.
  final Rect ellipse;
  final double mobiHeight;

  /// Where the pinned answer sheet starts on the screen: Mobi's line ends before it.
  final double sheetX;

  /// How tall the fade from the ground into the painting's top edge is, when the painting has
  /// slid down from the top (0: none).
  final double topFade;

  /// The daylight room.
  bool get day => art != SceneArt.welcomeHero;
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
  static const double lampX = 0.748;
  static const double lampY = 0.157;
  static const double coneFootY = 0.318;

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
    // By day there is no lamp to come on: the room is lit, and its own life is [SceneLife]'s.
    if (!widget.animate || Motion.reduced(context) || widget.layout.day) {
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
    final colors = context.mmColors;
    final lamp = colors.lamp;
    if (l.day) {
      // The daylit room: the painting, its sunlit pool breathing a little for a few breaths
      // (never under reduced motion or with [WelcomeHero.animate] off), nothing else moving.
      final picture = SceneImage(l.art, width: l.image.width, height: l.image.height, fit: BoxFit.fill);
      return Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned.fromRect(
            rect: l.image,
            child: widget.animate ? SceneLife(scene: StateScene.allClear, night: false, child: picture) : picture,
          ),
        ],
      );
    }
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Positioned.fromRect(rect: l.image, child: SceneImage(l.art, width: l.image.width, height: l.image.height)),
        // Slid down on a tall phone: the painting's dark top edge melts into the ground.
        if (l.topFade > 0)
          Positioned(
            left: 0,
            right: 0,
            top: 0,
            height: l.topFade,
            child: IgnorePointer(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [colors.ground, colors.ground.withValues(alpha: 0)],
                    stops: [(l.image.top / l.topFade).clamp(0.0, 1.0), 1],
                  ),
                ),
              ),
            ),
          ),
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
      lampAt + Offset(0, w * 0.065),
      glowR,
      Paint()
        ..shader = RadialGradient(colors: [lamp.withValues(alpha: a), lamp.withValues(alpha: 0)]).createShader(Rect.fromCircle(center: lampAt + Offset(0, w * 0.065), radius: glowR)),
    );
    // The motes: each rises through the cone on its own phase, swaying a little, fading in and
    // out so none pops. Positions are arithmetic on the index, so every run is the same.
    final top = image.top + WelcomeHero.lampY * h + w * 0.022;
    final foot = image.top + WelcomeHero.coneFootY * h;
    final paint = Paint();
    for (var i = 0; i < motes; i++) {
      final p = (t + i / motes) % 1.0;
      final y = foot + (top - foot) * p;
      final spread = ((y - (image.top + WelcomeHero.lampY * h)) / (w * 0.217)) * 0.15 * w;
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
