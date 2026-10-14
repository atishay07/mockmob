import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/storage/app_prefs.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../widgets/you_page.dart' show youText;

/// The three themes as small pictures of the app itself, side by side: Night, Daylight and
/// Match phone (the two split on a diagonal). Each is painted in its own theme's colours, so the
/// choice is seen, not read. The chosen one wears the volt rim and an inked bubble.
class ThemeTiles extends StatelessWidget {
  const ThemeTiles({super.key, required this.mode, required this.onChoose});

  final ThemeMode mode;
  final ValueChanged<ThemeChoice> onChoose;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: youText),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final (choice, themeMode, title, note) in const [
            (ThemeChoice.dark, ThemeMode.dark, YouCopy.themeDark, YouCopy.themeDarkNote),
            (ThemeChoice.light, ThemeMode.light, YouCopy.themeLight, YouCopy.themeLightNote),
            (ThemeChoice.system, ThemeMode.system, YouCopy.themeSystem, YouCopy.themeSystemNote),
          ]) ...[
            if (choice != ThemeChoice.dark) const SizedBox(width: MmSpace.s12),
            Expanded(
              child: _ThemeTile(
                title: title,
                note: note,
                night: themeMode != ThemeMode.light,
                day: themeMode != ThemeMode.dark,
                selected: mode == themeMode,
                onTap: () => onChoose(choice),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ThemeTile extends ConsumerWidget {
  const _ThemeTile({
    required this.title,
    required this.note,
    required this.night,
    required this.day,
    required this.selected,
    required this.onTap,
  });

  final String title;
  final String note;
  final bool night;
  final bool day;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    const radius = BorderRadius.all(Radius.circular(18));
    return MmPressable(
      semanticsLabel: '$title. $note',
      selected: selected,
      inMutuallyExclusiveGroup: true,
      focusRadius: radius,
      onTap: () {
        if (!selected) ref.read(hapticsProvider).selection();
        onTap();
      },
      builder: (context, pressed, _) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AspectRatio(
            aspectRatio: 0.72,
            child: DecoratedBox(
              position: DecorationPosition.foreground,
              decoration: ShapeDecoration(
                shape: mmShapeBorder(
                  radius,
                  side: BorderSide(
                    // Selected is the strongest edge on the page in both themes: a 2 dp ink border.
                    color: selected ? colors.ink : colors.line,
                    width: selected ? 2 : 1,
                  ),
                ),
              ),
              child: MmClip(
                borderRadius: radius,
                child: RepaintBoundary(child: CustomPaint(painter: _PreviewPainter(night: night, day: day))),
              ),
            ),
          ),
          const SizedBox(height: MmSpace.s12),
          // The ink rim on the picture is the one selected indicator (with the heavier title);
          // a second dot beside the name said the same thing twice.
          Text(
            title,
            style: type.labelLarge.copyWith(fontSize: 14, fontWeight: selected ? FontWeight.w700 : FontWeight.w500, color: selected ? colors.ink : colors.ink2),
          ),
          const SizedBox(height: 2),
          Text(note, style: type.caption.copyWith(fontSize: 12, height: 16 / 12, color: colors.ink3)),
        ],
      ),
    );
  }
}

/// A tiny Today: the ground with its lamp, a sheet card with the lit edge, two rows of bubbles,
/// and the dock with its volt Start. "Match phone" shows Night and Daylight split on a diagonal.
class _PreviewPainter extends CustomPainter {
  const _PreviewPainter({required this.night, required this.day});

  final bool night;
  final bool day;

  @override
  void paint(Canvas canvas, Size size) {
    if (night && day) {
      canvas.save();
      canvas.clipPath(Path()..moveTo(0, 0)..lineTo(size.width, 0)..lineTo(0, size.height)..close());
      _scene(canvas, size, MmColors.dark);
      canvas.restore();
      canvas.save();
      canvas.clipPath(Path()..moveTo(size.width, 0)..lineTo(size.width, size.height)..lineTo(0, size.height)..close());
      _scene(canvas, size, MmColors.light);
      canvas.restore();
      canvas.drawLine(
        Offset(size.width, 0),
        Offset(0, size.height),
        Paint()
          ..strokeWidth = 1
          ..color = const Color(0x40000000),
      );
    } else {
      _scene(canvas, size, night ? MmColors.dark : MmColors.light);
    }
  }

  void _scene(Canvas canvas, Size size, MmColors c) {
    final rect = Offset.zero & size;
    final w = size.width;
    final h = size.height;
    canvas.drawRect(rect, Paint()..color = c.ground);
    // The lamp in the upper left.
    canvas.drawRect(
      rect,
      Paint()
        ..shader = RadialGradient(
          center: const Alignment(-1, -1),
          radius: 1.1,
          colors: [c.lamp.withValues(alpha: c.isNight ? 0.24 : 0.16), c.lamp.withValues(alpha: 0)],
        ).createShader(rect),
    );
    // The sheet card.
    final card = RRect.fromRectAndRadius(Rect.fromLTWH(w * 0.1, h * 0.14, w * 0.8, h * 0.4), Radius.circular(w * 0.07));
    canvas.drawRRect(card, Paint()..color = c.isNight ? c.raised2 : c.raised);
    canvas.drawRRect(card, Paint()..style = PaintingStyle.stroke..strokeWidth = 0.8..color = c.line);
    final lit = Paint()
      ..strokeWidth = 1.4
      ..strokeCap = StrokeCap.round
      ..color = c.isNight ? c.volt : c.accentText;
    canvas.drawLine(Offset(w * 0.24, h * 0.14 + 0.7), Offset(w * 0.76, h * 0.14 + 0.7), lit);
    // A title line and two rows of bubbles.
    final ink = Paint()
      ..strokeWidth = h * 0.028
      ..strokeCap = StrokeCap.round
      ..color = c.ink;
    canvas.drawLine(Offset(w * 0.2, h * 0.22), Offset(w * 0.56, h * 0.22), ink);
    final bubbles = BubblePaint(c);
    final r = w * 0.045;
    for (var row = 0; row < 2; row++) {
      for (var i = 0; i < 5; i++) {
        final centre = Offset(w * 0.24 + i * w * 0.13, h * (0.33 + row * 0.1));
        final filled = row == 0 ? i < 3 : i == 1;
        bubbles.paint(canvas, centre, r, filled ? BubbleState.filled : BubbleState.hollow);
      }
    }
    // The dock and the Start circle.
    final dock = RRect.fromRectAndRadius(Rect.fromLTWH(w * 0.08, h * 0.84, w * 0.58, h * 0.09), Radius.circular(h));
    canvas.drawRRect(dock, Paint()..color = c.isNight ? c.raised2 : c.raised);
    canvas.drawRRect(dock, Paint()..style = PaintingStyle.stroke..strokeWidth = 0.8..color = c.line);
    canvas.drawCircle(Offset(w * 0.8, h * 0.885), h * 0.045, Paint()..color = c.volt);
  }

  @override
  bool shouldRepaint(_PreviewPainter old) => old.night != night || old.day != day;
}
