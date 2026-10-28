// The content of the You rhythm screen (spec 5.11): week marks, the run rows, goal, pause,
// closed weeks, the Celebrations setting, and the quiet Turn off rhythm. Stateless: the screen
// passes the state and the callbacks, and goldens render it directly.
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/rhythm_prefs.dart';
import '../data/rhythm_providers.dart';
import '../logic/week_view.dart';
import 'rhythm_page.dart';
import 'week_marks.dart';

class RhythmBody extends StatelessWidget {
  const RhythmBody({
    super.key,
    required this.snapshot,
    required this.rhythmOff,
    required this.mode,
    required this.busy,
    required this.onEditGoal,
    required this.onPauseThisWeek,
    required this.onPauseTwoWeeks,
    required this.onPauseUntilOn,
    required this.onResume,
    required this.onTurnOff,
    required this.onTurnOn,
    required this.onMode,
    this.errorText,
  });

  final RhythmSnapshot snapshot;
  final bool rhythmOff;
  final CelebrationMode mode;

  /// A write is in flight: the keys wait.
  final bool busy;
  final String? errorText;
  final VoidCallback onEditGoal;
  final VoidCallback onPauseThisWeek;
  final VoidCallback onPauseTwoWeeks;
  final VoidCallback onPauseUntilOn;
  final VoidCallback onResume;
  final VoidCallback onTurnOff;
  final VoidCallback onTurnOn;
  final ValueChanged<CelebrationMode> onMode;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final rhythm = snapshot.rhythm!;
    final week = snapshot.week!;
    final note = runNote(rhythm);
    final closed = closedWeeks(rhythm);
    final goal = snapshot.goal?.daysPerWeek ?? rhythm.daysGoal;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (snapshot.stale && snapshot.fetchedAt != null) ...[
          Text(RhythmCopy.asOf(snapshot.fetchedAt!), style: type.small.copyWith(color: colors.ink3)),
          const SizedBox(height: MmSpace.s8),
        ],
        if (errorText != null) ...[
          InlineBanner(message: errorText!, tone: BannerTone.error),
          const SizedBox(height: MmSpace.s12),
        ],
        if (rhythmOff) ...[
          Text(RhythmCopy.rhythmOffTitle, style: type.subhead),
          const SizedBox(height: MmSpace.s4),
          Text(RhythmCopy.rhythmOffBody, style: type.body.copyWith(color: colors.ink2)),
          const SizedBox(height: MmSpace.s16),
          KeyButton.secondary(label: RhythmCopy.turnOnRhythm, onPressed: onTurnOn, expanded: false),
        ] else ...[
          const SizedBox(height: MmSpace.s8),
          WeekMarks(week: week),
          const SizedBox(height: MmSpace.s12),
          Text(week.label, style: type.subhead),
        ],
        const SizedBox(height: MmSpace.s24),
        HairlineRow(first: true, child: Text(note ?? weeksInRhythmText(rhythm), style: type.body)),
        // The new-run note already says the best, so the Best run row would repeat it.
        if (rhythm.bestRun > 0 && note == null) HairlineRow(child: Text(RhythmCopy.bestRun(rhythm.bestRun), style: type.body)),
        HairlineRow(
          trailing: KeyButton.quiet(label: RhythmCopy.editGoal, onPressed: busy ? null : onEditGoal),
          child: Text(RhythmCopy.goalRow(goal), style: type.body),
        ),
        if (!rhythmOff) ...[
          const SizedBox(height: MmSpace.group),
          _PauseGroup(
            paused: week.status == WeekStatus.paused,
            busy: busy,
            onThisWeek: onPauseThisWeek,
            onTwoWeeks: onPauseTwoWeeks,
            onUntilOn: onPauseUntilOn,
            onResume: onResume,
          ),
        ],
        if (closed.isNotEmpty) ...[
          const SizedBox(height: MmSpace.group),
          const GroupHeading(RhythmCopy.closedWeeks),
          for (var i = 0; i < closed.length; i++)
            HairlineRow(
              first: i == 0,
              trailing: closed[i].met ? Icon(LucideIcons.check, size: 18, color: colors.ink2, semanticLabel: 'Goal met') : null,
              child: Text(closedWeekText(closed[i]), style: type.body),
            ),
        ],
        const SizedBox(height: MmSpace.group),
        _CelebrationsGroup(mode: mode, onMode: onMode),
        if (!rhythmOff) ...[
          const SizedBox(height: MmSpace.s24),
          FlushQuietKey(label: RhythmCopy.turnOff, onPressed: onTurnOff),
        ],
      ],
    );
  }
}

