// The Mob's pennant on the den wall (spec 5.3 D1, BRAND-MOTION-KIT 6 "Streak extending"): a paper
// pennant on a string with a folded corner, the weeks figure, and one stitch per week along its foot
// (max 12 drawn). Pure paint plus two texts; the den swings it in (M1) by rotating it about the pin.
//
// Paper and ink only: the pennant is never the volt thing in the den (the primary key is).

import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../copy_v3.dart';

class Pennant extends StatelessWidget {
  const Pennant({super.key, required this.weeks, this.swing, this.width = 58, this.string = 18, this.onTap, this.semanticsLabel, this.stitch, this.crown = false});

  /// V4 den: "Chai Circle, 4 weeks in a row. Opens This week." (both streaks labelled, D173 item 6).
  /// Null keeps the chain screens' label.
  final String? semanticsLabel;

  /// V4 den: the stitches' colour (volt on the wall). Null keeps the ink stitches.
  final Color? stitch;

  /// V4 den (Mob hours, 3.6): the latest stitch carries the week's top-hours crown.
  final bool crown;

  /// The Mob chain in weeks, as the server counts it.
  final int weeks;

  /// Rotation in radians about the pin (M1 swing; M8 lift), or null for still.
  final ValueListenable<double>? swing;
  final double width;

  /// Length of the string above the pennant.
  final double string;
  final VoidCallback? onTap;

