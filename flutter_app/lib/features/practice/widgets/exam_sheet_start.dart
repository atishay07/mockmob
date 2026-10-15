import 'dart:math' as math;
import 'dart:ui' show lerpDouble;

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';

/// NTA mode's own start moment (owner, APK v8: "NTA mode can have something"), played where the
/// ticket's stub was once the server has said yes: the exam window's sheet slides up into place,
/// and the NTA mark comes down on its corner and settles, like a stamp on an admit card. Serious,
/// not playful: no bounce show, one settle. It runs inside the hold the ticket already has, never
/// inside the timed paper, so the paper's clock is never held back by it.
///
/// The sheet wears the exam screen's own colours (pale panel, navy header, grey option rings), the
/// same in Night and Day on purpose, as the NTA mode glyph does. [play] false rests it below,
/// unseen; true plays it once. Under reduced motion it is simply there, settled.
class ExamSheetStart extends StatefulWidget {
  const ExamSheetStart({super.key, required this.height, required this.play});

  /// The sheet's height; its width follows (a portrait sheet).
  final double height;

  /// Whether the moment has been called (the server said yes).
  final bool play;

  /// The whole moment: the slide, then the mark's settle. It ends inside the 220 ms tear plus
  /// the 260 ms hold the ticket already has after the server's yes.
  static const Duration duration = Duration(milliseconds: 420);

  /// The sheet's width for a [height].
  static double widthFor(double height) => height * 0.74;

  /// Where the sheet is (0 below and tilted, 1 in place) at moment progress [t] (0..1).
  static double slideAt(double t) => Motion.out.transform((t / 0.62).clamp(0.0, 1.0));

  /// How far the mark has come down (0 lifted and clear, 1 settled) at moment progress [t].
  static double markAt(double t) => Motion.out.transform(((t - 0.46) / 0.54).clamp(0.0, 1.0));

  @override
  State<ExamSheetStart> createState() => _ExamSheetStartState();
}

class _ExamSheetStartState extends State<ExamSheetStart> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: ExamSheetStart.duration);

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (widget.play && Motion.reduced(context)) _c.value = 1;
  }

  @override
  void didUpdateWidget(ExamSheetStart old) {
    super.didUpdateWidget(old);
    if (old.play == widget.play) return;
    if (!widget.play) {
      _c.value = 0;
    } else if (Motion.reduced(context)) {
      _c.value = 1;
    } else {
      _c.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final h = widget.height;
    // The mark's letters in the app's own face (a painter has no default font family).
    final face = context.mmType.caption;
    return SizedBox(
      width: ExamSheetStart.widthFor(h),
      height: h,
      child: RepaintBoundary(
        child: AnimatedBuilder(
          animation: _c,
          builder: (context, _) => CustomPaint(painter: ExamSheetPainter(t: _c.value, face: face)),
        ),
      ),
    );
  }
}

/// Paints the exam sheet and its mark at moment progress [t] (0..1). Pure, so goldens and tests
/// can hold any frame.
class ExamSheetPainter extends CustomPainter {
  const ExamSheetPainter({required this.t, this.face = const TextStyle()});

  final double t;

  /// The face the mark's letters are set in (size, weight and colour are the painter's).
  final TextStyle face;

  static const Color paper = Color(0xFFF1EEE6);
  static const Color navy = Color(0xFF2F4A7D);
  static const Color rule = Color(0xFFC9C4B8);
  static const Color ring = Color(0xFFA9A9A9);
  static const Color picked = Color(0xFF2E9A2E);

