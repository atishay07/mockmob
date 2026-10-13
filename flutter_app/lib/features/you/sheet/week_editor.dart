import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api.dart';
import '../../../core/copy/copy.dart';
import '../../../core/haptics/haptics.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../onboarding/model/answers.dart' show OnboardingAnswers;
import '../../onboarding/model/choices.dart' show StudyTime;
import '../data/profile_editor.dart';
import '../data/student_target.dart';
import '../edit_copy.dart';

/// The study week, edited in place: which days, what time, how long. Saving sends the day count
/// to the weekly goal and the time to reminders, and says "saved" only after both answered.
class WeekEditor extends ConsumerStatefulWidget {
  const WeekEditor({super.key});

  @override
  ConsumerState<WeekEditor> createState() => _WeekEditorState();
}

class _WeekEditorState extends ConsumerState<WeekEditor> {
  late StudentWeek _start = _initial();
  late final Set<int> _days = {..._start.days};
  late StudyTime _window = _start.window;
  late int _minutes = _start.minutes;
  late bool _wasSet = ref.read(studentTargetProvider).week != null;
  bool _saving = false;
  String? _error;
  DateTime? _savedAt;

  StudentWeek _initial() {
    const d = OnboardingAnswers.empty;
    return ref.read(studentTargetProvider).week ?? StudentWeek(days: d.days, window: d.window, minutes: d.minutes);
  }

  bool get _changed =>
      !_wasSet || _window != _start.window || _minutes != _start.minutes || _days.length != _start.days.length || !_days.containsAll(_start.days);

  void _edit(VoidCallback change) => setState(() {
        change();
        _error = null;
        _savedAt = null;
      });

  void _toggleDay(int day) {
    if (_days.contains(day) && _days.length == 1) return;
    ref.read(hapticsProvider).selection();
    _edit(() => _days.contains(day) ? _days.remove(day) : _days.add(day));
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
      _savedAt = null;
    });
    try {
      await ref.read(profileEditorProvider).saveWeek(days: {..._days}, window: _window, minutes: _minutes);
      if (!mounted) return;
      setState(() {
        _saving = false;
        _wasSet = true;
        _start = StudentWeek(days: {..._days}, window: _window, minutes: _minutes);
        _savedAt = ref.read(nowProvider)();
      });
    } on WeekSaveError catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = switch (e.part) {
          WeekSavePart.studyTime => EditCopy.weekTimeFailed,
          WeekSavePart.length => EditCopy.weekLengthFailed,
          WeekSavePart.goal when e.error.code == 'goal_unknown' => EditCopy.weekGoalUnknown,
          WeekSavePart.goal => e.error.isOffline ? EditCopy.weekOffline : EditCopy.weekFailed,
        };
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final label = type.caption.copyWith(color: colors.ink3);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(EditCopy.weekDays, style: label),
        const SizedBox(height: MmSpace.s8),
        _DayPicker(days: _days, onToggle: _saving ? null : _toggleDay),
        const SizedBox(height: MmSpace.s20),
        Text(EditCopy.weekTime, style: label),
        const SizedBox(height: MmSpace.s8),
        Wrap(
          spacing: MmSpace.s8,
          runSpacing: MmSpace.s8,
          children: [
            for (final w in StudyTime.values)
              MmChip(
                label: '${w.label}, ${w.time}',
                selected: w == _window,
                onTap: _saving ? null : () => _edit(() => _window = w),
              ),
          ],
        ),
        const SizedBox(height: MmSpace.s20),
        Text(EditCopy.weekLength, style: label),
        const SizedBox(height: MmSpace.s8),
        MmSegmented<int>(
          semanticsLabel: EditCopy.weekLength,
          segments: [for (final m in const [10, 20, 30]) MmSegment(m, EditCopy.minutesLabel(m))],
          value: _minutes,
          onChanged: _saving ? null : (m) => _edit(() => _minutes = m),
        ),
        const SizedBox(height: MmSpace.s12),
        Text(EditCopy.weekNote, style: type.small.copyWith(color: colors.ink2)),
        const SizedBox(height: MmSpace.s20),
        if (_error != null) ...[
          InlineBanner(message: _error!, tone: BannerTone.error),
          const SizedBox(height: MmSpace.s12),
        ],
        KeyButton.secondary(label: EditCopy.weekSave, loading: _saving, onPressed: _changed && !_saving ? _save : null),
        if (_savedAt != null) ...[
          const SizedBox(height: MmSpace.s12),
          ReceiptLine(text: EditCopy.weekSaved(_savedAt!, _days.length, _window.plural, _window.time)),
        ],
      ],
    );
  }
}

/// Seven answer bubbles, Monday first: inked is a study day, hollow a rest day. At least one
/// day stays inked.
class _DayPicker extends StatelessWidget {
  const _DayPicker({required this.days, required this.onToggle});

  final Set<int> days;
  final ValueChanged<int>? onToggle;

  static const _letters = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final colors = context.mmColors;
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        for (var i = 0; i < 7; i++)
          MmPressable(
            semanticsLabel: EditCopy.dayLabel(weekdayNames[i], days.contains(i)),
            checked: days.contains(i),
            onTap: onToggle == null ? null : () => onToggle!(i),
            builder: (context, pressed, _) => SizedBox(
              width: MmTarget.min,
              height: 64,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Bubble(state: days.contains(i) ? BubbleState.filled : BubbleState.hollow, size: 30),
                  const SizedBox(height: MmSpace.s6),
                  Text(_letters[i], style: type.caption.copyWith(color: days.contains(i) ? colors.ink : colors.ink3)),
                ],
              ),
            ),
          ),
      ],
    );
  }
}