class _PauseGroup extends StatelessWidget {
  const _PauseGroup({
    required this.paused,
    required this.busy,
    required this.onThisWeek,
    required this.onTwoWeeks,
    required this.onUntilOn,
    required this.onResume,
  });

  final bool paused;
  final bool busy;
  final VoidCallback onThisWeek;
  final VoidCallback onTwoWeeks;
  final VoidCallback onUntilOn;
  final VoidCallback onResume;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const GroupHeading(RhythmCopy.pauseTitle),
        Text(RhythmCopy.pausedKeepsRun, style: type.body.copyWith(color: colors.ink2)),
        const SizedBox(height: MmSpace.s8),
        if (paused)
          Align(
            alignment: Alignment.centerLeft,
            child: KeyButton.secondary(label: RhythmCopy.resume, onPressed: busy ? null : onResume, expanded: false),
          )
        else ...[
          _PauseRow(label: RhythmCopy.pauseThisWeek, first: true, onTap: busy ? null : onThisWeek),
          _PauseRow(label: RhythmCopy.pauseTwoWeeks, onTap: busy ? null : onTwoWeeks),
          _PauseRow(label: RhythmCopy.pauseUntilOn, onTap: busy ? null : onUntilOn),
        ],
      ],
    );
  }
}

/// A pause preset as a plain tappable row with a pause glyph, so a preset reads as an action.
class _PauseRow extends StatelessWidget {
  const _PauseRow({required this.label, required this.onTap, this.first = false});

  final String label;
  final VoidCallback? onTap;
  final bool first;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      button: true,
      enabled: onTap != null,
      label: '${RhythmCopy.pauseTitle}, $label',
      excludeSemantics: true,
      onTap: onTap,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: HairlineRow(
          first: first,
          trailing: Icon(LucideIcons.pause, size: 18, color: onTap == null ? colors.ink4 : colors.ink2),
          child: Text(label, style: type.body.copyWith(color: onTap == null ? colors.ink3 : colors.ink)),
        ),
      ),
    );
  }
}

/// Celebrations: Full, Quiet or Off (spec 6.2). Selected is an ink fill plus a check, never colour alone.
class CelebrationsPicker extends StatelessWidget {
  const CelebrationsPicker({super.key, required this.mode, required this.onMode});

  final CelebrationMode mode;
  final ValueChanged<CelebrationMode> onMode;

  static String hint(CelebrationMode m) => switch (m) {
        CelebrationMode.full => RhythmCopy.celebrationsFullHint,
        CelebrationMode.quiet => RhythmCopy.celebrationsQuietHint,
        CelebrationMode.off => RhythmCopy.celebrationsOffHint,
      };

  static String label(CelebrationMode m) => switch (m) {
        CelebrationMode.full => RhythmCopy.celebrationsFull,
        CelebrationMode.quiet => RhythmCopy.celebrationsQuiet,
        CelebrationMode.off => RhythmCopy.celebrationsOff,
      };

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            for (final m in CelebrationMode.values) ...[
              if (m != CelebrationMode.values.first) const SizedBox(width: MmSpace.s8),
              Expanded(child: _ModeChoice(label: label(m), selected: m == mode, onTap: () => onMode(m))),
            ],
          ],
        ),
        const SizedBox(height: MmSpace.s8),
        Text(hint(mode), style: type.small.copyWith(color: colors.ink2)),
      ],
    );
  }
}

class _CelebrationsGroup extends StatelessWidget {
  const _CelebrationsGroup({required this.mode, required this.onMode});

  final CelebrationMode mode;
  final ValueChanged<CelebrationMode> onMode;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const GroupHeading(RhythmCopy.celebrationsTitle),
        CelebrationsPicker(mode: mode, onMode: onMode),
      ],
    );
  }
}

class _ModeChoice extends StatelessWidget {
  const _ModeChoice({required this.label, required this.selected, required this.onTap});

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      button: true,
      selected: selected,
      label: label,
      excludeSemantics: true,
      onTap: onTap,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: MmTarget.min),
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: selected ? colors.ink : colors.raised,
              borderRadius: MmRadius.keyAll,
              border: Border.all(color: selected ? colors.ink : colors.lineStrong),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (selected) ...[Icon(LucideIcons.check, size: 16, color: colors.ground), const SizedBox(width: MmSpace.s4)],
                Flexible(child: Text(label, style: type.button.copyWith(color: selected ? colors.ground : colors.ink), textAlign: TextAlign.center)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
