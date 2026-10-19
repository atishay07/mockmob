// Paper and stationery for the run (BRAND-MOTION-KIT 1, 2 and 5): the paper colours of the design
// packs (no new hues: they are the packs' paper, read beside the app tokens), the bulldog-style paper
// clip that drops on a locked option (M4), the tick that draws along a right option's edge (M5,
// `PathMetric`), and the small paper stamp for "Three in a row" (M5, once per run).

import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/physics.dart';

import '../../../../core/motion/springs.dart';
import '../../../../core/theme/theme.dart';
import 'paper_particles.dart' show drawGlint;

/// The packs' paper (design-live prototype `--paper*`, `--wall`, `--grid`), Night and Day.
class RunPaper {
  const RunPaper._(this.night);

  factory RunPaper.of(BuildContext context) => context.mmColors.isNight ? const RunPaper._(true) : const RunPaper._(false);

  final bool night;

  Color get paper => night ? const Color(0xFFEDE5D3) : const Color(0xFFFFFDF8);
  Color get paperInk => night ? const Color(0xFF1E1B15) : const Color(0xFF17150F);
  Color get paperInk2 => const Color(0xFF5C5545);
  Color get paperLine => night ? const Color(0xFFCFC5AF) : const Color(0xFFE2DACB);
  Color get paperEdge => night ? const Color(0xFFBDB29C) : const Color(0xFFCFC6B4);

  /// The desk wall behind the ruler.
  Color get wall => night ? const Color(0xFF171511) : const Color(0xFFECE5D6);

  /// Graph paper at about 4% ink.
  Color get grid => night ? const Color(0x09F4F0E6) : const Color(0x0C17150F);

  /// The lamp pool (26% Night, 17% Day; spec 5.4).
  Color get lampPool => night ? const Color(0xFFF2A93B).withValues(alpha: 0.30) : const Color(0xFFF2C46B).withValues(alpha: 0.22);

  /// A filled ruler number (a question you answered).
  Color get doneTag => const Color(0xFF1E1B15);
  Color get doneTagInk => const Color(0xFFFFFDF8);

  /// Clip steel.
  Color get clip => const Color(0xFF8F8A80);
  Color get clipShine => const Color(0xFFE9E4D8);
}

/// The paper clip (design-live `clipSVG`, 14 by 30): a bent wire with a light edge.
class PaperClipPainter extends CustomPainter {
  const PaperClipPainter({required this.steel, required this.shine});

  final Color steel;
  final Color shine;

  static const Size box = Size(14, 30);

  Path _wire(Size s) {
    final k = s.width / 14;
    return Path()
      ..moveTo(4 * k, 9 * k)
      ..lineTo(4 * k, 5 * k)
      ..arcToPoint(Offset(10 * k, 5 * k), radius: Radius.circular(3 * k))
      ..lineTo(10 * k, 22 * k)
      ..arcToPoint(Offset(0, 22 * k), radius: Radius.circular(5 * k))
      ..lineTo(0, 9 * k);
  }

  @override
  void paint(Canvas canvas, Size size) {
    final k = size.width / 14;
    final p = _wire(size).shift(Offset(1.2 * k, 0));
    canvas.drawPath(
      p,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.2 * k
        ..strokeCap = StrokeCap.round
        ..color = steel,
    );
    canvas.drawPath(
      p.shift(Offset(-0.6 * k, -0.4 * k)),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 0.8 * k
        ..strokeCap = StrokeCap.round
        ..color = shine,
    );
  }

  @override
  bool shouldRepaint(PaperClipPainter old) => old.steel != steel || old.shine != shine;
}

/// The tick that draws itself along its path (drawIn 450): [progress] 0 to 1.
class DrawnTickPainter extends CustomPainter {
  DrawnTickPainter({required this.progress, required this.colour}) : super(repaint: progress);

  final Animation<double> progress;
  final Color colour;

  @override
  void paint(Canvas canvas, Size size) {
    final t = progress.value.clamp(0.0, 1.0);
    if (t <= 0) return;
    final k = size.width / 24;
    final path = Path()
      ..moveTo(5 * k, 12.5 * k)
      ..lineTo(9.5 * k, 17 * k)
      ..lineTo(19 * k, 7.5 * k);
    final out = Path();
    for (final m in path.computeMetrics()) {
      out.addPath(m.extractPath(0, m.length * t), Offset.zero);
    }
    canvas.drawPath(
      out,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3 * k
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round
        ..color = colour,
    );
  }

