import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/copy/copy.dart';
import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/trend.dart';

/// Marks per session in one format, with a chip per format the student has played. A single
/// session is a point and a sentence, never a line.
///
/// Every dot is a session: the first and last are dated on the axis, and a tap on any dot opens
/// a small glass note with its day, marks and paper length, and Show me opening that session.
/// The line draws in left to right (500 ms) once per visit and again when the format changes;
/// never on a rebuild with the same data, and never under reduced motion.
class TrendSection extends ConsumerStatefulWidget {
  const TrendSection({super.key, required this.series});

  final List<TrendSeries> series;

  @override
  ConsumerState<TrendSection> createState() => _TrendSectionState();
}

class _TrendSectionState extends ConsumerState<TrendSection> with SingleTickerProviderStateMixin {
  String? _key;
  int? _picked;
  String? _drawnKey;
  late final AnimationController _draw = AnimationController(vsync: this, duration: _drawIn, value: 1);

  /// The line drawing in, left to right.
  static const Duration _drawIn = Duration(milliseconds: 600);

  static const double _chartHeight = 168;

  TrendSeries get _selected {
    for (final s in widget.series) {
      if (s.key == _key) return s;
    }
    return defaultSeries(widget.series)!;
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _maybeDraw();
  }

  @override
  void didUpdateWidget(TrendSection old) {
    super.didUpdateWidget(old);
    _maybeDraw();
  }

