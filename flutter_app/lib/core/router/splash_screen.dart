import 'package:flutter/material.dart';

import '../theme/theme.dart';
import '../widgets/brand/wordmark.dart';
import '../widgets/materials/light_field.dart';

/// Shown only while the stored session is read at launch: the warm ground, a faint lamp in the
/// upper left and the static wordmark. No Mobi and no motion, so it continues the Android 12
/// launch screen (the mark on the same ground) without a jump.
class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Scaffold(
      backgroundColor: colors.ground,
      body: Stack(
        fit: StackFit.expand,
        children: [
          LightField.lamp(context, strength: 0.7),
          Center(
            child: Semantics(header: true, child: const Wordmark(height: 40)),
          ),
        ],
      ),
    );
  }
}
