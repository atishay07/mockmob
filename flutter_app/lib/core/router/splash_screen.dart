import 'package:flutter/material.dart';

import '../theme/theme.dart';
import '../widgets/brand/brand_logo.dart';
import '../widgets/brand/brand_opening.dart';
import '../widgets/brand/logo_geometry.g.dart';
import '../widgets/materials/light_field.dart';
import '../widgets/status_tint.dart';

/// Shown only while the stored session is read at launch, under the brand opening. It is the
/// opening's last frame exactly (the charcoal ground in both themes, the lamp, the centred word),
/// so if the opening hands off before the app is ready nothing moves. The status-bar scrim takes
/// the charcoal too, so a day theme does not lay a light band across the top.
class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  static final ThemeData _dark = buildTheme(Brightness.dark);

  @override
  Widget build(BuildContext context) {
    return StatusTint(
      color: MmColors.dark.ground,
      child: _content(),
    );
  }

  Widget _content() {
    return Theme(
      data: _dark,
      child: Builder(
        builder: (context) => Scaffold(
          backgroundColor: MmColors.dark.ground,
          body: Stack(
            fit: StackFit.expand,
            children: [
              LightField.lamp(context, strength: 0.7),
              Semantics(
                header: true,
                label: 'MockMob',
                excludeSemantics: true,
                child: CustomPaint(
                  painter: BrandLogoPainter(
                    form: BrandLogoForm.wordmark,
                    letterColor: LogoGeometry.warmWhite,
                    devicePixelRatio: MediaQuery.devicePixelRatioOf(context),
                    poseOf: OpeningTimeline.wordPose,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
