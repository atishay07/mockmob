import 'package:flutter/material.dart';

import '../../../core/models/lab_loop.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../copy.dart';

/// A habit's 95% Wilson interval as a band on 0 to 100% (the website's Rule book band): the range
/// drawn as a soft bar, the share as a dot, and the same in words under it ("8 of 23 (35%). At
/// this count, the 95% interval runs from 19% to 55%.").
///
/// The band shows how little or how much the count can say: a wide band is a small count. The
/// words carry the same numbers, so nothing depends on seeing the drawing. The range grows from
/// its left edge over 420 ms once the band first appears and the dot fades in at 360 ms; under
/// reduced motion both are simply there. Drawn only for a habit that passed its gate.
class IntervalBand extends StatefulWidget {
  const IntervalBand({super.key, required this.interval});

  final RuleInterval interval;

  /// The words under the band.
  static String lineOf(RuleInterval iv) => RulesCopy.intervalLine(iv.k, iv.n, iv.pct, iv.low, iv.high);

  @override
  State<IntervalBand> createState() => _IntervalBandState();
}

class _IntervalBandState extends State<IntervalBand> with SingleTickerProviderStateMixin {
  late final AnimationController _grow = AnimationController(vsync: this, duration: const Duration(milliseconds: 780), value: 1);
  bool _decided = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_decided) return;
    _decided = true;
    if (Motion.reduced(context)) return;
    _grow.value = 0;
    _grow.forward();
  }

  @override
  void dispose() {
    _grow.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final iv = widget.interval;
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 460),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ExcludeSemantics(
            child: SizedBox(
              height: 14,
              width: double.infinity,
              child: CustomPaint(
                painter: _BandPainter(
                  interval: iv,
                  growth: _grow,
                  track: colors.sunken,
                  trackEdge: colors.line,
                  range: colors.accentText,
                  dot: colors.accentText,
                  dotRing: colors.ground,
                ),
              ),
            ),
          ),
          const SizedBox(height: MmSpace.s6),
          Text(
            IntervalBand.lineOf(iv),
            style: type.small.copyWith(color: colors.ink3, fontFeatures: const [FontFeature.tabularFigures()]),
          ),
        ],
      ),
    );
  }
}

/// The band: a 10 dp pill track (0 to 100%), the range at 30% of the accent, the dot at the share.
/// A range narrower than 1.5% is drawn at 1.5% so it never disappears.
class _BandPainter extends CustomPainter {
  _BandPainter({
    required this.interval,
    required this.growth,
    required this.track,
    required this.trackEdge,
    required this.range,
    required this.dot,
    required this.dotRing,
  }) : super(repaint: growth);

  final RuleInterval interval;
  final Animation<double> growth;
  final Color track;
  final Color trackEdge;
  final Color range;
  final Color dot;
  final Color dotRing;

  @override
  void paint(Canvas canvas, Size size) {
    const barH = 10.0;
    final top = (size.height - barH) / 2;
    final trackRect = RRect.fromRectAndRadius(Rect.fromLTWH(0, top, size.width, barH), const Radius.circular(barH / 2));
    canvas.drawRRect(trackRect, Paint()..color = track);
    canvas.drawRRect(trackRect.deflate(0.5), Paint()
      ..color = trackEdge
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1);

    final low = interval.low.clamp(0, 100) / 100;
    final widthShare = ((interval.high - interval.low) / 100).clamp(0.015, 1.0);
    // The range grows from its left edge over the first 420 of 780 ms (after a 120 ms delay).
    final t = Curves.easeOutCubic.transform(((growth.value * 780 - 120) / 420).clamp(0.0, 1.0));
    final left = size.width * low;
    final w = (size.width * widthShare * t).clamp(0.0, size.width - left);
    if (w > 0) {
      canvas.drawRRect(
        RRect.fromRectAndRadius(Rect.fromLTWH(left, top, w, barH), const Radius.circular(barH / 2)),
        Paint()..color = range.withValues(alpha: 0.30),
      );
    }

    // The dot fades in from 360 ms.
    final fade = ((growth.value * 780 - 360) / 200).clamp(0.0, 1.0);
    if (fade > 0) {
      final cx = (size.width * interval.pct.clamp(0, 100) / 100).clamp(5.0, size.width - 5.0);
      final c = Offset(cx, size.height / 2);
      canvas.drawCircle(c, 6, Paint()..color = dotRing.withValues(alpha: fade));
      canvas.drawCircle(c, 4.5, Paint()..color = dot.withValues(alpha: fade));
    }
  }

  @override
  bool shouldRepaint(_BandPainter old) =>
      old.interval != interval ||
      old.track != track ||
      old.trackEdge != trackEdge ||
      old.range != range ||
      old.dot != dot ||
      old.dotRing != dotRing ||
      old.growth != growth;
}
