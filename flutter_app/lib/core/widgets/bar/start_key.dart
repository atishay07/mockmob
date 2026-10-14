import 'package:flutter/material.dart';

import '../../motion/motion.dart';
import '../../theme/theme.dart';

/// The volt Start key in the bar's middle slot (DOCK.md sections 3.1, 4 and 5.2): a 60 by 40
/// stadium (52 by 34 compact) that says **Start**. It is an action, not a place; it opens the
/// Start sheet. No glyph, no breathing: "something to resume" is the capsule's job, in words.
///
/// Pressed, it sinks to 0.94 in 100 ms and its volt deepens 16% toward `voltEdge`; on release
/// an ink ring spreads out of it (380 ms).
class StartKeyFace extends StatelessWidget {
  const StartKeyFace({super.key, required this.collapse, this.pressed = 0, this.ripple = 1});

  /// The bar's collapse, 0 expanded to 1 compact.
  final Animation<double> collapse;

  /// How far down the press is, 0 to 1.
  final double pressed;

  /// The ink ring after a tap, 0 to 1 (1 is gone).
  final double ripple;

  /// The key's rect inside its slot box (the bar's full 64 dp height, bottom anchored).
  static Rect keyRect(Size slot, double collapse) {
    final w = MmBar.startKey.width + (MmBar.startKeyCompact.width - MmBar.startKey.width) * collapse;
    final h = MmBar.startKey.height + (MmBar.startKeyCompact.height - MmBar.startKey.height) * collapse;
    // The compact bar is 12 dp shorter and bottom anchored, so its centre is 6 dp lower.
    final cy = slot.height / 2 + (MmBar.height - MmBar.compactHeight) / 2 * collapse;
    return Rect.fromCenter(center: Offset(slot.width / 2, cy), width: w, height: h);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final label = Text(
      'Start',
      maxLines: 1,
      textScaler: MediaQuery.textScalerOf(context).clamp(maxScaleFactor: 1.2),
      style: type.labelLarge.copyWith(
        fontFamily: MmFonts.hanken,
        fontSize: 15,
        height: 18 / 15,
        fontWeight: FontWeight.w700,
        letterSpacing: -0.1,
        color: colors.voltInk,
      ),
    );
    return CustomPaint(
      painter: _StartKeyPainter(
        collapse: collapse,
        pressed: pressed,
        ripple: ripple,
        night: colors.isNight,
        volt: colors.volt,
        voltEdge: colors.voltEdge,
        rim: colors.isNight ? colors.voltEdge : colors.accentText.withValues(alpha: 0.45),
      ),
      child: AnimatedBuilder(
        animation: collapse,
        builder: (context, child) {
          final e = collapse.value;
          return Transform.translate(
            offset: Offset(0, (MmBar.height - MmBar.compactHeight) / 2 * e),
            child: Transform.scale(scale: (1 - pressed * 0.06) * (1 - e * (1 / 15)), child: child),
          );
        },
        child: Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10),
            child: FittedBox(fit: BoxFit.scaleDown, child: label),
          ),
        ),
      ),
    );
  }
}

class _StartKeyPainter extends CustomPainter {
  _StartKeyPainter({
    required this.collapse,
    required this.pressed,
    required this.ripple,
    required this.night,
    required this.volt,
    required this.voltEdge,
    required this.rim,
  }) : super(repaint: collapse);

  final Animation<double> collapse;
  final double pressed;
  final double ripple;
  final bool night;
  final Color volt;
  final Color voltEdge;
  final Color rim;

  @override
  void paint(Canvas canvas, Size size) {
    var rect = StartKeyFace.keyRect(size, collapse.value);
    final scale = 1 - 0.06 * pressed;
    rect = Rect.fromCenter(center: rect.center, width: rect.width * scale, height: rect.height * scale);
    final rrect = RRect.fromRectAndRadius(rect, Radius.circular(rect.height / 2));

    // The bar's one lit element: a 14% volt glow pooled 6 dp beneath the key (Night only).
    if (night) {
      canvas.drawRRect(
        rrect.shift(const Offset(0, 6)),
        Paint()
          ..color = volt.withValues(alpha: 0.14)
          ..maskFilter = MaskFilter.blur(BlurStyle.normal, Shadow.convertRadiusToSigma(14)),
      );
    }
    canvas.drawRRect(rrect, Paint()..color = Color.lerp(volt, voltEdge, 0.16 * pressed)!);
    // A 1 dp rim a shade deeper, so the key reads as ink pressed into the bar.
    canvas.drawRRect(
      rrect.deflate(0.5),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..color = rim,
    );
    if (night) {
      // A 1 dp white highlight along the top.
      canvas.save();
      canvas.clipRRect(rrect);
      canvas.drawRRect(
        rrect.deflate(1),
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1
          ..shader = LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.center,
            colors: [Colors.white.withValues(alpha: 0.35), Colors.white.withValues(alpha: 0)],
          ).createShader(rect),
      );
      canvas.restore();
    }
    if (ripple < 1) {
      final t = Motion.glide.transform(ripple.clamp(0.0, 1.0));
      final grow = 14 * t;
      canvas.drawRRect(
        RRect.fromRectAndRadius(rect.inflate(grow), Radius.circular(rect.height / 2 + grow)),
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2 - 1.5 * t
          ..color = (night ? volt : voltEdge).withValues(alpha: 0.6 * (1 - t)),
      );
    }
  }

  @override
  bool shouldRepaint(_StartKeyPainter old) =>
      old.collapse != collapse ||
      old.pressed != pressed ||
      old.ripple != ripple ||
      old.night != night ||
      old.volt != volt ||
      old.voltEdge != voltEdge ||
      old.rim != rim;
}
