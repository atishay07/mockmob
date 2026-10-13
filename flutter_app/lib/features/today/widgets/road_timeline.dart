// The road to May drawn to scale: one line from this month to the end of June 2027, a month
// initial under each month, "Now" where the student stands, the registration window and the
// boards as bands above the line, the expected CUET window as the one volt block and CSAS as an
// open ring after it. Under it, each stop in words with its real dates. Every mark is a date.
import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../copy.dart';
import '../logic/today_model.dart';

class RoadTimeline extends StatelessWidget {
  const RoadTimeline({super.key, required this.today, required this.stops});

  final DateTime today;
  final List<RoadStop> stops;

  /// The line ends with June 2027, after the first CSAS rounds.
  static final DateTime end = DateTime.utc(2027, 7, 1);

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      label: 'Timeline from ${TodayCopy.nowLabel.toLowerCase()} to June 2027',
      excludeSemantics: true,
      child: RepaintBoundary(
        child: CustomPaint(
          size: const Size(double.infinity, 76),
          painter: _RoadPainter(
            today: today,
            stops: stops,
            colors: colors,
            label: type.caption.copyWith(fontSize: 11, height: 1, fontWeight: FontWeight.w600, color: colors.ink3),
            now: type.caption.copyWith(fontSize: 11, height: 1, fontWeight: FontWeight.w700, color: colors.ink),
          ),
        ),
      ),
    );
  }
}

/// The colour a stop is drawn in, shared by the line and the list so they read as one key.
Color roadStopColor(RoadStopKind kind, MmColors c) => switch (kind) {
      RoadStopKind.registration => c.ink3,
      RoadStopKind.boards => c.ink2,
      RoadStopKind.exam => c.isNight ? c.volt : c.accentText,
      RoadStopKind.counselling => c.ink2,
    };

class _RoadPainter extends CustomPainter {
  _RoadPainter({required this.today, required this.stops, required this.colors, required this.label, required this.now});

  final DateTime today;
  final List<RoadStop> stops;
  final MmColors colors;
  final TextStyle label;
  final TextStyle now;

  @override
  void paint(Canvas canvas, Size size) {
    final start = DateTime.utc(today.year, today.month);
    final span = RoadTimeline.end.difference(start).inDays.toDouble();
    const inset = 6.0;
    final w = size.width - inset * 2;
    double x(DateTime d) => inset + w * (d.difference(start).inDays / span).clamp(0.0, 1.0);
    const axis = 46.0;

    // The months: a tick and an initial for each.
    final tick = Paint()..color = colors.line;
    for (var m = start; m.isBefore(RoadTimeline.end); m = DateTime.utc(m.year, m.month + 1)) {
      final next = DateTime.utc(m.year, m.month + 1);
      canvas.drawRect(Rect.fromLTWH(x(m), axis - 3, 1, 6), tick);
      _text(canvas, _monthInitial(m.month), label, Offset((x(m) + x(next)) / 2, axis + 16));
    }
    canvas.drawRRect(
      RRect.fromRectAndRadius(Rect.fromLTRB(inset, axis - 1, size.width - inset, axis + 1), const Radius.circular(1)),
      Paint()..color = colors.lineStrong,
    );

    for (final s in stops) {
      final color = roadStopColor(s.kind, colors);
      final a = x(s.start);
      final b = s.end == null ? a : x(s.end!);
      switch (s.kind) {
        case RoadStopKind.registration:
          final r = RRect.fromRectAndRadius(Rect.fromLTRB(a, 12, b, 20), const Radius.circular(4));
          canvas.drawRRect(r, Paint()..color = color.withValues(alpha: 0.18));
          canvas.drawRRect(r, Paint()
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1
            ..color = color.withValues(alpha: 0.8));
        case RoadStopKind.boards:
          canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTRB(a, 26, b, 34), const Radius.circular(4)), Paint()..color = color.withValues(alpha: 0.55));
        case RoadStopKind.exam:
          canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTRB(a, axis - 6, b, axis + 6), const Radius.circular(6)), Paint()..color = color);
        case RoadStopKind.counselling:
          canvas.drawCircle(Offset(a, axis), 5, Paint()..color = colors.ground);
          canvas.drawCircle(Offset(a, axis), 5, Paint()
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1.5
            ..color = color);
      }
    }

    // Now: a paper-white disc on the line, pinned by a hairline to its word above.
    final n = x(today);
    canvas.drawRect(Rect.fromLTWH(n - 0.5, 14, 1, axis - 14 - 6), Paint()..color = colors.ink.withValues(alpha: 0.5));
    canvas.drawCircle(Offset(n, axis), 6, Paint()..color = colors.ink);
    canvas.drawCircle(Offset(n, axis), 6, Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..color = colors.ground);
    _text(canvas, TodayCopy.nowLabel, now, Offset(n, 6), alignLeft: n < 24);
  }

  static String _monthInitial(int month) => const ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'][month - 1];

  void _text(Canvas canvas, String text, TextStyle style, Offset center, {bool alignLeft = false}) {
    final tp = TextPainter(text: TextSpan(text: text, style: style), textDirection: TextDirection.ltr)..layout();
    final dx = alignLeft ? center.dx - 4 : center.dx - tp.width / 2;
    tp.paint(canvas, Offset(dx, center.dy - tp.height / 2));
    tp.dispose();
  }

  @override
  bool shouldRepaint(_RoadPainter old) => old.today != today || old.colors != colors || old.stops != stops;
}

