// The shared stage of the full-screen moments K1 to K4 (spec 5.3 M-sheets, 5.6 M8 to M11).
//
// One timeline per moment: an AnimationController over the moment's T3 length, read as milliseconds,
// so every layer is a pure function of the clock and a frame golden at 640 ms is exact. Springs are
// sampled as curves of that clock ([SpringCurve]). A tap anywhere or the visible "Skip" lands the end
// state in 200 ms; reduced motion shows the end state with a 120 ms fade, no particles and no squash;
// Lite halves the particles (PaperParticles does that) and nothing here uses a shader or a blur.
//
// Light first: every moment opens with the lamp ([LampField]) before anything moves.

import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/physics.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/haptics/haptics.dart';
import '../../../../core/motion/motion_tokens.g.dart';
import '../../../../core/motion/springs.dart';
import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/key_button.dart';
import '../../widgets/mob_ring.dart' show MobColours;
import '../copy_v3.dart';
import '../data/mob_v3_models.dart';
import 'fold_manifest.dart';
import 'mob_fx.dart';
import 'paper_particles.dart';

// ---------------------------------------------------------------------------------------------------
// Clock helpers
// ---------------------------------------------------------------------------------------------------

/// A spring sampled as a curve: 0 at t 0, 1 at t 1, overshooting in between as the spring does.
class SpringCurve extends Curve {
  SpringCurve(this.spring, this.duration);

  final SpringDescription spring;
  final Duration duration;

  late final SpringSimulation _sim = SpringSimulation(spring, 0, 1, 0);

  @override
  double transformInternal(double t) => _sim.x(t * duration.inMicroseconds / 1e6);

  @override
  double transform(double t) {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return transformInternal(t);
  }
}

/// The spec's springs as curves of the moment clock.
abstract final class MomentCurves {
  static final Curve celebrate = SpringCurve(Springs.celebrate, MotionSprings.celebrateDuration);
  static final Curve iconPop = SpringCurve(Springs.iconPop, MotionSprings.iconPopDuration);
  static final Curve lift = SpringCurve(Springs.lift, MotionSprings.liftDuration);
}

/// Progress 0..1 of a segment that starts at [start] ms and lasts [dur] ms, through [curve].
double seg(double ms, double start, double dur, [Curve curve = Curves.linear]) {
  if (ms <= start) return 0;
  if (ms >= start + dur) return 1;
  return curve.transform((ms - start) / dur);
}

/// A raw spring value (may pass 1) for a segment, for overshoot that must show.
double springSeg(double ms, double start, Duration d, Curve spring) {
  if (ms <= start) return 0;
  final t = (ms - start) / d.inMilliseconds;
  if (t >= 1) return 1;
  return spring.transform(t);
}

double lerpD(double a, double b, double t) => a + (b - a) * t;

/// A decaying sway: [amp] radians at the start, settling to 0 over [dur] ms with [cycles] swings.
double decaySway(double ms, double start, double dur, double amp, {double cycles = 2}) {
  if (ms <= start || ms >= start + dur) return 0;
  final t = (ms - start) / dur;
  return amp * math.cos(t * cycles * 2 * math.pi) * (1 - t) * (1 - t);
}

// ---------------------------------------------------------------------------------------------------
// The base state of a moment
// ---------------------------------------------------------------------------------------------------

/// A one-shot that fires when the clock crosses [atMs] while the moment plays (not on a Skip).
class MomentCue {
  const MomentCue(this.atMs, this.run);
  final double atMs;
  final VoidCallback run;
}

abstract class MomentStageState<T extends StatefulWidget> extends State<T> with TickerProviderStateMixin {
  /// The moment's length in ms (its T3 ceiling or less).
  double get totalMs;

  /// Cues in time order (haptics, particle bursts).
  List<MomentCue> get cues => const [];

  late final AnimationController clock = AnimationController(vsync: this, duration: Duration(milliseconds: totalMs.round()));
  late final AnimationController _fade = AnimationController(vsync: this, duration: MotionDurations.reducedFade, value: 1);
  final PaperParticlesController particles = PaperParticlesController();
  bool _started = false;
  bool _skipping = false;
  bool reducedPath = false;
  double _lastMs = 0;
  int _cueIndex = 0;

