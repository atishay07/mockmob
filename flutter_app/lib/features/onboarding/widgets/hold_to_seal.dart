import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../copy.dart';
import 'foil_seal.dart';

/// "Hold to seal", the dominant action of the plan: a volt-rimmed pill with the foil seal at its
/// left end. While it is held the pill fills with volt from the left ([progress], which also
/// runs the light around the sheet), the seal turns a quarter and grows a ring of progress, and
/// the label says "Keep holding". Letting go early drains it. TalkBack's double tap (or a long
/// press there) seals at once.
class HoldToSeal extends StatelessWidget {
  const HoldToSeal({super.key, required this.progress, required this.onHoldStart, required this.onHoldEnd, required this.onSeal});

  final Animation<double> progress;
  final VoidCallback onHoldStart;
  final VoidCallback onHoldEnd;

  /// The accessible path: seals at once.
  final VoidCallback onSeal;

  static const double _seal = 34;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      button: true,
      label: OnboardingCopy.holdToSeal,
      onTap: onSeal,
      onLongPress: onSeal,
      excludeSemantics: true,
      // A raw listener, so the fill starts the instant a finger lands (no tap delay).
      child: Listener(
        behavior: HitTestBehavior.opaque,
        onPointerDown: (_) => onHoldStart(),
        onPointerUp: (_) => onHoldEnd(),
        onPointerCancel: (_) => onHoldEnd(),
        child: AnimatedBuilder(
          animation: progress,
          builder: (context, _) {
            final p = progress.value;
            final label = p > 0 ? OnboardingCopy.sealing : OnboardingCopy.holdToSeal;
            final text = Padding(
              padding: const EdgeInsets.only(left: _seal + MmSpace.s16),
              child: Center(child: Text(label, maxLines: 1, style: type.button.copyWith(color: colors.ink))),
            );
            return SizedBox(
              height: MmTarget.primaryKey,
              child: CustomPaint(
                painter: _HoldPainter(progress: p, colors: colors),
                // The label is drawn twice: paper ink over the empty part, volt ink over the
                // fill, split exactly at the fill line so it reads at every point.
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    text,
                    ClipRect(
                      clipper: _LeftOf(p),
                      child: Padding(
                        padding: const EdgeInsets.only(left: _seal + MmSpace.s16),
                        child: Center(child: Text(label, maxLines: 1, style: type.button.copyWith(color: colors.voltInk))),
                      ),
                    ),
                    Positioned(
                      left: (MmTarget.primaryKey - _seal) / 2,
                      top: (MmTarget.primaryKey - _seal) / 2,
                      child: CustomPaint(
                        foregroundPainter: _RingPainter(progress: p, color: colors.isNight ? colors.voltInk : colors.ink),
                        child: Transform.rotate(
                          angle: p * math.pi / 2,
                          child: Transform.scale(scale: 0.86 + 0.14 * p, child: const FoilSeal(sealed: true, size: _seal, animate: false)),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

class _HoldPainter extends CustomPainter {
  const _HoldPainter({required this.progress, required this.colors});

  final double progress;
  final MmColors colors;

  @override
  void paint(Canvas canvas, Size size) {
    final rrect = RRect.fromRectAndRadius(Offset.zero & size, Radius.circular(size.height / 2));
    final accent = colors.isNight ? colors.volt : colors.accentText;
    // A soft volt glow under the pill at rest (the owner's glass-and-light direction), so the
    // one key on the screen is the one the eye lands on; it gives way to the fill as it is held.
    if (progress < 1) {
      canvas.drawRRect(
        rrect.shift(const Offset(0, 4)),
        Paint()
          ..color = accent.withValues(alpha: (colors.isNight ? 0.22 : 0.16) * (1 - progress))
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 14),
      );
    }
    canvas.drawRRect(rrect, Paint()..color = colors.isNight ? colors.raised2 : colors.raised);
    // A wash of volt over the pill at rest, so it reads as the key; the fill grows over it.
    canvas.drawRRect(rrect, Paint()..color = accent.withValues(alpha: colors.isNight ? 0.14 : 0.10));
    // The volt rim says this is the action; the fill grows inside it.
    canvas.drawRRect(
      rrect.deflate(1),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2
        ..color = accent.withValues(alpha: 0.9),
    );
    if (progress <= 0) return;
    canvas.save();
    canvas.clipRRect(rrect);
    final w = size.height + (size.width - size.height) * progress;
    canvas.drawRRect(
      RRect.fromRectAndRadius(Rect.fromLTWH(0, 0, w, size.height), Radius.circular(size.height / 2)),
      Paint()..color = colors.volt,
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(_HoldPainter old) => old.progress != progress || old.colors != colors;
}

/// The ring of progress around the seal while it is held.
class _RingPainter extends CustomPainter {
  const _RingPainter({required this.progress, required this.color});

  final double progress;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    if (progress <= 0) return;
    final rect = (Offset.zero & size).inflate(4);
    canvas.drawArc(
      rect,
      -math.pi / 2,
      2 * math.pi * progress.clamp(0.0, 1.0),
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2
        ..strokeCap = StrokeCap.round
        ..color = color,
    );
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.progress != progress || old.color != color;
}

class _LeftOf extends CustomClipper<Rect> {
  const _LeftOf(this.fraction);

  final double fraction;

  @override
  Rect getClip(Size size) {
    final w = size.height + (size.width - size.height) * fraction;
    return Rect.fromLTWH(0, 0, fraction <= 0 ? 0 : w, size.height);
  }

  @override
  bool shouldReclip(_LeftOf old) => old.fraction != fraction;
}
