import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter/widgets.dart';

import '../../motion/motion.dart';
import '../../theme/theme.dart';
import 'hybrid_sims.dart';
import 'hybrid_spec.dart';

/// The colours a hybrid object's drawn part takes on the current theme.
///
/// The part is volt on Night and the deep olive on Daylight, with a thin edge so it holds on a
/// brass plate or a white face, and a soft glint of the lamp. The compass needle is the one
/// exception: it lies on a charcoal dial in both themes, so it is a filled volt mark on both (the
/// design system's rule for a filled mark), edged in the darker volt on Daylight.
@immutable
class HybridInk {
  const HybridInk({required this.fill, required this.edge, required this.glint, required this.tail, required this.shadow});

  factory HybridInk.of(BuildContext context, {bool darkFace = false}) {
    final c = context.mmColors;
    final night = c.isNight;
    return HybridInk(
      fill: night || darkFace ? c.volt : c.accentText,
      edge: darkFace ? (night ? const Color(0x99000000) : c.voltEdge) : const Color(0x8C14130F),
      glint: c.lamp,
      tail: const Color(0xFF6A5C46),
      shadow: night ? const Color(0x52000000) : c.ink.withValues(alpha: 0.16),
    );
  }

  /// Ink for a part drawn on a white enamel face (the stopwatch's hands). The face is part of
  /// the photographed object, white in both themes, so its hands take the readable olive in both:
  /// on Night the page's volt on that enamel is about 1.1:1 and the hand read as a hairline
  /// outline; the olive is about 5.6:1 (19 Oct, H4).
  factory HybridInk.onEnamel(BuildContext context) {
    final c = context.mmColors;
    return HybridInk(
      fill: MmColors.light.accentText,
      edge: const Color(0x8C14130F),
      glint: c.lamp,
      tail: const Color(0xFF6A5C46),
      shadow: const Color(0x33000000),
    );
  }

  final Color fill;
  final Color edge;
  final Color glint;

  /// The unlit end of a compass needle.
  final Color tail;

  /// The contact shadow under the object and the drawn part's shadow on its face.
  final Color shadow;

  @override
  bool operator ==(Object other) =>
      other is HybridInk && other.fill == fill && other.edge == edge && other.glint == glint && other.tail == tail && other.shadow == shadow;

  @override
  int get hashCode => Object.hash(fill, edge, glint, tail, shadow);
}

/// The clock every hybrid object runs on: seconds since the object was made, advanced by a ticker
/// only while something moves. The ticker is the state's own, so TickerMode (a hidden tab, a
/// route underneath) holds it.
abstract class _HybridState<W extends StatefulWidget> extends State<W> with SingleTickerProviderStateMixin {
  /// Made the first time something moves, so a still pose never holds one.
  Ticker? _ticker;
  final ValueNotifier<double> clock = ValueNotifier<double>(0);
  double _base = 0;
  bool _started = false;
  bool reduced = false;

  double get now => clock.value;

  /// True once nothing more will move.
  bool settledAt(double t);

  /// The first pose (called once, when the theme and the motion setting are known).
  void begin();

  void _tick(Duration elapsed) {
    clock.value = _base + elapsed.inMicroseconds / Duration.microsecondsPerSecond;
    if (settledAt(clock.value)) {
      _ticker?.stop();
      _base = clock.value;
    }
  }

  /// Runs the clock until the motion settles.
  void wake() {
    if (reduced) {
      // A still pose: one repaint, no travel.
      clock.value = clock.value + 1e-6;
      return;
    }
    if (_ticker?.isActive ?? false) return;
    if (settledAt(clock.value)) {
      clock.value = clock.value + 1e-6;
      return;
    }
    _base = clock.value;
    (_ticker ??= createTicker(_tick)).start();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    reduced = Motion.reduced(context);
    if (!_started) {
      _started = true;
      begin();
      wake();
    }
  }

  @override
  void dispose() {
    _ticker?.dispose();
    clock.dispose();
    super.dispose();
  }

