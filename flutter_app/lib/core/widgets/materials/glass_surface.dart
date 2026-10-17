import 'package:flutter/material.dart';

import '../../theme/theme.dart';
import 'mm_glass.dart';

/// What a pane of glass is for. Each role is one [GlassKind] of MockMob Glass.
enum GlassRole {
  /// The dock and the Start circle.
  dock,

  /// Sheets and dialogs.
  sheet,

  /// A floating control (a header pill).
  control,

  /// A menu or popover bubble.
  bubble,
}

/// MockMob Glass ([MmGlass], GLASS-1017) for chrome that floats over content we do not control:
/// the dock, the Start button, sheets, dialogs, floating controls and menu bubbles.
///
/// Kept as the long-standing entry point: it maps a [GlassRole] to a [GlassKind]. A sheet's
/// reading core stays dense (4.5:1 for `ink3` over anything); its rim is thinner so the blurred
/// page shows at the edge. Lite drops the blur and thickens the tint; Off is solid. The blur is
/// always clipped to the shape. No glass on glass.
class GlassSurface extends StatelessWidget {
  const GlassSurface({
    super.key,
    required this.child,
    this.borderRadius = MmRadius.panelAll,
    this.role = GlassRole.control,
    this.pressed = false,
    this.shadow = true,
    this.quality,
    this.sheetTintAlpha,
    this.materialize,
    this.fill = 0,
    this.evenTint = false,
  });

  /// The tint ramp the Start sheet's morph has always passed ([sheetTintAlpha]): 0.45 on its
  /// first frame to 0.985 at rest.
  static const double _rampFrom = 0.45;
  static const double _rampTo = 0.985;

  final Widget child;
  final BorderRadius borderRadius;
  final GlassRole role;

  /// Pressed glass brightens its rim light.
  final bool pressed;
  final bool shadow;

  /// Overrides the inherited [GlassScope] quality (the lab shows all three side by side).
  final GlassQuality? quality;

  /// The morph's old tint ramp (0.45 to 0.985), still passed by the Start sheet's route. It is
  /// read as how far the sheet has materialised, so the blur, the rim and the tint grow together.
  final double? sheetTintAlpha;

  /// How far the glass has materialised (0 to 1); wins over [sheetTintAlpha].
  final double? materialize;

  /// How far a sheet has filled the screen (0 to 1): glass turns into the opaque surface.
  final double fill;

  /// One density edge to edge (see [MmGlass.evenTint]).
  final bool evenTint;

  GlassKind get _kind => switch (role) {
    GlassRole.dock => GlassKind.bar,
    GlassRole.sheet => GlassKind.sheet,
    GlassRole.control => GlassKind.control,
    GlassRole.bubble => GlassKind.bubble,
  };

  double get _materialize {
    final m = materialize;
    if (m != null) return m;
    final alpha = sheetTintAlpha;
    if (alpha == null) return 1;
    return ((alpha - _rampFrom) / (_rampTo - _rampFrom)).clamp(0.0, 1.0);
  }

  @override
  Widget build(BuildContext context) {
    return MmGlass(
      kind: _kind,
      borderRadius: borderRadius,
      quality: quality,
      materialize: _materialize,
      fill: fill,
      boost: pressed ? MmElevation.pressedEdgeBoost : 1,
      shadow: shadow,
      evenTint: evenTint,
      child: child,
    );
  }
}
