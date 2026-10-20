// K3 Week stitched (spec 5.3, 5.6 M8, T3 2000; F13). Plays only for a `stitch:<week>` key that the
// server sent after `quest.done` (the overlay checks). The lamp brightens and the cream paper pennant
// lifts; the number rolls n-1 to n; a needle sews the new volt stitch, riding the thread's tangent,
// then the thread holes appear; the pennant settles with a decaying sway; glints ride the stitch; the
// title engraves, the heads pop, and a den object card rises when the week reaches a milestone.

import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../../../../core/models/json_helpers.dart';
import '../../../../core/motion/motion_tokens.g.dart';
import '../../../../core/theme/theme.dart';
import '../copy_v3.dart';
import '../data/mob_v3_models.dart';
import 'moment_kit.dart';
import 'paper_particles.dart' show drawGlint;
import 'parcel.dart';

// ---- Mob hours on the stitch (MOB-MINIMAL 3.4 item 5, 3.6; MOB HOURS CONTRACT `v3.hours`) ----------------
// A minimal, tolerant reading of `v3.hours` for this one card, taken from the den's `MobHours`
// (data/mob_v3_models.dart).

/// One sharing member's week: their minutes and the days they met their own daily goal.
class StitchHoursMember {
  const StitchHoursMember({required this.memberId, required this.minutes, this.goalDays = 0});

  final String memberId;
  final int minutes;
  final int goalDays;

  /// The week tick: their own daily goal met on 5 of 7 days.
  bool get tick => goalDays >= 5;
}

/// The Mob hours this card may show. Every field defaults to empty or 0; members with 0 minutes never appear.
class StitchHours {
  const StitchHours({this.topMemberId, this.members = const []});

  /// `v3.hours` read both ways round (snake_case per the contract, camelCase tolerated). Null when absent or not a
  /// map; a member without an id or with 0 minutes is dropped.
  static StitchHours? fromJson(Object? raw) {
    if (raw is! Map) return null;
    final j = asJson(raw);
    final members = <StitchHoursMember>[];
    for (final m in asJsonList(j['members'])) {
      final id = asString(m['member_id'] ?? m['memberId']);
      final minutes = asInt(m['minutes']) ?? 0;
      if (id == null || minutes <= 0) continue;
      members.add(StitchHoursMember(memberId: id, minutes: minutes, goalDays: asInt(m['goal_days'] ?? m['goalDays']) ?? 0));
    }
    return StitchHours(topMemberId: asString(j['top_member_id'] ?? j['topMemberId']), members: members);
  }

  /// Where the overlay reads the Mob's hours from the den: `v3.hours` (MobHours). Null (absent, or nobody shares)
  /// keeps the card hidden. Tests may swap it.
  static StitchHours? Function(MobV3 v3) of = fromMobHours;

  /// [MobHours] as this card reads it: only members with minutes, the server's top member id as it is.
  static StitchHours? fromMobHours(MobV3 v3) {
    final h = v3.hours;
    if (h == null || h.offForEveryone) return null;
    return StitchHours(
      topMemberId: h.topMemberId,
      members: [for (final m in h.members) if (m.minutes > 0) StitchHoursMember(memberId: m.memberId, minutes: m.minutes, goalDays: m.goalDays)],
    );
  }

  final String? topMemberId;
  final List<StitchHoursMember> members;

  StitchHoursMember? _of(String id) {
    for (final m in members) {
      if (m.memberId == id && m.minutes > 0) return m;
    }
    return null;
  }

  /// The crown: only a top member the server named, with minutes, who is in [mob].
  StitchHoursMember? crownIn(List<MobV3Member> mob) {
    final id = topMemberId;
    if (id == null || !mob.any((x) => x.memberId == id)) return null;
    return _of(id);
  }

  /// The sharing members of [mob] to show, in the Mob's head order (never a rank below the top).
  List<(MobV3Member, StitchHoursMember)> shownIn(List<MobV3Member> mob) => [
        for (final x in headOrder(mob))
          if (_of(x.memberId) case final StitchHoursMember h) (x, h),
      ];

  /// The card shows when it has a crown or at least one tick.
  bool showsIn(List<MobV3Member> mob) => crownIn(mob) != null || shownIn(mob).any((p) => p.$2.tick);
}

class StitchedMoment extends StatefulWidget {
  const StitchedMoment({super.key, required this.mobName, required this.members, required this.weeks, this.item, required this.onKey, required this.onClose, this.keyLabel, this.hours});

