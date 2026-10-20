// The Mob's pennant (spec C2, 0.4, M8): a paper pennant on a string, cream, with a dashed stitch line
// inside its edge and a folded corner at the top right. One volt stitch for every week in a row, at most
// twelve drawn; after twelve the number says the rest. The number sits on the paper in the condensed
// figure cut with the word "weeks" under it. Volt is only the stitches, the one lit thing on the sheet.
//
// It is a still: the stitching moment (M8) is the moments agent's. The painter exposes [stitchRects] so
// the needle of that moment can ride the same marks.

import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/theme/theme.dart';
import '../copy_v3.dart';
import 'chain_paper.dart';

class ChainPennant extends StatelessWidget {
  const ChainPennant({super.key, required this.weeks, this.width = 96, this.showNext = true, this.crown = false});

  final int weeks;
  final double width;

  /// A small lamp crown at the latest stitch: the week's crown (Mob hours, someone studied the most). Still, no motion.
  final bool crown;

  /// A faint dashed mark where the next week's stitch will go.
  final bool showNext;

  static const int maxStitches = 12;
  static const double ratio = 1.46;

  /// The stitch marks, as centres in a pennant of [size], six to a row, filling left to right and row by row.
  static List<Offset> stitchCentres(Size size, int n) {
    final count = n.clamp(0, maxStitches + 1);
    final perRow = 6;
    final gapX = size.width * 0.115;
    final rowY = size.height * 0.735;
    final rowGap = size.height * 0.07;
    final out = <Offset>[];
    for (var i = 0; i < count; i++) {
      final row = i ~/ perRow;
      final inRow = math.min(perRow, count - row * perRow);
      final col = i % perRow;
      final start = size.width / 2 - gapX * (math.min(perRow, math.max(inRow, 1)) - 1) / 2;
      out.add(Offset(start + col * gapX, rowY + row * rowGap));
    }
    return out;
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final height = width * ratio;
    final drawn = weeks.clamp(0, maxStitches);
    return Semantics(
      label: '$weeks ${MobV3Copy.weeksInARow(weeks)}',
      container: true,
      child: ExcludeSemantics(
        child: SizedBox(
          width: width,
          height: height + 18,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              Positioned.fill(
                child: CustomPaint(
                  painter: _PennantPainter(
                    paper: ChainPaper.fill(context),
                    shade: ChainPaper.shade(context),
                    edge: ChainPaper.edge(context),
                    quiet: ChainPaper.inkQuiet(context),
                    volt: colors.volt,
                    voltEdge: colors.voltEdge,
                    string: colors.ink3,
                    shadow: colors.isNight ? const Color(0x66000000) : const Color(0x293B2A12),
                    stitches: drawn,
                    showNext: showNext && weeks < maxStitches,
                    night: colors.isNight,
                  ),
                ),
              ),
              if (crown && drawn > 0)
                Builder(
                  builder: (context) {
                    final at = stitchCentres(Size(width, height), drawn)[drawn - 1];
                    return Positioned(
                      key: const ValueKey('pennant-crown'),
                      left: at.dx - 7,
                      top: 18 + at.dy - 5 - 14 - 1,
                      child: Icon(LucideIcons.crown, size: 14, color: colors.lamp),
                    );
                  },
                ),
              Positioned(
                left: 0,
                right: 0,
                top: 18 + height * 0.05,
                child: MediaQuery.withNoTextScaling(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        '$weeks',
                        textHeightBehavior: MmType.figureHeightBehavior,
                        style: type.figure.copyWith(color: ChainPaper.ink, fontSize: weeks > 99 ? 40 : 52, height: 0.95),
                      ),
                      Text(MobV3Copy.weeksWord, style: type.label.copyWith(color: ChainPaper.ink, fontWeight: FontWeight.w800, fontSize: 13, height: 1.1)),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PennantPainter extends CustomPainter {
  _PennantPainter({
    required this.paper,
    required this.shade,
    required this.edge,
    required this.quiet,
    required this.volt,
    required this.voltEdge,
    required this.string,
    required this.shadow,
    required this.stitches,
    required this.showNext,
    required this.night,
  });

  final Color paper, shade, edge, quiet, volt, voltEdge, string, shadow;
  final int stitches;
  final bool showNext;
  final bool night;

  @override
  void paint(Canvas canvas, Size size) {
    const top = 18.0;
    final w = size.width;
    final h = size.height - top;
    final body = Path()
      ..moveTo(0, top)
      ..lineTo(w, top)
      ..lineTo(w, top + h * 0.8)
      ..lineTo(w / 2, top + h)
      ..lineTo(0, top + h * 0.8)
      ..close();
    // The string and its knot.
    canvas.drawLine(Offset(w / 2, 0), Offset(w / 2, top + 1), Paint()
      ..color = string
      ..strokeWidth = 1.5);
    canvas.drawCircle(Offset(w / 2, 1), 2, Paint()..color = string);
    // A soft shadow under the sheet.
    canvas.drawPath(body.shift(const Offset(0, 3)), Paint()
      ..color = shadow
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 5));
    canvas.drawPath(body, Paint()..color = paper);
    canvas.drawPath(body, Paint()
      ..color = edge
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1);
    // The folded corner.
    final fold = Path()
      ..moveTo(w - 16, top)
      ..lineTo(w, top + 16)
      ..lineTo(w - 16, top + 16)
      ..close();
    canvas.save();
    canvas.clipPath(body);
    canvas.drawPath(fold, Paint()..color = shade);
    canvas.restore();
    // The dashed stitch line inside the edge.
    final inner = Path()
      ..moveTo(6, top + 6)
      ..lineTo(w - 6, top + 6)
      ..lineTo(w - 6, top + h * 0.8 - 3)
      ..lineTo(w / 2, top + h - 9)
      ..lineTo(6, top + h * 0.8 - 3)
      ..close();
    canvas.drawPath(
      dashedPath(inner, dash: 3.5, gap: 3),
      Paint()
        ..color = quiet.withValues(alpha: 0.7)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1,
    );
    // One volt stitch for every week, a short slanted dash, twelve at most.
    final centres = ChainPennant.stitchCentres(Size(w, h), stitches + (showNext ? 1 : 0));
    for (var i = 0; i < centres.length; i++) {
      final c = centres[i].translate(0, top);
      final p = Path()
        ..moveTo(c.dx - 3.4, c.dy + 5)
        ..lineTo(c.dx + 3.4, c.dy - 5);
      if (i < stitches) {
        canvas.drawPath(p, Paint()
          ..color = volt
          ..style = PaintingStyle.stroke
          ..strokeWidth = 3.4
          ..strokeCap = StrokeCap.round);
        if (!night) {
          canvas.drawPath(p, Paint()
            ..color = voltEdge
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1.2
            ..strokeCap = StrokeCap.round);
        }
      } else {
        canvas.drawPath(
          dashedPath(p, dash: 2, gap: 2),
          Paint()
            ..color = quiet
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1.5
            ..strokeCap = StrokeCap.round,
        );
      }
    }
  }

  @override
  bool shouldRepaint(_PennantPainter old) => old.stitches != stitches || old.paper != paper || old.showNext != showNext;
}
