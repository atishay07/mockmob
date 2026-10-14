import 'dart:math' as math;

import 'package:flutter/widgets.dart';

import '../../motion/motion.dart';
import '../../theme/theme.dart';

/// The bar's four custom icons (DOCK.md section 4): 24 dp, 1.75 dp strokes with round caps, on
/// a 2 dp grid. Each holds an answer bubble that inks when its tab is active (the "green dot",
/// now part of the icon instead of floating behind it).
enum BarIconKind { today, practice, review, you }

/// The colours an icon is drawn with.
@immutable
class BarIconColors {
  const BarIconColors({required this.idle, required this.active, required this.fill, required this.onFill, this.rim});

  /// Outline at rest (ink 2).
  final Color idle;

  /// Outline when active (ink).
  final Color active;

  /// The inked bubble (volt).
  final Color fill;

  /// What is drawn over the inked bubble: Review's tick, You's initial (`voltInk`).
  final Color onFill;

  /// Daylight's 1 dp rim around the inked bubble (`#526700`), null on Night.
  final Color? rim;

  factory BarIconColors.of(MmColors colors) => BarIconColors(
    idle: colors.ink2,
    active: colors.ink,
    fill: colors.volt,
    onFill: colors.voltInk,
    rim: colors.isNight ? null : colors.accentText,
  );

  @override
  bool operator ==(Object other) =>
      other is BarIconColors && other.idle == idle && other.active == active && other.fill == fill && other.onFill == onFill && other.rim == rim;

  @override
  int get hashCode => Object.hash(idle, active, fill, onFill, rim);
}

/// Paints one bar icon.
///
/// [on] (0 to 1) moves the outline from idle to active ink; [ink] (0 to 1) fills the bubble with
/// a circular mask that grows from [inkFrom] (-1 the left side, 1 the right: the side the lens
/// came from); [tick] (0 to 1) draws Review's tick. Every value is a listenable, so a frame of
/// motion repaints this icon alone and never rebuilds the bar.
class BarIconPainter extends CustomPainter {
  BarIconPainter({
    required this.kind,
    required this.colors,
    required this.on,
    required this.ink,
    required this.tick,
    required this.inkFrom,
    this.initial,
    this.initialStyle,
  }) : super(repaint: Listenable.merge([on, ink, tick, inkFrom]));

  final BarIconKind kind;
  final BarIconColors colors;
  final Animation<double> on;
  final Animation<double> ink;
  final Animation<double> tick;
  final ValueNotifier<double> inkFrom;

  /// You's initial (null draws Mobi's visor).
  final String? initial;
  final TextStyle? initialStyle;

  static const double stroke = 1.75;

  /// The answer bubble's centre and radius on the 24 dp grid.
  static (Offset, double) bubbleOf(BarIconKind kind) => switch (kind) {
    BarIconKind.today => (const Offset(12, 15), 4),
    BarIconKind.practice => (const Offset(7, 17), 4),
    BarIconKind.review => (const Offset(8, 14), 4),
    BarIconKind.you => (const Offset(12, 12), 8),
  };

  final List<TextPainter?> _texts = [null, null];

  /// The initial, laid out once per colour slot (0 the outline, 1 voltInk). The outline slot is
  /// laid out again only while the outline colour cross-fades (160 ms on a tab change).
  TextPainter _textFor(String name, Color color, int slot) {
    final cached = _texts[slot];
    if (cached != null && cached.text!.style!.color == color) return cached;
    cached?.dispose();
    return _texts[slot] = TextPainter(
      text: TextSpan(
        text: name,
        style: (initialStyle ?? const TextStyle(fontSize: 11, fontWeight: FontWeight.w700)).copyWith(height: 1, color: color),
      ),
      textDirection: TextDirection.ltr,
      textScaler: TextScaler.noScaling,
    )..layout();
  }

  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    canvas.scale(size.width / 24, size.height / 24);
    final outline = Color.lerp(colors.idle, colors.active, on.value.clamp(0.0, 1.0))!;
    final line = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..color = outline;
    final (center, r) = bubbleOf(kind);

