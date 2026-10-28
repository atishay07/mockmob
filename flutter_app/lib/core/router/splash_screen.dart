import 'package:flutter/material.dart';

import '../theme/theme.dart';

/// Shown only while the stored session is read at launch (spec 5.1.1): ground colour and a
/// static wordmark, no Mobi and no motion, matching the Android 12 launch screen.
class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Scaffold(
      backgroundColor: colors.ground,
      body: Center(
        child: Semantics(
          header: true,
          child: Text('MockMob', style: context.mmType.display.copyWith(color: colors.ink)),
        ),
      ),
    );
  }
}