  /// The raster with its contact shadow under it and [part] painted over it, at [height].
  Widget frame({required HybridSpec spec, required double height, required CustomPainter part, Widget Function(Widget image)? wrapImage, double light = 1}) {
    final ink = HybridInk.of(context);
    final width = height * spec.aspect;
    Widget image = Image.asset(
      spec.asset,
      width: width,
      height: height,
      fit: BoxFit.fill,
      filterQuality: FilterQuality.medium,
      excludeFromSemantics: true,
      gaplessPlayback: true,
    );
    if (light < 1) {
      image = context.mmColors.isNight
          ? ColorFiltered(colorFilter: ColorFilter.matrix(_dim(light)), child: image)
          : Opacity(opacity: light, child: image);
    }
    if (wrapImage != null) image = wrapImage(image);
    return ExcludeSemantics(
      child: RepaintBoundary(
        child: SizedBox(
          width: width,
          height: height,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              if (spec.foot != null) Positioned.fill(child: CustomPaint(painter: _ContactShadow(spec: spec, color: ink.shadow))),
              image,
              Positioned.fill(child: CustomPaint(painter: part)),
            ],
          ),
        ),
      ),
    );
  }

  static List<double> _dim(double k) => [k, 0, 0, 0, 0, 0, k, 0, 0, 0, 0, 0, k, 0, 0, 0, 0, 0, 1, 0];
}

class _ContactShadow extends CustomPainter {
  const _ContactShadow({required this.spec, required this.color});

  final HybridSpec spec;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final foot = spec.foot!;
    final center = Offset(foot.dx * size.width, foot.dy * size.height);
    final rect = Rect.fromCenter(center: center, width: spec.footWidth * size.width * 1.08, height: size.height * 0.07);
    canvas.save();
    canvas.translate(center.dx, center.dy);
    canvas.scale(1, rect.height / rect.width);
    canvas.translate(-center.dx, -center.dy);
    final r = rect.width / 2;
    canvas.drawCircle(
      center,
      r,
      Paint()..shader = RadialGradient(colors: [color, color.withValues(alpha: 0)], stops: const [0.35, 1]).createShader(Rect.fromCircle(center: center, radius: r)),
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(_ContactShadow old) => old.color != color || old.spec != spec;
}

/// Moves the canvas into a dial's own space: the pin at the origin, the face's tilt undone, and
/// the dial's ellipse as the unit circle. Returns the pixels per unit (the smaller semi-axis), so a
/// stroke can be given in pixels.
double _intoDial(Canvas canvas, Size size, HybridSpec spec) {
  final rx = spec.radiusX * size.width;
  final ry = spec.radiusY * size.height;
  canvas.translate(spec.pivot.dx * size.width, spec.pivot.dy * size.height);
  canvas.rotate(spec.faceTilt);
  canvas.scale(rx, ry);
  return math.min(rx, ry);
}

// ---------------------------------------------------------------------------------------------
// Compass

/// The gimbal compass with a drawn needle.
///
/// While [searching] the needle wanders; otherwise it swings on a spring to [heading] (radians
/// clockwise from the lubber line at 12) and settles with an overshoot and two damped swings.
/// Bumping [nudge] knocks it off and lets it settle again ([nudgeDirection] says which way): the
/// ground changed under the same heading. [arc], when given, is a fraction drawn round the dial
/// (it travels from the old value to the new). Reduced motion holds the final pose.
class HybridCompass extends StatefulWidget {
  const HybridCompass({super.key, required this.height, this.searching = false, this.heading = 0, this.nudge = 0, this.nudgeDirection = 1, this.arc});

  final double height;
  final bool searching;
  final double heading;
  final int nudge;
  final int nudgeDirection;
  final double? arc;

  static const HybridSpec spec = HybridSpec.compass;

  @override
  State<HybridCompass> createState() => _HybridCompassState();
}

class _HybridCompassState extends _HybridState<HybridCompass> {
  late NeedleSim _needle;
  double _arcFrom = 0;
  double _arcTo = 0;
  double _arcStart = 0;

  static const double _arcTime = 0.7;

  double _arcAt(double t) => _arcFrom + (_arcTo - _arcFrom) * const Cubic(0.45, 0, 0.55, 1).transform(((t - _arcStart) / _arcTime).clamp(0.0, 1.0));

  @override
  void begin() {
    _arcTo = widget.arc ?? 0;
    _arcFrom = reduced ? _arcTo : 0;
    if (reduced) {
      _needle = NeedleSim(angle: widget.heading);
    } else if (widget.searching) {
      _needle = NeedleSim(angle: widget.heading - 0.5)..search(0);
    } else {
      // Arrives a little off and swings onto the heading: the answer is in.
      _needle = NeedleSim(angle: widget.heading - 1.1)..settle(widget.heading, 0.12);
    }
  }

  @override
  bool settledAt(double t) => _needle.settledAt(t) && t - _arcStart >= _arcTime;

