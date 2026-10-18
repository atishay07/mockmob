import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';

/// Where one question stands, on the round badge that carries its number. Colour never stands alone: the row beside the badge
/// says the state in words (the stamp, the state line, the action).
enum BadgeKind {
  /// A wrong answer not repaired yet.
  wrong,

  /// Repaired, waiting for Check it held.
  pending,

  /// Repaired and the check came right.
  held,

  /// Repaired and the check came wrong.
  slipped,
}

BadgeKind badgeKindOf(String kind) => switch (kind) {
  'held' => BadgeKind.held,
  'slipped' => BadgeKind.slipped,
  'pending' || 'repaired' => BadgeKind.pending,
  _ => BadgeKind.wrong,
};

/// The 36 dp round badge with a question's number: wrong is the wrong wash and ring, the saved repairs are a ring in the
/// state's own ink on the ground.
class NumberBadge extends StatelessWidget {
  const NumberBadge({super.key, required this.number, required this.kind});

  static const double size = 36;

  final int number;
  final BadgeKind kind;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final (fill, ring, ink) = switch (kind) {
      BadgeKind.wrong => (colors.wrongSurface, colors.wrongBorder, colors.badText),
      BadgeKind.pending => (colors.ground, colors.lineStrong, colors.ink),
      BadgeKind.held => (colors.ground, colors.goodText, colors.goodText),
      BadgeKind.slipped => (colors.ground, colors.warnText, colors.warnText),
    };
    return ExcludeSemantics(
      child: SizedBox.square(
        dimension: size,
        child: DecoratedBox(
          decoration: ShapeDecoration(color: fill, shape: CircleBorder(side: BorderSide(color: ring, width: 1.5))),
          child: Center(
            child: Text('$number', style: type.label.copyWith(fontSize: 13, height: 1, fontWeight: FontWeight.w700, color: ink)),
          ),
        ),
      ),
    );
  }
}

/// "D yours": the student's letter in a ring and the word beside it. The key stays hidden until the student has tried again
/// (L13), so only the pick is shown.
class PickFact extends StatelessWidget {
  const PickFact({super.key, required this.letter});

  final String letter;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      label: ReviewCopy.pickSpoken(letter),
      excludeSemantics: true,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox.square(
            dimension: 20,
            child: DecoratedBox(
              decoration: ShapeDecoration(shape: CircleBorder(side: BorderSide(color: colors.wrongBorder, width: 1.5))),
              child: Center(
                child: Text(letter, style: type.caption.copyWith(fontSize: 11, height: 1, fontWeight: FontWeight.w700, color: colors.badText)),
              ),
            ),
          ),
          const SizedBox(width: MmSpace.s4),
          Text(ReviewCopy.yoursWord, style: type.caption.copyWith(fontWeight: FontWeight.w600, color: colors.ink2)),
        ],
      ),
    );
  }
}

/// The one action of a row, drawn as a raised pill 40 dp tall. The row around it is the tap target, so the pill is the word and
/// the affordance, never a second control.
class ActionPill extends StatelessWidget {
  const ActionPill({super.key, required this.label, this.pressed = false});

  final String label;
  final bool pressed;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return ExcludeSemantics(
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 40, minWidth: 44),
        child: DecoratedBox(
          decoration: ShapeDecoration(
            color: pressed ? colors.sunken : colors.raised2,
            shape: StadiumBorder(side: BorderSide(color: colors.lineStrong)),
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            child: Center(
              widthFactor: 1,
              child: Text(label, maxLines: 1, style: type.label.copyWith(fontSize: 13.5, height: 1.2, color: colors.ink)),
            ),
          ),
        ),
      ),
    );
  }
}

/// The thread a chapter's mistakes hang on: a 2 dp rail through the badges, drawn from the top of the row (or from the badge
/// when the row is the first) to the bottom (or to the badge when it is the last).
class ThreadRail extends CustomPainter {
  const ThreadRail({required this.color, required this.top, required this.bottom, required this.badgeCenter});

  final Color color;
  final bool top;
  final bool bottom;

  /// Where the badge's centre sits below the row's top.
  final double badgeCenter;

  @override
  void paint(Canvas canvas, Size size) {
    final x = NumberBadge.size / 2;
    final paint = Paint()
      ..color = color
      ..strokeWidth = 2;
    if (top) canvas.drawLine(Offset(x, 0), Offset(x, badgeCenter), paint);
    if (bottom) canvas.drawLine(Offset(x, badgeCenter), Offset(x, size.height), paint);
  }

  @override
  bool shouldRepaint(ThreadRail old) => old.color != color || old.top != top || old.bottom != bottom || old.badgeCenter != badgeCenter;
}

/// One question as a row: the badge, what it is, and the one action. The whole row is the 64 dp or taller target.
class ChapterItemRow extends StatelessWidget {
  const ChapterItemRow({
    super.key,
    required this.badge,
    required this.number,
    required this.title,
    required this.details,
    required this.action,
    required this.onTap,
    required this.semanticsLabel,
    this.rail = false,
    this.first = true,
    this.last = true,
    this.divider = false,
  });

  final BadgeKind badge;
  final int number;
  final Widget title;
  final List<Widget> details;
  final String action;
  final VoidCallback onTap;
  final String semanticsLabel;

  /// Draw the thread through the badges (the open chapter's mistakes).
  final bool rail;
  final bool first;
  final bool last;

  /// A hairline under the row (Saved repairs).
  final bool divider;

  static const double _pad = 12;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return MmPressable(
      onTap: onTap,
      pressedScale: 0.985,
      focusRadius: MmRadius.keyAll,
      haptic: MmPressHaptic.selection,
      highlight: true,
      semanticsLabel: semanticsLabel,
      builder: (context, pressed, _) => DecoratedBox(
        decoration: BoxDecoration(border: divider ? Border(bottom: BorderSide(color: colors.line)) : null),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 64),
          child: CustomPaint(
            painter: rail ? ThreadRail(color: colors.line, top: !first, bottom: !last, badgeCenter: _pad + NumberBadge.size / 2) : null,
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: _pad),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  NumberBadge(number: number, kind: badge),
                  const SizedBox(width: MmSpace.s12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [title, for (final d in details) ...[const SizedBox(height: 2), d]],
                    ),
                  ),
                  const SizedBox(width: MmSpace.s8),
                  // The pill sits on the middle of the first two lines, as the mock draws it.
                  Padding(padding: const EdgeInsets.only(top: 4), child: ActionPill(label: action, pressed: pressed)),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The paper and when it was attempted, with the time held together ("9:40 PM" never splits).
Text stampText(BuildContext context, String stamp) =>
    Text(ReviewCopy.bindTime(stamp), style: context.mmType.caption.copyWith(color: context.mmColors.ink2));
