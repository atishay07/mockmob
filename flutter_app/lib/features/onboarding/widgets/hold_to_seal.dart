import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../copy.dart';

/// "Hold to seal": a pill that fills with volt from the left while it is held (the seal's
/// progress, [progress], also runs the light around the sheet). Letting go early drains it. The
/// plain "Seal it" button beside it does the same in one tap, for TalkBack and anyone who would
/// rather not hold.
class HoldToSeal extends StatelessWidget {
  const HoldToSeal({super.key, required this.progress, required this.onHoldStart, required this.onHoldEnd, required this.onSeal});

  final Animation<double> progress;
  final VoidCallback onHoldStart;
  final VoidCallback onHoldEnd;

  /// The accessible path: seals at once.
  final VoidCallback onSeal;

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
            String label(double v) => v > 0 ? OnboardingCopy.sealing : OnboardingCopy.holdToSeal;
            return SizedBox(
              height: MmTarget.primaryKey,
              child: CustomPaint(
                painter: _HoldPainter(progress: p, colors: colors),
                // The label is drawn twice: paper ink over the empty part, volt ink over the
                // fill, split exactly at the fill line so it reads at every point.
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    Center(child: Text(label(p), style: type.button.copyWith(color: colors.ink))),
                    ClipRect(
                      clipper: _LeftOf(p),
                      child: Center(child: Text(label(p), style: type.button.copyWith(color: colors.voltInk))),
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
    canvas.drawRRect(rrect, Paint()..color = colors.isNight ? colors.raised2 : colors.raised);
    canvas.drawRRect(
      rrect.deflate(0.75),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5
        ..color = colors.isNight ? colors.volt.withValues(alpha: 0.7) : colors.accentText,
    );
    if (progress <= 0) return;
    canvas.save();
    canvas.clipRRect(rrect);
    canvas.drawRect(Rect.fromLTWH(0, 0, size.width * progress, size.height), Paint()..color = colors.volt);
    canvas.restore();
  }

  @override
  bool shouldRepaint(_HoldPainter old) => old.progress != progress || old.colors != colors;
}

class _LeftOf extends CustomClipper<Rect> {
  const _LeftOf(this.fraction);

  final double fraction;

  @override
  Rect getClip(Size size) => Rect.fromLTWH(0, 0, size.width * fraction, size.height);

  @override
  bool shouldReclip(_LeftOf old) => old.fraction != fraction;
}
