import 'dart:async';

import 'package:flutter/material.dart';

import '../motion/motion.dart';
import '../theme/theme.dart';
import '../widgets/brand/brand_logo.dart';
import '../widgets/brand/brand_opening.dart';
import '../widgets/brand/logo_geometry.g.dart';
import '../widgets/materials/light_field.dart';
import '../widgets/status_tint.dart';

/// The launch screen: shown only while the stored session is read at launch, under the brand
/// opening and after it if the session is slow. It is the opening's last frame exactly (the
/// charcoal ground in both themes, the lamp, the centred word), so when the opening hands off
/// to it nothing moves. The status-bar scrim takes the charcoal too, so a day theme does not lay
/// a light band across the top.
///
/// A slow start holds here without a spinner: Mobi keeps the opening's idle, one blink every
/// [OpeningTimeline.idleBlinkEvery], so the app is never a still picture. Under reduced motion
/// he does not blink.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  /// Whether Mobi blinks while the launch screen waits. The app turns it on (`main.dart`); tests
  /// keep the still frame, so screens settle and no timer is left running.
  static bool idleEnabled = false;

  static final ThemeData _dark = buildTheme(Brightness.dark);

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with SingleTickerProviderStateMixin {
  /// 0 to 1 over one blink; the ticker only runs during a blink, so a still launch screen asks for
  /// no frames.
  late final AnimationController _blink = AnimationController(
    vsync: this,
    duration: Duration(milliseconds: OpeningTimeline.blinkMs.round()),
  );
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    // Where the opening's own idle would blink first, then every 2.8 s.
    if (SplashScreen.idleEnabled) _blinkIn(OpeningTimeline.idleFirstBlinkAt);
  }

  void _blinkIn(double ms) {
    _timer = Timer(Duration(milliseconds: ms.round()), () {
      if (!mounted) return;
      if (!Motion.reduced(context)) _blink.forward(from: 0);
      _blinkIn(OpeningTimeline.idleBlinkEvery);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _blink.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return StatusTint(
      color: MmColors.dark.ground,
      child: _content(),
    );
  }

  Widget _content() {
    return Theme(
      data: SplashScreen._dark,
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
                    poseOf: (size) => OpeningTimeline.launchPoseAt(size, _blink.value * OpeningTimeline.blinkMs),
                    repaint: _blink,
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
