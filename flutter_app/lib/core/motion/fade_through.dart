import 'package:flutter/widgets.dart';

import 'motion.dart';

/// Words that change in place: the old ones leave, then the new ones arrive. Never both at once.
///
/// [MmOverlapSwitcher] is the default for a content swap because it never shows a blank frame, and that is right for
/// a card or a list. For two lines of text standing at the same spot it is wrong: halfway through, both are readable
/// and printed over one another (v15 walk: the week's readout, the Change plan questions, the line over the greeting).
/// This is the other rule: the first half of [duration] fades the old words out, the second half fades the new ones in,
/// so at no moment are two readable. The ground is never bare for long: [duration] is short (220 ms).
///
/// A swap carries a small move so it still reads as one object changing its mind:
/// - [rise]: the new words come up that many dp from below (the old ones lift a third of it);
/// - [slide]: the new words come in that many dp from the side the sign points to (positive: from the trailing edge,
///   a next step; negative: from the leading edge, a step back), the old ones drift a third of it the other way.
/// Reduced motion swaps at once.
///
/// The child must carry a key that changes with its content.
class MmFadeThrough extends StatelessWidget {
  const MmFadeThrough({
    super.key,
    required this.child,
    this.alignment = Alignment.topCenter,
    this.duration = const Duration(milliseconds: 220),
    this.rise = 0,
    this.slide = 0,
  });

  final Widget child;
  final AlignmentGeometry alignment;
  final Duration duration;
  final double rise;
  final double slide;

  @override
  Widget build(BuildContext context) {
    final current = child.key;
    final sign = Directionality.maybeOf(context) == TextDirection.rtl ? -1.0 : 1.0;
    return AnimatedSwitcher(
      duration: Motion.of(context, duration),
      reverseDuration: Motion.of(context, duration),
      // Linear underneath, so the halves are exact.
      switchInCurve: Curves.linear,
      switchOutCurve: Curves.linear,
      transitionBuilder: (child, animation) {
        final incoming = child.key == current;
        return AnimatedBuilder(
          animation: animation,
          child: child,
          builder: (context, child) {
            // Nothing until the other layer has left, then 0 to 1 over the last half.
            final v = Motion.out.transform(((animation.value - 0.5) * 2).clamp(0.0, 1.0));
            final leave = 1 - v;
            final dx = slide * sign * (incoming ? leave : -leave / 3);
            final dy = rise * (incoming ? leave : -leave / 3);
            return Opacity(opacity: v, child: Transform.translate(offset: Offset(dx, dy), child: child));
          },
        );
      },
      layoutBuilder: (currentChild, previous) => Stack(alignment: alignment, children: [...previous, ?currentChild]),
      child: child,
    );
  }
}