  @override
  void didUpdateWidget(HybridCompass old) {
    super.didUpdateWidget(old);
    final t = now;
    if (widget.arc != old.arc) {
      _arcFrom = reduced ? (widget.arc ?? 0) : _arcAt(t);
      _arcTo = widget.arc ?? 0;
      _arcStart = t;
    }
    if (reduced) {
      _needle.jump(widget.heading);
    } else if (widget.searching) {
      _needle.search(t);
    } else if (old.searching || widget.heading != old.heading) {
      _needle.settle(widget.heading, t);
    } else if (widget.nudge != old.nudge) {
      _needle.settle(widget.heading, t, kick: 9.0 * widget.nudgeDirection.sign);
    }
    wake();
  }

  @override
  Widget build(BuildContext context) {
    return frame(
      spec: HybridCompass.spec,
      height: widget.height,
      part: _NeedlePainter(clock: clock, needle: _needle, arc: _arcAt, showArc: widget.arc != null, ink: HybridInk.of(context, darkFace: true)),
    );
  }
}

class _NeedlePainter extends CustomPainter {
  _NeedlePainter({required this.clock, required this.needle, required this.arc, required this.showArc, required this.ink}) : super(repaint: clock);

  final ValueListenable<double> clock;
  final NeedleSim needle;
  final double Function(double t) arc;
  final bool showArc;
  final HybridInk ink;

  @override
  void paint(Canvas canvas, Size size) {
    final t = clock.value;
    canvas.save();
    final px = _intoDial(canvas, size, HybridCompass.spec);
    final unit = 1 / px;

    if (showArc) {
      final f = arc(t).clamp(0.0, 1.0);
      final ring = Rect.fromCircle(center: Offset.zero, radius: 0.9);
      final stroke = math.max(2.0, px * 0.05) * unit;
      canvas.drawArc(ring, 0, 2 * math.pi, false, Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..color = const Color(0x1FFFFFFF));
      if (f > 0.002) {
        canvas.drawArc(ring, -math.pi / 2, 2 * math.pi * f, false, Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = stroke
          ..strokeCap = StrokeCap.round
          ..color = ink.fill);
      }
    }

    canvas.rotate(needle.angleAt(t));
    const length = 0.8;
    const tailLength = 0.62;
    final half = math.max(2.2, px * 0.085) * unit;
    final north = Path()
      ..moveTo(0, -length)
      ..lineTo(half, 0)
      ..lineTo(-half, 0)
      ..close();
    final south = Path()
      ..moveTo(0, tailLength)
      ..lineTo(half, 0)
      ..lineTo(-half, 0)
      ..close();

    // Its shadow on the dial, down and to the right of the lamp.
    canvas.save();
    canvas.translate(0.025, 0.05);
    final shadow = Paint()..color = const Color(0x66000000);
    canvas.drawPath(north, shadow);
    canvas.drawPath(south, shadow);
    canvas.restore();

    canvas.drawPath(south, Paint()..color = ink.tail);
    canvas.drawPath(north, Paint()..color = ink.fill);
    final edge = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 0.9 * unit
      ..strokeJoin = StrokeJoin.round
      ..color = ink.edge;
    canvas.drawPath(north, edge);
    canvas.drawPath(south, edge);
    // The lamp catches the lit side of the needle.
    canvas.drawLine(
      Offset(half * 0.35, -0.06),
      Offset(half * 0.08, -length * 0.86),
      Paint()
        ..strokeWidth = 0.9 * unit
        ..strokeCap = StrokeCap.round
        ..color = ink.glint.withValues(alpha: 0.6),
    );
    _cap(canvas, math.max(2.6, px * 0.075) * unit, ink);
    canvas.restore();
  }

  @override
  bool shouldRepaint(_NeedlePainter old) => old.needle != needle || old.ink != ink || old.showArc != showArc || old.clock != clock;
}

/// A brass pin cap, lit from the lamp.
void _cap(Canvas canvas, double r, HybridInk ink) {
  final rect = Rect.fromCircle(center: Offset.zero, radius: r);
  canvas.drawCircle(
    Offset.zero,
    r,
    Paint()
      ..shader = RadialGradient(
        center: const Alignment(-0.4, -0.5),
        colors: [Color.lerp(const Color(0xFFF3DCA6), ink.glint, 0.25)!, const Color(0xFF8A6A35), const Color(0xFF4A3920)],
        stops: const [0, 0.6, 1],
      ).createShader(rect),
  );
}

// ---------------------------------------------------------------------------------------------
// Metronome

/// The metronome with a drawn arm and its sliding weight.
///
/// It ticks [ticks] times (at most 7: one swing side to side every 0.6 s) after [delay] when it
/// first shows, then stands upright. A rise of [ticks] while it is on screen ticks the difference.
/// [paused] leans the arm on the slot's side and keeps it there. Reduced motion: upright, or the
/// lean when paused.
class HybridMetronome extends StatefulWidget {
  const HybridMetronome({super.key, required this.height, this.ticks = 0, this.paused = false, this.delay = const Duration(milliseconds: 350)});

