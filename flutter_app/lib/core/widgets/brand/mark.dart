import 'package:flutter/material.dart';

import 'brand_logo.dart';

/// The app mark: "mo" (the m before Mobi, and Mobi) on the charcoal icon tile, cropped exactly
/// like the launcher icon (`tool/make_icons.py`), painted by [BrandLogo].
///
/// [ink] (0 to 1) inks Mobi's empty answer-bubble eye where the full master is drawn (large
/// sizes); [edge] is kept for older callers and no longer draws anything. [tile] false draws only
/// "mo" in the theme's ink, on a surface of its own.
class MmMark extends StatelessWidget {
  const MmMark({super.key, this.size = 64, this.ink = 1, this.edge = 1, this.tile = true, this.semanticLabel});

  final double size;
  final double ink;
  final double edge;
  final bool tile;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    return BrandLogo.icon(
      size: size,
      tile: tile,
      semanticLabel: semanticLabel,
      pose: ink >= 1 ? LogoPose.rest : LogoPose(mobi: MobiFacePose(ink: ink.clamp(0.0, 1.0))),
    );
  }
}
