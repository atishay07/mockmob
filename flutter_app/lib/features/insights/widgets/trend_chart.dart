import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:go_router/go_router.dart';

import '../../../core/copy/copy.dart';
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
class TrendSection extends StatefulWidget {
  const TrendSection({super.key, required this.series});

  final List<TrendSeries> series;

  @override
  State<TrendSection> createState() => _TrendSectionState();
}

class _TrendSectionState extends State<TrendSection> with SingleTickerProviderStateMixin {
  String? _key;
  int? _picked;
  String? _drawnKey;
  late final AnimationController _draw = AnimationController(vsync: this, duration: _drawIn, value: 1);

  /// The line drawing in, left to right.
  static const Duration _drawIn = Duration(milliseconds: 500);

  static const double _chartHeight = 148;

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
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(child: Text(s.label, style: type.label.copyWith(color: colors.ink2))),
            Text(
              InsightsCopy.trendLatest(last.marks, last.maxMarks),
              style: type.cardTitle.copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
            ),
          ],
        ),
        const SizedBox(height: MmSpace.s8),
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
                  if (picked != null) _tooltip(geo, shown[picked], geo.point(picked)),
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

  /// A small glass note above the picked dot: its day, marks and paper length, and Show me.
  Widget _tooltip(_TrendGeometry geo, TrendPoint p, Offset at) {
    final colors = context.mmColors;
    final type = context.mmType;
    const width = 176.0;
    final left = (at.dx - width / 2).clamp(0.0, geo.size.width - width);
    // Above the dot when there is room, otherwise below it.
    final above = at.dy > 96;
    return Positioned(
      left: left,
      width: width,
      top: above ? null : at.dy + 14,
      bottom: above ? geo.size.height - at.dy + 14 : null,
      child: Semantics(
        container: true,
        liveRegion: true,
        child: FakeGlass(
          borderRadius: MmRadius.smallAll,
          grain: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.s12, MmSpace.s8, MmSpace.s8, 0),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(formatDayMonthShort(p.at.toLocal()), style: type.caption.copyWith(color: colors.ink2)),
                Text(
                  InsightsCopy.trendPointMarks(p.marks, p.maxMarks),
                  style: type.labelLarge.copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
                ),
                Text(InsightsCopy.trendPointPaper(p.maxMarks ~/ 5), style: type.caption.copyWith(color: colors.ink2)),
                ShowMePill(
                  semanticsLabel: InsightsCopy.showMeSessions(1),
                  onTap: () => unawaited(context.push<void>(AppRoutes.result(p.attemptId))),
                ),
              ],
            ),
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
    final grid = Paint()
      ..color = colors.line
      ..strokeWidth = 1;
    for (final v in [geo.maxV, geo.maxV / 2, 0.0]) {
      canvas.drawLine(Offset(plot.left, geo.y(v)), Offset(plot.right, geo.y(v)), grid);
      final tp = TextPainter(text: TextSpan(text: v.round().toString(), style: labelStyle), textDirection: TextDirection.ltr)..layout();
      tp.paint(canvas, Offset(0, geo.y(v) - tp.height / 2));
      tp.dispose();
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
      canvas.drawPath(
        path,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2
          ..strokeJoin = StrokeJoin.round
          ..color = colors.ink2,
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
      canvas.drawCircle(c, r + 1, Paint()..color = colors.ground);
      bubbles.paint(canvas, c, r, lastPoint || isPicked ? BubbleState.filled : BubbleState.hollow);
      if (isPicked) {
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
