// The den preview of D0 (spec 5.3): the lamp-lit room, your starter Fold standing in the lamp pool and
// four dashed paper seats waiting for friends. Layers back to front: room art, a functional scrim that
// lets the art meet the ground (and, on Day, one under the header for contrast), the seats, the Fold.
// The art is the app's `scene-empty-nothing` room; the Fold comes only through FoldPuppet.

import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/theme/theme.dart';
import '../copy_v3.dart';
import '../data/mob_v3_models.dart';
import 'fold_puppet.dart';

class DenPreview extends StatelessWidget {
  const DenPreview({super.key, required this.fold, this.height = 288, this.fallbackName = ''});

  /// Your Fold (a starter on a fresh account).
  final FoldKey fold;
  final double height;
  final String fallbackName;

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final type = context.mmType;
    final art = c.isNight ? 'assets/art/scene-empty-nothing-night.webp' : 'assets/art/scene-empty-nothing-day.webp';
    return Semantics(
      container: true,
      label: MobV3Copy.denPreviewLabel,
      child: ExcludeSemantics(
        child: SizedBox(
          height: height,
          child: Stack(
            fit: StackFit.expand,
            clipBehavior: Clip.none,
            children: [
              Image.asset(art, fit: BoxFit.cover, alignment: const Alignment(-0.25, 0.1), filterQuality: FilterQuality.medium, errorBuilder: (_, _, _) => ColoredBox(color: c.sunken)),
              // The art meets the ground over its last 40%: a functional scrim, never decoration.
              Positioned(
                left: 0,
                right: 0,
                bottom: -1,
                height: height * 0.42,
                child: DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [c.ground.withValues(alpha: 0), c.ground]))),
              ),
              if (!c.isNight)
                Positioned(
                  left: 0,
                  right: 0,
                  top: 0,
                  height: 64,
                  child: DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [c.ground.withValues(alpha: 0.4), c.ground.withValues(alpha: 0)]))),
                ),
              Positioned(
                left: MmSpace.gutter,
                right: MmSpace.gutter,
                bottom: 30,
                child: LayoutBuilder(
                  builder: (context, box) {
                    // The seats share what the Fold leaves: 46 dp each when it fits, narrower on a small phone.
                    const foldW = 72.0;
                    const gaps = MmSpace.s12 + 3 * MmSpace.s8;
                    final seatW = ((box.maxWidth - foldW - gaps) / 4).clamp(34.0, 46.0);
                    return Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        SizedBox(
                          width: foldW,
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              FoldPuppet(fold: fold, size: 80, breathe: true, fallbackName: fallbackName),
                              const SizedBox(height: MmSpace.s8),
                            ],
                          ),
                        ),
                        const SizedBox(width: MmSpace.s12),
                        for (var i = 0; i < 4; i++) ...[
                          if (i > 0) const SizedBox(width: MmSpace.s8),
                          Padding(padding: const EdgeInsets.only(bottom: MmSpace.s4), child: DenOpenSeat(width: seatW)),
                        ],
                      ],
                    );
                  },
                ),
              ),
              Positioned(
                left: MmSpace.gutter,
                bottom: 6,
                child: SizedBox(width: 72, child: Center(child: Text(MobV3Copy.youTag, style: type.label.copyWith(color: c.ink, fontWeight: FontWeight.w700)))),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// A dashed paper seat: a rounded outline with a plus, waiting for a friend (D0, and the setup's den).
class DenOpenSeat extends StatelessWidget {
  const DenOpenSeat({super.key, this.width = 46, this.height = 62});

  final double width;
  final double height;

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    return CustomPaint(
      painter: _DashedSeat(color: c.ink.withValues(alpha: c.isNight ? 0.5 : 0.42), fill: c.raised.withValues(alpha: c.isNight ? 0.22 : 0.4)),
      child: SizedBox(width: width, height: height, child: Center(child: Icon(LucideIcons.plus, size: 18, color: c.ink2))),
    );
  }
}

class _DashedSeat extends CustomPainter {
  _DashedSeat({required this.color, required this.fill});

  final Color color;
  final Color fill;

  @override
  void paint(Canvas canvas, Size size) {
    final rrect = RRect.fromRectAndCorners(Offset.zero & size, topLeft: const Radius.circular(23), topRight: const Radius.circular(23), bottomLeft: const Radius.circular(12), bottomRight: const Radius.circular(12));
    canvas.drawRRect(rrect, Paint()..color = fill);
    final path = Path()..addRRect(rrect.deflate(0.75));
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5
      ..strokeCap = StrokeCap.round;
    for (final m in path.computeMetrics()) {
      const dash = 5.0;
      const gap = 4.0;
      for (var d = 0.0; d < m.length; d += dash + gap) {
        canvas.drawPath(m.extractPath(d, math.min(d + dash, m.length)), paint);
      }
    }
  }

  @override
  bool shouldRepaint(_DashedSeat old) => old.color != color || old.fill != fill;
}