  double get ms => clock.value * totalMs;
  bool get playing => clock.value < 1;

  /// The end state is drawn (after a Skip, in reduced motion, or at the natural end).
  bool get landed => clock.value >= 1;

  @override
  void initState() {
    super.initState();
    clock.addListener(_onTick);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (MobFx.reduced(context)) {
      // Reduced motion: the end state, one 120 ms fade, no particles, no squash. Order and information stay.
      reducedPath = true;
      _skipping = true;
      clock.value = 1;
      _fade.forward(from: 0);
    } else {
      clock.forward();
    }
  }

  void _onTick() {
    final now = ms;
    if (!_skipping) {
      final list = cues;
      while (_cueIndex < list.length && list[_cueIndex].atMs <= now) {
        if (list[_cueIndex].atMs >= _lastMs - 0.001) list[_cueIndex].run();
        _cueIndex++;
      }
    }
    _lastMs = now;
  }

  /// Lands the end state in 200 ms (spec 5.0). Ends the particles; fires no cue.
  void skip() {
    if (!playing || _skipping) return;
    _skipping = true;
    particles.clear();
    // 180 ms of motion after the first frame, so the end state is on screen within MobBeat.skip (200),
    // as the podium does.
    clock.animateTo(1, duration: MobBeat.skip - const Duration(milliseconds: 20), curve: MotionCurves.out);
  }

  /// Haptics through the app's verbs, never on a Skip.
  Haptics? get haptics => hapticsOf(context);

  /// The centre of [key]'s box in [stage]'s coordinates (for a particle burst).
  Offset? centreIn(GlobalKey key, GlobalKey stage, {Offset shift = Offset.zero}) {
    final b = key.currentContext?.findRenderObject() as RenderBox?;
    final s = stage.currentContext?.findRenderObject() as RenderBox?;
    if (b == null || s == null || !b.attached || !s.attached) return null;
    return s.globalToLocal(b.localToGlobal(b.size.center(Offset.zero) + shift));
  }

  double? topIn(GlobalKey key, GlobalKey stage) {
    final b = key.currentContext?.findRenderObject() as RenderBox?;
    final s = stage.currentContext?.findRenderObject() as RenderBox?;
    if (b == null || s == null || !b.attached || !s.attached) return null;
    return s.globalToLocal(b.localToGlobal(Offset.zero)).dy;
  }

  /// Wraps the moment's content in the reduced-motion fade.
  Widget reducedFade(Widget child) => FadeTransition(opacity: _fade, child: child);

  @override
  void dispose() {
    clock.removeListener(_onTick);
    clock.dispose();
    _fade.dispose();
    particles.dispose();
    super.dispose();
  }
}

// ---------------------------------------------------------------------------------------------------
// The frame: ground, graph paper, the lamp, the top row, the body and the keys
// ---------------------------------------------------------------------------------------------------

class MomentFrame extends StatelessWidget {
  const MomentFrame({
    super.key,
    required this.stageKey,
    required this.title,
    this.subtitle,
    required this.lamp,
    required this.playing,
    required this.onSkip,
    required this.onClose,
    required this.body,
    required this.keys,
    required this.particles,
    this.keysT = 1,
  });

  final GlobalKey stageKey;
  final String? title;
  final String? subtitle;
  final LampState lamp;
  final bool playing;
  final VoidCallback onSkip;
  final VoidCallback onClose;
  final Widget body;
  final List<Widget> keys;
  final PaperParticlesController particles;

