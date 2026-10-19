// K2 Quest done (spec 5.3, 5.6 M10, T3 1900; F8). The count rolls to the TRUE total, past the goal
// ("70 answered. The quest needed 60."), while the 12-segment bar fills to full at the target and
// stays full; the bar pulses, blooms segment by segment, folds away, and a square paper seal stamps
// in its place (never a coin disc). Then "Quest done" engraves, the heads pop and the parcel arrives.

import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../core/motion/motion_tokens.g.dart';
import '../../../../core/theme/theme.dart';
import '../copy_v3.dart';
import '../data/mob_v3_models.dart';
import 'moment_kit.dart';
import 'paper_particles.dart';
import 'parcel.dart';

/// What the finished quest's parcel held (spec 0.4): a Fold, a den object, or the week's stitch.
class QuestPrize {
  const QuestPrize(this.kind, {this.fold, this.item});
  final ParcelKind kind;
  final FoldKey? fold;
  final String? item;

  QuestParcel get parcel => QuestParcel(kind: kind, fold: fold, item: item);
}

class QuestDoneMoment extends StatefulWidget {
  const QuestDoneMoment({
    super.key,
    required this.mobName,
    required this.members,
    required this.quest,
    required this.week,
    required this.prize,
    required this.keyLabel,
    required this.onKey,
    required this.onClose,
    this.lastSeen,
  });

  final String mobName;
  final List<MobV3Member> members;
  final Quest quest;

  /// The chain week this quest stitched (the server's `mobChain.weeks`).
  final int week;
  final QuestPrize prize;
  final String keyLabel;
  final VoidCallback onKey;
  final VoidCallback onClose;

  /// The count the student last saw on the quest strip, when known. Never above the true total.
  final int? lastSeen;

  /// Where the roll starts: the last value seen, else ten below the target; never above the total.
  static int rollFrom(Quest q, int? lastSeen) => math.min(q.answered, math.max(0, lastSeen ?? q.target - 10));

  @override
  State<QuestDoneMoment> createState() => QuestDoneMomentState();
}

class QuestDoneMomentState extends MomentStageState<QuestDoneMoment> {
  static const double total = 1900;
  final GlobalKey _stage = GlobalKey();
  final GlobalKey _seal = GlobalKey();
  final GlobalKey _title = GlobalKey();

  @override
  double get totalMs => total;

  @override
  late final List<MomentCue> cues = [
    MomentCue(1120, () {
      haptics?.medium();
      final c = centreIn(_seal, _stage);
      if (c == null) return;
      final floor = topIn(_title, _stage);
      particles.burst(PaperBurst(origin: c, count: 8, speed: 220, glints: 12, glintRadius: 92, floorY: floor == null ? null : floor - 6, seed: 12));
    }),
  ];

  /// The number on screen at [atMs]: rolls from [QuestDoneMoment.rollFrom] to the true total over
  /// 0 to 600 ms, never above it, and holds the total after.
  static int countAt(Quest q, int? lastSeen, double atMs) {
    final from = QuestDoneMoment.rollFrom(q, lastSeen);
    final k = seg(atMs, 0, 600, MotionCurves.out);
    return math.min(q.answered, from + ((q.answered - from) * k).floor());
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(animation: clock, builder: (context, _) => reducedFade(_frame(context)));
  }

