// K1 Milestone (spec 5.3, 5.6 M11, T3 2000). The lamp comes up; an arc of paper ticks drops in 70 ms
// apart (a rested day is a dashed link with a moon, never a gap), today's tick lands with celebrate in
// volt; the number rolls n-1 to n with a 1.25 stamp; Mobi cheers once; glints and paper bits stop
// above the number; the title and line land; the reward chip unfolds when the milestone gives one.

import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../core/motion/motion_tokens.g.dart';
import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/art/mm_art.dart';
import '../copy_v3.dart';
import '../data/mob_v3_models.dart';
import '../logic/fold_catalog.dart' show chainMilestones;
import 'moment_kit.dart';
import 'paper_particles.dart';
import 'results_parts.dart' show RunStep;

/// The days of the arc, oldest first: true where a rest pass kept the chain.
List<bool> restedDays(ChainState c, int n) {
  final count = math.min(n, MilestoneMoment.maxTicks);
  final states = <String, ChainDayState>{for (final d in c.calendar) d.day: d.state, for (final d in c.week) d.day: d.state};
  final days = states.keys.toList()..sort();
  // Today is the last day the server marks practised, rested or today.
  final kept = [for (final d in days) if (const {ChainDayState.practised, ChainDayState.rested, ChainDayState.madeUp, ChainDayState.paused, ChainDayState.today}.contains(states[d])) d];
  final tail = kept.length >= count ? kept.sublist(kept.length - count) : kept;
  final out = [for (final d in tail) states[d] == ChainDayState.rested];
  while (out.length < count) {
    out.insert(0, false);
  }
  return out;
}

class MilestoneMoment extends StatefulWidget {
  const MilestoneMoment({super.key, required this.days, required this.chain, required this.onKey, required this.onClose});

  /// The milestone (the key's n, sent by the server).
  final int days;
  final ChainState chain;
  final VoidCallback onKey;
  final VoidCallback onClose;

  static const int maxTicks = 21;

  /// The reward this milestone gives: the server's milestone row first, else the canonical table.
  static String? rewardOf(ChainState c, int n) {
    for (final m in c.milestones) {
      if (m.at == n) return m.reward;
    }
    return chainMilestones[n];
  }

  @override
  State<MilestoneMoment> createState() => _MilestoneMomentState();
}

class _MilestoneMomentState extends MomentStageState<MilestoneMoment> {
  final GlobalKey _stage = GlobalKey();
  final GlobalKey _number = GlobalKey();

  @override
  double get totalMs => 2000;

  @override
  late final List<MomentCue> cues = [
    MomentCue(600, () => haptics?.confirm()),
    MomentCue(900, () {
      final c = centreIn(_number, _stage);
      final top = topIn(_number, _stage);
      if (c == null || top == null) return;
      particles.burst(PaperBurst(origin: Offset(c.dx, top - 40), count: 16, speed: 260, glints: 6, glintRadius: 70, floorY: top - 6, seed: 14));
    }),
  ];

  @override
  Widget build(BuildContext context) => AnimatedBuilder(animation: clock, builder: (context, _) => reducedFade(_frame(context)));

