import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api.dart';
import '../../../core/copy/copy.dart';
import '../../../core/haptics/haptics.dart';
import '../../../core/repositories/repositories.dart' show goalRepositoryProvider;
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../onboarding/model/answers.dart' show OnboardingAnswers;
import '../../onboarding/model/choices.dart' show StudyTime;
import '../../onboarding/state/answers_controller.dart' show onboardingAnswersProvider;
import '../data/profile_editor.dart';
import '../data/student_target.dart';
import '../edit_copy.dart';
import '../widgets/you_page.dart' show youText;

/// The study week, edited in place: which days, what time, how long. Saving sends the day count
/// to the weekly goal and the time to reminders, and says "saved" only after both answered. The
/// Save key is not drawn here: it is pinned at the foot of the page by [WeekSaveFooter], fed by
/// the [controller].
class WeekEditor extends ConsumerStatefulWidget {
  const WeekEditor({super.key, this.controller});

  /// Where the pinned Save key reads its state. Null draws no Save key (the editor alone).
  final WeekSaveController? controller;

  @override
  ConsumerState<WeekEditor> createState() => _WeekEditorState();
}

class _WeekEditorState extends ConsumerState<WeekEditor> {
  late StudentWeek _start;
  late Set<int> _days;
  late StudyTime _window;
  late int _minutes;
  late bool _wasSet;

  /// The student has changed something. Until then the editor follows the phone's answers and the
  /// server's goal as they load, so it never shows (or saves) a stale copy.
  bool _touched = false;

  /// The student changed the day picker, so the day count is theirs to send.
  bool _daysTouched = false;
  bool _saving = false;
  String? _error;
  DateTime? _savedAt;

  @override
  void initState() {
    super.initState();
    _seed();
  }

  /// The week as the phone kept it, with the day count of the server's goal when it is known: the
  /// goal is what Save compares against, and the Goal screen can change it without this phone.
  void _seed() {
    const d = OnboardingAnswers.empty;
    final week = ref.read(studentTargetProvider).week;
    final goalDays = ref.read(goalRepositoryProvider).value?.daysPerWeek;
    final days = week?.days ?? d.days;
    _start = StudentWeek(
      days: goalDays == null ? {...days} : daysForCount(days, goalDays),
      window: week?.window ?? d.window,
      minutes: week?.minutes ?? d.minutes,
    );
    _days = {..._start.days};
    _window = _start.window;
    _minutes = _start.minutes;
    _wasSet = week != null;
  }

  void _follow() {
    if (_touched || _saving || !mounted) return;
    setState(_seed);
  }

  bool get _changed =>
      !_wasSet || _window != _start.window || _minutes != _start.minutes || _days.length != _start.days.length || !_days.containsAll(_start.days);

  void _edit(VoidCallback change) => setState(() {
        change();
        _touched = true;
        _error = null;
        _savedAt = null;
      });

