import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/settings/appearance_settings.dart';
import '../../../core/settings/changed_row.dart';
import '../../../core/storage/app_prefs.dart' show ThemeChoice;
import '../../../core/widgets/widgets.dart';
import '../copy.dart';

/// Night, Day or Match phone as one control, on You and in the Account sheet. One tap changes the
/// theme this frame (the app's cross-fade carries it); saving the choice is a convenience that
/// never blocks it.
class ThemeSwitch extends ConsumerWidget {
  const ThemeSwitch({super.key});

  static ThemeChoice _choiceOf(ThemeMode mode) => switch (mode) {
        ThemeMode.dark => ThemeChoice.dark,
        ThemeMode.light => ThemeChoice.light,
        ThemeMode.system => ThemeChoice.system,
      };

  /// Applies [mode] and marks the Appearance row as changed (its hairline draws on return).
  static void choose(WidgetRef ref, ThemeMode mode) {
    unawaited(ref.read(themeModeProvider.notifier).choose(_choiceOf(mode)).catchError((Object _) {}));
    ref.read(changedSettingsRowProvider.notifier).mark(ChangedRowKeys.appearance);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mode = ref.watch(themeModeProvider);
    return MmSegmented<ThemeMode>(
      semanticsLabel: YouCopy.themeHeading,
      showBubbles: false,
      value: mode,
      segments: const [
        MmSegment(ThemeMode.dark, YouCopy.themeDark),
        MmSegment(ThemeMode.light, YouCopy.themeLight),
        MmSegment(ThemeMode.system, YouCopy.themeSystem),
      ],
      onChanged: (m) => choose(ref, m),
    );
  }
}
