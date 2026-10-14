import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/bubbles/bubble_painter.dart';
import '../../../core/widgets/surfaces/mm_surface.dart' show MmRow;

/// Which tool a hub row draws for itself.
enum ToolArtKind {
  /// Combo planner: a small answer sheet, one bubble inked in each row (the papers you pick).
  combo,

  /// CUET 2027 guide: a timeline mark: a passed bubble, the one you are in, one still to come.
  guide,
}

/// A 36 dp well with a code-drawn mark for one tool, in the room's own bubbles. Static: it
/// says what the tool is, it carries no number.
class ToolArt extends StatelessWidget {
  const ToolArt(this.kind, {super.key});

  final ToolArtKind kind;

  /// The mark is drawn on a 44 dp square and scaled to the 36 dp well every You row uses.
  static const double size = 44;
  static const double well = 36;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return ExcludeSemantics(
      child: DecoratedBox(
        decoration: BoxDecoration(shape: BoxShape.circle, color: colors.isNight ? colors.raised2 : colors.sunken),
        child: SizedBox.square(
          dimension: well,
          child: FittedBox(child: CustomPaint(size: const Size.square(size), painter: _ToolArtPainter(colors, kind))),
        ),
      ),
    );
  }
}

class _ToolArtPainter extends CustomPainter {
  _ToolArtPainter(this.colors, this.kind);

  final MmColors colors;
  final ToolArtKind kind;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = BubblePaint(colors);
    final c = size.center(Offset.zero);
    switch (kind) {
      case ToolArtKind.combo:
        // Three rows of three: an answer sheet with one bubble inked per row.
        const inked = [1, 0, 2];
        const gap = 10.5;
        for (var row = 0; row < 3; row++) {
          for (var col = 0; col < 3; col++) {
            final at = c + Offset((col - 1) * gap, (row - 1) * gap);
            paint.paint(canvas, at, 3.6, inked[row] == col ? BubbleState.filled : BubbleState.hollow);
          }
        }
      case ToolArtKind.guide:
        // A vertical hairline with three bubbles: passed, now (ringed), still to come.
        const gap = 12.5;
        canvas.drawLine(
          c + const Offset(0, -gap),
          c + const Offset(0, gap),
          Paint()
            ..color = colors.lineStrong
            ..strokeWidth = 1.2,
        );
        paint.paint(canvas, c + const Offset(0, -gap), 3.8, BubbleState.filled);
        paint.paint(canvas, c, 3.8, BubbleState.hollow, emphasis: true);
        paint.paint(canvas, c + const Offset(0, gap), 3.8, BubbleState.hollow);
        // Tick marks to the right, so the mark reads as a schedule and not a progress bar.
        final tick = Paint()
          ..color = colors.ink3
          ..strokeWidth = 1.4
          ..strokeCap = StrokeCap.round;
        for (final dy in [-gap, 0.0, gap]) {
          canvas.drawLine(c + Offset(9, dy), c + Offset(15, dy), tick);
        }
    }
  }

  @override
  bool shouldRepaint(_ToolArtPainter old) => old.colors != colors || old.kind != kind;
}

/// A hub row that draws its own mark instead of a line icon: the art, a title, a note and the
/// chevron, as one row of a tools panel (its hairlines start at 64 dp).
class ToolRow extends StatelessWidget {
  const ToolRow({super.key, required this.art, required this.title, required this.note, required this.onTap});

  final ToolArtKind art;
  final String title;
  final String note;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return MmRow(
      title: title,
      subtitle: note,
      leading: ToolArt(art),
      semanticsLabel: '$title. $note',
      onTap: onTap,
      trailing: Icon(LucideIcons.chevronRight, size: 16, color: context.mmColors.ink3),
    );
  }
}
