import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';

/// Lets anything in a step tell the guide Mobi where the student just touched, so he glances at
/// it. The flow provides it; outside the flow it does nothing.
class GuideGlance extends InheritedWidget {
  const GuideGlance({super.key, required this.onGlance, required super.child});

  final ValueChanged<Offset> onGlance;

  /// Mobi glances at the centre of [context]'s render box.
  static void at(BuildContext context) {
    final scope = context.getInheritedWidgetOfExactType<GuideGlance>();
    if (scope == null) return;
    final box = context.findRenderObject();
    if (box is RenderBox && box.hasSize && box.attached) scope.onGlance(box.localToGlobal(box.size.center(Offset.zero)));
  }

  @override
  bool updateShouldNotify(GuideGlance old) => false;
}

/// One answer of a step as a tactile tile: a raised surface with the edge light, an answer
/// bubble that inks from its corner when chosen, the paper rim once chosen. It sinks under the
/// finger, ticks, and Mobi glances at it. The content is the caller's ([child]); state is never
/// colour alone (the bubble and the rim, and TalkBack's selected or checked).
class ChoiceTile extends ConsumerWidget {
  const ChoiceTile({
    super.key,
    required this.selected,
    required this.onTap,
    required this.semanticsLabel,
    required this.child,
    this.exclusive = true,
    this.minHeight = 56,
    this.padding = const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s12, MmSpace.s12, MmSpace.s16),
    this.bubble = BubbleSpot.topRight,
    this.bubbleSize = 22,
    this.radius = MmRadius.keyAll,
    this.flat = false,
  });

  final bool selected;
  final VoidCallback? onTap;
  final String semanticsLabel;
  final Widget child;

  /// One of a set (radio); false for a multi-pick (checkbox).
  final bool exclusive;
  final double minHeight;
  final EdgeInsets padding;
  final BubbleSpot bubble;
  final double bubbleSize;
  final BorderRadius radius;

  /// No surface until chosen: a rung on a ladder, a row in a quiet list.
  final bool flat;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final dot = Bubble(
      state: selected ? BubbleState.filled : BubbleState.hollow,
      size: bubbleSize,
      inkOrigin: const Offset(-0.5, -0.6),
    );
    return MmPressable(
      semanticsLabel: semanticsLabel,
      selected: exclusive ? selected : null,
      checked: exclusive ? null : selected,
      inMutuallyExclusiveGroup: exclusive ? true : null,
      pressedScale: 0.97,
      focusRadius: radius,
      onTap: onTap == null
          ? null
          : () {
              ref.read(hapticsProvider).selection();
              GuideGlance.at(context);
              onTap!();
            },
      builder: (context, pressed, _) {
        final fill = flat && !selected
            ? (pressed ? colors.raised : Colors.transparent)
            : MmSelection.fill(colors, selected: selected, pressed: pressed);
        // A flat row lifts onto a raised fill when chosen, with no rim: its own mark (the inked,
        // numbered bubble) says it is chosen, and a stack of rims would read as boxes.
        final side = flat ? const BorderSide(color: Colors.transparent, width: 1.5) : MmSelection.side(colors, selected: selected);
        return AnimatedContainer(
          duration: Motion.of(context, Motion.ui),
          curve: Motion.glide,
          decoration: ShapeDecoration(color: fill, shape: mmShapeBorder(radius, side: side)),
          child: CustomPaint(
            foregroundPainter: flat && !selected
                ? null
                : EdgeLightPainter(
                    borderRadius: radius,
                    top: pressed ? colors.edgeTop.withValues(alpha: 0.5) : colors.edgeTop,
                    bottom: colors.edgeBottom.withValues(alpha: 0),
                    sheen: false,
                  ),
            child: ConstrainedBox(
              constraints: BoxConstraints(minHeight: minHeight),
              child: switch (bubble) {
                BubbleSpot.none => Padding(padding: padding, child: child),
                BubbleSpot.topRight => Stack(
                    children: [
                      Padding(padding: padding, child: child),
                      Positioned(top: MmSpace.s12, right: MmSpace.s12, child: dot),
                    ],
                  ),
                BubbleSpot.leading => Padding(
                    padding: padding,
                    child: Row(
                      children: [
                        dot,
                        const SizedBox(width: MmSpace.s12),
                        Expanded(child: child),
                      ],
                    ),
                  ),
              },
            ),
          ),
        );
      },
    );
  }
}

/// Where a [ChoiceTile]'s answer bubble sits.
enum BubbleSpot { none, topRight, leading }

/// A small round medallion lit from the upper left by the desk lamp, holding a glyph: the
/// picture of a choice. Code-drawn, no raster art.
class GlyphMedallion extends StatelessWidget {
  const GlyphMedallion({super.key, required this.child, this.size = 44, this.lit = false});

  final Widget child;
  final double size;

  /// Chosen: the rim catches the volt light.
  final bool lit;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return SizedBox.square(
      dimension: size,
      child: DecoratedBox(
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: RadialGradient(
            center: const Alignment(-0.45, -0.55),
            radius: 1.0,
            colors: [
              colors.lamp.withValues(alpha: colors.isNight ? 0.22 : 0.18),
              colors.lamp.withValues(alpha: colors.isNight ? 0.05 : 0.04),
            ],
          ),
          border: Border.all(
            color: lit ? (colors.isNight ? colors.volt.withValues(alpha: 0.55) : colors.accentText.withValues(alpha: 0.5)) : colors.line,
            width: 1,
          ),
        ),
        child: Center(child: child),
      ),
    );
  }
}