  final double height;
  final int ticks;
  final bool paused;
  final Duration delay;

  static const HybridSpec spec = HybridSpec.metronome;

  @override
  State<HybridMetronome> createState() => _HybridMetronomeState();
}

class _HybridMetronomeState extends _HybridState<HybridMetronome> {
  final MetronomeSim _arm = MetronomeSim();

  @override
  void begin() {
    final start = widget.delay.inMicroseconds / Duration.microsecondsPerSecond;
    if (widget.paused) {
      _arm.pause(reduced ? null : start);
    } else if (reduced || widget.ticks <= 0) {
      _arm.still();
    } else {
      _arm.run(widget.ticks, start);
    }
  }

  @override
  bool settledAt(double t) => _arm.settledAt(t);

  @override
  void didUpdateWidget(HybridMetronome old) {
    super.didUpdateWidget(old);
    final t = now;
    if (widget.paused != old.paused) {
      if (widget.paused) {
        _arm.pause(reduced ? null : t);
      } else {
        _arm.still();
      }
    } else if (!widget.paused && widget.ticks > old.ticks && !reduced) {
      _arm.run(widget.ticks - old.ticks, t);
    }
    wake();
  }

  @override
  Widget build(BuildContext context) {
    return frame(
      spec: HybridMetronome.spec,
      height: widget.height,
      part: _ArmPainter(clock: clock, arm: _arm, ink: HybridInk.of(context)),
    );
  }
}

class _ArmPainter extends CustomPainter {
  _ArmPainter({required this.clock, required this.arm, required this.ink}) : super(repaint: clock);

  final ValueListenable<double> clock;
  final MetronomeSim arm;
  final HybridInk ink;

  @override
  void paint(Canvas canvas, Size size) {
    final t = clock.value;
    const spec = HybridMetronome.spec;
    final pivot = Offset(spec.pivot.dx * size.width, spec.pivot.dy * size.height);
    final top = Offset(HybridSpec.metronomeSlotTop.dx * size.width, HybridSpec.metronomeSlotTop.dy * size.height);
    final upright = math.atan2(top.dx - pivot.dx, pivot.dy - top.dy);
    final length = HybridSpec.metronomeArm * size.height;
    final stroke = math.max(1.6, size.width * 0.013);

    canvas.save();
    canvas.translate(pivot.dx, pivot.dy);
    canvas.rotate(upright + arm.angleAt(t));

    final w = arm.weightAt(t) * length;
    final weight = RRect.fromRectAndRadius(
      Rect.fromCenter(center: Offset(0, -w), width: math.max(5.0, size.width * 0.085), height: math.max(4.0, size.height * 0.05)),
      Radius.circular(math.max(1.0, size.width * 0.012)),
    );

    // Shadow on the plate.
    canvas.save();
    canvas.translate(stroke * 0.9, stroke * 1.2);
    final shadow = Paint()..color = const Color(0x59000000);
    canvas.drawLine(Offset.zero, Offset(0, -length), shadow
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round);
    canvas.drawRRect(weight, Paint()..color = const Color(0x59000000));
    canvas.restore();

    canvas.drawLine(Offset.zero, Offset(0, -length), Paint()
      ..strokeWidth = stroke + 1.2
      ..strokeCap = StrokeCap.round
      ..color = ink.edge);
    canvas.drawLine(Offset.zero, Offset(0, -length), Paint()
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round
      ..color = ink.fill);

    canvas.drawRRect(weight, Paint()..color = ink.fill);
    canvas.drawRRect(weight, Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 0.9
      ..color = ink.edge);
    // The lamp along the weight's top edge.
    final r = weight.outerRect;
    canvas.drawLine(
      Offset(r.left + r.width * 0.2, r.top + 0.9),
      Offset(r.right - r.width * 0.2, r.top + 0.9),
      Paint()
        ..strokeWidth = 0.9
        ..strokeCap = StrokeCap.round
        ..color = ink.glint.withValues(alpha: 0.7),
    );
    _cap(canvas, math.max(2.2, size.width * 0.022), ink);
    canvas.restore();
  }