/// The key under the line: each stop's mark and short name in pairs, then one note for the dates
/// nobody has published yet. The line above already places every stop in its months.
class RoadLegend extends StatelessWidget {
  const RoadLegend({super.key, required this.stops});

  final List<RoadStop> stops;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final label = type.caption.copyWith(fontSize: 12, height: 16 / 12, fontWeight: FontWeight.w500, color: colors.ink2);
    final expected = stops.any((s) => s.expected);
    return Semantics(
      container: true,
      label: [for (final s in stops) '${s.title}, ${s.when}'].join('. '),
      excludeSemantics: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Wrap(
            spacing: MmSpace.s16,
            runSpacing: MmSpace.s8,
            children: [
              for (final s in stops)
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _Key(kind: s.kind),
                    const SizedBox(width: MmSpace.s6),
                    Text(s.title, style: label),
                  ],
                ),
            ],
          ),
          if (expected) ...[
            const SizedBox(height: MmSpace.s8),
            Text(TodayCopy.datesExpected, style: type.caption.copyWith(fontSize: 12, height: 16 / 12, color: colors.ink3)),
          ],
        ],
      ),
    );
  }
}

/// The stops in words: the key mark, the name, the dates and "Expected" while unannounced.
class RoadStops extends StatelessWidget {
  const RoadStops({super.key, required this.stops});

  final List<RoadStop> stops;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final s in stops)
          Semantics(
            container: true,
            label: '${s.title}. ${s.when}.${s.note == null ? '' : ' ${s.note}'}',
            excludeSemantics: true,
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: MmSpace.s6),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(padding: const EdgeInsets.only(top: 5), child: _Key(kind: s.kind)),
                  const SizedBox(width: MmSpace.s12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(s.title, style: type.labelLarge),
                        Text(s.when, style: type.caption.copyWith(color: colors.ink2)),
                        if (s.note != null) Text(s.note!, style: type.caption.copyWith(color: colors.ink3)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

class _Key extends StatelessWidget {
  const _Key({required this.kind});

  final RoadStopKind kind;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final color = roadStopColor(kind, colors);
    final decoration = switch (kind) {
      RoadStopKind.registration => BoxDecoration(
          color: color.withValues(alpha: 0.18),
          border: Border.all(color: color.withValues(alpha: 0.8)),
          borderRadius: BorderRadius.circular(3),
        ),
      RoadStopKind.boards => BoxDecoration(color: color.withValues(alpha: 0.55), borderRadius: BorderRadius.circular(3)),
      RoadStopKind.exam => BoxDecoration(color: color, borderRadius: BorderRadius.circular(4)),
      RoadStopKind.counselling => BoxDecoration(shape: BoxShape.circle, border: Border.all(color: color, width: 1.5)),
    };
    return SizedBox(
      width: 16,
      height: 10,
      child: Center(
        child: SizedBox(width: kind == RoadStopKind.counselling ? 10 : 16, height: 10, child: DecoratedBox(decoration: decoration)),
      ),
    );
  }
}