  Widget _frame(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final t = ms;
    final q = widget.quest;
    final count = countAt(q, widget.lastSeen, t);
    final target = math.max(1, q.target);
    final fill = math.min(1.0, count / target);

    // The bar: pulse at 700, bloom from 760, fold away at 1080.
    final pulse = 1 + 0.04 * math.sin(math.pi * seg(t, 700, 200));
    final barLeave = seg(t, 1080, MotionDurations.leave.inMilliseconds.toDouble(), MotionCurves.leave);
    // The seal: stamps 1.4 to 1 with a 2 degree settle on celebrate.
    final sealP = springSeg(t, 1120, MotionSprings.celebrateDuration, MomentCurves.celebrate);
    final sealIn = seg(t, 1120, 90);
    final sealGlow = seg(t, 1160, 200) * (1 - seg(t, 1500, 400));
    final titleT = seg(t, 1160, MotionDurations.engrave.inMilliseconds.toDouble());
    final lineT = seg(t, 1240, 320);
    final parcelP = springSeg(t, 1400, MotionSprings.celebrateDuration, MomentCurves.celebrate);
    final parcelIn = seg(t, 1400, 100);
    final keysT = seg(t, 1600, 300, MotionCurves.out);
    final lamp = LampState(strength: lerpD(0.55, 1, seg(t, 0, 300, MotionCurves.glide)) + 0.15 * sealGlow, centreY: 0.26);

    final countStyle = type.figureCompact.copyWith(fontSize: 34, height: 1, color: colors.ink);
    final rest = MobV3Copy.questPast(count, q.target).substring('$count'.length);

    final body = SingleChildScrollView(
      physics: const ClampingScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: MmSpace.momentGutter),
      child: Column(
        children: [
          const SizedBox(height: MmSpace.s8),
          // The true total, counting past the goal (F8). It stays when the bar folds away.
          Semantics(
            label: MobV3Copy.questPast(q.answered, q.target),
            excludeSemantics: true,
            child: Text.rich(
              TextSpan(children: [
                TextSpan(text: '$count', style: countStyle),
                TextSpan(text: rest, style: type.body.copyWith(color: colors.ink2)),
              ]),
              key: const ValueKey('k2-count'),
              textAlign: TextAlign.center,
            ),
          ),
          const SizedBox(height: MmSpace.s12),
          SizedBox(
            height: 176,
            child: Stack(
              alignment: Alignment.center,
              children: [
                if (barLeave < 1)
                  Opacity(
                    opacity: 1 - barLeave,
                    child: Transform(
                      alignment: Alignment.center,
                      transform: Matrix4.identity()
                        ..setEntry(3, 2, 0.0015)
                        ..rotateX(-barLeave * 80 * math.pi / 180)
                        ..scaleByDouble(pulse, pulse, 1, 1),
                      child: CustomPaint(
                        key: const ValueKey('k2-bar'),
                        size: const Size(300, 26),
                        painter: QuestBarPainter(fill: fill, bloomMs: t - 760, ink: colors.ink, glow: colors.voltGlow, night: colors.isNight),
                      ),
                    ),
                  ),
                // Mounted from the first frame (hidden) so the seal still has decoded by its beat.
                IgnorePointer(
                  child: Opacity(
                    opacity: sealIn,
                    child: Transform.rotate(
                      angle: -2 * math.pi / 180 * (1 - sealP),
                      child: Transform.scale(
                        scale: lerpD(1.4, 1, sealP),
                        child: ParcelStills.available
                            ? SizedBox.square(
                                key: _seal,
                                dimension: 148,
                                child: CustomPaint(
                                  painter: PaperSealPainter(glow: sealGlow, drawPaper: false),
                                  child: Image.asset(
                                    ParcelStills.seal,
                                    fit: BoxFit.contain,
                                    filterQuality: FilterQuality.medium,
                                    excludeFromSemantics: true,
                                    errorBuilder: (_, _, _) => const CustomPaint(painter: PaperSealPainter()),
                                  ),
                                ),
                              )
                            : CustomPaint(
                                key: _seal,
                                size: const Size.square(148),
                                painter: PaperSealPainter(glow: sealGlow),
                              ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: MmSpace.s12),
          KeyedSubtree(
            key: _title,
            child: EngraveText(MobV3Copy.questDone, style: type.moment.copyWith(color: colors.ink), t: titleT),
          ),
          const SizedBox(height: MmSpace.s8),
          Opacity(
            opacity: lineT,
            child: Transform.translate(
              offset: Offset(0, (1 - lineT) * 6),
              child: Text(
                MobV3Copy.questDoneLine(widget.mobName, q.answered, q.target, widget.week),
                style: type.body.copyWith(color: colors.ink2),
                textAlign: TextAlign.center,
              ),
            ),
          ),
          const SizedBox(height: MmSpace.s20),
          MemberHeads(members: widget.members, popAt: 1300, ms: t, size: 44),
          const SizedBox(height: MmSpace.s20),
          Opacity(
            opacity: parcelIn,
            child: Transform.translate(
              offset: Offset(0, (1 - parcelP) * 22),
              child: Transform.scale(
                scale: lerpD(0.86, 1, parcelP),
                child: ParcelIcon(
                  key: const ValueKey('k2-parcel'),
                  kind: widget.prize.kind,
                  fold: widget.prize.fold,
                  item: widget.prize.item,
                  size: 112,
                  still: true,
                  semanticLabel: MobV3Copy.parcelA11y(widget.prize.parcel),
                ),
              ),
            ),
          ),
          const SizedBox(height: MmSpace.s16),
        ],
      ),
    );

    return MomentFrame(
      stageKey: _stage,
      title: widget.mobName,
      subtitle: MobV3Copy.questTitle,
      lamp: lamp,
      playing: playing,
      onSkip: skip,
      onClose: widget.onClose,
      body: body,
      particles: particles,
      keysT: keysT,
      keys: [momentKey(widget.keyLabel, widget.onKey, key: const ValueKey('k2-key'))],
    );
  }
}

/// The weekly quest bar: 12 paper segments that fill in order up to the target and stay full past it
/// (F8); from [bloomMs] 0 each segment lifts 1 dp with a 14% volt glow, 22 ms apart.
class QuestBarPainter extends CustomPainter {
  QuestBarPainter({required this.fill, required this.bloomMs, required this.ink, required this.glow, required this.night});

  static const int segments = 12;
  final double fill;
  final double bloomMs;
  final Color ink;
  final Color glow;
  final bool night;

  @override
  void paint(Canvas canvas, Size size) {
    const gap = 4.0;
    final w = (size.width - gap * (segments - 1)) / segments;
    final h = size.height;
    final filled = fill * segments;
    for (var i = 0; i < segments; i++) {
      final bloom = (((bloomMs - i * 22) / 120).clamp(0.0, 1.0));
      final x = i * (w + gap);
      final r = RRect.fromRectAndRadius(Rect.fromLTWH(x, -bloom, w, h), const Radius.circular(4));
      if (bloom > 0) {
        canvas.drawRRect(r.inflate(3), Paint()..color = glow.withValues(alpha: glow.a * bloom));
      }
      canvas.drawRRect(r, Paint()..color = ink.withValues(alpha: night ? 0.1 : 0.08));
      final part = (filled - i).clamp(0.0, 1.0);
      if (part > 0) {
        canvas.save();
        canvas.clipRect(Rect.fromLTWH(x, -bloom - 1, w * part, h + 2));
        canvas.drawRRect(r, Paint()..color = ink.withValues(alpha: night ? 0.92 : 0.86));
        canvas.restore();
      }
      canvas.drawRRect(r, Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..color = ink.withValues(alpha: 0.18));
    }
  }

  @override
  bool shouldRepaint(QuestBarPainter old) => old.fill != fill || old.bloomMs != bloomMs || old.ink != ink || old.night != night;
}
