import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/theme/theme.dart';

/// Records each haptic the code under test fires.
class RecordingHaptics implements HapticDriver {
  final List<String> calls = [];

  int count(String kind) => calls.where((c) => c == kind).length;

  @override
  Future<void> selectionClick() async => calls.add('selection');

  @override
  Future<void> lightImpact() async => calls.add('light');

  @override
  Future<void> mediumImpact() async => calls.add('medium');
}

// Built once, so MaterialApp's AnimatedTheme does not run a tween on every pump.
final Map<Brightness, ThemeData> _themes = {for (final b in Brightness.values) b: buildTheme(b)};

/// [child] in the app's theme, with a haptics recorder and optional reduced motion.
Widget motionApp(
  Widget child, {
  RecordingHaptics? haptics,
  bool reduced = false,
  Brightness brightness = Brightness.dark,
}) {
  return ProviderScope(
    overrides: [
      if (haptics != null) hapticsProvider.overrideWithValue(Haptics(enabled: true, driver: haptics)),
    ],
    child: MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: _themes[brightness],
      builder: (context, app) => MediaQuery(data: MediaQuery.of(context).copyWith(disableAnimations: reduced), child: app!),
      home: Scaffold(body: child),
    ),
  );
}

/// Pumps 16 ms frames for [total].
Future<void> pumpFrames(WidgetTester tester, Duration total, {void Function()? each}) async {
  const step = Duration(milliseconds: 16);
  for (var t = Duration.zero; t < total; t += step) {
    await tester.pump(step);
    each?.call();
  }
}
