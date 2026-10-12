import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../theme/theme.dart';
import 'mm_spinner.dart';

enum KeyVariant {
  /// Volt keycap with a voltEdge lip. One per screen.
  primary,

  /// Raised fill with a lineStrong lip.
  secondary,

  /// Transparent, 44 dp, no lift.
  quiet,

  /// Answer option: 56 dp, 3 dp dark lip, selected = flush + 2 dp ink border + check.
  option,
}

/// The pure visual of a key at a given press [depth] (0 raised, 1 flush). `KeyButton` drives
/// it from a controller; goldens render it at fixed depths.
class KeyButtonFace extends StatelessWidget {
  const KeyButtonFace({
    super.key,
    required this.label,
    this.variant = KeyVariant.primary,
    this.depth = 0,
    this.disabled = false,
    this.loading = false,
    this.selected = false,
    this.focused = false,
    this.expanded = true,
    this.leading,
    this.minHeight,
  });

  final String label;
  final KeyVariant variant;

  /// 0 = raised, 1 = pressed flush. Disabled and selected keys are always flush.
  final double depth;
  final bool disabled;
  final bool loading;
  final bool selected;
  final bool focused;
  final bool expanded;

  /// Leading widget of an option (the letter chip).
  final Widget? leading;
  final double? minHeight;

  double get _lip => switch (variant) {
        KeyVariant.primary || KeyVariant.secondary => 4,
        KeyVariant.option => 3,
        KeyVariant.quiet => 0,
      };

  double get _minHeight =>
      minHeight ??
      switch (variant) {
        KeyVariant.primary || KeyVariant.secondary => MmTarget.primaryKey,
        KeyVariant.option => MmTarget.option,
        KeyVariant.quiet => MmTarget.min,
      };

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final lip = _lip;
    final flush = disabled || selected;
    final effectiveDepth = flush ? 1.0 : depth.clamp(0.0, 1.0);

    // Disabled is flush at 45% strength. Colours are blended onto the ground instead of using
    // `Opacity`, so no saveLayer is needed.
    Color fade(Color c) => disabled ? Color.lerp(colors.ground, c, 0.45)! : c;

    final Color faceColor;
    final Color edgeColor;
    final Color textColor;
    Color? borderColor;
    var borderWidth = 0.0;
    switch (variant) {
      case KeyVariant.primary:
        faceColor = fade(colors.volt);
        edgeColor = colors.voltEdge;
        textColor = fade(colors.voltInk);
      case KeyVariant.secondary:
        faceColor = fade(colors.raised);
        edgeColor = colors.lineStrong;
        textColor = fade(colors.ink);
        borderColor = fade(colors.line);
        borderWidth = 1;
      case KeyVariant.option:
        faceColor = fade(colors.raised);
        edgeColor = colors.optionLip;
        textColor = fade(colors.ink);
        borderColor = selected ? colors.ink : fade(colors.line);
        borderWidth = selected ? 2 : 1;
      case KeyVariant.quiet:
        faceColor = Color.lerp(colors.sunken.withValues(alpha: 0), colors.sunken, effectiveDepth)!;
        edgeColor = colors.ground;
        textColor = fade(colors.ink);
    }

    final labelStyle = variant == KeyVariant.option
        ? type.body.copyWith(color: textColor, fontWeight: FontWeight.w500)
        : type.button.copyWith(color: textColor);

    final Widget content = variant == KeyVariant.option
        ? _optionContent(colors, labelStyle)
        : _centeredContent(textColor, labelStyle);

    final face = DecoratedBox(
      decoration: BoxDecoration(
        color: faceColor,
        borderRadius: variant == KeyVariant.quiet ? MmRadius.smallAll : MmRadius.keyAll,
        border: borderColor == null ? null : Border.all(color: borderColor, width: borderWidth),
      ),
      child: ConstrainedBox(
        constraints: BoxConstraints(minHeight: _minHeight),
        child: Padding(
          // Options keep their inner size whether the border is 1 or 2 dp.
          padding: EdgeInsets.symmetric(
            horizontal: variant == KeyVariant.quiet ? MmSpace.s16 : MmSpace.s20,
            vertical: variant == KeyVariant.option ? MmSpace.s12 + (2 - borderWidth) : MmSpace.s12,
          ),
          child: content,
        ),
      ),
    );

    final Widget key = lip == 0
        ? face
        : Stack(
            clipBehavior: Clip.none,
            children: [
              if (effectiveDepth < 1)
                Positioned(
                  left: 0,
                  right: 0,
                  top: lip,
                  bottom: 0,
                  child: DecoratedBox(
                    decoration: BoxDecoration(color: edgeColor, borderRadius: MmRadius.keyAll),
                  ),
                ),
              Padding(
                padding: EdgeInsets.only(bottom: lip),
                child: Transform.translate(offset: Offset(0, lip * effectiveDepth), child: face),
              ),
            ],
          );

    final ring = focused
        ? Stack(
            clipBehavior: Clip.none,
            children: [
              key,
              Positioned(
                left: -4,
                right: -4,
                top: -4,
                bottom: -4,
                child: IgnorePointer(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(MmRadius.key + 4),
                      border: Border.all(color: colors.focusRing, width: 2),
                    ),
                  ),
                ),
              ),
            ],
          )
        : key;

    return RepaintBoundary(child: ring);
  }

  Widget _spinner(Color color) => MmSpinner(color: color);

  Widget _centeredContent(Color textColor, TextStyle style) {
    Widget row(bool showSpinner) => Row(
          mainAxisSize: MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (showSpinner) ...[_spinner(textColor), const SizedBox(width: MmSpace.s8)],
            Flexible(child: Text(label, style: style, textAlign: TextAlign.center)),
          ],
        );

    if (expanded) return Center(child: row(loading));
    // Quiet keys never load, so they keep their natural width.
    if (variant == KeyVariant.quiet) return row(loading);
    // Intrinsic-width keys always reserve room for the spinner so width never changes.
    return Stack(
      alignment: Alignment.center,
      children: [
        Visibility(
          visible: false,
          maintainSize: true,
          maintainAnimation: true,
          maintainState: true,
          child: row(true),
        ),
        row(loading),
      ],
    );
  }

  Widget _optionContent(MmColors colors, TextStyle style) {
    return Row(
      children: [
        if (leading != null) ...[leading!, const SizedBox(width: MmSpace.s12)],
        Expanded(child: Text(label, style: style)),
        if (loading) ...[const SizedBox(width: MmSpace.s12), _spinner(colors.ink)],
        if (selected) ...[
          const SizedBox(width: MmSpace.s12),
          Icon(LucideIcons.check, size: 20, color: colors.ink),
        ],
      ],
    );
  }
}
