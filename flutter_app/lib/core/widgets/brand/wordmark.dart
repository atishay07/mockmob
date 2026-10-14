import 'package:flutter/material.dart';

import 'brand_logo.dart';
import 'logo_geometry.g.dart';

/// The `mockmob` wordmark (logo B, "Closing Mobi"): Cabinet Grotesk Black outlines with Mobi as
/// the second o, painted by [BrandLogo]. Letters take [color] (the theme's ink by default); Mobi
/// is always volt with the charcoal visor. The detail master follows the painted size.
///
/// The box is the word's ink: about 4.5 [height] wide and 0.7 [height] tall.
class Wordmark extends StatelessWidget {
  const Wordmark({super.key, this.height = 32, this.hairline = 1, this.color});

  /// The em (font size) in dp.
  final double height;

  /// How far the empty answer-bubble eye is inked, 0 to 1 (only drawn where the full master is
  /// used, that is large sizes). 1 is the static logo.
  final double hairline;
  final Color? color;

  static const String text = LogoGeometry.word;

  @override
  Widget build(BuildContext context) {
    return BrandLogo.wordmark(
      em: height,
      color: color,
      pose: hairline >= 1 ? LogoPose.rest : LogoPose(mobi: MobiFacePose(ink: hairline.clamp(0.0, 1.0))),
    );
  }
}
