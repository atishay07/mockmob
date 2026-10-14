// The study days editor (spec 5.11, owner feedback 13 Oct): the student taps the weekdays they
// plan to study. Their number is the weekly goal, saved on the server first; which days they are
// stays on this phone and draws the rest days in the week. Rest is part of the plan, never a miss.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/copy/formatters.dart';
import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../onboarding/onboarding.dart';
import '../copy.dart';
import '../data/rhythm_providers.dart';
import '../data/study_days.dart';
import 'week_dial.dart';

/// Opens the study days editor. Saves through `RhythmActions.saveStudyDays` and closes when the
/// server acknowledged the goal. Returns the saved number of days, or null when dismissed. [done] is
/// the study days counted this week, for the live ring above the days.
Future<int?> showGoalEditor(BuildContext context, {required int initialDays, int done = 0}) {
  return showMmSheet<int>(
    context: context,
    title: RhythmCopy.daysTitle,
    builder: (context) => GoalEditor(initialDays: initialDays, done: done),
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
  const GoalEditor({super.key, required this.initialDays, this.done = 0, this.initialPlan, this.onSave});

  /// The goal on the server now.
  final int initialDays;

  /// Study days counted this week: the live ring above the days shows them against the new goal.
  final int done;

  /// The days chosen before; defaults to this phone's plan, else the onboarding's.
  final Set<int>? initialPlan;

  /// Defaults to `RhythmActions.saveStudyDays`. Throws when the save fails.
  final Future<void> Function(Set<int> days)? onSave;

  @override
  ConsumerState<GoalEditor> createState() => _GoalEditorState();
}

/// The quick choices above the days: a count of days spread through the week, or Monday to Friday.
/// Each one is a plain set of weekdays (0 = Monday).
const Map<String, Set<int>> studyDayPresets = {
  RhythmCopy.presetThree: {0, 2, 4},
  RhythmCopy.presetFour: {0, 1, 3, 5},
  RhythmCopy.presetFive: {0, 1, 2, 4, 5},
  RhythmCopy.presetWeekdays: {0, 1, 2, 3, 4},
};

class _GoalEditorState extends ConsumerState<GoalEditor> {
  late Set<int> _days = _initial();
  final MobiController _mobi = MobiController();
  bool _saving = false;
  bool _failed = false;

  /// Mobi listens once the student starts choosing, and thinks when the week gets very full.
  bool _choosing = false;

  Set<int> _initial() {
    final known = widget.initialPlan ?? ref.read(plannedDaysProvider) ?? ref.read(studentSheetProvider)?.days;
    final goal = widget.initialDays.clamp(1, 7);
    if (known != null && known.length == goal) return {...known};
    return spreadDays(goal);
  }

  @override
  void dispose() {
    _mobi.dispose();
    super.dispose();
  }

  /// Mobi follows the choice: listening while days are picked, thinking at six or seven (a full
  /// week is a lot to plan). These are reactions, so reduced motion shows only a still pose, and
  /// a quick run of taps is answered once, not on every tap.
  void _react() {
    if (_days.length >= 6) {
      _mobi.setMood(MobiMood.curious);
      _mobi.react(MobiAct.think, key: 'rhythm-days:full', gap: _answerGap);
    } else if (_choosing) {
      _mobi.setMood(MobiMood.calm);
      _mobi.react(MobiMoments.act(MobiEvent.choiceWitnessed), key: 'rhythm-days:choose', gap: _answerGap);
    }
  }

  static const Duration _answerGap = Duration(milliseconds: 900);

  /// The selection tick is the press's own (`MmPressHaptic.selection` on the day).
  void _toggle(int day) {
    setState(() {
      _failed = false;
      _choosing = true;
      _days = _days.contains(day) ? ({..._days}..remove(day)) : {..._days, day};
    });
    _react();
  }

  void _preset(Set<int> days) {
    ref.read(hapticsProvider).selection();
    setState(() {
      _failed = false;
      _choosing = true;
      _days = {...days};
    });
    _react();
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
        // The week as it will be: the ring above the days reshapes as they are tapped, with this
        // week's real count in it. Mobi listens beside it.
        SizedBox(
          height: 96,
          child: Stack(
            alignment: Alignment.center,
            children: [
              WeekDial(done: widget.done, goal: _days.isEmpty ? 1 : _days.length, size: 96, showWords: false),
              Align(
                alignment: Alignment.centerRight,
                child: MobiCharacter(controller: _mobi, size: 68, entrance: MobiAct.appear, watchTaps: false, seed: 5),
              ),
            ],
          ),
        ),
        const SizedBox(height: MmSpace.s16),
        Row(
          children: [
            for (var d = 0; d < 7; d++)
              Expanded(child: _DayToggle(day: d, chosen: _days.contains(d), onTap: _saving ? null : () => _toggle(d))),
          ],
        ),
        const SizedBox(height: MmSpace.s12),
        Semantics(
          container: true,
          label: RhythmCopy.presetsLabel,
          child: Wrap(
            spacing: MmSpace.s8,
            runSpacing: MmSpace.s8,
            children: [
              for (final e in studyDayPresets.entries)
                _PresetChip(
                  label: e.key,
                  selected: _days.length == e.value.length && _days.containsAll(e.value),
                  onTap: _saving ? null : () => _preset(e.value),
                ),
            ],
          ),
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

/// One quick choice: a pill that inks when the days chosen are exactly its days.
class _PresetChip extends StatelessWidget {
  const _PresetChip({required this.label, required this.selected, required this.onTap});

  final String label;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      onTap: onTap,
      semanticsLabel: label,
      selected: selected,
      haptic: MmPressHaptic.none,
      builder: (context, pressed, focused) => AnimatedContainer(
        duration: Motion.of(context, const Duration(milliseconds: 180)),
        curve: Motion.emphasized,
        constraints: const BoxConstraints(minHeight: 36),
        // 12 dp a side, so the four quick choices sit on one row on a 360 dp phone.
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12, vertical: MmSpace.s8),
        decoration: ShapeDecoration(
          color: selected ? colors.selectedSurface : colors.sunken,
          shape: StadiumBorder(side: BorderSide(color: selected ? colors.ink2 : colors.line)),
        ),
        child: Text(
          label,
          style: type.labelLarge.copyWith(fontSize: 14, color: selected ? colors.ink : colors.ink2),
          textScaler: MediaQuery.textScalerOf(context).clamp(maxScaleFactor: 1.3),
        ),
      ),
    );
  }
}

/// One weekday: an inked bubble when it is a study day, the dashed rest mark when it is not,
/// with the day's short name beneath. A 48 dp target that answers on the next frame: it sinks on
/// the press spring, a veil washes it, and a selection tick fires on release. The bubble itself
/// springs when its state changes: it squeezes and rebounds like a pencil mark pressed in.
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
                child: Center(child: _SpringBubble(chosen: chosen)),
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

/// The day's bubble, with a spring when it flips: inking squeezes it to 0.78 and it rebounds past
/// full size before settling (an elastic curve over 420 ms); letting a day go settles back from
/// 0.9. One transform on the bubble, nothing laid out again. Still under reduced motion.
class _SpringBubble extends StatefulWidget {
  const _SpringBubble({required this.chosen});

  final bool chosen;

  @override
  State<_SpringBubble> createState() => _SpringBubbleState();
}

class _SpringBubbleState extends State<_SpringBubble> with SingleTickerProviderStateMixin {
  late final AnimationController _spring = AnimationController(vsync: this, duration: const Duration(milliseconds: 420), value: 1);

  @override
  void didUpdateWidget(_SpringBubble old) {
    super.didUpdateWidget(old);
    if (old.chosen != widget.chosen && !Motion.reduced(context)) _spring.forward(from: 0);
  }

  @override
  void dispose() {
    _spring.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final chosen = widget.chosen;
    return AnimatedBuilder(
      animation: _spring,
      builder: (context, child) {
        final t = _spring.value;
        final from = chosen ? 0.78 : 0.9;
        final scale = from + (1 - from) * (chosen ? Curves.elasticOut.transform(t) : Curves.easeOutBack.transform(t));
        return Transform.scale(scale: scale, child: child);
      },
      child: RepaintBoundary(child: Bubble(state: chosen ? BubbleState.filled : BubbleState.rest, size: 34)),
    );
  }
}