  @override
  void paint(Canvas canvas, Size size) {
    final s = ExamSheetStart.slideAt(t);
    final m = ExamSheetStart.markAt(t);
    final w = size.width;
    final h = size.height;
    final u = h / 100;

    // The sheet: up from below and square to the ticket.
    canvas
      ..save()
      ..translate(w / 2, h / 2 + (1 - s) * 30 * u)
      ..rotate((1 - s) * -0.09)
      ..translate(-w / 2, -h / 2);
    final sheet = RRect.fromRectAndRadius(Rect.fromLTWH(0, 0, w, h), Radius.circular(6 * u));
    final alpha = s.clamp(0.0, 1.0);
    canvas
      ..drawRRect(
        sheet.shift(Offset(0, 2.5 * u)),
        Paint()
          ..color = Colors.black.withValues(alpha: 0.18 * alpha)
          ..maskFilter = MaskFilter.blur(BlurStyle.normal, 3 * u),
      )
      ..drawRRect(sheet, Paint()..color = paper.withValues(alpha: alpha))
      ..drawRRect(
        sheet,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = math.max(0.6, 0.6 * u)
          ..color = Colors.black.withValues(alpha: 0.22 * alpha),
      );

    // The header band with its title rule.
    final header = 16 * u;
    canvas
      ..save()
      ..clipRRect(sheet)
      ..drawRect(Rect.fromLTWH(0, 0, w, header), Paint()..color = navy.withValues(alpha: alpha))
      ..restore()
      ..drawRRect(
        RRect.fromRectAndRadius(Rect.fromLTWH(6 * u, header / 2 - 1.4 * u, w * 0.46, 2.8 * u), Radius.circular(1.4 * u)),
        Paint()..color = Colors.white.withValues(alpha: 0.6 * alpha),
      );

    // The question: two grey lines, the second shorter.
    final line = Paint()..color = rule.withValues(alpha: alpha);
    for (final (y, f) in [(24.0, 0.78), (31.0, 0.52)]) {
      canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(6 * u, y * u, (w - 12 * u) * f, 3 * u), Radius.circular(1.5 * u)), line);
    }

    // Four options, each a ring and its line; nothing picked yet: the paper starts clean.
    final ringPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = math.max(0.8, 1.1 * u)
      ..color = ring.withValues(alpha: alpha);
    for (var i = 0; i < 4; i++) {
      final cy = (45 + i * 12.5) * u;
      canvas
        ..drawCircle(Offset(10 * u, cy), 3.4 * u, ringPaint)
        ..drawRRect(
          RRect.fromRectAndRadius(
            Rect.fromLTWH(17 * u, cy - 1.3 * u, (w - 23 * u) * (i.isEven ? 0.86 : 0.64), 2.6 * u),
            Radius.circular(1.3 * u),
          ),
          line,
        );
    }

    // The footer: the exam's Save and Next key, a green bar.
    canvas
      ..drawRRect(
        RRect.fromRectAndRadius(Rect.fromLTWH(w - 6 * u - w * 0.42, h - 13 * u, w * 0.42, 7 * u), Radius.circular(1.6 * u)),
        Paint()..color = picked.withValues(alpha: alpha),
      )
      ..restore();

    // The mark: lifted, large and clear at first, then down on the sheet's lower left corner.
    if (m <= 0) return;
    final r = 17 * u;
    final at = Offset(w * 0.3, h * 0.79);
    final scale = lerpDouble(1.7, 1, m)!;
    final ink = navy.withValues(alpha: 0.92 * Motion.out.transform(m));
    canvas
      ..save()
      ..translate(at.dx, at.dy)
      ..rotate(lerpDouble(-0.32, -0.16, m)!)
      ..scale(scale);
    canvas
      ..drawCircle(Offset.zero, r, Paint()..color = paper.withValues(alpha: 0.85 * m))
      ..drawCircle(
        Offset.zero,
        r,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.8 * u
          ..color = ink,
      )
      ..drawCircle(
        Offset.zero,
        r - 3.2 * u,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 0.8 * u
          ..color = ink,
      );
    final word = TextPainter(
      text: TextSpan(
        text: 'NTA',
        style: face.copyWith(color: ink, fontSize: 10.5 * u, fontWeight: FontWeight.w800, letterSpacing: 0.6 * u, height: 1),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    word.paint(canvas, Offset(-word.width / 2, -word.height / 2));
    word.dispose();
    canvas.restore();
  }

  @override
  bool shouldRepaint(ExamSheetPainter old) => old.t != t || old.face != face;
}
