// The strip of seven paper ticks, today last (spec C1, Live 03). A practised day is a cream sheet with a
// ticked corner; a rested day is a dashed sheet with a moon (the pass applied itself); a day set aside for
// exams carries a lamp dot; a day nobody practised is plain paper in shade, never red, never a gap that
// shames. Today undone is one outlined sheet that reads "2 of 5". The links between sheets are dashed
// round a rested or open day. The only volt on the strip is today's ring.
//
// The ticks draw in one after another (45 ms apart, 450 ms each) when the strip first appears; in reduced
// motion they are simply there. Nothing on it counts down and nothing on it warns.

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/motion/motion.dart';
import '../../../../core/theme/theme.dart';
import '../copy_v3.dart';
import '../data/mob_v3_models.dart';
import 'chain_paper.dart';

class ChainStrip extends StatefulWidget {
  const ChainStrip({super.key, required this.days, this.todayAnswered = 0, this.todayNeeded = 5, this.todayDone = false, this.animate = true});

  /// Seven days, today last (`ChainState.week`).
  final List<ChainDay> days;
  final int todayAnswered;
  final int todayNeeded;
  final bool todayDone;
  final bool animate;

  /// A sheet's height. The width follows the cell.
  static const double tileHeight = 52;

  @override
  State<ChainStrip> createState() => _ChainStripState();
}

class _ChainStripState extends State<ChainStrip> with SingleTickerProviderStateMixin {
  static const int _stagger = 45;
  static const int _each = 450;
  late final AnimationController _c = AnimationController(vsync: this, duration: Duration(milliseconds: _stagger * 7 + _each));
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (!widget.animate || Motion.reduced(context)) {
      _c.value = 1;
    } else {
      _c.forward();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  bool _linkDashed(ChainDay a, ChainDay b) => const {ChainDayState.rested, ChainDayState.paused, ChainDayState.open}.contains(a.state) || const {ChainDayState.rested, ChainDayState.paused, ChainDayState.open}.contains(b.state);

  @override
  Widget build(BuildContext context) {
    final days = widget.days;
    if (days.isEmpty) return const SizedBox.shrink();
    final colors = context.mmColors;
    final type = context.mmType;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var i = 0; i < days.length; i++)
          Expanded(
            child: _Cell(
              day: days[i],
              today: i == days.length - 1,
              index: i,
              controller: _c,
              leftDashed: i == 0 ? null : _linkDashed(days[i - 1], days[i]),
              rightDashed: i == days.length - 1 ? null : _linkDashed(days[i], days[i + 1]),
              answered: widget.todayAnswered,
              needed: widget.todayNeeded,
              todayDone: widget.todayDone,
              colors: colors,
              type: type,
            ),
          ),
      ],
    );
  }
}

class _Cell extends StatelessWidget {
  const _Cell({
    required this.day,
    required this.today,
    required this.index,
    required this.controller,
    required this.leftDashed,
    required this.rightDashed,
    required this.answered,
    required this.needed,
    required this.todayDone,
    required this.colors,
    required this.type,
  });

  final ChainDay day;
  final bool today;
  final int index;
  final Animation<double> controller;
  final bool? leftDashed;
  final bool? rightDashed;
  final int answered;
  final int needed;
  final bool todayDone;
  final MmColors colors;
  final MmType type;