  /// The week's Mob hours (null: the card is hidden).
  final StitchHours? hours;

  final String mobName;
  final List<MobV3Member> members;

  /// Weeks in a row now (the server's `mobChain.weeks`, after this week's stitch).
  final int weeks;

  /// The den object this week brought, when it reached a milestone (`desk_bell`...).
  final String? item;
  final VoidCallback onKey;
  final VoidCallback onClose;

  /// The key's words: "Back to the den", or "Open the parcel" when the reveal comes next (spec order:
  /// quest done, week stitched, reveal).
  final String? keyLabel;

  @override
  State<StitchedMoment> createState() => _StitchedMomentState();
}

class _StitchedMomentState extends MomentStageState<StitchedMoment> {
  final GlobalKey _stage = GlobalKey();
  final GlobalKey _restKey = GlobalKey();
  double? _restH;

  @override
  double get totalMs => 2000;

  @override
  late final List<MomentCue> cues = [MomentCue(780, () => haptics?.confirm())];

  @override
  Widget build(BuildContext context) => AnimatedBuilder(animation: clock, builder: (context, _) => reducedFade(_frame(context)));

  Widget _frame(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final t = ms;
    final n = widget.weeks;

    // The pennant: lift 8 dp and -1.5 degrees (0-300), then settle at 1.03 with a decaying sway (780, 900).
    final up = seg(t, 0, 300, MotionCurves.out);
    final settle = seg(t, 780, 900, MotionCurves.out);
    final lift = -8 * up * (1 - settle);
    final swing = -1.5 * math.pi / 180 * up * (1 - seg(t, 780, 220, MotionCurves.out)) + decaySway(t, 780, 900, 1.2 * math.pi / 180, cycles: 1.5);
    final scale = 1 + 0.03 * math.sin(math.pi * seg(t, 780, 600));
    final roll = seg(t, 180, MotionDurations.numberRoll.inMilliseconds.toDouble());
    final sew = seg(t, 300, MotionDurations.drawIn.inMilliseconds.toDouble(), MotionCurves.inOut);
    final holes = seg(t, 750, 140);
    final glints = ((t - 820) / 420).clamp(0.0, 1.0);
    final titleT = seg(t, 900, MotionDurations.engrave.inMilliseconds.toDouble());
    final lineT = seg(t, 980, 320);
    final cardT = seg(t, 1300, MotionDurations.emphasized.inMilliseconds.toDouble(), MotionCurves.emphasized);
    final bell = decaySway(t, 1520, 480, 9 * math.pi / 180, cycles: 2);
    final keysT = seg(t, 1700, 300, MotionCurves.out);
    final lamp = LampState(strength: lerpD(0.6, 1.15, seg(t, 0, 300, MotionCurves.glide)) - 0.15 * seg(t, 900, 700), centreY: 0.25);

    final ink = const Color(0xFF221E17);
    final pennant = SizedBox(
      width: PennantPainter.width,
      height: PennantPainter.height + PennantPainter.hang,
      child: Stack(
        children: [
          Positioned.fill(
            child: CustomPaint(
              key: const ValueKey('k3-pennant'),
              painter: PennantPainter(
                weeks: n,
                sew: sew,
                holes: holes,
                glints: t >= 820 && glints < 1 ? glints : null,
                night: colors.isNight,
                volt: colors.volt,
                voltEdge: colors.voltEdge,
              ),
            ),
          ),
          Positioned(
            left: 0,
            right: 0,
            top: PennantPainter.hang + 14,
            child: Column(
              children: [
                RollNumber(from: math.max(0, n - 1), to: n, t: roll, style: type.figureHero.copyWith(fontSize: 76, color: ink)),
                const SizedBox(height: 2),
                // Part of the pennant's art (the headline says it in full), so it keeps its size inside the cloth at large text.
                Text(MobV3Copy.weeksInARow(n), style: type.label.copyWith(color: ink.withValues(alpha: 0.8), fontSize: 14), textAlign: TextAlign.center, textScaler: TextScaler.noScaling),
              ],
            ),
          ),
        ],
      ),
    );

    final item = widget.item;
    // M7 (walk 19 Oct): at 360 x 640 dp the reward card fell behind the key. The pennant gives way:
    // it scales down until the title, line, heads and card fit above the key.
    final body = LayoutBuilder(builder: (context, box) {
      // The rest (title, line, heads, card) is measured after each layout; the first frame uses a
      // close guess, so the pennant settles at its size before the moment is visible.
      final rest = _restH ?? (item != null ? 480.0 : 360.0) * MediaQuery.textScalerOf(context).scale(1);
      const natural = PennantPainter.height + PennantPainter.hang + MmSpace.s4;
      final fit = ((box.maxHeight - rest - MmSpace.s4) / natural).clamp(0.5, 1.0);
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        final h = _restKey.currentContext?.size?.height;
        if (h != null && (_restH == null || (h - _restH!).abs() > 1)) setState(() => _restH = h);
      });
      return _body(context, t, n, item, lift, swing, scale, pennant, fit, titleT, lineT, cardT, bell);
    });

    return MomentFrame(
      stageKey: _stage,
      title: widget.mobName,
      subtitle: MobV3Copy.mobsChain,
      lamp: lamp,
      playing: playing,
      onSkip: skip,
      onClose: widget.onClose,
      body: body,
      particles: particles,
      keysT: keysT,
      keys: [momentKey(widget.keyLabel ?? MobV3Copy.backToDen, widget.onKey, key: const ValueKey('k3-key'))],
    );
  }

  Widget _body(BuildContext context, double t, int n, String? item, double lift, double swing, double scale, Widget pennant, double fit, double titleT, double lineT, double cardT, double bell) {
    final colors = context.mmColors;
    final type = context.mmType;
    const natural = PennantPainter.height + PennantPainter.hang;
    return SingleChildScrollView(
      physics: const ClampingScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: MmSpace.momentGutter),
      child: Column(
        children: [
          const SizedBox(height: MmSpace.s4),
          Transform.translate(
            offset: Offset(0, lift),
            child: Transform.rotate(
              angle: swing,
              alignment: Alignment.topCenter,
              child: Transform.scale(
                scale: scale,
                alignment: Alignment.topCenter,
                child: SizedBox(
                  width: PennantPainter.width * fit,
                  height: natural * fit,
                  child: FittedBox(fit: BoxFit.contain, alignment: Alignment.topCenter, child: pennant),
                ),
              ),
            ),
          ),
          Column(
            key: _restKey,
            children: [
          const SizedBox(height: MmSpace.s20),
          EngraveText(MobV4ResultsCopy.weekStitched(n), style: type.headline.copyWith(color: colors.ink), t: titleT),
          const SizedBox(height: MmSpace.s8),
          Opacity(
            opacity: lineT,
            child: Transform.translate(
              offset: Offset(0, (1 - lineT) * 6),
              child: Text(MobV4ResultsCopy.weeksForMob(n, widget.mobName), style: type.body.copyWith(color: colors.ink2), textAlign: TextAlign.center),
            ),
          ),
          const SizedBox(height: MmSpace.s16),
          // With Mob hours to show, the card carries the heads (crown and ticks); without, the heads as before.
          if (widget.hours?.showsIn(widget.members) ?? false)
            Opacity(
              opacity: lineT,
              child: Transform.translate(offset: Offset(0, (1 - lineT) * 10), child: _HoursCard(hours: widget.hours!, members: widget.members, week: n)),
            )
          else
            MemberHeads(members: widget.members, popAt: 1080, ms: t, size: 40),
          if (item != null) ...[
            const SizedBox(height: MmSpace.s20),
            Opacity(
              opacity: cardT,
              child: Transform.translate(
                offset: Offset(0, (1 - cardT) * 14),
                child: _RewardCard(item: item, bell: bell),
              ),
            ),
          ],
          const SizedBox(height: MmSpace.s16),
            ],
          ),
        ],
      ),
    );
  }
}