  /// The keys' rise, 0..1.
  final double keysT;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final pad = MediaQuery.paddingOf(context);
    return Material(
      color: colors.ground,
      child: GestureDetector(
        behavior: HitTestBehavior.translucent,
        onTap: playing ? onSkip : null,
        child: Stack(
          key: stageKey,
          children: [
            Positioned.fill(child: RepaintBoundary(child: CustomPaint(painter: GraphPaperPainter(colors.ink, colors.isNight)))),
            Positioned.fill(child: RepaintBoundary(child: CustomPaint(painter: LampFieldPainter(lamp, colors.isNight)))),
            Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SizedBox(height: pad.top),
                SizedBox(
                  height: 64,
                  child: Row(
                    children: [
                      const SizedBox(width: MmSpace.s4),
                      _CloseButton(onTap: onClose),
                      const SizedBox(width: MmSpace.s4),
                      Expanded(
                        child: title == null
                            ? const SizedBox.shrink()
                            : Column(
                                mainAxisSize: MainAxisSize.min,
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(title!, style: type.title.copyWith(color: colors.ink), maxLines: 1, overflow: TextOverflow.ellipsis),
                                  if (subtitle != null) Text(subtitle!, style: type.caption.copyWith(color: colors.ink2), maxLines: 1, overflow: TextOverflow.ellipsis),
                                ],
                              ),
                      ),
                      AnimatedOpacity(
                        opacity: playing ? 1 : 0,
                        duration: MobBeat.skip,
                        child: IgnorePointer(ignoring: !playing, child: SkipPill(onTap: onSkip)),
                      ),
                      const SizedBox(width: MmSpace.s12),
                    ],
                  ),
                ),
                Expanded(child: body),
                Opacity(
                  opacity: keysT.clamp(0.0, 1.0),
                  child: Transform.translate(
                    offset: Offset(0, (1 - keysT.clamp(0.0, 1.0)) * 14),
                    child: IgnorePointer(
                      ignoring: keysT < 0.5,
                      child: Padding(
                        padding: EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, MmSpace.s16 + pad.bottom),
                        child: keys.length == 1
                            ? keys.first
                            : Row(children: [for (var i = 0; i < keys.length; i++) ...[if (i > 0) const SizedBox(width: MmSpace.s12), Expanded(flex: i == keys.length - 1 ? 3 : 2, child: keys[i])]]),
                      ),
                    ),
                  ),
                ),
              ],
            ),
            Positioned.fill(child: PaperParticles(controller: particles)),
          ],
        ),
      ),
    );
  }
}

class _CloseButton extends StatelessWidget {
  const _CloseButton({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Semantics(
      button: true,
      label: MobV3Copy.close,
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: SizedBox.square(dimension: 48, child: Center(child: Icon(LucideIcons.x, size: 24, color: colors.ink))),
      ),
    );
  }
}

/// The visible "Skip" (students new to apps do not know a tap skips).
class SkipPill extends StatelessWidget {
  const SkipPill({super.key, required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Semantics(
      button: true,
      label: MobV3Copy.skipShow,
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: SizedBox(
          height: 48,
          child: Center(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
              decoration: BoxDecoration(
                color: colors.raised.withValues(alpha: colors.isNight ? 0.9 : 0.95),
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: colors.line),
              ),
              child: Text(MobV3Copy.skipShow, style: context.mmType.label.copyWith(color: colors.ink2)),
            ),
          ),
        ),
      ),
    );
  }
}

/// A moment key that rises in with the others.
Widget momentKey(String label, VoidCallback? onTap, {bool primary = true, bool loading = false, Key? key}) =>
    primary ? KeyButton(key: key, label: label, onPressed: onTap, loading: loading) : KeyButton.secondary(key: key, label: label, onPressed: onTap);

// ---------------------------------------------------------------------------------------------------
// Light: the lamp pool (radial, from the top) and the warm leak (radial, from a point). Never rays.
// ---------------------------------------------------------------------------------------------------

class LampState {
  const LampState({this.strength = 1, this.width = 1, this.centreY = 0.24, this.leak = 0, this.leakAt});

  /// 0..1.5 of the room's lamp (26% Night, 17% Day at 1).
  final double strength;

  /// 1 wide; 0.6 narrowed onto the stage.
  final double width;

  /// The pool's centre as a fraction of the height.
  final double centreY;

  /// The warm leak 0..1 (the parcel seam), drawn as a radial glow at [leakAt].
  final double leak;
  final Offset? leakAt;
}

class LampFieldPainter extends CustomPainter {
  LampFieldPainter(this.lamp, this.night);

  final LampState lamp;
  final bool night;

  static const Color lampColour = Color(0xFFF2A93B);
  static const Color lampDay = Color(0xFFF2C46B);

