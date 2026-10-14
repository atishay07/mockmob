// The study days editor (spec 5.11, owner feedback 13 Oct): the student taps the weekdays they
// plan to study. Their number is the weekly goal, saved on the server first; which days they are
// stays on this phone and draws the rest days in the week. Rest is part of the plan, never a miss.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/copy/formatters.dart';
import '../../../core/haptics/haptics.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../onboarding/onboarding.dart';
import '../copy.dart';
import '../data/rhythm_providers.dart';
import '../data/study_days.dart';

/// Opens the study days editor. Saves through `RhythmActions.saveStudyDays` and closes when the
/// server acknowledged the goal. Returns the saved number of days, or null when dismissed.
Future<int?> showGoalEditor(BuildContext context, {required int initialDays}) {
  return showMmSheet<int>(
    context: context,
    title: RhythmCopy.daysTitle,
    builder: (context) => GoalEditor(initialDays: initialDays),
  );
}

/// A starting choice of [n] days, spread through the week, when the student has none yet.
Set<int> spreadDays(int n) => switch (n.clamp(1, 7)) {
      1 => {0},
      2 => {1, 4},
      3 => {0, 2, 4},
      4 => {0, 1, 3, 5},
      5 => {0, 1, 2, 3, 4},
      6 => {0, 1, 2, 3, 4, 5},
      _ => {0, 1, 2, 3, 4, 5, 6},
    };

class GoalEditor extends ConsumerStatefulWidget {
  const GoalEditor({super.key, required this.initialDays, this.initialPlan, this.onSave});

  /// The goal on the server now.
  final int initialDays;

  /// The days chosen before; defaults to this phone's plan, else the onboarding's.
  final Set<int>? initialPlan;

  /// Defaults to `RhythmActions.saveStudyDays`. Throws when the save fails.
  final Future<void> Function(Set<int> days)? onSave;

  @override
  ConsumerState<GoalEditor> createState() => _GoalEditorState();
}

class _GoalEditorState extends ConsumerState<GoalEditor> {
  late Set<int> _days = _initial();
  bool _saving = false;
  bool _failed = false;

  Set<int> _initial() {
    final known = widget.initialPlan ?? ref.read(plannedDaysProvider) ?? ref.read(studentSheetProvider)?.days;
    final goal = widget.initialDays.clamp(1, 7);
    if (known != null && known.length == goal) return {...known};
    return spreadDays(goal);
  }

  /// The selection tick is the press's own (`MmPressHaptic.selection` on the day).
  void _toggle(int day) {
    setState(() {
      _failed = false;
      _days = _days.contains(day) ? ({..._days}..remove(day)) : {..._days, day};
    });
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _failed = false;
    });
    try {
      final save = widget.onSave ?? ref.read(rhythmActionsProvider).saveStudyDays;
      await save(_days);
      if (mounted) Navigator.of(context).pop(_days.length);
    } on Object {
      if (mounted) {
        setState(() {
          _saving = false;
          _failed = true;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final rest = [for (var d = 0; d < 7; d++) if (!_days.contains(d)) weekdayNames[d]];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(RhythmCopy.daysPrompt, style: type.body.copyWith(color: colors.ink2)),
        const SizedBox(height: MmSpace.s16),
        Row(
          children: [
            for (var d = 0; d < 7; d++)
              Expanded(child: _DayToggle(day: d, chosen: _days.contains(d), onTap: _saving ? null : () => _toggle(d))),
          ],
        ),
        const SizedBox(height: MmSpace.s16),
        Semantics(
          liveRegion: true,
          child: Text(_days.isEmpty ? RhythmCopy.daysNone : RhythmCopy.daysSummary(_days.length), style: type.subhead),
        ),
        if (_days.isNotEmpty && rest.isNotEmpty) ...[
          const SizedBox(height: MmSpace.s4),
          Text(RhythmCopy.restOn(rest), style: type.body.copyWith(color: colors.ink2)),
        ],
        const SizedBox(height: MmSpace.s12),
        Text(RhythmCopy.restIsPlan, style: type.caption.copyWith(color: colors.ink3)),
        const SizedBox(height: MmSpace.s4),
        Text(RhythmCopy.daysWhere, style: type.caption.copyWith(color: colors.ink3)),
        if (_failed) ...[
          const SizedBox(height: MmSpace.s12),
          InlineBanner(message: RhythmCopy.goalSaveFailed, tone: BannerTone.error),
        ],
        const SizedBox(height: MmSpace.s24),
        KeyButton(label: RhythmCopy.saveDays, onPressed: _saving || _days.isEmpty ? null : _save, loading: _saving),
      ],
    );
  }
}

/// One weekday: an inked bubble when it is a study day, the dashed rest mark when it is not,
/// with the day's short name beneath. A 48 dp target that answers on the next frame: it sinks on
/// the press spring, a veil washes it, and a selection tick fires on release.
class _DayToggle extends StatelessWidget {
  const _DayToggle({required this.day, required this.chosen, this.onTap});

  final int day;
  final bool chosen;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final name = weekdayNames[day];
    return Semantics(
      button: true,
      toggled: chosen,
      enabled: onTap != null,
      label: '$name, ${chosen ? 'study day' : 'rest day'}',
      excludeSemantics: true,
      onTap: onTap,
      child: MmPressable(
        onTap: onTap,
        button: false,
        highlight: true,
        focusRadius: MmRadius.smallAll,
        haptic: MmPressHaptic.selection,
        // The whole column is the target, not just the bubble and the three letters.
        builder: (context, pressed, focused) => SizedBox(
          width: double.infinity,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(
                height: MmTarget.min,
                child: Center(child: Bubble(state: chosen ? BubbleState.filled : BubbleState.rest, size: 34)),
              ),
              const SizedBox(height: MmSpace.s4),
              Text(
                name.substring(0, 3),
                style: type.caption.copyWith(fontSize: 12, fontWeight: FontWeight.w600, color: chosen ? colors.ink : colors.ink3),
                textScaler: MediaQuery.textScalerOf(context).clamp(maxScaleFactor: 1.3),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
