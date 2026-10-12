import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../widgets/you_row.dart';

/// One option of a pick-one list: a title, a note, an optional leading picture and a check glyph
/// when chosen. Selected is the check plus a bold title, never colour alone.
class ChoiceRow extends StatelessWidget {
  const ChoiceRow({
    super.key,
    required this.title,
    required this.note,
    required this.selected,
    required this.onTap,
    this.leading,
    this.hairline = true,
  });

  final String title;
  final String note;
  final bool selected;
  final VoidCallback onTap;
  final Widget? leading;
  final bool hairline;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      inMutuallyExclusiveGroup: true,
      selected: selected,
      child: RowFrame(
        onTap: onTap,
        hairline: hairline,
        semanticsLabel: '$title. $note${selected ? '. Selected' : ''}',
        child: Row(
          children: [
            if (leading != null) ...[leading!, const SizedBox(width: MmSpace.s16)],
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: type.subhead.copyWith(fontWeight: selected ? FontWeight.w800 : FontWeight.w700)),
                  const SizedBox(height: 2),
                  Text(note, style: type.small.copyWith(color: colors.ink2)),
                ],
              ),
            ),
            const SizedBox(width: MmSpace.s8),
            SizedBox(
              width: 24,
              height: 24,
              child: selected ? Icon(LucideIcons.check, size: 22, color: colors.ink) : null,
            ),
          ],
        ),
      ),
    );
  }
}

/// A small picture of a theme: a sheet of paper on its ground, drawn in that theme's own colours.
/// "Match phone" shows the two themes split along a diagonal, so the choice is seen, not read.
class ThemeSwatch extends StatelessWidget {
  const ThemeSwatch({super.key, required this.light, required this.dark});

  /// Which halves to show. Both true draws the split.
  final bool light;
  final bool dark;

  static const double size = 40;

  @override
  Widget build(BuildContext context) {
    final lineColor = context.mmColors.lineStrong;
    return SizedBox(
      width: size,
      height: size,
      child: ExcludeSemantics(
        child: RepaintBoundary(
          child: CustomPaint(painter: _SwatchPainter(light: light, dark: dark, outline: lineColor)),
        ),
      ),
    );
  }
}

class _SwatchPainter extends CustomPainter {
  const _SwatchPainter({required this.light, required this.dark, required this.outline});

  final bool light;
  final bool dark;
  final Color outline;

  @override
  void paint(Canvas canvas, Size size) {
    final rrect = RRect.fromRectAndRadius(Offset.zero & size, const Radius.circular(MmRadius.small));
    canvas.save();
    canvas.clipRRect(rrect);
    if (light && dark) {
      _half(canvas, size, MmColors.light, Path()..moveTo(0, 0)..lineTo(size.width, 0)..lineTo(0, size.height)..close());
      _half(canvas, size, MmColors.dark, Path()..moveTo(size.width, 0)..lineTo(size.width, size.height)..lineTo(0, size.height)..close());
    } else {
      final colors = light ? MmColors.light : MmColors.dark;
      _half(canvas, size, colors, Path()..addRect(Offset.zero & size));
    }
    canvas.restore();
    canvas.drawRRect(rrect.deflate(0.5), Paint()..style = PaintingStyle.stroke..strokeWidth = 1..color = outline);
  }

  /// The ground, a raised sheet and two ink lines, clipped to [area].
  void _half(Canvas canvas, Size size, MmColors colors, Path area) {
    canvas.save();
    canvas.clipPath(area);
    canvas.drawRect(Offset.zero & size, Paint()..color = colors.ground);
    final sheet = RRect.fromRectAndRadius(
      Rect.fromLTWH(size.width * 0.2, size.height * 0.2, size.width * 0.6, size.height * 0.6),
      const Radius.circular(4),
    );
    canvas.drawRRect(sheet, Paint()..color = colors.raised);
    canvas.drawRRect(sheet, Paint()..style = PaintingStyle.stroke..strokeWidth = 1..color = colors.line);
    final ink = Paint()..color = colors.ink..strokeWidth = 2..strokeCap = StrokeCap.round;
    canvas.drawLine(Offset(size.width * 0.32, size.height * 0.4), Offset(size.width * 0.62, size.height * 0.4), ink);
    canvas.drawLine(Offset(size.width * 0.32, size.height * 0.56), Offset(size.width * 0.52, size.height * 0.56), ink..color = colors.ink3);
    canvas.restore();
  }

  @override
  bool shouldRepaint(_SwatchPainter old) => old.light != light || old.dark != dark || old.outline != outline;
}
