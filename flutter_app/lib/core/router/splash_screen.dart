import 'package:flutter/material.dart';

import '../theme/theme.dart';
import '../widgets/brand/brand_logo.dart';
import '../widgets/brand/brand_opening.dart';
import '../widgets/brand/logo_geometry.g.dart';
import '../widgets/materials/light_field.dart';

/// Shown only while the stored session is read at launch, under the brand opening. It is the
/// opening's last frame exactly (the charcoal ground in both themes, the lamp, the centred word),
/// so if the opening hands off before the app is ready nothing moves.
class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Theme(
      data: buildTheme(Brightness.dark),
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