  Widget _frame(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final t = ms;
    final n = widget.days;
    final rested = restedDays(widget.chain, n);
    final reward = MilestoneMoment.rewardOf(widget.chain, n);

    final roll = seg(t, 600, MotionDurations.numberRoll.inMilliseconds.toDouble());
    final stamp = lerpD(1.25, 1, seg(t, 600, 360, MotionCurves.out));
    final mobi = springSeg(t, 820, MotionSprings.iconPopDuration, MomentCurves.iconPop);
    final mobiIn = seg(t, 820, 120);
    final titleT = seg(t, 1000, MotionDurations.engrave.inMilliseconds.toDouble());
    final lineT = seg(t, 1080, 320);
    final chipT = seg(t, 1300, MotionDurations.emphasized.inMilliseconds.toDouble(), MotionCurves.emphasized);
    final keysT = seg(t, 1700, 300, MotionCurves.out);
    final lamp = LampState(strength: lerpD(0.4, 1.1, seg(t, 0, 300, MotionCurves.glide)), centreY: 0.22);

    final arc = SizedBox(
      height: 232,
      child: LayoutBuilder(
        builder: (context, box) {
          final w = math.min(box.maxWidth, 340.0);
          return Stack(
            alignment: Alignment.topCenter,
            children: [
              Positioned.fill(
                child: CustomPaint(
                  key: const ValueKey('k1-arc'),
                  painter: TickArcPainter(rested: rested, ms: t, width: w, night: colors.isNight, volt: colors.volt, voltInk: colors.voltInk, ink: colors.ink),
                ),
              ),
              Positioned(
                top: 92,
                child: KeyedSubtree(
                  key: _number,
                  child: RollNumber(from: math.max(0, n - 1), to: n, t: roll, stamp: stamp, style: type.hero.copyWith(color: colors.ink)),
                ),
              ),
            ],
          );
        },
      ),
    );

    final body = SingleChildScrollView(
      physics: const ClampingScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: MmSpace.momentGutter),
      child: Column(
        children: [
          arc,
          const SizedBox(height: MmSpace.s8),
          EngraveText(MobV3Copy.daysInARow(n), style: type.moment.copyWith(color: colors.ink), t: titleT),
          const SizedBox(height: MmSpace.s8),
          Opacity(
            opacity: lineT,
            child: Transform.translate(
              offset: Offset(0, (1 - lineT) * 6),
              child: Text(MobV3Copy.milestoneLine(widget.chain), style: type.body.copyWith(color: colors.ink2), textAlign: TextAlign.center),
            ),
          ),
          if (reward == 'rest_pass') ...[
            const SizedBox(height: MmSpace.s16),
            Opacity(
              opacity: chipT,
              child: Transform(
                alignment: Alignment.topCenter,
                transform: Matrix4.identity()
                  ..setEntry(3, 2, 0.0015)
                  ..rotateX((1 - chipT) * 70 * math.pi / 180),
                child: const _RestPassChip(),
              ),
            ),
          ],
          const SizedBox(height: MmSpace.s16),
          Opacity(
            opacity: mobiIn,
            child: Transform.translate(
              offset: Offset(0, (1 - mobi) * 14),
              child: Transform.scale(
                scale: lerpD(0.86, 1, mobi),
                alignment: Alignment.bottomCenter,
                child: const ArtImage(MmArt.mobiCheer, height: 112, key: ValueKey('k1-mobi')),
              ),
            ),
          ),
          const SizedBox(height: MmSpace.s8),
        ],
      ),
    );

    return MomentFrame(
      stageKey: _stage,
      title: null,
      lamp: lamp,
      playing: playing,
      onSkip: skip,
      onClose: widget.onClose,
      body: body,
      particles: particles,
      keysT: keysT,
      keys: [momentKey(RunStep.maybeOf(context)?.last == false ? MobV4ResultsCopy.continueKey : MobV3Copy.backToDen, widget.onKey, key: const ValueKey('k1-key'))],
    );
  }
}

