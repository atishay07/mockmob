import 'package:flutter/material.dart';

import '../../theme/theme.dart';

/// The `mockmob` wordmark: lowercase Bricolage (width 82, weight 700), tracking -3%, written on
/// an answer sheet: the first "o" is a bubble inked in volt, the second an empty bubble ring, so
/// the name reads as a marked answer. [hairline] (0 to 1) inks the first bubble from its centre
/// for the cold open; at 0 both bubbles are empty rings.
class Wordmark extends StatelessWidget {
  const Wordmark({super.key, this.height = 32, this.hairline = 1, this.color});

  /// Font size in dp (the cap height is about two thirds of it).
  final double height;

  /// How far the first bubble is inked, 0 to 1.
  final double hairline;
  final Color? color;

  static const String text = 'mockmob';

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final style = TextStyle(
      fontFamily: MmFonts.wordmark,
      fontWeight: FontWeight.w700,
      fontSize: height,
      height: 1,
      letterSpacing: height * -0.03,
      color: color ?? colors.ink,
      leadingDistribution: TextLeadingDistribution.even,
    );
    final painter = TextPainter(
      text: TextSpan(text: text, style: style),
      textDirection: TextDirection.ltr,
      textScaler: TextScaler.noScaling,
    )..layout();
    final size = Size(painter.width + height * 0.04, painter.height);
    painter.dispose();

    return Semantics(
      label: 'MockMob',
      excludeSemantics: true,
      child: CustomPaint(
        size: size,
        painter: WordmarkPainter(
          style: style,
          hairline: hairline,
          light: colors.isNight ? colors.volt : colors.accentText,
        ),
      ),
    );
  }
}

class WordmarkPainter extends CustomPainter {
  WordmarkPainter({required this.style, required this.hairline, required this.light});

  final TextStyle style;
  final double hairline;
  final Color light;

  static const _clear = TextStyle(color: Color(0x00000000));

  @override
  void paint(Canvas canvas, Size size) {
    // The two o's are laid out invisibly so the spacing stays the font's own, then drawn as
    // answer bubbles in their boxes.
    final tp = TextPainter(
      text: TextSpan(
        style: style,
        children: const [
          TextSpan(text: 'm'),
          TextSpan(text: 'o', style: _clear),
          TextSpan(text: 'ckm'),
          TextSpan(text: 'o', style: _clear),
          TextSpan(text: 'b'),
        ],
      ),
      textDirection: TextDirection.ltr,
      textScaler: TextScaler.noScaling,
    )..layout();
    tp.paint(canvas, Offset.zero);

    final fontSize = style.fontSize ?? 32;
    final baseline = tp.computeDistanceToActualBaseline(TextBaseline.alphabetic);
    final xHeight = fontSize * 0.527; // x-height of this cut, in em
    final cy = baseline - xHeight / 2;
    final ink = style.color ?? const Color(0xFFF4F0E6);
    final ring = (fontSize * 0.118).clamp(1.4, 8.0);

    for (final (index, filled) in const [(1, true), (5, false)]) {
      final box = tp.getBoxesForSelection(TextSelection(baseOffset: index, extentOffset: index + 1)).first.toRect();
      final r = (box.width < xHeight ? box.width : xHeight) / 2 * 1.04;
      final c = Offset(box.center.dx, cy);
      if (filled) {
        final t = hairline.clamp(0.0, 1.0);
        canvas.drawCircle(
          c,
          r - ring / 2,
          Paint()
            ..color = t >= 1 ? light : ink
            ..style = PaintingStyle.stroke
            ..strokeWidth = ring,
        );
        if (t > 0) canvas.drawCircle(c, r * t, Paint()..color = light);
      } else {
        canvas.drawCircle(
          c,
          r - ring / 2,
          Paint()
            ..color = ink
            ..style = PaintingStyle.stroke
            ..strokeWidth = ring,
        );
      }
    }
    tp.dispose();
  }

  @override
  bool shouldRepaint(WordmarkPainter old) => old.style != style || old.hairline != hairline || old.light != light;
}
