import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

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
    // The answer mark is not drawn until the tile is chosen: no empty radio on every tile, the
    // bubble inks in (with its tick) when the student picks it.
    final dot = _ChosenMark(selected: selected, size: bubbleSize, hollowToo: flat);
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
        // A flat row (a rung on a ladder) never has a surface: its inked, numbered bubble says it
        // is chosen. A tile is a card; chosen, it is the selected surface with a 2 px ink border
        // in both themes (SPACING.md 8.1): Night lifts to raised2, Day stays white, because
        // Day's raised2 is darker than the page and would read as switched off. Volt is only in
        // the bubble. Unchosen on Day, a hairline gives the white tile its edge on cream.
        final Color fill;
        if (flat) {
          fill = pressed ? colors.raised : Colors.transparent;
        } else if (selected) {
          fill = colors.selectedSurface;
        } else {
          fill = Color.lerp(colors.raised, colors.isNight ? colors.raised2 : colors.sunken, pressed ? 0.7 : 0)!;
        }
        final BorderSide side;
        if (flat) {
          side = BorderSide.none;
        } else if (selected) {
          side = BorderSide(color: colors.ink, width: 2);
        } else {
          side = colors.isNight ? BorderSide.none : BorderSide(color: colors.line);
        }
        // The border is painted over the content, not around it: a decoration's border insets
        // its child by its width, so picking a tile (a 2 dp border) grew it and pushed the row
        // below (v15 taste pass, #12).
        return AnimatedContainer(
          duration: Motion.of(context, Motion.ui),
          curve: Motion.glide,
          decoration: ShapeDecoration(color: fill, shape: mmShapeBorder(radius)),
          foregroundDecoration: side == BorderSide.none ? null : ShapeDecoration(shape: mmShapeBorder(radius, side: side)),
          child: CustomPaint(
            foregroundPainter: flat || selected
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

/// The inked tick of a chosen tile: a volt bubble with a check, appearing as the student picks
/// it. Nothing is drawn for an unchosen tile (unless [hollowToo]).
class _ChosenMark extends StatelessWidget {
  const _ChosenMark({required this.selected, required this.size, required this.hollowToo});

  final bool selected;
  final double size;
  final bool hollowToo;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final bubble = Bubble(
      state: selected ? BubbleState.filled : BubbleState.hollow,
      size: size,
      inkOrigin: const Offset(-0.5, -0.6),
    );
    return AnimatedOpacity(
      duration: Motion.of(context, Motion.ui),
      opacity: selected || hollowToo ? 1 : 0,
      child: Stack(
        alignment: Alignment.center,
        children: [
          bubble,
          if (selected) Icon(LucideIcons.check, size: size * 0.6, color: colors.voltInk),
        ],
      ),
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
            color: lit ? colors.accentText.withValues(alpha: colors.isNight ? 0.55 : 0.5) : colors.line,
            width: 1,
          ),
        ),
        child: Center(child: child),
      ),
    );
  }
}

/// A short one-of-a-set question answered in a single row of 48 dp pills (the age question on
/// the save step): each pill is a full 48 dp target in the answer-sheet selection language
/// ([MmSelection]): a hollow bubble and a hairline at rest; chosen, the raised fill, the paper-ink
/// rim and an inked bubble. The pills share the row, each given the width its words need plus an
/// equal share of what is left, so no label is ever cut; when the words cannot fit in one row (a
/// narrow phone at a large text size) they wrap onto a second row at their own widths.
class ChoicePills<T> extends ConsumerWidget {
  const ChoicePills({super.key, required this.options, required this.selected, required this.onSelected});

  /// Each answer and its label, in order.
  final List<(T, String)> options;
  final T? selected;
  final ValueChanged<T> onSelected;

  /// 52 dp answer tiles with no radio dot (v15 taste pass): they read as answers, not a form.
  static const double height = 52;
  static const double _lead = MmSpace.s16;
  static const double _trail = MmSpace.s16;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final type = context.mmType;
    final style = type.labelLarge.copyWith(fontSize: 14);
    final scaler = MediaQuery.textScalerOf(context);
    final needs = [
      for (final (_, label) in options) _textWidth(label, style, scaler) + _lead + _trail,
    ];
    Widget pill((T, String) o, {double? width}) => SizedBox(
          width: width,
          child: _Pill(
            label: o.$2,
            style: style,
            selected: selected == o.$1,
            onTap: () {
              ref.read(hapticsProvider).selection();
              GuideGlance.at(context);
              onSelected(o.$1);
            },
          ),
        );
    return LayoutBuilder(
      builder: (context, box) {
        const gap = MmSpace.s8;
        final total = needs.fold<double>(0, (a, b) => a + b) + gap * (options.length - 1);
        if (box.hasBoundedWidth && total <= box.maxWidth) {
          final extra = (box.maxWidth - total) / options.length;
          return Row(
            children: [
              for (var i = 0; i < options.length; i++) ...[
                if (i > 0) const SizedBox(width: gap),
                pill(options[i], width: needs[i] + extra),
              ],
            ],
          );
        }
        return Wrap(spacing: gap, runSpacing: gap, children: [for (final o in options) pill(o)]);
      },
    );
  }

  static double _textWidth(String text, TextStyle style, TextScaler scaler) {
    final p = TextPainter(text: TextSpan(text: text, style: style), textDirection: TextDirection.ltr, textScaler: scaler, maxLines: 1)..layout();
    final w = p.width.ceilToDouble();
    p.dispose();
    return w;
  }
}

class _Pill extends StatelessWidget {
  const _Pill({required this.label, required this.style, required this.selected, required this.onTap});

  final String label;
  final TextStyle style;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return MmPressable(
      semanticsLabel: label,
      selected: selected,
      inMutuallyExclusiveGroup: true,
      pressedScale: 0.97,
      onTap: onTap,
      builder: (context, pressed, _) => AnimatedContainer(
        duration: Motion.of(context, Motion.ui),
        curve: Motion.glide,
        height: ChoicePills.height,
        decoration: ShapeDecoration(
          color: MmSelection.fill(colors, selected: selected, pressed: pressed),
          shape: mmShapeBorder(MmRadius.keyAll, side: MmSelection.side(colors, selected: selected)),
        ),
        padding: const EdgeInsets.only(left: MmSpace.s16, right: MmSpace.s16),
        alignment: Alignment.center,
        // Never cut: a label a few dp wider than its tile (a 360 dp phone, where the row has no
        // spare width) is set a little smaller, not faded away at the tile's rim.
        child: FittedBox(
          fit: BoxFit.scaleDown,
          child: Text(
            label,
            maxLines: 1,
            softWrap: false,
            style: style.copyWith(color: selected ? colors.ink : colors.ink2, fontWeight: selected ? FontWeight.w700 : FontWeight.w500),
          ),
        ),
      ),
    );
  }
}
