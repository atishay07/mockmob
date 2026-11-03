import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/motion/motion.dart';
import '../../core/theme/theme.dart';

/// What a Learn pill says (C-LEARN-CALM 2.5): one shape for every small status and choice in Learn, so "Up next", "Needs work",
/// "Chapter 5 of 14" and a part option read as one family instead of three.
enum LearnPillTone {
  /// The chapter the student is in ("Up next", "Start here"): volt fill, volt ink.
  here,

  /// The one verdict ("Needs work"): a soft warm tint with the warn ink; the words carry the meaning, never the colour alone.
  warn,

  /// A plain fact ("Chapter 5 of 14"): a quiet wash of the ink, ink-2 words.
  plain,

  /// A choice not picked: an outline, ink-2 words.
  choice,

  /// A choice picked: ink fill, ground words and a check.
  chosen,
}

/// One Learn pill: a stadium, 28 dp tall to look at (it grows when its words wrap at large text), 13 w700 words, 10 dp sides.
/// Not a button by itself: a tappable pill sits inside its own 48 dp target (see the part switch).
class LearnPill extends StatelessWidget {
  const LearnPill({super.key, required this.label, this.tone = LearnPillTone.plain, this.trailing});

  final String label;
  final LearnPillTone tone;

  /// Quieter words after the label, in the same pill: "Needs work, from your papers".
  final String? trailing;

  static const double height = 28;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final (Color fill, Color ink, Color? edge) = switch (tone) {
      LearnPillTone.here => (colors.volt, colors.voltInk, null),
      LearnPillTone.warn => (colors.warnText.withValues(alpha: colors.isNight ? 0.14 : 0.11), colors.warnText, null),
      LearnPillTone.plain => (colors.ink.withValues(alpha: colors.isNight ? 0.07 : 0.06), colors.ink2, null),
      LearnPillTone.choice => (colors.ink.withValues(alpha: 0), colors.ink2, colors.lineStrong),
      LearnPillTone.chosen => (colors.ink, colors.ground, colors.ink),
    };
    final style = type.label.copyWith(fontSize: 13, height: 1.25, fontWeight: FontWeight.w700, letterSpacing: 0.05, color: ink);
    return AnimatedContainer(
      duration: Motion.of(context, const Duration(milliseconds: 200)),
      curve: Motion.out,
      constraints: const BoxConstraints(minHeight: height),
      padding: EdgeInsets.symmetric(horizontal: tone == LearnPillTone.choice || tone == LearnPillTone.chosen ? 14 : 10, vertical: 5),
      decoration: ShapeDecoration(
        color: fill,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(height / 2),
          side: edge == null ? BorderSide.none : BorderSide(color: edge),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (tone == LearnPillTone.chosen) ...[
            Icon(LucideIcons.check, size: 14, color: ink),
            const SizedBox(width: 6),
          ],
          Flexible(
            child: Text.rich(
              TextSpan(
                text: label,
                children: [
                  if (trailing != null) TextSpan(text: ', $trailing', style: style.copyWith(fontWeight: FontWeight.w500)),
                ],
              ),
              style: style,
            ),
          ),
        ],
      ),
    );
  }
}