  @override
  void paint(Canvas canvas, Size size) {
    final base = night ? 0.26 : 0.17;
    final a = (base * lamp.strength).clamp(0.0, 0.6);
    if (a > 0.001) {
      final c = Offset(size.width / 2, size.height * lamp.centreY);
      final r = size.width * 0.95 * lamp.width;
      final colour = night ? lampColour : lampDay;
      final paint = Paint()
        ..shader = RadialGradient(
          colors: [colour.withValues(alpha: a), colour.withValues(alpha: a * 0.45), colour.withValues(alpha: 0)],
          stops: const [0, 0.45, 1],
        ).createShader(Rect.fromCircle(center: c, radius: r));
      canvas.save();
      // An elliptical pool: wider than tall, like a desk lamp's light on a wall.
      canvas.translate(c.dx, c.dy);
      canvas.scale(1, 1.25);
      canvas.translate(-c.dx, -c.dy);
      canvas.drawCircle(c, r, paint);
      canvas.restore();
    }
    final at = lamp.leakAt;
    if (at != null && lamp.leak > 0.001) {
      final r = size.width * 0.55;
      final l = lamp.leak.clamp(0.0, 1.0);
      final paint = Paint()
        ..shader = RadialGradient(
          colors: [
            const Color(0xFFFFD58A).withValues(alpha: (night ? 0.55 : 0.42) * l),
            lampColour.withValues(alpha: (night ? 0.28 : 0.2) * l),
            lampColour.withValues(alpha: 0),
          ],
          stops: const [0, 0.42, 1],
        ).createShader(Rect.fromCircle(center: at, radius: r));
      canvas.drawCircle(at, r, paint);
    }
  }

  @override
  bool shouldRepaint(LampFieldPainter old) =>
      old.lamp.strength != lamp.strength || old.lamp.width != lamp.width || old.lamp.leak != lamp.leak || old.lamp.leakAt != lamp.leakAt || old.night != night || old.lamp.centreY != lamp.centreY;
}

/// Exam stationery: a faint graph-paper grid (4% ink), 24 dp squares.
class GraphPaperPainter extends CustomPainter {
  GraphPaperPainter(this.ink, this.night);
  final Color ink;
  final bool night;

  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..color = ink.withValues(alpha: night ? 0.035 : 0.05)
      ..strokeWidth = 1;
    const step = 24.0;
    final x0 = (size.width % step) / 2;
    for (var x = x0; x <= size.width; x += step) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), p);
    }
    for (var y = 0.0; y <= size.height; y += step) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), p);
    }
  }

  @override
  bool shouldRepaint(GraphPaperPainter old) => old.ink != ink || old.night != night;
}

// ---------------------------------------------------------------------------------------------------
// Text that lands: whole words engrave left to right; a number rolls n-1 to n
// ---------------------------------------------------------------------------------------------------

/// Whole words engrave left to right (engrave 280 ms): each word rises 4 dp and inks in. Never a
/// letter at a time (craft judge 4.11). [t] is 0..1 over the engrave.
class EngraveText extends StatelessWidget {
  const EngraveText(this.text, {super.key, required this.style, required this.t, this.textAlign = TextAlign.center, this.maxLines});

  final String text;
  final TextStyle style;
  final double t;
  final TextAlign textAlign;
  final int? maxLines;

  @override
  Widget build(BuildContext context) {
    if (t >= 1) return Text(text, style: style, textAlign: textAlign, maxLines: maxLines);
    final words = text.split(' ');
    final n = words.length;
    final colour = style.color ?? context.mmColors.ink;
    final spans = <InlineSpan>[];
    for (var i = 0; i < n; i++) {
      // Each word takes 55% of the engrave, starting in order.
      final start = n == 1 ? 0.0 : i / (n - 1) * 0.45;
      final k = ((t - start) / 0.55).clamp(0.0, 1.0);
      final eased = MotionCurves.out.transform(k);
      spans.add(TextSpan(text: i == n - 1 ? words[i] : '${words[i]} ', style: TextStyle(color: colour.withValues(alpha: colour.a * eased))));
    }
    return Transform.translate(
      offset: Offset(0, (1 - MotionCurves.out.transform(t.clamp(0.0, 1.0))) * 4),
      child: Text.rich(TextSpan(style: style, children: spans), textAlign: textAlign, maxLines: maxLines),
    );
  }
}

/// A number that rolls from [from] to [to]: the old one leaves upward, the new one rises in (numberRoll
/// 500). Tabular, one layer, never two numerals overlapping in the same place at full ink.
class RollNumber extends StatelessWidget {
  const RollNumber({super.key, required this.from, required this.to, required this.t, required this.style, this.stamp = 1});

