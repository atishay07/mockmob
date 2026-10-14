import 'package:flutter/material.dart';

import '../../theme/theme.dart';
import '../materials/edge_light.dart';
import '../materials/grain.dart';
import '../materials/light_field.dart';
import '../materials/lit_edge.dart';
import '../materials/shape.dart';
import '../pressable.dart';

/// The spacing rhythm of a screen (docs/brain/ui-blitz/motion.md 3.9). Gaps say how things
/// relate: tight inside a pair, an item gap between siblings, a section gap between groups.
abstract final class MmRhythm {
  /// Under the tab-root header, before the first block.
  static const double screenTop = 8;

  /// Between independent sections of a screen.
  static const double section = 40;

  /// Between a group's blocks (a hero and the list under it).
  static const double group = 24;

  /// Between sibling items (two tiles, two cards).
  static const double item = 12;

  /// Inside a label and value pair.
  static const double tight = 6;

  /// Padding of each tier.
  static const double heroPad = 24;
  static const double plainPad = 20;
  static const double insetPad = 16;

  /// Corner radius of each tier.
  static const double heroRadius = 28;
  static const double plainRadius = 24;
  static const double insetRadius = 18;
}

/// Where a surface sits in the screen's hierarchy.
enum MmSurfaceTier {
  /// The one focal surface: raised, lit by the lamp (or a subject's light) from the upper left,
  /// grain, the edge light, optionally the volt lit edge. 28 dp corners, 24 dp padding.
  hero,

  /// The ordinary card: raised, a 1 dp top edge light and no border. 24 dp, 20 dp.
  plain,

  /// Content nested inside another surface: a sunken well with no border and no light. 18 dp,
  /// 16 dp. Use it instead of a card inside a card.
  inset,

  /// No fill: content straight on the ground, padded like a plain card.
  bare,
}

/// A surface of the Night Sheet: one of three tiers instead of the same bordered box everywhere.
/// With [onTap] it presses (0.96 on the shared spring), shows the press veil and gives a haptic.
///
/// ```dart
/// MmSurface.hero(lit: true, child: tonightsMove)
/// MmSurface.plain(child: lastMocks)
/// MmSurface.inset(child: minutesPicker)   // inside the hero, not a third border
/// ```
class MmSurface extends StatelessWidget {
  const MmSurface({
    super.key,
    required this.tier,
    required this.child,
    this.padding,
    this.radius,
    this.lit = false,
    this.light,
    this.onTap,
    this.haptic = MmPressHaptic.selection,
    this.semanticsLabel,
    this.captureLaunch = false,
  });

  const MmSurface.hero({
    super.key,
    required this.child,
    this.padding,
    this.radius,
    this.lit = false,
    this.light,
    this.onTap,
    this.haptic = MmPressHaptic.selection,
    this.semanticsLabel,
    this.captureLaunch = false,
  }) : tier = MmSurfaceTier.hero;

  const MmSurface.plain({
    super.key,
    required this.child,
    this.padding,
    this.radius,
    this.lit = false,
    this.onTap,
    this.haptic = MmPressHaptic.selection,
    this.semanticsLabel,
    this.captureLaunch = false,
  })  : tier = MmSurfaceTier.plain,
        light = null;

  const MmSurface.inset({
    super.key,
    required this.child,
    this.padding,
    this.radius,
    this.onTap,
    this.haptic = MmPressHaptic.selection,
    this.semanticsLabel,
  })  : tier = MmSurfaceTier.inset,
        lit = false,
        light = null,
        captureLaunch = false;

  final MmSurfaceTier tier;
  final Widget child;

  /// Defaults to the tier's padding.
  final EdgeInsetsGeometry? padding;

  /// Defaults to the tier's corner radius.
  final double? radius;

  /// The volt lit edge along the top: the one focal element of the screen.
  final bool lit;

  /// A hero's light: a subject field colour pooled at the lower right (with the lamp still at
  /// the upper left). Null is the lamp alone.
  final Color? light;

  final VoidCallback? onTap;
  final MmPressHaptic haptic;

  /// With [onTap]: what TalkBack reads for the whole surface.
  final String? semanticsLabel;

  /// With [onTap]: the page it opens grows out of it.
  final bool captureLaunch;

  double get _radius =>
      radius ??
      switch (tier) {
        MmSurfaceTier.hero => MmRhythm.heroRadius,
        MmSurfaceTier.plain || MmSurfaceTier.bare => MmRhythm.plainRadius,
        MmSurfaceTier.inset => MmRhythm.insetRadius,
      };

  EdgeInsetsGeometry get _padding =>
      padding ??
      EdgeInsets.all(switch (tier) {
        MmSurfaceTier.hero => MmRhythm.heroPad,
        MmSurfaceTier.plain || MmSurfaceTier.bare => MmRhythm.plainPad,
        MmSurfaceTier.inset => MmRhythm.insetPad,
      });

