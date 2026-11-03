import 'package:flutter/material.dart';

import '../../../core/models/notification_prefs.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../copy.dart';
import 'time_sheet.dart';

/// A span of the 24-hour day as fractions of its width. A span that crosses midnight is two.
List<(double, double)> daySpans(ClockTime start, ClockTime end) {
  final s = start.minutesOfDay / 1440.0;
  final e = end.minutesOfDay / 1440.0;
  if (start == end) return const [];
  return s < e ? [(s, e)] : [(s, 1.0), (0.0, e)];
}

/// Where two sets of spans overlap.
List<(double, double)> overlapOf(
  List<(double, double)> a,
  List<(double, double)> b,
) {
  final out = <(double, double)>[];
  for (final x in a) {
    for (final y in b) {
      final lo = x.$1 > y.$1 ? x.$1 : y.$1;
      final hi = x.$2 < y.$2 ? x.$2 : y.$2;
      if (hi > lo) out.add((lo, hi));
    }
  }
  return out;
}

/// The student's day on one line: quiet hours as a neutral band, the study window as an ink bar,
/// and any overlap marked in the warning colour with a conflict line beneath. It answers "when
/// can MockMob speak?" at a glance, and the bars slide to their new times when a setting changes.
/// Everything it draws is also written below it, so colour is never the only signal.
class DayShape extends StatefulWidget {
  const DayShape({
    super.key,
    required this.quietStart,
    required this.quietEnd,
    this.window,
  });

  final ClockTime quietStart;
  final ClockTime quietEnd;
  final StudyWindow? window;

  @override
  State<DayShape> createState() => _DayShapeState();
}

class _Marks {
  const _Marks(this.qs, this.qe, this.ws, this.we);

  final double qs;
  final double qe;
  final double ws;
  final double we;

  static _Marks of(DayShape w) => _Marks(
    w.quietStart.minutesOfDay.toDouble(),
    w.quietEnd.minutesOfDay.toDouble(),
    (w.window?.start.minutesOfDay ?? 0).toDouble(),
    (w.window?.end.minutesOfDay ?? 0).toDouble(),
  );

  static _Marks lerp(_Marks a, _Marks b, double t) => _Marks(
    a.qs + (b.qs - a.qs) * t,
    a.qe + (b.qe - a.qe) * t,
    a.ws + (b.ws - a.ws) * t,
    a.we + (b.we - a.we) * t,
  );
}

