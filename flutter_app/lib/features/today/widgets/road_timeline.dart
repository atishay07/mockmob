// The road to May drawn to scale: one line from this month to the month after the last stop, a
// month initial under each month, "Now" where the student stands, the registration window and
// the boards as bands above the line and the expected CUET window as the one volt block. Under it, each stop in words with its real dates, which also serves as
// the key to the marks. Every mark is a date.
import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../copy.dart';
import '../logic/today_model.dart';

class RoadTimeline extends StatelessWidget {
  const RoadTimeline({super.key, required this.today, required this.stops, required this.end});

  final DateTime today;
  final List<RoadStop> stops;

  /// The right edge, derived from the last stop (the road model's `end`).
  final DateTime end;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      label: 'Timeline from ${TodayCopy.nowLabel.toLowerCase()} to ${_monthName(end.subtract(const Duration(days: 1)))}',
      excludeSemantics: true,
      child: RepaintBoundary(
        child: CustomPaint(
          size: const Size(double.infinity, 76),
          painter: _RoadPainter(
            today: today,
            stops: stops,
            end: end,
            colors: colors,
            label: type.caption.copyWith(fontSize: 11, height: 1, fontWeight: FontWeight.w600, color: colors.ink3),
            now: type.caption.copyWith(fontSize: 11, height: 1, fontWeight: FontWeight.w700, color: colors.ink),
          ),
        ),
      ),
    );
  }
}

const List<String> _monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December',
];

String _monthName(DateTime d) => '${_monthNames[d.month - 1]} ${d.year}';

/// The colour a stop is drawn in, shared by the line and the list so they read as one key.
Color roadStopColor(RoadStopKind kind, MmColors c) => switch (kind) {
      RoadStopKind.registration => c.ink3,
      RoadStopKind.boards => c.ink2,
      RoadStopKind.exam => c.isNight ? c.volt : c.accentText,
    };

class _RoadPainter extends CustomPainter {
  _RoadPainter({required this.today, required this.stops, required this.end, required this.colors, required this.label, required this.now});

  final DateTime today;
  final List<RoadStop> stops;
  final DateTime end;
  final MmColors colors;
  final TextStyle label;
  final TextStyle now;

  @override
  void paint(Canvas canvas, Size size) {
    final start = DateTime.utc(today.year, today.month);
    final span = end.difference(start).inDays.toDouble();
    const inset = 6.0;
    final w = size.width - inset * 2;
    double x(DateTime d) => inset + w * (d.difference(start).inDays / span).clamp(0.0, 1.0);
    const axis = 46.0;

    // The months: a tick and an initial for each.
    final tick = Paint()..color = colors.line;
    for (var m = start; m.isBefore(end); m = DateTime.utc(m.year, m.month + 1)) {
      final next = DateTime.utc(m.year, m.month + 1);
      canvas.drawRect(Rect.fromLTWH(x(m), axis - 3, 1, 6), tick);
      _text(canvas, _monthShort(m.month), label, Offset((x(m) + x(next)) / 2, axis + 16));
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

  static String _monthShort(int month) => _monthNames[month - 1].substring(0, 3);

  void _text(Canvas canvas, String text, TextStyle style, Offset center, {bool alignLeft = false}) {
    final tp = TextPainter(text: TextSpan(text: text, style: style), textDirection: TextDirection.ltr)..layout();
    final dx = alignLeft ? center.dx - 4 : center.dx - tp.width / 2;
    tp.paint(canvas, Offset(dx, center.dy - tp.height / 2));
    tp.dispose();
  }

  @override
  bool shouldRepaint(_RoadPainter old) => old.today != today || old.end != end || old.colors != colors || old.stops != stops;
}

/// The stops in words: the key mark, the name, the dates (each says "Expected" while NTA or CBSE
/// has not published them) and a note where one helps. The mark is the key to the line above.
class RoadStops extends StatelessWidget {
  const RoadStops({super.key, required this.stops});

  final List<RoadStop> stops;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    // When every date is still expected, the word is said once above the list, not on each row.
    final allExpected = stops.length > 1 && stops.every((s) => s.expected);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (allExpected) ...[
          Semantics(
            container: true,
            label: TodayCopy.expectedDates,
            excludeSemantics: true,
            child: Text(TodayCopy.expectedDates, style: type.caption.copyWith(color: colors.ink3, fontWeight: FontWeight.w600)),
          ),
          const SizedBox(height: MmSpace.s4),
        ],
        for (final s in stops)
          Semantics(
            container: true,
            label: '${s.title}. ${s.expected ? '${TodayCopy.expectedTag}. ' : ''}${s.when}.${s.note == null ? '' : ' ${s.note}'}',
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
                        Wrap(
                          spacing: MmSpace.s8,
                          runSpacing: MmSpace.s4,
                          crossAxisAlignment: WrapCrossAlignment.center,
                          children: [
                            Text(s.title, style: type.labelLarge),
                            if (s.expected && !allExpected) const _ExpectedTag(),
                          ],
                        ),
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

/// "Expected": the stop's date is not published yet. The same sunken pill the practice chips use.
class _ExpectedTag extends StatelessWidget {
  const _ExpectedTag();

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.sunken,
        borderRadius: MmRadius.pillAll,
        border: Border.all(color: colors.line),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.s8, vertical: 2),
        child: Text(TodayCopy.expectedTag, style: context.mmType.caption.copyWith(color: colors.ink2), maxLines: 1, softWrap: false),
      ),
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
    };
    return SizedBox(
      width: 16,
      height: 10,
      child: Center(
        child: SizedBox(width: 16, height: 10, child: DecoratedBox(decoration: decoration)),
      ),
    );
  }
}