    switch (kind) {
      case BarIconKind.today:
        // The ruled baseline, broken where the sun sits on it.
        canvas.drawLine(const Offset(3, 19), const Offset(7, 19), line);
        canvas.drawLine(const Offset(17, 19), const Offset(21, 19), line);
        // Two short rays above the low sun.
        for (final side in const [-1.0, 1.0]) {
          final a = -math.pi / 2 + side * 0.72;
          final d = Offset(math.cos(a), math.sin(a));
          canvas.drawLine(center + d * 6.6, center + d * 8.9, line);
        }
      case BarIconKind.practice:
        // A pencil at 45 degrees, its tip touching the bubble.
        canvas.save();
        canvas.translate(10.4, 13.6);
        canvas.rotate(-math.pi / 4);
        final pencil = Path()
          ..moveTo(0, 0)
          ..lineTo(4.2, -2.4)
          ..lineTo(12.6, -2.4)
          ..arcToPoint(const Offset(12.6, 2.4), radius: const Radius.circular(2.4))
          ..lineTo(4.2, 2.4)
          ..close();
        canvas.drawPath(pencil, line);
        canvas.drawLine(const Offset(4.2, -2.4), const Offset(4.2, 2.4), line);
        canvas.restore();
      case BarIconKind.review:
        break;
      case BarIconKind.you:
        break;
    }

    // The bubble: its outline, then the ink growing from the lens's side.
    final e = Motion.glide.transform(ink.value.clamp(0.0, 1.0));
    final fillR = r + stroke / 2;
    if (e < 1) canvas.drawCircle(center, r, line);
    Path? inked;
    if (e > 0) {
      final from = center + Offset(inkFrom.value * r, 0);
      final mask = Path()..addOval(Rect.fromCircle(center: from, radius: 2 * fillR * e + 0.01));
      final disc = Path()..addOval(Rect.fromCircle(center: center, radius: fillR));
      inked = Path.combine(PathOperation.intersect, disc, mask);
      canvas.drawPath(inked, Paint()..color = colors.fill);
      final rim = colors.rim;
      if (rim != null) {
        canvas.save();
        canvas.clipPath(inked);
        canvas.drawCircle(
          center,
          fillR - 0.5,
          Paint()
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1
            ..color = rim,
        );
        canvas.restore();
      }
    }

    switch (kind) {
      case BarIconKind.review:
        // A tick across the bubble, out to the upper right: drawn in the outline, and in
        // voltInk where it crosses the inked bubble.
        final path = Path()
          ..moveTo(5.4, 14.2)
          ..lineTo(7.7, 16.6)
          ..lineTo(19.6, 5.2);
        // The outline tick stays whole; the voltInk stroke draws across the inked bubble.
        canvas.drawPath(path, line);
        if (inked != null) {
          final t = tick.value.clamp(0.0, 1.0);
          canvas.save();
          canvas.clipPath(inked);
          canvas.drawPath(t >= 1 ? path : _partial(path, t), Paint.from(line)..color = colors.onFill);
          canvas.restore();
        }
      case BarIconKind.you:
        _paintYou(canvas, center, outline, inked);
      case BarIconKind.today:
      case BarIconKind.practice:
        break;
    }
    canvas.restore();
  }

  void _paintYou(Canvas canvas, Offset center, Color outline, Path? inked) {
    void mark(Color color, int slot) {
      final name = initial;
      if (name == null || name.isEmpty) {
        // Mobi's visor.
        canvas.drawRRect(
          RRect.fromRectAndRadius(Rect.fromCenter(center: center.translate(0, -0.5), width: 9, height: 4.5), const Radius.circular(2.25)),
          Paint()..color = color,
        );
        return;
      }
      final text = _textFor(name, color, slot);
      text.paint(canvas, center - Offset(text.width / 2, text.height / 2));
    }

    mark(outline, 0);
    if (inked != null) {
      canvas.save();
      canvas.clipPath(inked);
      mark(colors.onFill, 1);
      canvas.restore();
    }
  }

  static Path _partial(Path path, double t) {
    final out = Path();
    if (t <= 0) return out;
    final metrics = path.computeMetrics().toList();
    final total = metrics.fold<double>(0, (n, m) => n + m.length);
    var left = total * t;
    for (final m in metrics) {
      if (left <= 0) break;
      out.addPath(m.extractPath(0, math.min(left, m.length)), Offset.zero);
      left -= m.length;
    }
    return out;
  }

  @override
  bool shouldRepaint(BarIconPainter old) =>
      old.kind != kind ||
      old.colors != colors ||
      old.on != on ||
      old.ink != ink ||
      old.tick != tick ||
      old.inkFrom != inkFrom ||
      old.initial != initial ||
      old.initialStyle != initialStyle;
}
