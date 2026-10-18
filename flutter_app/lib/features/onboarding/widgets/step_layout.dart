import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import 'entrance.dart';
import 'step_frame.dart';

/// The common body of a step under the sheet: the question as a headline, one line of support,
/// the answers (scrolling when they need to), and the action area pinned at the bottom. It builds
/// in order when it appears (MOTION.md 4.2): the headline lifts, the support follows, the answers
/// lift (each wrapped in [EntranceItem.answer] by the step), the key lifts last. Text sits on the
/// screen gutter, under the card edges (SPACING.md 1.2, E0).
class StepLayout extends StatelessWidget {
  const StepLayout({
    super.key,
    required this.title,
    required this.body,
    this.support,
    this.bottom,
    this.titleKey,
    this.endInset = fade + MmSpace.s8,
    this.hideBottomForKeyboard = true,
    this.tight = false,
    this.backInRow = true,
  });

  final String title;
  final String? support;
  final Widget body;

  /// Pinned under the body: the primary action, and anything that belongs with it.
  final Widget? bottom;

  /// On the question, for tests that measure it.
  final Key? titleKey;

  /// The room under the last answer when the list is scrolled to its end, so it comes fully
  /// clear of the fade and the key. A step whose answers end in a row of tiles takes more
  /// ([tileEndInset]).
  final double endInset;

  /// While the keyboard is up, the pinned key steps out of the way (it would sit on the keyboard and
  /// take the room the answers need). Only a step with a text field is ever in this state.
  final bool hideBottomForKeyboard;

  /// Takes the short phones' tighter head (8 dp less above the title and under the support) on any
  /// height: for a step whose body and pinned keys both need the room (the save step).
  final bool tight;

  /// The labelled Back sits left of [bottom] (off for a step that places it itself).
  final bool backInRow;

  /// The end inset of a step whose last answers are tiles (the rhythm step's times).
  static const double tileEndInset = 72;

  /// The fade above the pinned key (SPACING.md 4.5).
  static const double fade = StepFrame.fade;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    // Short phones (360 by 640) give the answers the room: the head tightens by 8 dp.
    final short = tight || MediaQuery.sizeOf(context).height < 720;
    final scaler = MediaQuery.textScalerOf(context).clamp(maxScaleFactor: 1.3);
    // Under Mobi the frame keeps the gap; with no Mobi above (a step pumped alone) the head keeps
    // its own room from the strip.
    final guided = StepGuide.of(context)?.mobi != null;
    final head = Padding(
      padding: EdgeInsets.only(top: guided ? 0 : (short ? MmSpace.s16 : MmSpace.s24)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // A question that takes two lines is set in the title cut (22/27), so it never stacks
          // a heavy 28 sp block onto its support line (SPACING-AUDIT O5); one-liners keep the
          // headline cut.
          LayoutBuilder(
            builder: (context, box) {
              final style = _fitsOneLine(title, type.headline, scaler, box.maxWidth) ? type.headline : type.title;
              return EntranceItem(
                at: Entrance.headline,
                child: Semantics(header: true, child: Text(title, key: titleKey, style: style, textScaler: scaler)),
              );
            },
          ),
          if (support != null) ...[
            const SizedBox(height: MmSpace.s8),
            EntranceItem(
              at: Entrance.support,
              rise: 8,
              child: Text(support!, style: type.body.copyWith(color: colors.ink2)),
            ),
          ],
          SizedBox(height: short ? MmSpace.s12 : MmSpace.s20),
        ],
      ),
    );

    final bottom = this.bottom;
    // Every step stands in the one frame (D40, D43, D44): the group balanced in the free height
    // with Mobi above it, the action row with Back pinned at the foot.
    return StepEntrance(
      child: StepFrame(
        endInset: endInset,
        hideBottomForKeyboard: hideBottomForKeyboard,
        backInRow: backInRow,
        content: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [head, body]),
        bottom: bottom == null ? null : EntranceItem(at: Entrance.key, child: bottom),
      ),
    );
  }

  static bool _fitsOneLine(String text, TextStyle style, TextScaler scaler, double width) {
    if (!width.isFinite) return true;
    final p = TextPainter(text: TextSpan(text: text, style: style), textDirection: TextDirection.ltr, textScaler: scaler, maxLines: 1)
      ..layout(maxWidth: width);
    final fits = !p.didExceedMaxLines;
    p.dispose();
    return fits;
  }
}
