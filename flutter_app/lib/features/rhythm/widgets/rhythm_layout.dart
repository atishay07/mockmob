// The layout pieces the rhythm screens share, so every page of this feature sits on the same three
// edges and the same vertical rhythm (SPACING.md sections 1.2, 3.1 and 9): the screen header, the
// section break (air, a hairline rule, air), and the colour of a contact shadow.
import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../you/widgets/you_page.dart' show BackKey;

/// The header of a rhythm page: the back key at the gutter, then the title inline on the same
/// 56 dp row. Back key 44 dp inside its 48 dp target, 12 dp to the title, which sits on the
/// `screenTitle` style (SPACING.md 9). Every left edge below it is the gutter, so the title never
/// starts on a line of its own.
class RhythmHeader extends StatelessWidget {
  const RhythmHeader({super.key, required this.title, required this.onBack});

  final String title;
  final VoidCallback onBack;

  /// The row's height.
  static const double height = 56;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: height),
      child: Padding(
        // The key's 48 dp target holds a 44 dp disc, 2 dp in: so the disc, not the target, sits on
        // the gutter, exactly under the edge of the cards below.
        padding: const EdgeInsets.only(left: MmSpace.gutter - 2, right: MmSpace.gutter),
        child: Row(
          children: [
            BackKey(onTap: onBack),
            // 44 dp disc, then 12 dp: the target already gives 2 dp on this side.
            const SizedBox(width: MmSpace.s12 - 2),
            Expanded(child: Semantics(header: true, child: Text(title, style: type.screenTitle))),
          ],
        ),
      ),
    );
  }
}

/// The break between two sections of a typeset page: 32 dp of air, a 1 dp hairline, then 16 dp
/// before the heading (SPACING.md 3.1). Put it in a column before the next heading. Pass
/// [rule] false for the very first block under a header, which has no rule above it.
class SectionBreak extends StatelessWidget {
  const SectionBreak({super.key, this.rule = true});

  final bool rule;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const SizedBox(height: MmSpace.s32),
        if (rule) ...[
          SizedBox(width: double.infinity, height: 1, child: ColoredBox(color: context.mmColors.line)),
          const SizedBox(height: MmSpace.s16),
        ],
      ],
    );
  }
}

/// The contact shadow under a thing that stands on the ground (a coin on a shelf): black at 24% on
/// Night, where the ground is charcoal, and the warm ink at 12% on Daylight, where black would
/// read as grey dirt on cream (SPACING.md 8.4). Scale with [strength] (1 is the standard).
Color contactShadowColor(MmColors colors, {double strength = 1}) =>
    colors.isNight ? Colors.black.withValues(alpha: 0.24 * strength) : colors.ink.withValues(alpha: 0.12 * strength);

/// A figure that rolls in while its screen arrives starts this long after the first frame, so the
/// whole entrance (the rise, then the roll) is done inside 800 ms: 240 ms of lead, 500 ms of roll.
const Duration kNumberRollDelay = Duration(milliseconds: 240);

/// When such a figure has landed. Anything that reacts to the number (Mobi cheering) waits this
/// long: he acts after the state lands, never before it.
final Duration kNumberLanded = kNumberRollDelay + Motion.numberRoll;

/// A thin bar: a well for the track and a fill for [fraction] of it, 8 dp tall. A [volt] fill is
/// volt on both themes (a fill is never the dark accent text colour) and carries the 1 dp dark
/// volt edge on Daylight, so it reads on cream; a plain fill is the quiet ink.
class FillBar extends StatelessWidget {
  const FillBar({super.key, required this.fraction, this.volt = true});

  final double fraction;
  final bool volt;

  static const double height = MmSpace.s8;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return ClipRRect(
      borderRadius: MmRadius.pillAll,
      child: SizedBox(
        height: height,
        child: Stack(
          children: [
            Positioned.fill(child: ColoredBox(color: colors.ink.withValues(alpha: 0.10))),
            Positioned.fill(
              child: FractionallySizedBox(
                alignment: Alignment.centerLeft,
                widthFactor: fraction.clamp(0.0, 1.0),
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: volt ? colors.volt : colors.ink3,
                    borderRadius: MmRadius.pillAll,
                    border: volt && !colors.isNight ? Border.all(color: colors.voltEdge) : null,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