  void _toggleDay(int day) {
    if (_days.contains(day) && _days.length == 1) return;
    ref.read(hapticsProvider).selection();
    _edit(() {
      _daysTouched = true;
      _days.contains(day) ? _days.remove(day) : _days.add(day);
    });
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
      _savedAt = null;
    });
    try {
      final saved = await ref.read(profileEditorProvider).saveWeek(
            days: {..._days},
            window: _window,
            minutes: _minutes,
            daysEdited: _daysTouched,
          );
      if (!mounted) return;
      setState(() {
        _saving = false;
        _wasSet = true;
        _days = {...saved};
        _start = StudentWeek(days: {...saved}, window: _window, minutes: _minutes);
        // Saved: from here the editor follows the phone and the server again.
        _touched = false;
        _daysTouched = false;
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

  /// Tells the page's pinned footer what Save should look like.
  void _publish({required bool loaded}) {
    final controller = widget.controller;
    if (controller == null) return;
    final canSave = loaded && _changed && !_saving;
    final reason = loaded && !_changed && !_saving && _savedAt == null ? EditCopy.weekUnchanged : null;
    final receipt = _savedAt == null ? null : EditCopy.weekSaved(_savedAt!, _days.length, _window.plural, _window.time);
    // After the frame: the footer is rebuilt by the listener, never during this build.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      controller.update(canSave: canSave, saving: _saving, disabledReason: reason, error: _error, receipt: receipt, onSave: _save);
    });
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<StudentWeek?>(studentTargetProvider.select((t) => t.week), (before, now) => _follow());
    ref.listen<int?>(goalRepositoryProvider.select((s) => s.value?.daysPerWeek), (before, now) => _follow());
    // Until the phone's answers have loaded the week is a guess, so Save waits for them.
    final loaded = !ref.watch(onboardingAnswersProvider.select((a) => a.isLoading));
    _publish(loaded: loaded);
    final colors = context.mmColors;
    final type = context.mmType;
    final label = type.caption.copyWith(color: colors.ink2);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // The count says what the chosen days add up to: it becomes the weekly goal.
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: youText),
          child: Row(
            children: [
              Expanded(child: Text(EditCopy.weekDays, style: label)),
              Semantics(
                liveRegion: true,
                child: Text(EditCopy.weekDaysCount(_days.length), style: type.labelLarge.copyWith(fontSize: 14)),
              ),
            ],
          ),
        ),
        const SizedBox(height: MmSpace.s4),
        // Seven 48 dp targets need 336 dp, more than the 328 dp inside the gutters of a 360 dp
        // phone, so the picker takes the full width less 12 dp a side.
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12),
          child: _DayPicker(days: _days, onToggle: _saving ? null : _toggleDay),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: youText),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: MmSpace.s20),
              Text(EditCopy.weekTime, style: label),
              const SizedBox(height: MmSpace.s8),
              // A 2 by 2 grid of equal pills, so the times line up whatever their words.
              for (var row = 0; row < StudyTime.values.length; row += 2)
                Padding(
                  padding: EdgeInsets.only(top: row == 0 ? 0 : MmSpace.s8),
                  child: Row(
                    children: [
                      for (var i = row; i < row + 2 && i < StudyTime.values.length; i++) ...[
                        if (i > row) const SizedBox(width: MmSpace.s8),
                        Expanded(
                          child: _TimeChoice(
                            label: '${StudyTime.values[i].label}, ${StudyTime.values[i].time}',
                            selected: StudyTime.values[i] == _window,
                            onTap: _saving ? null : () => _edit(() => _window = StudyTime.values[i]),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              const SizedBox(height: MmSpace.s20),
              Text(EditCopy.weekLength, style: label),
              const SizedBox(height: MmSpace.s8),
              MmSegmented<int>(
                semanticsLabel: EditCopy.weekLength,
                // A longer daily goal (More, H1) stays on the control as its own segment, so saving
                // the week never quietly turns it back into 30.
                segments: [for (final m in {10, 20, 30, if (![10, 20, 30].contains(_start.minutes)) _start.minutes}) MmSegment(m, EditCopy.minutesLabel(m))],
                value: _minutes,
                onChanged: _saving ? null : (m) => _edit(() => _minutes = m),
              ),
              const SizedBox(height: MmSpace.s12),
              Text(EditCopy.weekNote, style: type.small.copyWith(color: colors.ink2)),
            ],
          ),
        ),
      ],
    );
  }
}

/// What the pinned Save key at the foot of the sheet editor shows, kept by the [WeekEditor]
/// above it. The key stays on screen however long the page is.
class WeekSaveController extends ChangeNotifier {
  bool canSave = false;
  bool saving = false;
  String? disabledReason;
  String? error;
  String? receipt;
  VoidCallback? onSave;