class _DayShapeState extends State<DayShape>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: Motion.card,
  );
  late _Marks _from = _Marks.of(widget);
  late _Marks _to = _from;
  bool _hadWindow = false;

  @override
  void initState() {
    super.initState();
    _hadWindow = widget.window != null;
    _controller.value = 1;
  }

  @override
  void didUpdateWidget(DayShape old) {
    super.didUpdateWidget(old);
    final next = _Marks.of(widget);
    final changed =
        next.qs != _to.qs ||
        next.qe != _to.qe ||
        next.ws != _to.ws ||
        next.we != _to.we;
    if (!changed) return;
    // A study window that just appeared grows from where it will sit, not from midnight.
    final appearing = !_hadWindow && widget.window != null;
    _from = appearing
        ? _Marks(_to.qs, _to.qe, next.ws, next.we)
        : _Marks.lerp(_from, _to, _controller.value);
    _to = next;
    _hadWindow = widget.window != null;
    if (Motion.reduced(context)) {
      _controller.value = 1;
    } else {
      _controller.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  static const _ticks = [
    (0.0, '12 AM'),
    (0.25, '6 AM'),
    (0.5, '12 PM'),
    (0.75, '6 PM'),
    (1.0, '12 AM'),
  ];

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final window = widget.window;
    final quiet = daySpans(widget.quietStart, widget.quietEnd);
    final study = window == null
        ? const <(double, double)>[]
        : daySpans(window.start, window.end);
    final clash = overlapOf(quiet, study).isNotEmpty;

    final description = [
      quiet.isEmpty
          ? NotificationsCopy.dayQuietOff
          : '${NotificationsCopy.dayQuiet} ${formatClock(widget.quietStart)} to ${formatClock(widget.quietEnd)}',
      if (window != null)
        '${NotificationsCopy.dayStudy} ${formatClock(window.start)} to ${formatClock(window.end)}',
    ].join('. ');

    final labelHeight = MediaQuery.textScalerOf(context).scale(13 * 1.3);

    return Semantics(
      container: true,
      image: true,
      label: '${NotificationsCopy.dayHeading}. $description.',
      excludeSemantics: true,
      child: RepaintBoundary(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AnimatedBuilder(
              animation: _controller,
              builder: (context, _) {
                final m = _Marks.lerp(
                  _from,
                  _to,
                  Curves.easeOutCubic.transform(_controller.value),
                );
                return CustomPaint(
                  size: const Size.fromHeight(40),
                  painter: _DayPainter(
                    marks: m,
                    hasQuiet: quiet.isNotEmpty,
                    hasWindow: window != null,
                    track: colors.sunken,
                    trackBorder: colors.line,
                    quiet: colors.lineStrong,
                    study: colors.ink,
                    clash: colors.warnText,
                    ground: colors.raised,
                  ),
                );
              },
            ),
            const SizedBox(height: MmSpace.s4),
            LayoutBuilder(
              builder: (context, box) => SizedBox(
                height: labelHeight,
                width: box.maxWidth,
                child: Stack(
                  children: [
                    for (final t in _ticks)
                      Positioned(
                        left: box.maxWidth * t.$1,
                        child: FractionalTranslation(
                          translation: Offset(
                            t.$1 == 0 ? 0 : (t.$1 == 1 ? -1 : -0.5),
                            0,
                          ),
                          child: Text(
                            t.$2,
                            style: type.label.copyWith(
                              color: colors.ink3,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: MmSpace.s12),
            _LegendLine(
              swatch: _Swatch.quiet,
              text: quiet.isEmpty
                  ? NotificationsCopy.dayQuietOff
                  : '${NotificationsCopy.dayQuiet} ${formatClock(widget.quietStart)} to ${formatClock(widget.quietEnd)}',
            ),
            if (window != null) ...[
              const SizedBox(height: MmSpace.s4),
              _LegendLine(
                swatch: clash ? _Swatch.clash : _Swatch.study,
                text:
                    '${NotificationsCopy.dayStudy} ${formatClock(window.start)} to ${formatClock(window.end)}',
              ),
            ],
          ],
        ),
      ),
    );
  }
}

enum _Swatch { quiet, study, clash }

class _LegendLine extends StatelessWidget {
  const _LegendLine({required this.swatch, required this.text});

  final _Swatch swatch;
  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final color = switch (swatch) {
      _Swatch.quiet => colors.lineStrong,
      _Swatch.study => colors.ink,
      _Swatch.clash => colors.warnText,
    };
    return Row(
      children: [
        SizedBox(
          width: 20,
          height: 8,
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: color,
              borderRadius: MmRadius.pillAll,
            ),
          ),
        ),
        const SizedBox(width: MmSpace.s8),
        Expanded(
          child: Text(
            text,
            style: context.mmType.small.copyWith(color: colors.ink2),
          ),
        ),
      ],
    );
  }
}

class _DayPainter extends CustomPainter {
  _DayPainter({
    required this.marks,
    required this.hasQuiet,
    required this.hasWindow,
    required this.track,
    required this.trackBorder,
    required this.quiet,
    required this.study,
    required this.clash,
    required this.ground,
  });

  final _Marks marks;
  final bool hasQuiet;
  final bool hasWindow;
  final Color track;
  final Color trackBorder;
  final Color quiet;
  final Color study;
  final Color clash;
  final Color ground;

  List<(double, double)> _spans(double s, double e) {
    final a = s / 1440, b = e / 1440;
    if (a == b) return const [];
    return a < b ? [(a, b)] : [(a, 1.0), (0.0, b)];
  }

  @override
  void paint(Canvas canvas, Size size) {
    const barTop = 8.0;
    const barHeight = 24.0;
    final rect = RRect.fromRectAndRadius(
      Rect.fromLTWH(0, barTop, size.width, barHeight),
      const Radius.circular(12),
    );
    canvas.save();
    canvas.clipRRect(rect);
    canvas.drawRRect(rect, Paint()..color = track);

    final quietSpans = hasQuiet
        ? _spans(marks.qs, marks.qe)
        : const <(double, double)>[];
    final studySpans = hasWindow
        ? _spans(marks.ws, marks.we)
        : const <(double, double)>[];

    for (final s in quietSpans) {
      canvas.drawRect(
        Rect.fromLTRB(
          s.$1 * size.width,
          barTop,
          s.$2 * size.width,
          barTop + barHeight,
        ),
        Paint()..color = quiet,
      );
    }
    for (final s in studySpans) {
      canvas.drawRect(
        Rect.fromLTRB(
          s.$1 * size.width,
          barTop + 4,
          s.$2 * size.width,
          barTop + barHeight - 4,
        ),
        Paint()..color = study,
      );
    }
    for (final o in overlapOf(quietSpans, studySpans)) {
      canvas.drawRect(
        Rect.fromLTRB(
          o.$1 * size.width,
          barTop + 4,
          o.$2 * size.width,
          barTop + barHeight - 4,
        ),
        Paint()..color = clash,
      );
    }
    canvas.restore();
    canvas.drawRRect(
      rect.deflate(0.5),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..color = trackBorder,
    );

    // Hour marks at 6 hour steps, drawn over the bar in the sheet colour.
    final tick = Paint()
      ..color = ground
      ..strokeWidth = 1;
    for (final f in const [0.25, 0.5, 0.75]) {
      canvas.drawLine(
        Offset(size.width * f, barTop + 3),
        Offset(size.width * f, barTop + barHeight - 3),
        tick,
      );
    }
  }

  @override
  bool shouldRepaint(_DayPainter old) =>
      old.marks.qs != marks.qs ||
      old.marks.qe != marks.qe ||
      old.marks.ws != marks.ws ||
      old.marks.we != marks.we ||
      old.hasQuiet != hasQuiet ||
      old.hasWindow != hasWindow ||
      old.study != study ||
      old.quiet != quiet;
}