  @override
  Widget build(BuildContext context) {
    final state = day.state;
    final ticked = state == ChainDayState.practised || state == ChainDayState.madeUp || (today && todayDone);
    final openToday = today && !todayDone;
    final weekday = MobTime.weekdayOfKey(day.day);
    final label = openToday ? '${MobV3Copy.todayWord}, ${MobV3Copy.todayProgress(answered, needed)}' : '${today ? MobV3Copy.todayWord : weekday}, ${MobV3Copy.dayStateWord(ticked ? ChainDayState.practised : state)}';
    final initial = MobV3Copy.dayInitials[(DateTime.tryParse(day.day)?.weekday ?? 1) - 1];
    return Semantics(
      container: true,
      label: label,
      child: ExcludeSemantics(
        child: Column(
          children: [
            SizedBox(
              height: ChainStrip.tileHeight,
              child: Stack(
                alignment: Alignment.center,
                fit: StackFit.expand,
                children: [
                  Positioned.fill(
                    child: CustomPaint(
                      painter: _TilePainter(
                        paper: ChainPaper.fill(context),
                        shade: ChainPaper.shade(context),
                        edge: ChainPaper.edge(context),
                        ink: ChainPaper.ink,
                        well: colors.raised,
                        line: colors.line,
                        dashes: colors.ink3,
                        ring: colors.volt,
                        lamp: colors.lamp,
                        track: colors.sunken,
                        state: state,
                        ticked: ticked,
                        openToday: openToday,
                        today: today,
                        madeUp: state == ChainDayState.madeUp,
                        fraction: needed <= 0 ? 0 : (answered / needed).clamp(0.0, 1.0),
                        leftDashed: leftDashed,
                        rightDashed: rightDashed,
                        index: index,
                        t: controller,
                      ),
                    ),
                  ),
                  if (state == ChainDayState.rested) Icon(LucideIcons.moon, size: 18, color: colors.ink2),
                  if (openToday)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: SizedBox(
                        width: 32,
                        child: FittedBox(
                          fit: BoxFit.scaleDown,
                          child: Text(MobV3Copy.todayProgress(answered, needed), style: type.label.copyWith(color: ChainPaper.ink, fontSize: 12, height: 1.1)),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: MmSpace.s6),
            Text(initial, style: type.label.copyWith(color: today ? colors.ink : colors.ink3, fontWeight: today ? FontWeight.w800 : FontWeight.w600)),
          ],
        ),
      ),
    );
  }
}

class _TilePainter extends CustomPainter {
  _TilePainter({
    required this.paper,
    required this.shade,
    required this.edge,
    required this.ink,
    required this.well,
    required this.line,
    required this.dashes,
    required this.ring,
    required this.lamp,
    required this.track,
    required this.state,
    required this.ticked,
    required this.openToday,
    required this.today,
    required this.madeUp,
    required this.fraction,
    required this.leftDashed,
    required this.rightDashed,
    required this.index,
    required this.t,
  }) : super(repaint: t);

  final Color paper, shade, edge, ink, well, line, dashes, ring, lamp, track;
  final ChainDayState state;
  final bool ticked, openToday, today, madeUp;
  final double fraction;
  final bool? leftDashed;
  final bool? rightDashed;
  final int index;
  final Animation<double> t;

  @override
  void paint(Canvas canvas, Size size) {
    final tileW = (size.width - 8).clamp(24.0, 42.0);
    final rect = Rect.fromCenter(center: Offset(size.width / 2, size.height / 2), width: tileW, height: size.height);
    final r = RRect.fromRectAndRadius(rect, const Radius.circular(12));
    final total = 45.0 * 7 + 450;
    final local = ((t.value * total - index * 45) / 450).clamp(0.0, 1.0);

    // Links first, under the sheets.
    final mid = size.height / 2;
    void link(double x0, double x1, bool dashed) {
      final p = Path()
        ..moveTo(x0, mid)
        ..lineTo(x1, mid);
      final paint = Paint()
        ..color = dashes.withValues(alpha: 0.7)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2
        ..strokeCap = StrokeCap.round;
      canvas.drawPath(dashed ? dashedPath(p, dash: 2.5, gap: 2.5) : p, paint);
    }

    if (leftDashed != null) link(0, rect.left, leftDashed!);
    if (rightDashed != null) link(rect.right, size.width, rightDashed!);

    if (ticked) {
      canvas.drawRRect(r, Paint()..color = paper);
      canvas.drawRRect(r, Paint()
        ..color = edge
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1);
      // The folded corner, top right.
      final fold = Path()
        ..moveTo(rect.right - 11, rect.top)
        ..lineTo(rect.right, rect.top + 11)
        ..lineTo(rect.right - 11, rect.top + 11)
        ..close();
      canvas.save();
      canvas.clipRRect(r);
      canvas.drawPath(fold, Paint()..color = shade);
      canvas.restore();
      // The tick, drawn in.
      final tick = MmPaths.check(Rect.fromCenter(center: rect.center.translate(0, 2), width: 24, height: 24));
      canvas.drawPath(
        mmPathPrefix(tick, Motion.out.transform(local)),
        Paint()
          ..color = ink
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2.6
          ..strokeCap = StrokeCap.round
          ..strokeJoin = StrokeJoin.round,
      );
      if (madeUp) {
        // A paper notch: a small triangle cut from the lower left, the make-up's mark.
        final notch = Path()
          ..moveTo(rect.left, rect.bottom - 10)
          ..lineTo(rect.left + 10, rect.bottom)
          ..lineTo(rect.left, rect.bottom)
          ..close();
        canvas.save();
        canvas.clipRRect(r);
        canvas.drawPath(notch, Paint()..color = well);
        canvas.restore();
      }
    } else if (state == ChainDayState.rested || state == ChainDayState.open) {
      final outline = Path()..addRRect(r.deflate(1));
      canvas.drawPath(
        dashedPath(outline, dash: 4, gap: 3),
        Paint()
          ..color = dashes
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.5,
      );
    } else {
      canvas.drawRRect(r, Paint()..color = openToday ? paper : well);
      canvas.drawRRect(r, Paint()
        ..color = openToday ? edge : line
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1);
      if (state == ChainDayState.paused) {
        canvas.drawCircle(rect.center, 4, Paint()..color = lamp);
      }
    }

    if (openToday) {
      // Today's progress: a thin track under the words and its fill.
      final trackRect = RRect.fromRectAndRadius(Rect.fromLTWH(rect.left + 8, rect.bottom - 14, rect.width - 16, 4), const Radius.circular(2));
      canvas.drawRRect(trackRect, Paint()..color = shade);
      if (fraction > 0) {
        final fill = RRect.fromRectAndRadius(Rect.fromLTWH(trackRect.left, trackRect.top, trackRect.width * fraction, 4), const Radius.circular(2));
        canvas.drawRRect(fill, Paint()..color = ink);
      }
    }

    if (today) {
      // The one volt on the strip.
      canvas.drawRRect(
        r.inflate(2),
        Paint()
          ..color = ring
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2.5,
      );
    }
  }

  @override
  bool shouldRepaint(_TilePainter old) =>
      old.state != state || old.ticked != ticked || old.openToday != openToday || old.fraction != fraction || old.paper != paper || old.leftDashed != leftDashed || old.rightDashed != rightDashed;
}