  void update({
    required bool canSave,
    required bool saving,
    required String? disabledReason,
    required String? error,
    required String? receipt,
    required VoidCallback onSave,
  }) {
    if (this.canSave == canSave &&
        this.saving == saving &&
        this.disabledReason == disabledReason &&
        this.error == error &&
        this.receipt == receipt) {
      this.onSave = onSave;
      return;
    }
    this.canSave = canSave;
    this.saving = saving;
    this.disabledReason = disabledReason;
    this.error = error;
    this.receipt = receipt;
    this.onSave = onSave;
    notifyListeners();
  }
}

/// The pinned footer of the sheet editor: what happened, then the one volt key.
class WeekSaveFooter extends StatelessWidget {
  const WeekSaveFooter({super.key, required this.controller});

  final WeekSaveController controller;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: controller,
      builder: (context, _) => Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (controller.error != null) ...[
            InlineBanner(message: controller.error!, tone: BannerTone.error),
            const SizedBox(height: MmSpace.s12),
          ],
          if (controller.receipt != null) ...[
            ReceiptLine(text: controller.receipt!),
            const SizedBox(height: MmSpace.s12),
          ],
          KeyButton(
            label: EditCopy.weekSave,
            loading: controller.saving,
            onPressed: controller.canSave ? controller.onSave : null,
            disabledReason: controller.disabledReason,
          ),
        ],
      ),
    );
  }
}

/// One study time: a full-width 48 dp pill with the answer bubble, so the four share a width.
class _TimeChoice extends ConsumerWidget {
  const _TimeChoice({required this.label, required this.selected, required this.onTap});

  final String label;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final disabled = onTap == null;
    return MmPressable(
      semanticsLabel: label,
      selected: selected,
      onTap: disabled
          ? null
          : () {
              ref.read(hapticsProvider).selection();
              onTap!();
            },
      builder: (context, pressed, _) => SizedBox(
        height: MmTarget.min,
        child: DecoratedBox(
          decoration: ShapeDecoration(
            color: MmSelection.fill(colors, selected: selected, pressed: pressed),
            shape: StadiumBorder(side: MmSelection.side(colors, selected: selected)),
          ),
          child: Padding(
            padding: const EdgeInsets.only(left: MmSpace.s12, right: MmSpace.s8),
            child: Row(
              children: [
                _Radio(selected: selected),
                const SizedBox(width: MmSpace.s8),
                Expanded(
                  // Shrinks a little on a narrow phone rather than cutting the time.
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    alignment: Alignment.centerLeft,
                    child: Text(
                      label,
                      maxLines: 1,
                      softWrap: false,
                      style: context.mmType.labelLarge.copyWith(fontSize: 14, color: disabled ? colors.ink4 : colors.ink),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
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
      children: [
        for (var i = 0; i < 7; i++)
          Expanded(
            child: MmPressable(
              semanticsLabel: EditCopy.dayLabel(weekdayNames[i], days.contains(i)),
              checked: days.contains(i),
              onTap: onToggle == null ? null : () => onToggle!(i),
              builder: (context, pressed, _) => SizedBox(
                height: 64,
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Bubble(state: days.contains(i) ? BubbleState.filled : BubbleState.hollow, size: 32),
                    const SizedBox(height: MmSpace.s6),
                    Text(_letters[i], style: type.labelLarge.copyWith(fontSize: 15, color: days.contains(i) ? colors.ink : colors.ink2)),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }
}

/// The choice mark of a time pill: a clear ring when open, the inked bubble with a tick when
/// chosen (the old 10 dp dot was hard to see on the pill).
class _Radio extends StatelessWidget {
  const _Radio({required this.selected});

  final bool selected;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return ExcludeSemantics(
      child: SizedBox.square(
        dimension: 20,
        child: selected
            ? Stack(
                alignment: Alignment.center,
                children: [
                  const Bubble(state: BubbleState.filled, size: 20),
                  Icon(LucideIcons.check, size: 13, color: colors.voltInk),
                ],
              )
            : DecoratedBox(decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: colors.ink3, width: 1.6))),
      ),
    );
  }
}