  Widget _face(BuildContext context, bool pressed) {
    final colors = context.mmColors;
    final r = BorderRadius.circular(_radius);
    final body = Padding(padding: _padding, child: child);
    Widget face;
    switch (tier) {
      case MmSurfaceTier.hero:
        final glow = light;
        face = DecoratedBox(
          decoration: ShapeDecoration(color: colors.raised, shape: mmShapeBorder(r)),
          child: MmClip(
            borderRadius: r,
            child: Stack(
              children: [
                Positioned.fill(
                  child: IgnorePointer(
                    child: RepaintBoundary(
                      child: LightField(
                        pools: [
                          if (glow != null) LightPool(color: glow, center: const Alignment(0.75, 0.2), radius: 0.85),
                          LightPool(
                            color: colors.lamp.withValues(alpha: colors.isNight ? 0.16 : 0.12),
                            center: const Alignment(-1.05, -1.2),
                            radius: 0.95,
                            aspect: 1.4,
                          ),
                        ],
                        child: const Grain(),
                      ),
                    ),
                  ),
                ),
                body,
              ],
            ),
          ),
        );
        face = CustomPaint(
          foregroundPainter: EdgeLightPainter(
            borderRadius: r,
            top: colors.edgeTop,
            bottom: colors.edgeBottom,
            lamp: colors.isNight ? colors.lamp : null,
            boost: pressed ? 1.6 : 1,
          ),
          child: face,
        );
      case MmSurfaceTier.plain:
        face = DecoratedBox(
          decoration: ShapeDecoration(color: colors.raised, shape: mmShapeBorder(r)),
          child: CustomPaint(
            foregroundPainter: EdgeLightPainter(
              borderRadius: r,
              top: colors.edgeTop,
              bottom: colors.edgeBottom.withValues(alpha: 0),
              sheen: false,
              boost: pressed ? 1.6 : 1,
            ),
            child: body,
          ),
        );
      case MmSurfaceTier.inset:
        face = DecoratedBox(
          decoration: ShapeDecoration(color: colors.sunken, shape: mmShapeBorder(r)),
          child: body,
        );
      case MmSurfaceTier.bare:
        face = body;
    }
    if (lit) face = LitEdge(borderRadius: r, child: face);
    return face;
  }

  @override
  Widget build(BuildContext context) {
    final tap = onTap;
    if (tap == null) return _face(context, false);
    return MmPressable(
      onTap: tap,
      haptic: haptic,
      highlight: true,
      captureLaunch: captureLaunch,
      semanticsLabel: semanticsLabel,
      excludeSemantics: semanticsLabel != null,
      focusRadius: BorderRadius.circular(_radius),
      pressedScale: tier == MmSurfaceTier.hero ? 0.98 : 0.97,
      builder: (context, pressed, _) => _face(context, pressed),
    );
  }
}

/// A list inside one plain surface: rows divided by inset hairlines, each row pressable edge to
/// edge. Use it instead of a stack of identical boxes.
class MmRowGroup extends StatelessWidget {
  const MmRowGroup({super.key, required this.children, this.dividerIndent = 68, this.tier = MmSurfaceTier.plain});

  final List<Widget> children;

  /// Where the hairline starts (past the leading glyph).
  final double dividerIndent;

  /// [MmSurfaceTier.plain] (default) or [MmSurfaceTier.inset] inside a hero.
  final MmSurfaceTier tier;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final rows = <Widget>[];
    for (var i = 0; i < children.length; i++) {
      if (i > 0) {
        rows.add(Padding(
          padding: EdgeInsetsDirectional.only(start: dividerIndent),
          child: SizedBox(height: 1, child: ColoredBox(color: colors.line.withValues(alpha: 0.8))),
        ));
      }
      rows.add(children[i]);
    }
    final radius = tier == MmSurfaceTier.inset ? MmRhythm.insetRadius : MmRhythm.plainRadius;
    return MmSurface(
      tier: tier,
      padding: EdgeInsets.zero,
      child: MmClip(
        borderRadius: BorderRadius.circular(radius),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: rows),
      ),
    );
  }
}

/// One row of an [MmRowGroup]: a 40 dp leading glyph, a title, an optional note and trailing.
/// At least 64 dp tall; the whole row is the target.
class MmRow extends StatelessWidget {
  const MmRow({
    super.key,
    required this.title,
    this.subtitle,
    this.leading,
    this.trailing,
    this.onTap,
    this.haptic = MmPressHaptic.selection,
    this.semanticsLabel,
    this.subtitleLines = 2,
  });

  final String title;
  final String? subtitle;
  final Widget? leading;
  final Widget? trailing;
  final VoidCallback? onTap;
  final MmPressHaptic haptic;
  final String? semanticsLabel;
  final int subtitleLines;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    Widget content(bool pressed) => ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 64),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.s16, vertical: MmSpace.s12),
        child: Row(
          children: [
            if (leading != null) ...[leading!, const SizedBox(width: MmSpace.s12)],
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(title, style: type.labelLarge),
                  if (subtitle != null) ...[
                    const SizedBox(height: 2),
                    Text(subtitle!, style: type.caption.copyWith(color: colors.ink2), maxLines: subtitleLines, overflow: TextOverflow.ellipsis),
                  ],
                ],
              ),
            ),
            if (trailing != null) ...[const SizedBox(width: MmSpace.s12), trailing!],
          ],
        ),
      ),
    );
    final tap = onTap;
    if (tap == null) return content(false);
    return MmPressable(
      onTap: tap,
      haptic: haptic,
      highlight: true,
      pressedScale: 0.985,
      focusRadius: BorderRadius.zero,
      semanticsLabel: semanticsLabel ?? (subtitle == null ? title : '$title. $subtitle'),
      builder: (context, pressed, _) => content(pressed),
    );
  }
}

/// A section of a screen: a heading in the Bricolage title cut, an optional caption under it
/// and an optional trailing action, then the content after the item gap.
class MmSection extends StatelessWidget {
  const MmSection({super.key, required this.title, required this.child, this.caption, this.action});

  final String title;
  final String? caption;
  final Widget? action;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Semantics(header: true, child: Text(title, style: type.title)),
                  if (caption != null) ...[
                    const SizedBox(height: 2),
                    Text(caption!, style: type.caption.copyWith(color: colors.ink2)),
                  ],
                ],
              ),
            ),
            ?action,
          ],
        ),
        const SizedBox(height: MmRhythm.item),
        child,
      ],
    );
  }
}