  @override
  bool shouldRepaint(_ArmPainter old) => old.arm != arm || old.ink != ink || old.clock != clock;
}

// ---------------------------------------------------------------------------------------------
// Stopwatch

/// The stopwatch with two drawn hands.
///
/// In [StopwatchMode.stages] the long hand sweeps on to [stage]'s place (one of [stageCount]
/// stops round the dial, the last short of 12); [StopwatchMode.running] sweeps it on continuously;
/// [StopwatchMode.done] settles both hands on 12; [StopwatchMode.lap] eases both hands forward
/// from ten to twelve onto 12 once (a timed paper starting; never a full turn). The pin is drawn
/// over both hands. Reduced motion shows the pose of the current stage, or of 12, at once.
class HybridStopwatch extends StatefulWidget {
  const HybridStopwatch({
    super.key,
    required this.height,
    this.stage = 0,
    this.stageCount = 3,
    this.mode = StopwatchMode.stages,
    this.elapsed = 0,
  });

  final double height;
  final int stage;
  final int stageCount;
  final StopwatchMode mode;

  /// For a stopwatch that starts in [StopwatchMode.lap]: how far into that motion it already is,
  /// in seconds, so one built again mid-play (a lazy list, a row that rebuilds) carries on from
  /// where the last one was instead of starting over.
  final double elapsed;

  static const HybridSpec spec = HybridSpec.stopwatch;

  @override
  State<HybridStopwatch> createState() => _HybridStopwatchState();
}

class _HybridStopwatchState extends _HybridState<HybridStopwatch> {
  late final StopwatchSim _hands = StopwatchSim(stageCount: widget.stageCount);

  void _still() {
    if (widget.mode == StopwatchMode.done || widget.mode == StopwatchMode.lap) {
      _hands.jump(long: 0, short: 0, mode: StopwatchMode.done);
    } else {
      _hands.jump(long: _hands.stageAngle(widget.stage), short: _hands.shortStageAngle(widget.stage));
    }
  }

  @override
  void begin() {
    if (reduced) {
      _still();
      return;
    }
    _hands.jump(long: 0, short: 0);
    switch (widget.mode) {
      case StopwatchMode.stages:
        _hands.advance(widget.stage, 0.1);
      case StopwatchMode.running:
        _hands.run(0.1);
      case StopwatchMode.done:
        _hands.done(0);
      case StopwatchMode.lap:
        _hands.lap(-widget.elapsed);
    }
  }

  @override
  bool settledAt(double t) => _hands.settledAt(t);

  @override
  void didUpdateWidget(HybridStopwatch old) {
    super.didUpdateWidget(old);
    if (reduced) {
      _still();
    } else if (widget.mode != old.mode || widget.stage != old.stage) {
      final t = now;
      switch (widget.mode) {
        case StopwatchMode.stages:
          _hands.advance(widget.stage, t);
        case StopwatchMode.running:
          if (old.mode != StopwatchMode.running) _hands.run(t);
        case StopwatchMode.done:
          if (old.mode != StopwatchMode.done) _hands.done(t);
        case StopwatchMode.lap:
          if (old.mode != StopwatchMode.lap) _hands.lap(t);
      }
    }
    wake();
  }

  @override
  Widget build(BuildContext context) {
    return frame(
      spec: HybridStopwatch.spec,
      height: widget.height,
      part: _HandsPainter(clock: clock, hands: _hands, ink: HybridInk.onEnamel(context)),
    );
  }
}

class _HandsPainter extends CustomPainter {
  _HandsPainter({required this.clock, required this.hands, required this.ink}) : super(repaint: clock);

  final ValueListenable<double> clock;
  final StopwatchSim hands;
  final HybridInk ink;

  Path _hand(double length, double tail, double base, double tip) => Path()
    ..moveTo(-tip, -length)
    ..lineTo(tip, -length)
    ..lineTo(base, tail)
    ..lineTo(-base, tail)
    ..close();

