import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';

/// A small stack of brass credit coins with a volt enamel face on the top one: the Wallet's own object (K6, 20 Oct:
/// the Wallet should reach the Pro page's craft). The same brass and volt as the badge tokens, and the same object in
/// Night and Day, like the tokens. Decorative: the figure beside it says the balance.
class CreditCoins extends StatelessWidget {
  const CreditCoins({super.key, this.size = 48, this.coins = 3});

  /// The object's box (square).
  final double size;

  /// How many coins high the stack is (1 to 6).
  final int coins;

  /// The stack for a pack of [credits]: taller for a bigger pack, so the packs read as sizes at a glance.
  static int forPack(int credits) => credits >= 300 ? 5 : (credits >= 150 ? 3 : 2);

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return ExcludeSemantics(
      child: RepaintBoundary(
        child: SizedBox.square(
          dimension: size,
          child: CustomPaint(painter: CreditCoinsPainter(coins: coins.clamp(1, 6), volt: colors.volt, voltEdge: colors.voltEdge, night: colors.isNight)),
        ),
      ),
    );
  }
}

class CreditCoinsPainter extends CustomPainter {
  const CreditCoinsPainter({required this.coins, required this.volt, required this.voltEdge, required this.night});

  final int coins;
  final Color volt;
  final Color voltEdge;
  final bool night;

  static const Color _brassLit = Color(0xFFF4DA97);
  static const Color _brass = Color(0xFFCB9C4A);
  static const Color _brassDeep = Color(0xFF8A6427);
  static const Color _brassEdge = Color(0xFF5E421A);

  @override
  void paint(Canvas canvas, Size size) {
    // A 24-unit box, like the choice glyphs: the coin is 18 wide, its face 6.4 tall, its edge 2.2 thick, and each
    // coin sits 2.5 above the one under it. The stack is centred in the box whatever its height.
    final unit = size.shortestSide / 24;
    const w = 18.0;
    const face = 6.4;
    const edge = 2.2;
    const step = 2.5;
    final stackHeight = face + edge + step * (coins - 1);
    final top0 = 12 - stackHeight / 2;
    canvas
      ..save()
      ..scale(unit);
    const left = (24 - w) / 2;

    // The shadow the stack throws on the desk.
    final baseY = top0 + step * (coins - 1) + face / 2 + edge;
    canvas.drawOval(
      Rect.fromCenter(center: Offset(12.6, baseY + 0.9), width: w * 1.04, height: face * 0.9),
      Paint()
        ..color = const Color(0xFF000000).withValues(alpha: night ? 0.42 : 0.2)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 1.1),
    );

    for (var i = coins - 1; i >= 0; i--) {
      final y = top0 + step * i;
      final faceRect = Rect.fromLTWH(left, y, w, face);
      // A coin a few hundredths off the line of the one under it, so the stack reads as stacked by hand.
      final nudge = math.sin(i * 1.7) * 0.35;
      canvas
        ..save()
        ..translate(nudge, 0);
      _coin(canvas, faceRect, edge, top: i == 0);
      canvas.restore();
    }
    canvas.restore();
  }

  void _coin(Canvas canvas, Rect faceRect, double edge, {required bool top}) {
    // The milled edge: the lower half of the face's oval swept down by the coin's thickness.
    final side = Path()
      ..moveTo(faceRect.left, faceRect.center.dy)
      ..arcTo(faceRect, math.pi, -math.pi, false)
      ..lineTo(faceRect.right, faceRect.center.dy + edge)
      ..arcTo(faceRect.shift(Offset(0, edge)), 0, math.pi, false)
      ..close();
    canvas.drawPath(
      side,
      Paint()
        ..isAntiAlias = true
        ..shader = ui.Gradient.linear(
          faceRect.centerLeft,
          faceRect.centerRight,
          const [_brassDeep, _brass, _brassLit, _brass, _brassDeep],
          const [0, 0.28, 0.42, 0.68, 1],
        ),
    );
    // The milling: fine dark ticks round the edge.
    final tick = Paint()
      ..color = _brassEdge.withValues(alpha: 0.35)
      ..strokeWidth = 0.22;
    for (var k = 1; k < 18; k++) {
      final a = math.pi * k / 18;
      final x = faceRect.center.dx - math.cos(a) * faceRect.width / 2;
      final yTop = faceRect.center.dy + math.sin(a) * faceRect.height / 2;
      canvas.drawLine(Offset(x, yTop + 0.3), Offset(x, yTop + edge - 0.2), tick);
    }
    canvas.drawPath(side, Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 0.3
      ..color = _brassEdge.withValues(alpha: 0.6));

    // The face: lit from the upper left.
    canvas.drawOval(
      faceRect,
      Paint()
        ..isAntiAlias = true
        ..shader = ui.Gradient.radial(
          faceRect.center.translate(-faceRect.width * 0.18, -faceRect.height * 0.25),
          faceRect.width * 0.62,
          const [_brassLit, _brass, _brassDeep],
          const [0, 0.62, 1],
        ),
    );
    canvas.drawOval(faceRect, Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 0.3
      ..color = _brassEdge.withValues(alpha: 0.55));
    // The raised rim.
    canvas.drawOval(faceRect.deflate(1.1), Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 0.35
      ..color = _brassEdge.withValues(alpha: 0.4));
    if (!top) return;
    // The top coin's volt enamel, with its darker edge so it holds on brass.
    final enamel = Rect.fromCenter(center: faceRect.center, width: faceRect.width * 0.56, height: faceRect.height * 0.5);
    canvas
      ..drawOval(enamel, Paint()..color = volt)
      ..drawOval(enamel, Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 0.35
        ..color = voltEdge)
      // The enamel's catch of light.
      ..drawOval(
        Rect.fromCenter(center: enamel.center.translate(-enamel.width * 0.16, -enamel.height * 0.18), width: enamel.width * 0.42, height: enamel.height * 0.3),
        Paint()..color = const Color(0xFFFFFFFF).withValues(alpha: 0.45),
      );
  }

  @override
  bool shouldRepaint(CreditCoinsPainter old) => old.coins != coins || old.volt != volt || old.voltEdge != voltEdge || old.night != night;
}
