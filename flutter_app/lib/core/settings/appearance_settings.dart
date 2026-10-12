import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../haptics/haptics.dart';
import '../motion/reduced_motion.dart';
import '../storage/storage.dart';

/// The Appearance setting: Match phone, Light or Dark. Starts as Match phone and loads the saved
/// choice once preferences are readable, so the first frame never waits on storage.
class ThemeModeSetting extends Notifier<ThemeMode> {
  @override
  ThemeMode build() {
    _load();
    return ThemeMode.system;
  }

  Future<void> _load() async {
    try {
      final choice = await ref.read(appPrefsProvider).theme();
      if (ref.mounted) state = _modeOf(choice);
    } on Object {
      // Preferences are a convenience; keep the default.
    }
  }

  Future<void> choose(ThemeChoice choice) async {
    state = _modeOf(choice);
    await ref.read(appPrefsProvider).setTheme(choice);
  }

  static ThemeMode _modeOf(ThemeChoice choice) => switch (choice) {
        ThemeChoice.system => ThemeMode.system,
        ThemeChoice.light => ThemeMode.light,
        ThemeChoice.dark => ThemeMode.dark,
      };
}

final themeModeProvider = NotifierProvider<ThemeModeSetting, ThemeMode>(ThemeModeSetting.new);

/// Copies the saved "Reduce motion" and "Touch feedback" choices into their providers. Watch it
/// once near the app root; the You screens write through the same providers and preferences.
final savedSettingsProvider = FutureProvider<void>((ref) async {
  final prefs = ref.read(appPrefsProvider);
  final reduce = await prefs.reduceMotionOverride();
  final touch = await prefs.touchFeedback();
  if (!ref.mounted) return;
  if (reduce != null) ref.read(reducedMotionOverrideProvider.notifier).set(reduce);
  ref.read(touchFeedbackProvider.notifier).set(touch);
});
