import 'dart:ui' show ImageFilter;

import 'package:flutter/material.dart';

import '../../theme/theme.dart';
import 'edge_light.dart';
import 'shape.dart';

/// What a pane of glass is for. Each role has its own blur.
enum GlassRole {
  /// The dock and the Start circle.
  dock,

  /// Sheets and dialogs.
  sheet,

  /// A floating control (a header pill).
  control,
}

/// Live smoked glass (brief section 5) for chrome that floats over content we do not control:
/// the dock, the Start button, sheets and dialogs.
///
/// Full quality blurs the backdrop (`BackdropFilter.grouped`, so every pane under one
/// `BackdropGroup` shares a single snapshot) behind a warm tint, a 1 dp edge light and a soft
/// shadow. Lite drops the blur and thickens the tint; Off is solid. The blur is always clipped to
/// the shape, so it never filters more than the pane. No glass on glass.
class GlassSurface extends StatelessWidget {
  const GlassSurface({
    super.key,
    required this.child,
    this.borderRadius = MmRadius.panelAll,
    this.role = GlassRole.control,
    this.pressed = false,
    this.shadow = true,
    this.quality,
  });

  final Widget child;
  final BorderRadius borderRadius;
  final GlassRole role;

  /// Pressed glass brightens its edge light.
  final bool pressed;
  final bool shadow;

  /// Overrides the inherited [GlassScope] quality (the lab shows all three side by side).
  final GlassQuality? quality;

  double get _sigma => switch (role) {
    GlassRole.dock => MmElevation.sigmaDock,
    GlassRole.sheet => MmElevation.sigmaSheet,
    GlassRole.control => MmElevation.sigmaControl,
  };

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final q = quality ?? GlassScope.of(context);
    final tint = switch (q) {
      // A sheet holds text a student reads over whatever was on screen, so its tint stays
      // dense enough to keep 4.5:1 even where a GPU drops or weakens the blur.
      GlassQuality.full => role == GlassRole.sheet ? colors.glassTint.withValues(alpha: colors.isNight ? 0.86 : 0.88) : colors.glassTint,
      GlassQuality.lite => colors.glassTintLite,
      GlassQuality.off => colors.raised,
    };

    Widget pane = DecoratedBox(
      decoration: ShapeDecoration(color: tint, shape: mmShapeBorder(borderRadius)),
      child: CustomPaint(
        foregroundPainter: EdgeLightPainter(
          borderRadius: borderRadius,
          top: colors.edgeTop,
          bottom: colors.edgeBottom,
          lamp: colors.isNight ? colors.lamp : null,
          boost: pressed ? MmElevation.pressedEdgeBoost : 1,
        ),
        child: child,
      ),
    );

    if (q == GlassQuality.full) {
      pane = BackdropFilter.grouped(
        filter: ImageFilter.blur(sigmaX: _sigma, sigmaY: _sigma),
        child: pane,
      );
    }
    pane = MmClip(borderRadius: borderRadius, child: pane);

    if (!shadow) return pane;
    return DecoratedBox(
      decoration: BoxDecoration(borderRadius: _shadowRadius, boxShadow: colors.glassShadow),
      child: pane,
    );
  }

  BorderRadius get _shadowRadius => isPillRadius(borderRadius) ? MmRadius.pillAll : borderRadius;
}