  @override
  void paint(Canvas canvas, Size size) {
    final t = clock.value;
    canvas.save();
    final px = _intoDial(canvas, size, HybridStopwatch.spec);
    final unit = 1 / px;
    final edge = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 0.8 * unit
      ..strokeJoin = StrokeJoin.round
      ..color = ink.edge;
    final shadow = Paint()..color = const Color(0x33000000);

    void draw(double angle, Path path, {double? counterweight}) {
      canvas.save();
      canvas.rotate(angle);
      canvas.save();
      canvas.translate(0.02, 0.035);
      canvas.drawPath(path, shadow);
      canvas.restore();
      canvas.drawPath(path, Paint()..color = ink.fill);
      canvas.drawPath(path, edge);
      if (counterweight != null) {
        final c = Offset(0, 0.16);
        canvas.drawCircle(c, counterweight, Paint()..color = ink.fill);
        canvas.drawCircle(c, counterweight, edge);
      }
      canvas.restore();
    }

    // The small hand first, the long one over it.
    draw(hands.shortAt(t), _hand(0.5, 0.08, math.max(1.9, px * 0.05) * unit, math.max(0.9, px * 0.02) * unit));
    draw(
      hands.longAt(t),
      _hand(0.84, 0.2, math.max(1.3, px * 0.03) * unit, math.max(0.5, px * 0.01) * unit),
      counterweight: math.max(1.8, px * 0.045) * unit,
    );
    _cap(canvas, math.max(2.4, px * 0.06) * unit, ink);
    canvas.restore();
  }

  @override
  bool shouldRepaint(_HandsPainter old) => old.hands != hands || old.ink != ink || old.clock != clock;
}

// ---------------------------------------------------------------------------------------------
// Desk bell

/// The desk bell. A rise of [rings] rings it once: the bell rocks on its base in three damped
/// swings and two rings spread from the knob. [muted] shows a quiet, still bell at 60% light and
/// never rings. Reduced motion never rocks or rings (the words beside it say what happened).
class HybridBell extends StatefulWidget {
  const HybridBell({super.key, required this.height, this.rings = 0, this.muted = false});

  final double height;
  final int rings;
  final bool muted;

  static const HybridSpec spec = HybridSpec.deskbell;

  @override
  State<HybridBell> createState() => _HybridBellState();
}

class _HybridBellState extends _HybridState<HybridBell> {
  final BellSim _bell = BellSim();

  @override
  void begin() {}

  @override
  bool settledAt(double t) => _bell.settledAt(t);

  @override
  void didUpdateWidget(HybridBell old) {
    super.didUpdateWidget(old);
    if (widget.muted) {
      _bell.still();
    } else if (widget.rings > old.rings && !reduced) {
      _bell.ring(now);
    }
    wake();
  }

  @override
  Widget build(BuildContext context) {
    const spec = HybridBell.spec;
    final ink = HybridInk.of(context);
    return frame(
      spec: spec,
      height: widget.height,
      light: widget.muted ? 0.6 : 1,
      wrapImage: (image) => AnimatedBuilder(
        animation: clock,
        builder: (context, child) => Transform.rotate(
          angle: _bell.angleAt(clock.value),
          alignment: Alignment(spec.pivot.dx * 2 - 1, spec.pivot.dy * 2 - 1),
          child: child,
        ),
        child: image,
      ),
      part: _RingsPainter(clock: clock, bell: _bell, ink: ink),
    );
  }
}

class _RingsPainter extends CustomPainter {
  _RingsPainter({required this.clock, required this.bell, required this.ink}) : super(repaint: clock);

  final ValueListenable<double> clock;
  final BellSim bell;
  final HybridInk ink;

  @override
  void paint(Canvas canvas, Size size) {
    final t = clock.value;
    final knob = Offset(HybridSpec.bellKnob.dx * size.width, HybridSpec.bellKnob.dy * size.height);
    for (var i = 0; i < 2; i++) {
      final p = bell.ringAt(i, t);
      if (p == null) continue;
      final eased = 1 - math.pow(1 - p, 2.2).toDouble();
      final r = size.width * (0.09 + 0.26 * eased);
      final alpha = math.pow(1 - p, 1.4).toDouble() * 0.95;
      final paint = Paint()
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round
        ..strokeWidth = math.max(1.2, size.width * (0.03 - 0.016 * p))
        ..color = ink.fill.withValues(alpha: alpha);
      final rect = Rect.fromCircle(center: knob, radius: r);
      // Two short arcs either side of the knob, like the sound leaving it.
      canvas.drawArc(rect, _rad(-168), _rad(46), false, paint);
      canvas.drawArc(rect, _rad(-58), _rad(46), false, paint);
    }
  }

  static double _rad(double d) => d * math.pi / 180;

  @override
  bool shouldRepaint(_RingsPainter old) => old.bell != bell || old.ink != ink || old.clock != clock;
}
