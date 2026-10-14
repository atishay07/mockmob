import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/motion/reduced_motion.dart';
import '../../../core/settings/appearance_settings.dart';
import '../../../core/settings/changed_row.dart';
import '../../../core/settings/theme_cross_fade.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../rhythm/rhythm.dart' show CelebrationMode, rhythmPrefsProvider;
import '../copy.dart';
import '../widgets/you_motion.dart';
import '../widgets/you_page.dart';
import '../widgets/you_row.dart';
import '../you_providers.dart';
import 'celebration_preview.dart';
import 'glass_swatch.dart';
import 'theme_tiles.dart';

/// Appearance and feel: the theme as three small pictures, the glass quality, motion and touch,
/// how results open, the late-night line and how much to celebrate. Every choice is a per-phone
/// convenience: it applies at once and is kept in preferences.
class AppearanceScreen extends ConsumerStatefulWidget {
  const AppearanceScreen({super.key});

  /// How long Mobi stays sleepy after Night is chosen, before he stands again.
  static const Duration sleepyFor = Duration(milliseconds: 1600);

  /// The act Mobi plays when the theme settles on [mode]: Daylight wakes him, Night makes him
  /// sleepy, Match phone makes him think about it.
  static MobiAct actFor(ThemeMode mode) => switch (mode) {
        ThemeMode.light => MobiAct.wake,
        ThemeMode.dark => MobiAct.sleepy,
        ThemeMode.system => MobiAct.think,
      };

  @override
  ConsumerState<AppearanceScreen> createState() => _AppearanceScreenState();
}

class _AppearanceScreenState extends ConsumerState<AppearanceScreen> {
  final MobiController _mobi = MobiController();
  Timer? _react;
  Timer? _stand;

  @override
  void dispose() {
    _react?.cancel();
    _stand?.cancel();
    _mobi.dispose();
    super.dispose();
  }

  /// Mobi answers the theme after the 250 ms cross-fade has finished, so the room has changed
  /// before he reacts to it. A second change cancels the first reaction.
  void _onTheme(ThemeMode next) {
    _react?.cancel();
    _stand?.cancel();
    _react = Timer(ThemeCrossFade.duration, () {
      if (!mounted) return;
      _mobi.react(AppearanceScreen.actFor(next));
      if (next == ThemeMode.dark) {
        _stand = Timer(AppearanceScreen.sleepyFor, () {
          if (mounted) _mobi.play(MobiAct.idle);
        });
      }
    });
  }

  void _changed() => ref.read(changedSettingsRowProvider.notifier).mark(ChangedRowKeys.appearance);

  @override
  Widget build(BuildContext context) {
    ref.listen<ThemeMode>(themeModeProvider, (previous, next) {
      if (previous != null && previous != next) _onTheme(next);
    });
    final colors = context.mmColors;
    final type = context.mmType;
    final mode = ref.watch(themeModeProvider);
    final reduceOverride = ref.watch(reducedMotionOverrideProvider);
    final systemReduces = MediaQuery.disableAnimationsOf(context);
    final touch = ref.watch(touchFeedbackProvider);
    final openDirectly = ref.watch(openResultsDirectlyProvider);
    final lateNight = ref.watch(lateNightLinesProvider);
    final celebrations = ref.watch(rhythmPrefsProvider.select((p) => p.mode));
    final autoLite = glassAutoLite(ref);

    return YouPage(
      title: YouCopy.appearanceTitle,
      children: [
        _ThemeHeadingRow(mobi: _mobi),
        ThemeTiles(
          mode: mode,
          onChoose: (choice) {
            _changed();
            ref.read(themeModeProvider.notifier).choose(choice);
          },
        ),
        const GroupHeading(YouCopy.glassHeading),
        const Padding(padding: EdgeInsets.symmetric(horizontal: youText), child: GlassQualityPicker()),
        const Padding(padding: EdgeInsets.fromLTRB(youText, MmSpace.s12, youText, 0), child: GlassSwatch()),
        Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, 0),
          child: YouNote(
            autoLite ? GlassQualityPicker.autoNote : YouCopy.glassNote,
            style: type.caption.copyWith(color: colors.ink2),
          ),
        ),
        const GroupHeading(YouCopy.feelHeading),
        YouPanel(
          flat: true,
          inset: 0,
          children: [
            // When the phone already removes animations there is nothing to switch here, so the
            // row says so in words instead of showing a dimmed switch that looks broken.
            if (systemReduces)
              const YouFactRow(
                title: YouCopy.reduceMotion,
                note: YouCopy.reduceMotionSystem,
                value: YouCopy.reduceMotionFromPhone,
              )
            else
              YouSwitchRow(
                flat: true,
                title: YouCopy.reduceMotion,
                note: YouCopy.reduceMotionNote,
                value: reduceOverride,
                onChanged: (value) {
                  _changed();
                  setReduceMotion(ref, value);
                },
              ),
            YouSwitchRow(
              flat: true,
              title: YouCopy.touchFeedback,
              note: YouCopy.touchFeedbackNote,
              value: touch,
              onChanged: (value) async {
                _changed();
                await setTouchFeedback(ref, value);
                // Turning it on gives the tap straight away, so the switch explains itself.
                if (value) ref.read(hapticsProvider).tick();
              },
            ),
            YouSwitchRow(
              flat: true,
              title: YouCopy.openDirectly,
              note: YouCopy.openDirectlyNote,
              value: openDirectly,
              onChanged: (value) {
                _changed();
                ref.read(openResultsDirectlyProvider.notifier).set(value);
              },
            ),
            YouSwitchRow(
              flat: true,
              title: YouCopy.lateNight,
              note: YouCopy.lateNightNote,
              value: lateNight,
              onChanged: (value) {
                _changed();
                ref.read(lateNightLinesProvider.notifier).set(value);
              },
            ),
          ],
        ),
        const GroupHeading(YouCopy.celebrationsHeading),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: youText),
          child: MmSegmented<CelebrationMode>(
            semanticsLabel: YouCopy.celebrationsHeading,
            segments: const [
              MmSegment(CelebrationMode.full, YouCopy.celebrationsFull),
              MmSegment(CelebrationMode.quiet, YouCopy.celebrationsQuiet),
              MmSegment(CelebrationMode.off, YouCopy.celebrationsOff),
            ],
            value: celebrations,
            onChanged: (m) {
              _changed();
              ref.read(rhythmPrefsProvider.notifier).setMode(m);
            },
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, 0),
          child: Semantics(
            liveRegion: true,
            child: YouNote(_celebrationNote(celebrations), style: type.caption.copyWith(color: colors.ink2)),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(youText, MmSpace.s12, youText, 0),
          child: CelebrationPreview(mode: celebrations),
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

/// The Theme heading with Mobi at the end of the row (72 dp). He reacts to the student's theme
/// choice once the 250 ms cross-fade is done, and every tap cycles a small act.
class _ThemeHeadingRow extends StatelessWidget {
  const _ThemeHeadingRow({required this.mobi});

  final MobiController mobi;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    return Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, MmSpace.s4),
      child: Row(
        children: [
          Expanded(
            child: Semantics(header: true, child: Text(YouCopy.themeHeading, style: type.labelLarge.copyWith(color: context.mmColors.ink2))),
          ),
          YouMobi(size: 72, controller: mobi),
        ],
      ),
    );
  }
}