class _RestPassChip extends StatelessWidget {
  const _RestPassChip();

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Container(
      key: const ValueKey('k1-chip'),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: colors.isNight ? const Color(0xFFEFE6D2) : colors.raised,
        borderRadius: BorderRadius.circular(MmRadius.key),
        border: Border.all(color: colors.isNight ? const Color(0xFFFFF8E6) : colors.lineStrong, width: 1.5),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const CustomPaint(size: Size.square(18), painter: MoonPainter(Color(0xFF2A251C))),
          const SizedBox(width: 8),
          Text(MobV3Copy.aRestPass, style: context.mmType.labelLarge.copyWith(color: const Color(0xFF221E17), fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}

/// A crescent moon in one stroke weight (the rested day, the rest pass).
class MoonPainter extends CustomPainter {
  const MoonPainter(this.colour, {this.stroke = false});
  final Color colour;
  final bool stroke;

  @override
  void paint(Canvas canvas, Size size) {
    final r = size.shortestSide / 2;
    final c = size.center(Offset.zero);
    final moon = Path.combine(
      PathOperation.difference,
      Path()..addOval(Rect.fromCircle(center: c, radius: r * 0.82)),
      Path()..addOval(Rect.fromCircle(center: c + Offset(r * 0.42, -r * 0.3), radius: r * 0.7)),
    );
    canvas.drawPath(moon, Paint()..color = colour);
  }

  @override
  bool shouldRepaint(MoonPainter old) => old.colour != colour;
}

/// The arc of paper ticks over the number: each drops in 70 ms apart from 120 ms; today's (the last)
/// lands with celebrate and is the volt one; a rested day is a dashed tile with a moon.
class TickArcPainter extends CustomPainter {
  TickArcPainter({required this.rested, required this.ms, required this.width, required this.night, required this.volt, required this.voltInk, required this.ink});

  final List<bool> rested;
  final double ms;
  final double width;
  final bool night;
  final Color volt;
  final Color voltInk;
  final Color ink;

  @override
  void paint(Canvas canvas, Size size) {
    final n = rested.length;
    if (n == 0) return;
    final cx = size.width / 2;
    final r = width * 0.43;
    final cy = r + 22;
    const a0 = 200 * math.pi / 180, a1 = -20 * math.pi / 180;
    final step = n == 1 ? 0.0 : (a0 - a1) / (n - 1);
    final tile = math.min(30.0, n == 1 ? 30.0 : r * step * 0.84);
    for (var i = 0; i < n; i++) {
      final today = i == n - 1;
      final start = 120 + i * 70.0;
      final drop = today
          ? springSeg(ms, start, MotionSprings.celebrateDuration, MomentCurves.celebrate)
          : seg(ms, start, 300, MotionCurves.emphasized);
      final o = seg(ms, start, 90);
      if (o <= 0) continue;
      final a = a0 - step * i;
      final p = Offset(cx + r * math.cos(a), cy - r * math.sin(a) - (1 - drop) * 18);
      canvas.save();
      canvas.translate(p.dx, p.dy);
      canvas.rotate((math.pi / 2 - a) * 0.18);
      final s = today ? lerpD(0.8, 1, drop) : 1.0;
      canvas.scale(s, s);
      final rect = RRect.fromRectAndRadius(Rect.fromCenter(center: Offset.zero, width: tile, height: tile), Radius.circular(tile * 0.24));
      if (rested[i]) {
        final dash = Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.4
          ..color = ink.withValues(alpha: 0.45 * o);
        final path = Path()..addRRect(rect);
        for (final m in path.computeMetrics()) {
          for (var d = 0.0; d < m.length; d += 6) {
            canvas.drawPath(m.extractPath(d, math.min(d + 3, m.length)), dash);
          }
        }
        canvas.save();
        canvas.translate(-tile * 0.28, -tile * 0.28);
        MoonPainter(ink.withValues(alpha: 0.55 * o)).paint(canvas, Size.square(tile * 0.56));
        canvas.restore();
      } else {
        final fill = today ? volt : (night ? const Color(0xFFECE3CF) : const Color(0xFFFFFCF4));
        canvas.drawRRect(rect.shift(const Offset(0, 1.5)), Paint()..color = Colors.black.withValues(alpha: (night ? 0.35 : 0.12) * o));
        canvas.drawRRect(rect, Paint()..color = fill.withValues(alpha: o));
        canvas.drawRRect(rect, Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1
          ..color = (today ? const Color(0xFF9DB400) : const Color(0xFFBFAF8E)).withValues(alpha: o));
        final tick = Path()
          ..moveTo(-tile * 0.2, 0)
          ..lineTo(-tile * 0.05, tile * 0.15)
          ..lineTo(tile * 0.22, -tile * 0.14);
        canvas.drawPath(tick, Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = math.max(1.6, tile * 0.09)
          ..strokeCap = StrokeCap.round
          ..strokeJoin = StrokeJoin.round
          ..color = (today ? voltInk : const Color(0xFF221E17)).withValues(alpha: o));
      }
      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(TickArcPainter old) => old.ms != ms || old.rested != rested || old.night != night || old.width != width;
}