/// The den object card: the art, "A desk bell for your den", "It stays on your den's shelf."
class _RewardCard extends StatelessWidget {
  const _RewardCard({required this.item, required this.bell});
  final String item;
  final double bell;

  static String? artFor(String item) => switch (item) {
        'desk_bell' => 'assets/art/hybrid-deskbell.webp',
        _ => null,
      };

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final art = artFor(item);
    return Container(
      key: const ValueKey('k3-reward'),
      padding: const EdgeInsets.fromLTRB(MmSpace.s12, MmSpace.s12, MmSpace.s16, MmSpace.s12),
      decoration: BoxDecoration(
        color: colors.raised,
        borderRadius: BorderRadius.circular(MmRadius.panel),
        border: Border.all(color: colors.line),
      ),
      child: Row(
        children: [
          SizedBox.square(
            dimension: 64,
            child: Transform.rotate(
              angle: bell,
              alignment: Alignment.bottomCenter,
              child: art == null
                  ? const CustomPaint(painter: PaperSealPainter())
                  : Image.asset(art, fit: BoxFit.contain, excludeFromSemantics: true, errorBuilder: (_, _, _) => const CustomPaint(painter: PaperSealPainter())),
            ),
          ),
          const SizedBox(width: MmSpace.s12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(MobV3Copy.rewardFor(item), style: type.subhead.copyWith(color: colors.ink)),
                const SizedBox(height: 2),
                Text(MobV3Copy.staysOnShelf, style: type.small.copyWith(color: colors.ink2)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// The Mob's pennant: cream paper on a string from a brass pin, a dashed border, a folded corner, and
/// one volt stitch per week in a row (12 drawn at most, then the number carries it). The newest
/// stitch is sewn by [sew] 0..1 with the needle riding the thread's tangent; [holes] inks the thread
/// holes; [glints] 0..1 runs three glints along it.
class PennantPainter extends CustomPainter {
  PennantPainter({required this.weeks, required this.sew, required this.holes, this.glints, required this.night, required this.volt, required this.voltEdge});

  static const double width = 172;
  static const double height = 236;

  /// The string and pin above the paper.
  static const double hang = 26;
  static const int maxRows = 12;

  final int weeks;
  final double sew;
  final double holes;
  final double? glints;
  final bool night;
  final Color volt;
  final Color voltEdge;

  static Path body(Size s) {
    const top = hang;
    final w = s.width;
    final h = s.height;
    return Path()
      ..moveTo(0, top)
      ..lineTo(w, top)
      ..lineTo(w, h - 44)
      ..lineTo(w / 2, h)
      ..lineTo(0, h - 44)
      ..close();
  }

  /// The row of stitch [i] (0 is the first week) out of [rows].
  static Path stitchPath(Size s, int i, int rows) {
    final w = s.width;
    final top = hang + 132.0;
    final bottom = s.height - 58.0;
    final step = rows <= 1 ? 0.0 : math.min(20.0, (bottom - top) / (rows - 1));
    final y = top + i * step;
    return Path()
      ..moveTo(w * 0.15, y + 1.5)
      ..quadraticBezierTo(w * 0.5, y - 2.5, w * 0.85, y + 1.5);
  }

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    // The pin and string.
    final pin = Offset(w / 2, 6);
    final string = Paint()
      ..color = night ? const Color(0xFF8C7A5C) : const Color(0xFF8A7656)
      ..strokeWidth = 1.4
      ..style = PaintingStyle.stroke;
    canvas.drawLine(pin, Offset(10, hang + 2), string);
    canvas.drawLine(pin, Offset(w - 10, hang + 2), string);
    canvas.drawCircle(pin, 6, Paint()
      ..shader = const RadialGradient(center: Alignment(-0.3, -0.4), colors: [Color(0xFFF3D99A), Color(0xFFB88B3E)]).createShader(Rect.fromCircle(center: pin, radius: 6)));

    // The paper.
    final b = body(size);
    canvas.drawShadow(b, Colors.black, night ? 10 : 6, false);
    canvas.drawPath(
      b,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: night ? const [Color(0xFFF2EAD8), Color(0xFFE2D6BC)] : const [Color(0xFFFFFCF4), Color(0xFFF0E7D3)],
        ).createShader(Offset.zero & size),
    );
    // The lamp-lit top edge.
    canvas.drawLine(Offset(0, hang + 0.5), Offset(w, hang + 0.5), Paint()
      ..color = const Color(0xFFFFF8E6)
      ..strokeWidth = 1.5);
    // A dashed border, inset.
    final inset = Path()
      ..moveTo(9, hang + 9)
      ..lineTo(w - 9, hang + 9)
      ..lineTo(w - 9, size.height - 48)
      ..lineTo(w / 2, size.height - 9)
      ..lineTo(9, size.height - 48)
      ..close();
    final dash = Paint()
      ..color = const Color(0xFF9E8F72).withValues(alpha: 0.7)
      ..strokeWidth = 1.1
      ..style = PaintingStyle.stroke;
    for (final m in inset.computeMetrics()) {
      for (var d = 0.0; d < m.length; d += 7) {
        canvas.drawPath(m.extractPath(d, math.min(d + 3.5, m.length)), dash);
      }
    }
    // The folded corner, top right.
    const f = 20.0;
    final corner = Path()
      ..moveTo(w - f, hang)
      ..lineTo(w, hang + f)
      ..lineTo(w - f, hang + f)
      ..close();
    canvas.drawPath(corner, Paint()..color = const Color(0xFFD9CCAF));
    canvas.drawPath(
      Path()
        ..moveTo(w - f, hang)
        ..lineTo(w, hang)
        ..lineTo(w, hang + f)
        ..close(),
      Paint()..color = night ? const Color(0xFF12110E) : const Color(0xFFF3EFE6),
    );

    // Stitches.
    final rows = math.min(weeks, maxRows);
    for (var i = 0; i < rows; i++) {
      final path = stitchPath(size, i, rows);
      final newest = i == rows - 1;
      final metric = path.computeMetrics().first;
      final drawn = newest ? metric.extractPath(0, metric.length * sew) : path;
      _thread(canvas, drawn);
      final holeAlpha = newest ? holes : 1.0;
      if (holeAlpha > 0) {
        final hp = Paint()..color = const Color(0xFF3C4A00).withValues(alpha: 0.55 * holeAlpha);
        for (var d = 5.0; d < metric.length; d += 9) {
          final tan = metric.getTangentForOffset(d);
          if (tan != null) canvas.drawCircle(tan.position, 1.1, hp);
        }
      }
      if (newest && sew > 0 && sew < 1) _needle(canvas, metric, sew);
      if (newest && glints != null) {
        for (var g = 0; g < 3; g++) {
          final k = (glints! * 1.3 - g * 0.15).clamp(0.0, 1.0);
          if (k <= 0 || k >= 1) continue;
          final tan = metric.getTangentForOffset(metric.length * k);
          if (tan == null) continue;
          drawGlint(canvas, tan.position + const Offset(0, -2), 6 * math.sin(k * math.pi), const Color(0xFFFFF4D6));
        }
      }
    }
  }

  void _thread(Canvas canvas, Path p) {
    canvas.drawPath(p, Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 5
      ..strokeCap = StrokeCap.round
      ..color = voltEdge);
    canvas.drawPath(p, Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3.2
      ..strokeCap = StrokeCap.round
      ..color = volt);
  }

  void _needle(Canvas canvas, ui.PathMetric m, double k) {
    final tan = m.getTangentForOffset(m.length * k);
    if (tan == null) return;
    canvas.save();
    canvas.translate(tan.position.dx, tan.position.dy);
    canvas.rotate(math.atan2(tan.vector.dy, tan.vector.dx) - 0.5);
    final steel = Paint()
      ..shader = const LinearGradient(colors: [Color(0xFFF4F4F2), Color(0xFF9EA3A8)]).createShader(const Rect.fromLTWH(-2, -16, 4, 18));
    final needle = Path()
      ..moveTo(0, 2)
      ..lineTo(-1.6, -12)
      ..quadraticBezierTo(0, -17, 1.6, -12)
      ..close();
    canvas.drawPath(needle, steel);
    canvas.drawOval(const Rect.fromLTWH(-0.7, -14.5, 1.4, 3), Paint()..color = const Color(0xFF55595E));
    canvas.restore();
  }

  @override
  bool shouldRepaint(PennantPainter old) =>
      old.weeks != weeks || old.sew != sew || old.holes != holes || old.glints != glints || old.night != night || old.volt != volt;
}

/// The Mob hours card on the stitch: the crowned head and "Riya studied the most: 6 h 20 m", "Riya's crown goes on
/// week 4's stitch."; a quiet ruler; each sharing member's head with a tick when they met their own daily goal on 5
/// of 7 days, and what a tick means. The crown and ticks sit still (4.3). Never a rank below the top, never 0 minutes.
class _HoursCard extends StatelessWidget {
  const _HoursCard({required this.hours, required this.members, required this.week});

  final StitchHours hours;
  final List<MobV3Member> members;
  final int week;

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final type = context.mmType;
    final crown = hours.crownIn(members);
    final crowned = crown == null ? null : members.firstWhere((m) => m.memberId == crown.memberId);
    final shown = hours.shownIn(members);
    final anyTick = shown.any((p) => p.$2.tick);
    final tickFill = c.isNight ? c.volt : c.ink;
    final tickInk = c.isNight ? const Color(0xFF0B0B0F) : c.raised;
    return Container(
      key: const ValueKey('k3-hours'),
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s16, MmSpace.s16, MmSpace.s12),
      decoration: BoxDecoration(color: c.raised, borderRadius: BorderRadius.circular(MmRadius.panel), border: Border.all(color: c.line)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (crown != null && crowned != null)
            Row(
              key: const ValueKey('k3-crown'),
              children: [
                SizedBox(
                  width: 52,
                  height: 58,
                  child: Stack(
                    clipBehavior: Clip.none,
                    children: [
                      Positioned(left: 0, bottom: 0, child: HeadDisc(member: crowned, size: 48)),
                      const Positioned(left: 13, top: 0, child: CustomPaint(size: Size(22, 14), painter: CrownPainter())),
                    ],
                  ),
                ),
                const SizedBox(width: MmSpace.s12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        crowned.you ? MobV4ResultsCopy.youStudiedMost(crown.minutes) : MobV4ResultsCopy.studiedMost(crowned.name, crown.minutes),
                        style: type.body.copyWith(color: c.ink, fontWeight: FontWeight.w700, fontFeatures: const [FontFeature.tabularFigures()]),
                      ),
                      const SizedBox(height: 2),
                      Text(crowned.you ? MobV4ResultsCopy.yourCrownOn(week) : MobV4ResultsCopy.crownOn(crowned.name, week), style: type.small.copyWith(color: c.ink2)),
                    ],
                  ),
                ),
              ],
            ),
          if (anyTick) ...[
            if (crown != null) ...[
              const SizedBox(height: MmSpace.s12),
              CustomPaint(size: const Size(double.infinity, 8), painter: _RulerPainter(c.ink3)),
              const SizedBox(height: MmSpace.s12),
            ],
            // One row: each sharing member shares the width (a Mob is at most 8, so heads never wrap to a second line).
            Row(
              children: [
                for (final (m, h) in shown.take(8))
                  Expanded(
                    child: Column(
                      key: ValueKey('k3-head-${m.memberId}${h.tick ? '-tick' : ''}'),
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        SizedBox(
                          width: shown.length > 5 ? 40 : 52,
                          height: 44,
                          child: Stack(
                            clipBehavior: Clip.none,
                            children: [
                              Positioned(left: 6, top: 2, child: HeadDisc(member: m, size: shown.length > 5 ? 30 : 40)),
                              if (h.tick)
                                Positioned(
                                  right: -4,
                                  top: -4,
                                  child: Container(
                                    width: 22,
                                    height: 22,
                                    decoration: BoxDecoration(color: tickFill, shape: BoxShape.circle, border: Border.all(color: c.raised, width: 2)),
                                    child: Icon(Icons.check_rounded, size: 14, color: tickInk),
                                  ),
                                ),
                            ],
                          ),
                        ),
                        const SizedBox(height: MmSpace.s4),
                        Text(m.you ? MobV3Copy.headYou : m.name, style: type.label.copyWith(color: c.ink2), maxLines: 1, overflow: TextOverflow.ellipsis),
                      ],
                    ),
                  ),
              ],
            ),
            const SizedBox(height: MmSpace.s8),
            Text(MobV4ResultsCopy.tickMeans, style: type.small.copyWith(color: c.ink2)),
          ],
        ],
      ),
    );
  }
}

