import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/motion/reduced_motion.dart';
import '../../../core/settings/appearance_settings.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../rhythm/rhythm.dart' show CelebrationMode, rhythmPrefsProvider;
import '../copy.dart';
import '../widgets/you_page.dart';
import '../widgets/you_row.dart';
import '../you_providers.dart';
import 'theme_tiles.dart';

/// Appearance and feel: the theme as three small pictures, the glass quality, motion and touch,
/// how results open, the late-night line and how much to celebrate. Every choice is a per-phone
/// convenience: it applies at once and is kept in preferences.
class AppearanceScreen extends ConsumerWidget {
  const AppearanceScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final mode = ref.watch(themeModeProvider);
    final reduceOverride = ref.watch(reducedMotionOverrideProvider);
    final systemReduces = MediaQuery.disableAnimationsOf(context);
    final touch = ref.watch(touchFeedbackProvider);
    final openDirectly = ref.watch(openResultsDirectlyProvider);
    final lateNight = ref.watch(lateNightLinesProvider);
    final celebrations = ref.watch(rhythmPrefsProvider.select((p) => p.mode));

    return YouPage(
      title: YouCopy.appearanceTitle,
      children: [
        const GroupHeading(YouCopy.themeHeading, top: MmSpace.s16),
        ThemeTiles(mode: mode, onChoose: (choice) => ref.read(themeModeProvider.notifier).choose(choice)),
        const GroupHeading(YouCopy.glassHeading),
        const Padding(padding: youGutter, child: GlassQualityPicker()),
        Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.gutter + 4, MmSpace.s8, MmSpace.gutter, 0),
          child: Text(YouCopy.glassNote, style: type.caption.copyWith(color: colors.ink2)),
        ),
        const GroupHeading(YouCopy.feelHeading),
        YouPanel(
          children: [
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
          ],
        ),
        const GroupHeading(YouCopy.celebrationsHeading),
        Padding(
          padding: youGutter,
          child: MmSegmented<CelebrationMode>(
            semanticsLabel: YouCopy.celebrationsHeading,
            segments: const [
              MmSegment(CelebrationMode.full, YouCopy.celebrationsFull),
              MmSegment(CelebrationMode.quiet, YouCopy.celebrationsQuiet),
              MmSegment(CelebrationMode.off, YouCopy.celebrationsOff),
            ],
            value: celebrations,
            onChanged: (m) => ref.read(rhythmPrefsProvider.notifier).setMode(m),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.gutter + 4, MmSpace.s8, MmSpace.gutter, 0),
          child: Semantics(
            liveRegion: true,
            child: Text(_celebrationNote(celebrations), style: type.caption.copyWith(color: colors.ink2)),
          ),
        ),
      ],
    );
  }

  static String _celebrationNote(CelebrationMode mode) => switch (mode) {
        CelebrationMode.full => YouCopy.celebrationsFullNote,
        CelebrationMode.quiet => YouCopy.celebrationsQuietNote,
        CelebrationMode.off => YouCopy.celebrationsOffNote,
      };
}
