// The move's keys: the label that fits, and the bar that keeps the primary key in reach.
// The card's own keys sit at the bottom of a tall hero, so on a short phone or at large text
// they are under the dock at rest. The bar pins the same primary key above the dock while the
// card's key is out of view, and hands over to it (same place, same size) as soon as it scrolls
// into the clear. It is an overlay: nothing in the page moves when it comes or goes.
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../logic/today_model.dart';

/// [action]'s label, or its [TodayAction.shortLabel] when the long one would break onto a second
/// line in a key [keyWidth] wide at the current text size.
String fitKeyLabel(BuildContext context, TodayAction action, double keyWidth) {
  final short = action.shortLabel;
  if (short == null || !keyWidth.isFinite) return action.label;
  final style = DefaultTextStyle.of(context).style.merge(context.mmType.button);
  final painter = TextPainter(
    text: TextSpan(text: action.label, style: style),
    textDirection: Directionality.of(context),
    textScaler: MediaQuery.textScalerOf(context),
    maxLines: 1,
  )..layout();
  final fits = painter.width <= keyWidth - 2 * MmSpace.s24;
  painter.dispose();
  return fits ? action.label : short;
}

/// The pinned primary key (and, when the card has one, a 48 dp key for its alternative), drawn
/// over a ground fade so scrolling text never reads between the key and the dock.
class StickyMoveBar extends StatelessWidget {
  const StickyMoveBar({super.key, required this.move, required this.onAction, this.retrying = false});

  final MoveHero move;
  final void Function(TodayAction action) onAction;
  final bool retrying;

  /// What the bar's own height is: the key and its breathing room.
  static const double height = MmTarget.primaryKey;

  @override
  Widget build(BuildContext context) {
    final m = move;
    final secondary = m.secondary;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Expanded(
          child: LayoutBuilder(
            builder: (context, box) => KeyButton(
              label: fitKeyLabel(context, m.primary, box.maxWidth),
              semanticsLabel: m.primary.label,
              onPressed: () => onAction(m.primary),
              loading: retrying && m.primary.target is RetryLoad,
            ),
          ),
        ),
        if (secondary != null) ...[
          const SizedBox(width: MmSpace.s8),
          _AlternativeKey(label: secondary.label, onTap: () => onAction(secondary)),
        ],
      ],
    );
  }
}

/// "Choose something else" as a 48 dp glass key beside the primary one. Named for screen
/// readers and on long press; the card's own text key carries the words.
class _AlternativeKey extends StatelessWidget {
  const _AlternativeKey({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Tooltip(
      message: label,
      excludeFromSemantics: true,
      child: MmPressable(
        semanticsLabel: label,
        onTap: onTap,
        // The same commit feel as the card's own "Choose something else" key.
        haptic: MmPressHaptic.light,
        builder: (context, pressed, _) => SizedBox.square(
          dimension: MmTarget.min,
          child: FakeGlass(
            borderRadius: MmRadius.pillAll,
            pressed: pressed,
            opacity: colors.isNight ? 0.9 : 0.96,
            child: Center(child: Icon(LucideIcons.arrowLeftRight, size: 20, color: colors.ink)),
          ),
        ),
      ),
    );
  }
}

/// Fades the bar in and out; instant under reduced motion.
class StickyMoveHost extends StatelessWidget {
  const StickyMoveHost({super.key, required this.pinned, required this.builder});

  final bool pinned;
  final WidgetBuilder builder;

  @override
  Widget build(BuildContext context) => AnimatedSwitcher(
        duration: Motion.of(context, const Duration(milliseconds: 140)),
        switchInCurve: Curves.easeOut,
        child: pinned ? KeyedSubtree(key: const ValueKey('sticky-move'), child: builder(context)) : const SizedBox.shrink(key: ValueKey('no-sticky')),
      );
}