/// The crown on the top member's head: a three-point paper crown in amber.
class CrownPainter extends CustomPainter {
  const CrownPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final path = Path()
      ..moveTo(0, h)
      ..lineTo(0, h * 0.25)
      ..lineTo(w * 0.28, h * 0.62)
      ..lineTo(w * 0.5, 0)
      ..lineTo(w * 0.72, h * 0.62)
      ..lineTo(w, h * 0.25)
      ..lineTo(w, h)
      ..close();
    canvas.drawPath(path, Paint()..color = const Color(0xFFF2A93B));
    canvas.drawPath(
      path,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.2
        ..strokeJoin = StrokeJoin.round
        ..color = const Color(0xFF8A5A12),
    );
  }

  @override
  bool shouldRepaint(CrownPainter old) => false;
}

/// A quiet measuring rule between the crown line and the heads (the den's Mob hours ruler), a tick every 6 dp.
class _RulerPainter extends CustomPainter {
  _RulerPainter(this.ink);
  final Color ink;

  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..color = ink.withValues(alpha: 0.5)
      ..strokeWidth = 1;
    var i = 0;
    for (var x = 0.0; x <= size.width; x += 6) {
      canvas.drawLine(Offset(x, size.height), Offset(x, i % 5 == 0 ? 0 : size.height * 0.5), p);
      i++;
    }
  }

  @override
  bool shouldRepaint(_RulerPainter old) => old.ink != ink;
}