  double get height => width * 1.42 + string;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final bodyH = width * 1.42;
    final ink = PennantPaper.ink(context);
    Widget body = SizedBox(
      width: width,
      height: height,
      child: CustomPaint(
        painter: _PennantPainter(paper: PennantPaper.of(context), edge: PennantPaper.edge(context), ink: ink, string: string, weeks: weeks, night: context.mmColors.isNight, stitch: stitch, crown: crown ? context.mmColors.lamp : null),
        child: Padding(
          padding: EdgeInsets.only(top: string + bodyH * 0.12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // The figure and its word stay inside the paper at any text size (the pennant is art).
              MediaQuery.withNoTextScaling(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // A brand-new Mob has no week yet: "New Mob", never "0 weeks" (L5, 19 Oct night walk).
                    Text(
                      weeks <= 0 ? MobV3Copy.pennantNew : '$weeks',
                      style: type.figureCompact.copyWith(color: ink, fontSize: weeks <= 0 ? width * 0.36 : width * 0.5, height: weeks <= 0 ? 1.3 : 1),
                    ),
                    Text(
                      MobV3Copy.pennantWord(weeks),
                      style: type.label.copyWith(color: ink, fontSize: width * 0.19, height: 1.1, fontWeight: FontWeight.w700),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
    final turn = swing;
    if (turn != null) {
      body = ValueListenableBuilder<double>(
        valueListenable: turn,
        child: body,
        builder: (context, a, child) => Transform.rotate(angle: a, alignment: Alignment.topCenter, child: child),
      );
    }
    final semantics = semanticsLabel ?? MobV3Copy.pennantSemantics(weeks);
    if (onTap == null) {
      return Semantics(
        label: semantics,
        image: true,
        child: ExcludeSemantics(child: body),
      );
    }
    return MmPressable(onTap: onTap, semanticsLabel: semantics, pressedScale: 0.97, focusRadius: BorderRadius.circular(8), builder: (context, pressed, _) => body);
  }
}

/// The pennant's paper and ink, the same in the den and the chain screens.
abstract final class PennantPaper {
  /// V4 den: the weekly stitches in volt, deepened on the light paper so they read in both themes.
  static Color stitch(BuildContext context) => context.mmColors.isNight ? const Color(0xFFB8D400) : const Color(0xFF7FA300);

  static Color of(BuildContext context) => context.mmColors.isNight ? const Color(0xFFEDE5D3) : const Color(0xFFFFFDF8);
  static Color edge(BuildContext context) => context.mmColors.isNight ? const Color(0xFFBFB49C) : const Color(0xFFD9D0BE);
  static Color ink(BuildContext context) => const Color(0xFF1E1B15);
}

class _PennantPainter extends CustomPainter {
  _PennantPainter({required this.paper, required this.edge, required this.ink, required this.string, required this.weeks, required this.night, this.stitch, this.crown});

  final Color? stitch;
  final Color? crown;

  final Color paper;
  final Color edge;
  final Color ink;
  final double string;
  final int weeks;
  final bool night;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final top = string;
    final h = size.height - string;
    final cx = w / 2;

    // The string and the pin.
    final cord = Paint()
      ..color = night ? const Color(0x99D8CCB0) : const Color(0x995A4E3A)
      ..strokeWidth = 1.2;
    canvas.drawLine(Offset(cx, 0), Offset(cx, top + 3), cord);
    canvas.drawCircle(Offset(cx, 1.5), 2, Paint()..color = night ? const Color(0xFFB59A6A) : const Color(0xFF8C7650));

    // The body: a rectangle with a pointed foot and a folded top-right corner.
    final fold = w * 0.2;
    final shoulder = top + h * 0.72;
    final body = Path()
      ..moveTo(0, top)
      ..lineTo(w - fold, top)
      ..lineTo(w, top + fold)
      ..lineTo(w, shoulder)
      ..lineTo(cx, top + h)
      ..lineTo(0, shoulder)
      ..close();

    // A soft drop shadow on the wall, lamp from the upper left.
    canvas.drawPath(
      body.shift(const Offset(2.5, 4)),
      Paint()
        ..color = Colors.black.withValues(alpha: night ? 0.38 : 0.12)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4),
    );
    canvas.drawPath(body, Paint()..color = paper);
    // A lamp-lit top edge and a faint shade toward the foot (paper, not a gradient fill).
    canvas.save();
    canvas.clipPath(body);
    canvas.drawRect(
      Rect.fromLTWH(0, top, w, h),
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            const Color(0x00000000),
            Colors.black.withValues(alpha: night ? 0.10 : 0.05),
          ],
        ).createShader(Rect.fromLTWH(0, top, w, h)),
    );
    canvas.restore();
    canvas.drawPath(
      body,
      Paint()
        ..color = edge
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1,
    );

    // The folded corner.
    final corner = Path()
      ..moveTo(w - fold, top)
      ..lineTo(w - fold, top + fold)
      ..lineTo(w, top + fold)
      ..close();
    canvas.drawPath(corner, Paint()..color = Color.lerp(paper, edge, 0.55)!);

    // The stitched border: a dashed seam inset 4 dp.
    final seam = Paint()
      ..color = ink.withValues(alpha: 0.32)
      ..strokeWidth = 1
      ..style = PaintingStyle.stroke;
    final inset = 4.0;
    final seamPath = Path()
      ..moveTo(inset, shoulder - inset * 0.6)
      ..lineTo(cx, top + h - inset * 1.6)
      ..lineTo(w - inset, shoulder - inset * 0.6);
    _dash(canvas, seamPath, seam, 3, 2.5);

    // One stitch per week across the pennant's lower edge (the figure carries the count): a single rounded
    // diagonal dash, about 7 x 2.4 dp at 40 degrees, 11 dp apart ("/ / /"), never a cross (a row of X marks
    // reads as failed weeks). The row sits at least 4 dp above the dashed seam and below the word; as many as
    // fit there are drawn (three on the den's pennant, as in the mock-up).
    if (weeks > 0) {
      const step = 11.0;
      const len = 7.0;
      const angle = 40 * math.pi / 180;
      final dx = math.cos(angle) * len / 2;
      final dy = math.sin(angle) * len / 2;
      final seamTopY = shoulder - inset * 0.6;
      final seamTipY = top + h - inset * 1.6;
      // The seam's height at x (it runs from the edges down to the point).
      double seamAt(double x) {
        final d = math.min(x, w - x) - inset;
        return seamTopY + (seamTipY - seamTopY) * (d / (cx - inset)).clamp(0.0, 1.0);
      }
      // The figure's word ends here (see the texts' padding and sizes in build).
      final wordBottom = top + h * 0.12 + w * 0.5 + w * 0.19 * 1.1;
      var n = math.min(weeks, 4);
      var rowY = shoulder;
      var start = cx;
      while (n > 0) {
        start = cx - (n - 1) * step / 2;
        final lowest = math.min(seamAt(start - dx), seamAt(start + (n - 1) * step + dx));
        rowY = math.min(shoulder - 1.5, lowest - 4 - dy);
        if (rowY - dy >= wordBottom + 1) break;
        n--;
      }
      if (n > 0) {
        final p = Paint()
          ..color = stitch ?? ink.withValues(alpha: 0.7)
          ..strokeWidth = 2.4
          ..strokeCap = StrokeCap.round;
        for (var i = 0; i < n; i++) {
          final x = start + step * i;
          canvas.drawLine(Offset(x - dx, rowY + dy), Offset(x + dx, rowY - dy), p);
        }
        // The latest stitch carries the week's top-hours crown: a small three-point paper crown 2 dp above it,
        // clear of the seam.
        final c = crown;
        if (c != null) {
          final x = start + step * (n - 1) + dx * 0.5;
          final base = rowY - dy - 2;
          final crownPath = Path()
            ..moveTo(x - 3, base)
            ..lineTo(x - 3, base - 3.2)
            ..lineTo(x - 1.3, base - 1.6)
            ..lineTo(x, base - 4)
            ..lineTo(x + 1.3, base - 1.6)
            ..lineTo(x + 3, base - 3.2)
            ..lineTo(x + 3, base)
            ..close();
          canvas.drawPath(crownPath, Paint()..color = c);
        }
      }
    }
  }

  void _dash(Canvas canvas, Path path, Paint paint, double on, double off) {
    for (final m in path.computeMetrics()) {
      var d = 0.0;
      while (d < m.length) {
        canvas.drawPath(m.extractPath(d, math.min(d + on, m.length)), paint);
        d += on + off;
      }
    }
  }

  @override
  bool shouldRepaint(_PennantPainter old) => old.weeks != weeks || old.stitch != stitch || old.crown != crown || old.paper != paper || old.night != night || old.string != string;
}