  /// Draws the line in when the series on screen is new to this visit.
  void _maybeDraw() {
    final s = _selected;
    final key = '${s.key}:${s.points.length}:${s.points.last.attemptId}';
    if (_drawnKey == key) return;
    _drawnKey = key;
    if (Motion.reduced(context) || s.points.length < 2) {
      _draw.value = 1;
    } else {
      _draw.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _draw.dispose();
    super.dispose();
  }

  void _select(String key) {
    ref.read(hapticsProvider).selection();
    setState(() {
      _key = key;
      _picked = null;
    });
    _maybeDraw();
  }

  List<TrendPoint> _shown(TrendSeries s) =>
      s.points.length > _TrendGeometry.maxShown ? s.points.sublist(s.points.length - _TrendGeometry.maxShown) : s.points;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final s = _selected;
    final last = s.points.last;
    final formats = widget.series.take(6).toList();
    final shown = _shown(s);
    final picked = _picked == null || _picked! >= shown.length ? null : _picked;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (formats.length > 1) ...[
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            clipBehavior: Clip.none,
            child: Row(
              children: [
                for (final f in formats) ...[
                  MmChip(label: f.label, selected: f.key == s.key, onTap: () => _select(f.key)),
                  const SizedBox(width: MmSpace.s8),
                ],
              ],
            ),
          ),
          const SizedBox(height: MmSpace.s16),
        ],
        // The latest result and its change: side by side, the change dropping under the figure when
        // large text leaves no room (a Wrap, so nothing overflows or clips).
        SizedBox(
          width: double.infinity,
          child: Wrap(
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.end,
            runSpacing: MmSpace.s8,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(s.label, style: type.label.copyWith(color: colors.ink2)),
                  const SizedBox(height: MmSpace.s4),
                  MonumentalNumber(
                    value: '${last.marks}',
                    unit: 'of ${last.maxMarks}',
                    style: type.figure,
                    semanticsLabel: InsightsCopy.trendLatest(last.marks, last.maxMarks),
                  ),
                ],
              ),
              if (s.points.length > 1) _DeltaChip(delta: last.marks - s.points[s.points.length - 2].marks),
            ],
          ),
        ),
        _readout(picked == null ? null : _note(shown[picked])),
        const SizedBox(height: MmSpace.s12),
        LayoutBuilder(
          builder: (context, box) {
            final size = Size(box.maxWidth, _chartHeight);
            final geo = _TrendGeometry(size: size, points: shown, max: s.maxMarks);
            return SizedBox(
              height: _chartHeight,
              width: double.infinity,
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  Positioned.fill(
                    child: GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTapUp: (d) {
                        final i = geo.nearest(d.localPosition);
                        ref.read(hapticsProvider).selection();
                        setState(() => _picked = i == _picked ? null : i);
                      },
                      child: AnimatedBuilder(
                        animation: _draw,
                        builder: (context, _) => CustomPaint(
                          painter: _TrendPainter(
                            geo: geo,
                            colors: colors,
                            labelStyle: type.caption.copyWith(color: colors.ink3),
                            progress: Motion.out.transform(_draw.value),
                            picked: picked,
                            describe: (i) => _describe(shown[i]),
                            onPoint: (i) => setState(() => _picked = i),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        ),
        const SizedBox(height: MmSpace.s4),
        ExcludeSemantics(
          child: Padding(
            padding: const EdgeInsets.only(left: _TrendGeometry.left),
            child: Row(
              children: [
                Text(formatDayMonthShort(shown.first.at.toLocal()), style: type.caption.copyWith(color: colors.ink2)),
                const Spacer(),
                if (shown.length > 1)
                  Text(formatDayMonthShort(shown.last.at.toLocal()), style: type.caption.copyWith(color: colors.ink2)),
              ],
            ),
          ),
        ),
        const SizedBox(height: MmSpace.s8),
        Text(
          s.points.length < 2 ? InsightsCopy.trendOnePoint : '${InsightsCopy.trendSessions(s.points.length)}. ${InsightsCopy.trendCaption}',
          style: type.caption.copyWith(color: colors.ink3),
        ),
      ],
    );
  }

  String _describe(TrendPoint p) =>
      InsightsCopy.trendPointLabel(formatDayMonthShort(p.at.toLocal()), p.marks, p.maxMarks, p.maxMarks ~/ 5);

  /// The band the readout opens in: it grows to the note and back, or just appears under reduced
  /// motion.
  Widget _readout(Widget? note) {
    final body = SizedBox(width: double.infinity, child: note == null ? null : Padding(padding: const EdgeInsets.only(top: MmSpace.s12), child: note));
    final d = Motion.of(context, Motion.ui);
    if (d == Duration.zero) return body;
    return AnimatedSize(duration: d, curve: Motion.glide, alignment: Alignment.topCenter, child: body);
  }

  /// The picked session as a readout above the chart: its day, marks and paper length, and Show me
  /// opening that session. A solid surface in its own band, so it never covers the line, the
  /// gridlines or the marks scale; it wraps at large text.
  Widget _note(TrendPoint p) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      container: true,
      liveRegion: true,
      child: DecoratedBox(
        key: const ValueKey('trend-note'),
        decoration: ShapeDecoration(
          color: colors.raised2,
          shape: mmShapeBorder(MmRadius.smallAll, side: BorderSide(color: colors.lineStrong)),
        ),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s8, MmSpace.s8, MmSpace.s8),
          child: Wrap(
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            runSpacing: MmSpace.s4,
            children: [
              Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    InsightsCopy.trendPointMarks(p.marks, p.maxMarks),
                    style: type.labelLarge.copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
                  ),
                  Text(
                    '${formatDayMonthShort(p.at.toLocal())}, ${InsightsCopy.trendPointPaper(p.maxMarks ~/ 5)}',
                    style: type.caption.copyWith(color: colors.ink2),
                  ),
                ],
              ),
              ShowMePill(
                semanticsLabel: InsightsCopy.showMeSessions(1),
                onTap: () => unawaited(context.push<void>(AppRoutes.result(p.attemptId))),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Where each session sits on the chart, shared by the painter, the taps and the note.
class _TrendGeometry {
  _TrendGeometry({required this.size, required this.points, required int max}) {
    plot = Rect.fromLTRB(left, 8, size.width - 10, size.height - 8);
    // Marks can go below zero (more wrong than a fifth of the right).
    minV = points.map((p) => p.marks).fold<int>(0, (a, b) => b < a ? b : a).toDouble();
    maxV = max.toDouble();
  }

  static const double left = 30;
  static const int maxShown = 20;

  final Size size;
  final List<TrendPoint> points;
  late final Rect plot;
  late final double minV;
  late final double maxV;

  double y(num v) => plot.bottom - (v - minV) / (maxV - minV == 0 ? 1 : maxV - minV) * plot.height;
  double x(int i) => points.length == 1 ? plot.center.dx : plot.left + plot.width * i / (points.length - 1);
  Offset point(int i) => Offset(x(i), y(points[i].marks));

  /// The session nearest a tap, by its x position.
  int nearest(Offset at) {
    var best = 0;
    var gap = double.infinity;
    for (var i = 0; i < points.length; i++) {
      final d = (x(i) - at.dx).abs();
      if (d < gap) {
        gap = d;
        best = i;
      }
    }
    return best;
  }
}

class _TrendPainter extends CustomPainter {
  _TrendPainter({
    required this.geo,
    required this.colors,
    required this.labelStyle,
    required this.progress,
    required this.picked,
    required this.describe,
    required this.onPoint,
  });

  final _TrendGeometry geo;
  final MmColors colors;
  final TextStyle labelStyle;

  /// How far the line has drawn in, 0 to 1.
  final double progress;
  final int? picked;
  final String Function(int i) describe;
  final ValueChanged<int> onPoint;

  @override
  void paint(Canvas canvas, Size size) {
    final shown = geo.points;
    final plot = geo.plot;
    final line = colors.isNight ? colors.volt : colors.accentText;
    final grid = Paint()
      ..color = colors.line.withValues(alpha: 0.7)
      ..strokeWidth = 1;
    for (final v in [geo.maxV, geo.maxV / 2, 0.0]) {
      canvas.drawLine(Offset(plot.left, geo.y(v)), Offset(plot.right, geo.y(v)), grid);
      // A midpoint that is not a whole mark (12.5) keeps its line but gets no rounded label.
      if (v != v.roundToDouble()) continue;
      final tp = TextPainter(text: TextSpan(text: v.round().toString(), style: labelStyle), textDirection: TextDirection.ltr)..layout();
      tp.paint(canvas, Offset(0, geo.y(v) - tp.height / 2));
      tp.dispose();
    }

    // The best session so far: a dashed rule and its figure, when it is not the latest one.
    if (shown.length >= 3) {
      var best = 0;
      for (var i = 1; i < shown.length; i++) {
        if (shown[i].marks > shown[best].marks) best = i;
      }
      if (best != shown.length - 1 && progress > 0.9) {
        final y = geo.y(shown[best].marks);
        final dash = Paint()
          ..color = colors.ink3.withValues(alpha: 0.7)
          ..strokeWidth = 1;
        for (var x = plot.left; x < plot.right; x += 8) {
          canvas.drawLine(Offset(x, y), Offset(math.min(x + 4, plot.right), y), dash);
        }
        final tp = TextPainter(
          text: TextSpan(text: InsightsCopy.trendBest(shown[best].marks), style: labelStyle.copyWith(color: colors.ink2, fontWeight: FontWeight.w600)),
          textDirection: TextDirection.ltr,
        )..layout();
        tp.paint(canvas, Offset(plot.right - tp.width, y - tp.height - 2));
        tp.dispose();
      }
    }

    // The line reaches across the plot as [progress] runs; each dot appears as the line gets to it.
    final reach = plot.left + plot.width * progress;
    if (shown.length > 1) {
      final path = Path()..moveTo(geo.x(0), geo.y(shown.first.marks));
      for (var i = 1; i < shown.length; i++) {
        path.lineTo(geo.x(i), geo.y(shown[i].marks));
      }
      canvas.save();
      canvas.clipRect(Rect.fromLTRB(0, 0, reach + 1, size.height));
      // The area under the line: volt at 22% at the line fading to nothing at the floor.
      final area = Path.from(path)
        ..lineTo(geo.x(shown.length - 1), plot.bottom)
        ..lineTo(geo.x(0), plot.bottom)
        ..close();
      canvas.drawPath(
        area,
        Paint()
          ..shader = LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [line.withValues(alpha: colors.isNight ? 0.26 : 0.2), line.withValues(alpha: 0)],
          ).createShader(plot),
      );
      canvas.drawPath(
        path,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2.5
          ..strokeJoin = StrokeJoin.round
          ..strokeCap = StrokeCap.round
          ..color = line,
      );
      canvas.restore();
    }
    final bubbles = BubblePaint(colors);
    for (var i = 0; i < shown.length; i++) {
      final c = geo.point(i);
      if (shown.length > 1 && c.dx > reach + 0.5) continue;
      final lastPoint = i == shown.length - 1;
      final isPicked = i == picked;
      final r = lastPoint || isPicked ? 7.0 : 4.0;
      if (lastPoint) {
        // The latest session carries a halo, the one lit point of the chart.
        canvas.drawCircle(c, r + 7, Paint()..color = line.withValues(alpha: 0.16));
        canvas.drawCircle(
          c,
          r + 4,
          Paint()
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1.2
            ..color = line.withValues(alpha: 0.55),
        );
      }
      canvas.drawCircle(c, r + 1, Paint()..color = colors.ground);
      bubbles.paint(canvas, c, r, lastPoint || isPicked ? BubbleState.filled : BubbleState.hollow);
      if (isPicked && !lastPoint) {
        canvas.drawCircle(
          c,
          r + 4,
          Paint()
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1.5
            ..color = colors.ink,
        );
      }
    }
  }

  /// One button per session for screen readers: its day, marks and length; activating it
  /// opens the note with Show me.
  @override
  SemanticsBuilderCallback get semanticsBuilder => (size) => [
        for (var i = 0; i < geo.points.length; i++)
          CustomPainterSemantics(
            rect: Rect.fromCenter(center: geo.point(i), width: 24, height: 24),
            properties: SemanticsProperties(button: true, label: describe(i), onTap: () => onPoint(i), textDirection: TextDirection.ltr),
          ),
      ];

  @override
  bool shouldRebuildSemantics(_TrendPainter old) => old.geo.points != geo.points || old.geo.size != geo.size;

  @override
  bool shouldRepaint(_TrendPainter old) =>
      old.geo.points != geo.points || old.geo.size != geo.size || old.colors != colors || old.progress != progress || old.picked != picked;
}

/// The change from the session before, in marks: a small outlined chip that says what it compares
/// to. Up is a volt ring, down is coral, level is plain; never a verdict, only the figure.
class _DeltaChip extends StatelessWidget {
  const _DeltaChip({required this.delta});

  final int delta;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final up = delta > 0, down = delta < 0;
    final tint = up ? (colors.isNight ? colors.volt : colors.accentText) : (down ? colors.wrongMark : colors.ink3);
    final text = up ? '+$delta' : (down ? '$delta' : '0');
    return Semantics(
      label: InsightsCopy.trendDeltaLabel(delta),
      excludeSemantics: true,
      child: DecoratedBox(
        decoration: ShapeDecoration(shape: StadiumBorder(side: BorderSide(color: tint.withValues(alpha: 0.6)))),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(text, style: type.cardTitle.copyWith(color: tint, height: 1.1)),
              Text(InsightsCopy.trendDeltaNote, style: type.caption.copyWith(fontSize: 11.5, height: 1.2, color: colors.ink3)),
            ],
          ),
        ),
      ),
    );
  }
}
