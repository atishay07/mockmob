import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/motion/reduced_motion.dart';
import '../../../core/settings/appearance_settings.dart';
import '../../../core/storage/app_prefs.dart';
import '../copy.dart';
import '../widgets/you_page.dart';
import '../widgets/you_row.dart';
import '../you_providers.dart';
import 'choice_rows.dart';

/// Appearance and feel (spec 5.12.2): theme, motion, touch feedback, how results open, the
/// late-night line and how much to celebrate. Every choice is a per-phone convenience: it applies
/// at once and is kept in preferences.
class AppearanceScreen extends ConsumerWidget {
  const AppearanceScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mode = ref.watch(themeModeProvider);
    final themes = ref.read(themeModeProvider.notifier);
    final reduceOverride = ref.watch(reducedMotionOverrideProvider);
    final systemReduces = MediaQuery.disableAnimationsOf(context);
    final touch = ref.watch(touchFeedbackProvider);
    final openDirectly = ref.watch(openResultsDirectlyProvider);
    final lateNight = ref.watch(lateNightLinesProvider);
    final celebrations = ref.watch(celebrationModeProvider);

    return YouPage(
      title: YouCopy.appearanceTitle,
      children: [
        const GroupHeading(YouCopy.themeHeading),
        ChoiceRow(
          title: YouCopy.themeSystem,
          note: YouCopy.themeSystemNote,
          selected: mode == ThemeMode.system,
          leading: const ThemeSwatch(light: true, dark: true),
          onTap: () => themes.choose(ThemeChoice.system),
        ),
        ChoiceRow(
          title: YouCopy.themeLight,
          note: YouCopy.themeLightNote,
          selected: mode == ThemeMode.light,
          leading: const ThemeSwatch(light: true, dark: false),
          onTap: () => themes.choose(ThemeChoice.light),
        ),
        ChoiceRow(
          title: YouCopy.themeDark,
          note: YouCopy.themeDarkNote,
          selected: mode == ThemeMode.dark,
          leading: const ThemeSwatch(light: false, dark: true),
          onTap: () => themes.choose(ThemeChoice.dark),
        ),
        const GroupHeading(YouCopy.feelHeading),
        YouSwitchRow(
          title: YouCopy.reduceMotion,
          note: systemReduces ? YouCopy.reduceMotionSystem : YouCopy.reduceMotionNote,
          // When the phone already removes animations the switch reads on and cannot be undone here.
          value: reduceOverride || systemReduces,
          onChanged: systemReduces ? null : (value) => setReduceMotion(ref, value),
        ),
        YouSwitchRow(
          title: YouCopy.touchFeedback,
          note: YouCopy.touchFeedbackNote,
          value: touch,
          onChanged: (value) async {
            await setTouchFeedback(ref, value);
            // Turning it on gives the tap straight away, so the switch explains itself.
            if (value) ref.read(hapticsProvider).tick();
          },
        ),
        YouSwitchRow(
          title: YouCopy.openDirectly,
          note: YouCopy.openDirectlyNote,
          value: openDirectly,
          onChanged: (value) => ref.read(openResultsDirectlyProvider.notifier).set(value),
        ),
        YouSwitchRow(
          title: YouCopy.lateNight,
          note: YouCopy.lateNightNote,
          value: lateNight,
          onChanged: (value) => ref.read(lateNightLinesProvider.notifier).set(value),
        ),
        const GroupHeading(YouCopy.celebrationsHeading),
        for (final (option, title, note) in [
          (CelebrationMode.full, YouCopy.celebrationsFull, YouCopy.celebrationsFullNote),
          (CelebrationMode.quiet, YouCopy.celebrationsQuiet, YouCopy.celebrationsQuietNote),
          (CelebrationMode.off, YouCopy.celebrationsOff, YouCopy.celebrationsOffNote),
        ])
          ChoiceRow(
            title: title,
            note: note,
            selected: celebrations == option,
            onTap: () => ref.read(celebrationModeProvider.notifier).choose(option),
          ),
      ],
    );
  }
}
