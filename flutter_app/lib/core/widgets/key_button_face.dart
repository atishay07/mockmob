import 'package:flutter/material.dart';

import '../motion/motion.dart';
import '../theme/theme.dart';
import 'bubbles/bubble.dart';
import 'materials/edge_light.dart';
import 'materials/shape.dart';
import 'mm_spinner.dart';

enum KeyVariant {
  /// The volt pill: the one primary action on a screen.
  primary,

  /// The glass pill: a secondary action, smoked with an edge light.
  secondary,

  /// A quiet text button, 48 dp tall.
  quiet,

  /// A solid answer option, 56 dp, that inks its bubble when chosen.
  option,
}

/// The pure visual of a button at a given press [depth] (0 at rest, 1 pressed). `KeyButton`
/// drives it; goldens render it at fixed depths.
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
    this.scaleWithDepth = true,
  });

  final String label;
  final KeyVariant variant;

  /// 0 = rest, 1 = pressed.
  final double depth;
  final bool disabled;
  final bool loading;
  final bool selected;
  final bool focused;
  final bool expanded;

  /// Leading widget of an option (the letter chip).
  final Widget? leading;
  final double? minHeight;

  /// Applies the 0.96 pressed scale here. `KeyButton` scales on a spring itself and sets false.
  final bool scaleWithDepth;

  double get _minHeight =>
      minHeight ??
      switch (variant) {
        KeyVariant.primary || KeyVariant.secondary => MmTarget.primaryKey,
        KeyVariant.option => MmTarget.option,
        KeyVariant.quiet => MmTarget.min,
      };

  BorderRadius get _radius => variant == KeyVariant.option ? MmRadius.keyAll : MmRadius.pillAll;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final d = depth.clamp(0.0, 1.0);

    final Color fill;
    final Color text;
    Color? border;
    var borderWidth = 0.0;
    var edge = false;
    List<BoxShadow>? shadow;

    switch (variant) {
      case KeyVariant.primary:
        fill = disabled ? colors.raised2 : Color.lerp(colors.volt, colors.voltEdge, 0.16 * d)!;
        text = disabled ? colors.ink3 : colors.voltInk;
        if (!disabled) {
          shadow = [
            BoxShadow(
              color: colors.isNight ? colors.voltGlow : colors.voltEdge.withValues(alpha: 0.28),
              blurRadius: 22 - 8 * d,
              offset: Offset(0, 8 - 4 * d),
              spreadRadius: -10,
            ),
          ];
        }
      case KeyVariant.secondary:
        fill = Color.lerp(colors.isNight ? colors.raised2 : colors.raised, colors.isNight ? colors.lineStrong : colors.raised2, 0.35 * d)!;
        text = disabled ? colors.ink4 : colors.ink;
        edge = !disabled;
        if (disabled) {
          border = colors.line;
          borderWidth = 1;
        }
        shadow = disabled ? null : colors.cardShadow;
      case KeyVariant.option:
        fill = selected ? colors.raised2 : Color.lerp(colors.raised, colors.raised2, 0.6 * d)!;
        text = disabled ? colors.ink3 : colors.ink;
        border = selected ? colors.ink : colors.line;
        borderWidth = selected ? 1.5 : 1;
      case KeyVariant.quiet:
        fill = Color.lerp(colors.sunken.withValues(alpha: 0), colors.sunken, d)!;
        text = disabled ? colors.ink4 : colors.ink;
    }

    final labelStyle = variant == KeyVariant.option
        ? type.body.copyWith(color: text, fontWeight: FontWeight.w500)
        : type.button.copyWith(color: text);

    final content = variant == KeyVariant.option ? _optionContent(colors, labelStyle) : _centeredContent(text, labelStyle);

    final enamel = variant == KeyVariant.primary && !disabled;
    Widget face = DecoratedBox(
      decoration: ShapeDecoration(
        color: enamel ? null : fill,
        gradient: enamel
            ? LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Color.lerp(fill, Colors.white, 0.14)!, fill, Color.lerp(fill, colors.voltEdge, 0.22)!],
                stops: const [0, 0.55, 1],
              )
            : null,
        shape: mmShapeBorder(_radius, side: border == null ? BorderSide.none : BorderSide(color: border, width: borderWidth)),
        shadows: shadow,
      ),
      child: CustomPaint(
        foregroundPainter: _foreground(colors, d, edge),
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: _minHeight),
          child: Padding(
            padding: EdgeInsets.symmetric(
              horizontal: switch (variant) {
                KeyVariant.quiet => MmSpace.s16,
                KeyVariant.option => MmSpace.s16,
                _ => MmSpace.s24,
              },
              vertical: MmSpace.s12,
            ),
            child: content,
          ),
        ),
      ),
    );

    if (scaleWithDepth && d > 0) {
      face = Transform.scale(scale: 1 - (1 - Springs.pressedScale) * d, child: face);
    }

    if (focused) {
      face = Stack(
        clipBehavior: Clip.none,
        children: [
          face,
          Positioned(
            left: -4,
            right: -4,
            top: -4,
            bottom: -4,
            child: IgnorePointer(
              child: DecoratedBox(
                decoration: ShapeDecoration(
                  shape: mmShapeBorder(
                    variant == KeyVariant.option ? BorderRadius.circular(MmRadius.key + 4) : MmRadius.pillAll,
                    side: BorderSide(color: colors.focusRing, width: 2),
                  ),
                ),
              ),
            ),
          ),
        ],
      );
    }
    return RepaintBoundary(child: face);
  }

  CustomPainter? _foreground(MmColors colors, double d, bool edge) {
    if (variant == KeyVariant.primary && !disabled) {
      return _VoltSheen(highlight: Colors.white.withValues(alpha: 0.38 - 0.18 * d));
    }
    if (edge) {
      return EdgeLightPainter(
        borderRadius: _radius,
        top: colors.edgeTop,
        bottom: colors.edgeBottom,
        boost: 1 + 0.6 * d,
      );
    }
    return null;
  }

  Widget _centeredContent(Color textColor, TextStyle style) {
    Widget row(bool showSpinner) => Row(
          mainAxisSize: MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (showSpinner) ...[MmSpinner(color: textColor), const SizedBox(width: MmSpace.s8)],
            Flexible(child: Text(label, style: style, textAlign: TextAlign.center)),
          ],
        );

    if (expanded) return Center(child: row(loading));
    if (variant == KeyVariant.quiet) return row(loading);
    // Intrinsic-width keys reserve room for the spinner so the width never changes.
    return Stack(
      alignment: Alignment.center,
      children: [
        Visibility(visible: false, maintainSize: true, maintainAnimation: true, maintainState: true, child: row(true)),
        row(loading),
      ],
    );
  }

  Widget _optionContent(MmColors colors, TextStyle style) {
    return Row(
      children: [
        if (leading != null) ...[leading!, const SizedBox(width: MmSpace.s12)],
        Expanded(child: Text(label, style: style)),
        const SizedBox(width: MmSpace.s12),
        if (loading)
          MmSpinner(color: colors.ink)
        else
          Bubble(state: selected ? BubbleState.filled : BubbleState.hollow, size: 22),
      ],
    );
  }
}

/// The volt pill's light: a thin bright line inside the top edge, like the lamp catching a
/// glossy enamel button.
class _VoltSheen extends CustomPainter {
  const _VoltSheen({required this.highlight});

  final Color highlight;

  @override
  void paint(Canvas canvas, Size size) {
    final r = size.height / 2;
    final path = Path()
      ..moveTo(r, 1.6)
      ..lineTo(size.width - r, 1.6);
    canvas.drawPath(
      path,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.2
        ..strokeCap = StrokeCap.round
        ..shader = LinearGradient(
          colors: [highlight.withValues(alpha: 0), highlight, highlight.withValues(alpha: 0)],
        ).createShader(Offset.zero & size),
    );
  }

  @override
  bool shouldRepaint(_VoltSheen old) => old.highlight != highlight;
}