  final int from;
  final int to;
  final double t;
  final TextStyle style;

  /// A stamp scale applied to the arriving numeral (1.25 to 1 for K1).
  final double stamp;

  @override
  Widget build(BuildContext context) {
    final k = t.clamp(0.0, 1.0);
    final h = (style.fontSize ?? 40) * 0.9;
    Widget num(int v) => Text('$v', style: style, textHeightBehavior: MmType.figureHeightBehavior, textAlign: TextAlign.center);
    if (k >= 1 || from == to) return Transform.scale(scale: stamp, child: num(to));
    return ClipRect(
      child: Stack(
        alignment: Alignment.center,
        children: [
          // The new number holds the box, so the layout never jumps.
          Opacity(opacity: 0, child: num(to)),
          if (k < 0.55)
            Opacity(
              opacity: (1 - k / 0.55).clamp(0.0, 1.0),
              child: Transform.translate(offset: Offset(0, -h * MotionCurves.leave.transform(k / 0.55)), child: num(from)),
            ),
          if (k > 0.35)
            Opacity(
              opacity: ((k - 0.35) / 0.4).clamp(0.0, 1.0),
              child: Transform.translate(
                offset: Offset(0, h * (1 - MotionCurves.out.transform(((k - 0.35) / 0.65).clamp(0.0, 1.0)))),
                child: Transform.scale(scale: stamp, child: num(to)),
              ),
            ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------------------------------
// Heads: the members in a row, each popping in (iconPop, 45 ms step)
// ---------------------------------------------------------------------------------------------------

/// Others first, you last, as the references show ("Riya, Kabir, Zoya, You").
List<MobV3Member> headOrder(List<MobV3Member> members) => [for (final m in members) if (!m.you) m, for (final m in members) if (m.you) m];

class MemberHeads extends StatelessWidget {
  const MemberHeads({super.key, required this.members, required this.popAt, required this.ms, this.size = 44});

  final List<MobV3Member> members;

  /// The first head pops at this ms, then one every 45 ms.
  final double popAt;
  final double ms;
  final double size;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final colors = context.mmColors;
    final list = headOrder(members);
    return Wrap(
      alignment: WrapAlignment.center,
      spacing: MmSpace.s12,
      runSpacing: MmSpace.s8,
      children: [
        for (var i = 0; i < list.length; i++)
          () {
            final m = list[i];
            final start = popAt + i * MotionDurations.staggerStep.inMilliseconds;
            final p = springSeg(ms, start, MotionSprings.iconPopDuration, MomentCurves.iconPop);
            final o = seg(ms, start, 120);
            return Opacity(
              opacity: o,
              child: Transform.scale(
                scale: lerpD(0.7, 1, p),
                child: SizedBox(
                  width: math.max(size + 12, 56),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      HeadDisc(member: m, size: size),
                      const SizedBox(height: MmSpace.s4),
                      Text(m.you ? MobV3Copy.headYou : m.name, style: type.label.copyWith(color: colors.ink, fontWeight: FontWeight.w700), textAlign: TextAlign.center),
                    ],
                  ),
                ),
              ),
            );
          }(),
      ],
    );
  }
}

/// A member's head disc: the Fold's head on paper, ringed in the member colour; the initial if the
/// Fold file is missing (spec 5.2).
class HeadDisc extends StatelessWidget {
  const HeadDisc({super.key, required this.member, this.size = 44});

  final MobV3Member member;
  final double size;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final ring = MobColours.of(context, member.colour);
    final head = member.fold == null ? null : FoldManifest.cached?[member.fold]?.head;
    final initial = Center(
      child: Text(member.initial, style: context.mmType.subhead.copyWith(color: MobColours.inkOn(context), fontSize: size * 0.42)),
    );
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(shape: BoxShape.circle, color: head == null ? ring : colors.raised2, border: Border.all(color: ring, width: 2.5)),
      clipBehavior: Clip.antiAlias,
      child: head == null
          ? initial
          : Image.asset(
              head,
              width: size,
              height: size,
              fit: BoxFit.cover,
              excludeFromSemantics: true,
              errorBuilder: (_, _, _) => Container(color: ring, child: initial),
            ),
    );
  }
}
