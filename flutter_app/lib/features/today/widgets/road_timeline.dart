// The road to May drawn to scale (ui-blitz/today.md 2.4): a track from the start of this month to
// the month after the last stop. The stretch already travelled this month is inked up to Now;
// ahead, the groove carries one small tick per week, so the weeks are countable. The
// registration window and the boards ride as named lanes above the track, the expected CUET
// window is the one volt block at its end, flagged with its name, and a bracket spans Now to the
// next stop with how long that is. Under it, the stops as a vertical timeline: each with its
// mark, its real dates, its note and how far it is, the next one ahead marked "Next". Every
// mark is a date; nothing here predicts marks or chances.
import 'package:flutter/material.dart';

import '../../../core/copy/formatters.dart' show formatDayMonthShort;
import '../../../core/theme/theme.dart';
import '../copy.dart';
import '../logic/today_model.dart';
import 'today_entrance.dart';

class RoadTimeline extends StatelessWidget {
  const RoadTimeline({super.key, required this.today, required this.stops, required this.end});

  final DateTime today;
  final List<RoadStop> stops;

  /// The right edge, derived from the last stop (the road model's `end`).
  final DateTime end;

  static const double height = 136;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final draw = todayEnterValue(context, delay: const Duration(milliseconds: 300), length: const Duration(milliseconds: 560));
    final small = type.caption.copyWith(fontSize: 11, height: 1, fontWeight: FontWeight.w600, color: colors.ink3);
    return Semantics(
      label: 'Timeline from ${TodayCopy.nowLabel.toLowerCase()} to ${_monthName(end.subtract(const Duration(days: 1)))}',
      excludeSemantics: true,
      child: RepaintBoundary(
        child: CustomPaint(
          size: const Size(double.infinity, height),
          painter: _RoadPainter(
            today: today,
            stops: stops,
            end: end,
            colors: colors,
            draw: draw,
            label: small,
            lane: small.copyWith(color: colors.ink2),
            exam: small.copyWith(fontWeight: FontWeight.w700, color: colors.isNight ? colors.volt : colors.accentText),
            now: small.copyWith(fontWeight: FontWeight.w700, color: colors.ink),
            stretch: type.caption.copyWith(fontSize: 12, height: 1, fontWeight: FontWeight.w700, color: colors.ink),
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

/// The colour a stop is drawn in, shared by the track and the list so they read as one key.
Color roadStopColor(RoadStopKind kind, MmColors c) => switch (kind) {
      RoadStopKind.registration => c.ink3,
      RoadStopKind.boards => c.ink2,
      RoadStopKind.exam => c.isNight ? c.volt : c.accentText,
    };

/// The first stop that starts after [today], or -1.
int roadNextIndex(List<RoadStop> stops, DateTime today) => stops.indexWhere((s) => s.start.isAfter(today));

/// The road, top to bottom: the Now flag; the registration and boards lanes, each named where it
/// starts (the exam named at the right of the first lane and flagged down to its block); the
/// stretch from Now to the next stop as a bracket with how long it is; the track, with the
/// travelled ink, the weekly ticks, the Now disc and the volt exam window; then the months.
class _RoadPainter extends CustomPainter {
  _RoadPainter({
    required this.today,
    required this.stops,
    required this.end,
    required this.colors,
    required this.draw,
    required this.label,
    required this.lane,
    required this.exam,
    required this.now,
    required this.stretch,
  }) : super(repaint: draw);

  final DateTime today;
  final List<RoadStop> stops;
  final DateTime end;
  final MmColors colors;
  final Animation<double> draw;
  final TextStyle label;
  final TextStyle lane;
  final TextStyle exam;
  final TextStyle now;
  final TextStyle stretch;

  static const double _flagY = 7;
  static const double _laneTop = 26;
  static const double _laneStep = 26;
  static const double _bar = 6;
  static const double _bracketY = 86;
  static const double _trackY = 106;
  static const double _track = 10;
  static const double _monthY = 128;

  // Text is laid out once per painter (its data and theme are fixed for its life); only the
  // draw-in progress repaints.
  final Map<String, TextPainter> _texts = {};

  TextPainter _tp(String text, TextStyle style) => _texts.putIfAbsent(
        '${identityHashCode(style)}|$text',
        () => TextPainter(text: TextSpan(text: text, style: style), textDirection: TextDirection.ltr, maxLines: 1)..layout(),
      );

  @override
  void paint(Canvas canvas, Size size) {
    final start = DateTime.utc(today.year, today.month);
    final span = end.difference(start).inDays.toDouble();
    const inset = 6.0;
    final w = size.width - inset * 2;
    double x(DateTime d) => inset + w * (d.difference(start).inDays / span).clamp(0.0, 1.0);
    final t = draw.value;
    final track = RRect.fromRectAndRadius(
      Rect.fromLTRB(inset, _trackY - _track / 2, size.width - inset, _trackY + _track / 2),
      const Radius.circular(_track / 2),
    );

    // The groove.
    canvas.drawRRect(track, Paint()..color = colors.ink.withValues(alpha: colors.isNight ? 0.07 : 0.06));
    canvas.drawRRect(
      track.deflate(0.5),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..color = colors.line,
    );

    final n = x(today);
    final nextIndex = roadNextIndex(stops, today);

    // The stretch to the next stop is lit a little in the groove, so the eye goes there.
    if (nextIndex >= 0) {
      final to = x(stops[nextIndex].start);
      if (to - n > 12) {
        canvas.drawRRect(
          RRect.fromRectAndRadius(Rect.fromLTRB(n, _trackY - _track / 2, n + (to - n) * t, _trackY + _track / 2), const Radius.circular(_track / 2)),
          Paint()..color = colors.ink.withValues(alpha: colors.isNight ? 0.09 : 0.08),
        );
      }
    }

    // One tick a week from Now to the window, inside the groove: the weeks, countable.
    final windowStart = stops.where((s) => s.kind == RoadStopKind.exam).firstOrNull?.start;
    if (windowStart != null) {
      final tick = Paint()
        ..color = colors.ink.withValues(alpha: colors.isNight ? 0.26 : 0.24)
        ..strokeWidth = 1;
      for (var d = today.add(const Duration(days: 7)); d.isBefore(windowStart); d = d.add(const Duration(days: 7))) {
        final tx = x(d);
        canvas.drawLine(Offset(tx, _trackY - 2.5), Offset(tx, _trackY + 2.5), tick);
      }
    }

    // The months: a hairline and a short name for each.
    final hair = Paint()..color = colors.line;
    for (var m = start; m.isBefore(end); m = DateTime.utc(m.year, m.month + 1)) {
      final next = DateTime.utc(m.year, m.month + 1);
      if (m != start) canvas.drawRect(Rect.fromLTWH(x(m) - 0.5, _trackY + _track / 2 + 3, 1, 4), hair);
      _text(canvas, _monthShort(m.month), label, Offset((x(m) + x(next)) / 2, _monthY));
    }

    // The lanes above the track, each named where it starts; the exam window on the track.
    var row = 0;
    for (final s in stops) {
      final color = roadStopColor(s.kind, colors);
      final a = x(s.start);
      final b = s.end == null ? a + 4 : x(s.end!);
      switch (s.kind) {
        case RoadStopKind.registration || RoadStopKind.boards:
          final y = _laneTop + row * _laneStep;
          row++;
          final bar = RRect.fromRectAndRadius(Rect.fromLTRB(a, y + 8, b, y + 8 + _bar), const Radius.circular(_bar / 2));
          if (s.kind == RoadStopKind.registration) {
            canvas.drawRRect(bar, Paint()..color = color.withValues(alpha: 0.2));
            canvas.drawRRect(
              bar,
              Paint()
                ..style = PaintingStyle.stroke
                ..strokeWidth = 1
                ..color = color.withValues(alpha: 0.85),
            );
          } else {
            canvas.drawRRect(bar, Paint()..color = color.withValues(alpha: 0.6));
          }
          final name = _tp(s.kind == RoadStopKind.registration ? TodayCopy.laneRegistration : TodayCopy.laneBoards, lane);
          final lx = a + name.width > size.width ? size.width - name.width : a;
          name.paint(canvas, Offset(lx, y - name.height / 2));
        case RoadStopKind.exam:
          final block = RRect.fromRectAndRadius(Rect.fromLTRB(a, _trackY - 8, b, _trackY + 8), const Radius.circular(8));
          // The flag: the exam's name at the right of the first lane, a hairline down to it.
          final name = _tp(TodayCopy.laneExam, exam);
          final nx = (b - name.width).clamp(0.0, size.width - name.width);
          name.paint(canvas, Offset(nx, _laneTop - name.height / 2));
          final fx = (a + b) / 2;
          canvas.drawRect(Rect.fromLTWH(fx - 0.5, _laneTop + 8, 1, _trackY - 8 - _laneTop - 10), Paint()..color = color.withValues(alpha: 0.45));
          // A soft halo under the one volt mark at night, then the block.
          if (colors.isNight) canvas.drawRRect(block.inflate(4), Paint()..color = color.withValues(alpha: 0.14));
          canvas.drawRRect(block, Paint()..color = color);
      }
    }

    // The bracket from Now to the next stop, with how long that stretch is.
    if (nextIndex >= 0) {
      final next = stops[nextIndex];
      final to = x(next.start);
      if (to - n > 12) {
        final reach = n + (to - n) * t;
        final ink = Paint()
          ..color = colors.ink.withValues(alpha: 0.5)
          ..strokeWidth = 1.2
          ..strokeCap = StrokeCap.round;
        canvas.drawLine(Offset(n + 1, _bracketY), Offset(reach, _bracketY), ink);
        canvas.drawLine(Offset(reach, _bracketY - 4), Offset(reach, _bracketY + 4), ink);
        final words = _tp(TodayCopy.stretchTo(next.start.difference(today).inDays), stretch);
        final cx = ((n + to) / 2).clamp(n + 8 + words.width / 2, size.width - words.width / 2 - 2);
        final o = ((t - 0.55) / 0.45).clamp(0.0, 1.0);
        if (o > 0) {
          final pill = Rect.fromCenter(center: Offset(cx, _bracketY), width: words.width + 14, height: words.height + 8);
          canvas.saveLayer(pill.inflate(1), Paint()..color = Color.fromRGBO(0, 0, 0, o));
          canvas.drawRRect(RRect.fromRectAndRadius(pill, const Radius.circular(10)), Paint()..color = colors.ground);
          canvas.drawRRect(
            RRect.fromRectAndRadius(pill.deflate(0.5), const Radius.circular(10)),
            Paint()
              ..style = PaintingStyle.stroke
              ..strokeWidth = 1
              ..color = colors.lineStrong,
          );
          words.paint(canvas, Offset(cx - words.width / 2, _bracketY - words.height / 2));
          canvas.restore();
        }
      }
    }

    // Travelled: ink from the start of the month up to Now, drawn in on open.
    final reached = inset + (n - inset) * t;
    if (reached > inset + 1) {
      canvas.drawRRect(
        RRect.fromRectAndRadius(Rect.fromLTRB(inset, _trackY - _track / 2, reached, _trackY + _track / 2), const Radius.circular(_track / 2)),
        Paint()..color = colors.ink.withValues(alpha: colors.isNight ? 0.7 : 0.62),
      );
    }

    // Now: a paper-white disc with a soft halo, pinned by a hairline to its flag above.
    canvas.drawRect(Rect.fromLTWH(n - 0.5, _flagY + 7, 1, _trackY - _flagY - 7 - 8), Paint()..color = colors.ink.withValues(alpha: 0.45));
    canvas.drawCircle(Offset(n, _trackY), 14, Paint()..color = colors.ink.withValues(alpha: 0.1 * t));
    canvas.drawCircle(Offset(n, _trackY), 7, Paint()..color = colors.ink);
    canvas.drawCircle(
      Offset(n, _trackY),
      7,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2
        ..color = colors.ground,
    );
    _text(canvas, '${TodayCopy.nowLabel}, ${formatDayMonthShort(today)}', now, Offset(n, _flagY), alignLeft: n < 48);
  }

  static String _monthShort(int month) => _monthNames[month - 1].substring(0, 3);

  void _text(Canvas canvas, String text, TextStyle style, Offset center, {bool alignLeft = false}) {
    final tp = _tp(text, style);
    final dx = alignLeft ? center.dx - 4 : center.dx - tp.width / 2;
    tp.paint(canvas, Offset(dx, center.dy - tp.height / 2));
  }

  @override
  bool shouldRepaint(_RoadPainter old) =>
      old.today != today || old.end != end || old.colors != colors || old.stops != stops || old.draw != draw;
}

/// How far a stop is from [today]: "On now" inside it, "in 5 days" under a week, else weeks.
String roadDistance(RoadStop s, DateTime today) {
  final end = s.end ?? s.start;
  if (!today.isBefore(s.start) && !today.isAfter(end)) return TodayCopy.onNow;
  final days = s.start.difference(today).inDays;
  if (days < 7) return TodayCopy.inDays(days);
  return TodayCopy.inWeeks(days ~/ 7);
}

/// The stops as a vertical timeline: a rail with each stop's mark, its name, its dates (each
/// says "Expected" while NTA or CBSE has not published them), a note where one helps and, given
/// [today], how far it is, the first one ahead marked "Next". The mark is the key to the track.
class RoadStops extends StatelessWidget {
  const RoadStops({super.key, required this.stops, this.today});

  final List<RoadStop> stops;

  /// When given, each stop says how far it is and the next one ahead is marked.
  final DateTime? today;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    // When every date is still expected, the word is said once above the list, not on each row.
    final allExpected = stops.length > 1 && stops.every((s) => s.expected);
    final now = today;
    final next = now == null ? -1 : roadNextIndex(stops, now);
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
          const SizedBox(height: MmSpace.s8),
        ],
        for (final (i, s) in stops.indexed)
          _StopRow(
            stop: s,
            last: i == stops.length - 1,
            isNext: i == next,
            distance: now == null ? null : roadDistance(s, now),
            tagExpected: s.expected && !allExpected,
          ),
      ],
    );
  }
}

class _StopRow extends StatelessWidget {
  const _StopRow({required this.stop, required this.last, required this.isNext, required this.distance, required this.tagExpected});