  @override
  bool shouldRepaint(DrawnTickPainter old) => old.colour != colour;
}

/// A small paper stamp: lands 1.4 to 1 on `celebrate` with a 2 degree settle and 4 glints (M5, at
/// exactly three right in a row, once per run). [t] is the time since it started, in ms; reduced
/// motion draws it at rest.
class PaperStamp extends StatelessWidget {
  const PaperStamp({super.key, required this.label, required this.t, this.reduced = false});

  final String label;
  final double t;
  final bool reduced;

  static final SpringSimulation _land = SpringSimulation(Springs.celebrate, 1.4, 1, 0);

  @override
  Widget build(BuildContext context) {
    final paper = RunPaper.of(context);
    final type = context.mmType;
    final sec = (t / 1000).clamp(0.0, 2.0);
    final scale = reduced ? 1.0 : _land.x(sec);
    final opacity = reduced ? (t / 120).clamp(0.0, 1.0) : (t / 60).clamp(0.0, 1.0);
    // The 2 degree settle: tilted on landing, swinging out to rest.
    final tilt = reduced ? -2.0 : -2.0 + 2.0 * math.exp(-sec * 7) * math.cos(sec * 22);
    final face = CustomPaint(
      painter: _StampEdgePainter(paper: paper.paper, line: paper.paperLine, edge: paper.paperEdge),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 9),
        child: Text(label, style: type.label.copyWith(color: paper.paperInk, fontWeight: FontWeight.w800, height: 1.2)),
      ),
    );
    return Opacity(
      opacity: opacity,
      child: Transform.rotate(
        angle: tilt * math.pi / 180,
        child: Transform.scale(
          scale: scale,
          child: CustomPaint(
            foregroundPainter: reduced ? null : _GlintRing(t: t),
            child: face,
          ),
        ),
      ),
    );
  }
}

class _StampEdgePainter extends CustomPainter {
  const _StampEdgePainter({required this.paper, required this.line, required this.edge});

  final Color paper;
  final Color line;
  final Color edge;

  @override
  void paint(Canvas canvas, Size size) {
    final r = RRect.fromRectAndRadius(Offset.zero & size, const Radius.circular(8));
    canvas.drawShadow(Path()..addRRect(r), const Color(0xFF000000), 3, false);
    canvas.drawRRect(r, Paint()..color = paper);
    canvas.drawRRect(r, Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1
      ..color = edge);
    // The inked inner border of a rubber stamp, dashed.
    final inner = RRect.fromRectAndRadius((Offset.zero & size).deflate(3), const Radius.circular(6));
    final path = Path()..addRRect(inner);
    final dash = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.1
      ..color = line;
    for (final m in path.computeMetrics()) {
      for (var d = 0.0; d < m.length; d += 5) {
        canvas.drawPath(m.extractPath(d, math.min(d + 3, m.length)), dash);
      }
    }
    // One folded corner.
    final c = Path()
      ..moveTo(size.width - 9, 0)
      ..lineTo(size.width, 9)
      ..lineTo(size.width - 9, 9)
      ..close();
    canvas.drawPath(c, Paint()..color = line);
  }

  @override
  bool shouldRepaint(_StampEdgePainter old) => old.paper != paper || old.line != line || old.edge != edge;
}

/// Four glints around a stamp, each twinkling once between 80 and 680 ms.
class _GlintRing extends CustomPainter {
  const _GlintRing({required this.t});

  final double t;

  @override
  void paint(Canvas canvas, Size size) {
    const spots = [Offset(-0.12, -0.2), Offset(1.1, -0.15), Offset(1.06, 1.2), Offset(-0.08, 1.15)];
    for (var i = 0; i < spots.length; i++) {
      final local = (t - 80 - i * 60) / 520;
      if (local <= 0 || local >= 1) continue;
      final k = math.sin(local * math.pi);
      final c = Offset(spots[i].dx * size.width, spots[i].dy * size.height);
      drawGlint(canvas, c, 5 * k, const Color(0xFFFFF4D6).withValues(alpha: 0.95 * k));
    }
  }

  @override
  bool shouldRepaint(_GlintRing old) => old.t != t;
}

/// A dashed ellipse or line helper shared by the ruler's flag outline.
void drawDashedPath(Canvas canvas, Path path, Paint paint, {double dash = 3, double gap = 2}) {
  for (final ui.PathMetric m in path.computeMetrics()) {
    for (var d = 0.0; d < m.length; d += dash + gap) {
      canvas.drawPath(m.extractPath(d, math.min(d + dash, m.length)), paint);
    }
  }
}