  final RoadStop stop;
  final bool last;
  final bool isNext;
  final String? distance;
  final bool tagExpected;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final s = stop;
    final when = distance == null ? '' : ' ${isNext ? '${TodayCopy.nextTag}, ' : ''}${distance!}.';
    return Semantics(
      container: true,
      label: '${s.title}. ${s.expected ? '${TodayCopy.expectedTag}. ' : ''}${s.when}.${s.note == null ? '' : ' ${s.note}'}$when',
      excludeSemantics: true,
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // The rail: the stop's mark, and a hairline down to the next stop.
            SizedBox(
              width: 28,
              child: Column(
                children: [
                  const SizedBox(height: 5),
                  _Key(kind: s.kind, strong: isNext || s.kind == RoadStopKind.exam),
                  if (!last)
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Container(width: 1.5, color: colors.lineStrong),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(width: MmSpace.s8),
            Expanded(
              child: Padding(
                padding: EdgeInsets.only(bottom: last ? 0 : MmSpace.s16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Wrap(
                            spacing: MmSpace.s8,
                            runSpacing: MmSpace.s4,
                            crossAxisAlignment: WrapCrossAlignment.center,
                            children: [
                              Text(s.title, style: type.labelLarge),
                              if (tagExpected) const _ExpectedTag(),
                            ],
                          ),
                        ),
                        if (distance != null) ...[
                          const SizedBox(width: MmSpace.s8),
                          _Distance(text: distance!, next: isNext),
                        ],
                      ],
                    ),
                    Text(s.when, style: type.caption.copyWith(color: colors.ink2)),
                    if (s.note != null) Text(s.note!, style: type.caption.copyWith(color: colors.ink3)),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// "in 16 weeks", with "Next" in a small ink pill before it on the next stop ahead.
class _Distance extends StatelessWidget {
  const _Distance({required this.text, required this.next});

  final String text;
  final bool next;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final words = Text(
      text,
      style: type.caption.copyWith(color: next ? colors.ink : colors.ink2, fontWeight: next ? FontWeight.w700 : FontWeight.w500),
    );
    if (!next) return words;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        DecoratedBox(
          decoration: BoxDecoration(color: colors.ink, borderRadius: MmRadius.pillAll),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 1),
            child: Text(
              TodayCopy.nextTag,
              style: type.caption.copyWith(fontSize: 11, height: 16 / 11, fontWeight: FontWeight.w700, color: colors.ground),
            ),
          ),
        ),
        const SizedBox(width: MmSpace.s6),
        words,
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

/// The stop's mark, as it is drawn on the track: an outlined lane, a filled lane, the volt
/// window. The next stop's mark is drawn a size up.
class _Key extends StatelessWidget {
  const _Key({required this.kind, this.strong = false});

  final RoadStopKind kind;
  final bool strong;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final color = roadStopColor(kind, colors);
    final decoration = switch (kind) {
      RoadStopKind.registration => BoxDecoration(
          color: color.withValues(alpha: 0.18),
          border: Border.all(color: color.withValues(alpha: 0.8)),
          borderRadius: BorderRadius.circular(4),
        ),
      RoadStopKind.boards => BoxDecoration(color: color.withValues(alpha: 0.55), borderRadius: BorderRadius.circular(4)),
      RoadStopKind.exam => BoxDecoration(color: color, borderRadius: BorderRadius.circular(5)),
    };
    return SizedBox(
      width: strong ? 20 : 16,
      height: strong ? 12 : 10,
      child: DecoratedBox(decoration: decoration),
    );
  }
}
