// "Your goal" (H1, option A, 19 Oct; mock-up goal-change-later-you): the daily time and the study
// days in one sheet, opened from You's goal row. The same four bubbles as onboarding (10, 20, 30 and
// More), Mobi's line from the student's own record (the smart layer's slot: only what the record
// says, else the plain line for the choice), the study days as a stepper, and Save my goal.
//
// The daily time stays on this phone in slice 1 (the server's study preferences hold 10, 20 or 30
// only, so they get the nearest of those, never a refusal); the study days are the server's weekly
// goal and are saved there. "Saved" shows only after the server answered.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api_error.dart';
import '../../../core/api/api_providers.dart' show nowProvider;
import '../../../core/haptics/haptics.dart';
import '../../../core/repositories/repositories.dart';
import '../../../core/settings/changed_row.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../onboarding/goal_copy.dart';
import '../../onboarding/state/answers_controller.dart' show onboardingAnswersProvider;
import '../../onboarding/widgets/goal_bubbles.dart';
import '../../today/copy_pattern.dart' show PatternCopy;
import '../../today/data/study_log_store.dart';
import '../../today/logic/study_pattern.dart';
import '../data/goal_pause.dart';
import '../data/student_target.dart' show daysForCount;

/// Opens the goal sheet.
Future<void> showDailyGoalSheet(BuildContext context) => showMmSheet<void>(
      context: context,
      title: GoalCopy.sheetTitle,
      builder: (sheet) => DailyGoalSheet(onSaved: () => Navigator.of(sheet).maybePop()),
    );

/// What Mobi's line in the sheet says, from [p] (null: the plain line for [minutes]) and the
/// goal it offers, if any. Only facts the pattern formed; never a guess.
({String line, String? header, int? offer}) goalSlot(StudyPattern? p, int minutes) {
  if (p != null) {
    final raise = p.raise;
    if (raise != null) return (line: GoalCopy.raiseLine(raise.minutes, raise.days, raise.outOf), header: GoalCopy.fromRecord, offer: raise.minutes);
    final fit = p.fit;
    final goal = p.goalMinutes;
    if (fit != null && goal != null) return (line: GoalCopy.fitLine(goal, fit.minutes), header: GoalCopy.fromRecord, offer: fit.minutes);
    final usual = p.length;
    if (usual != null && !usual.stated && !usual.ranged && !p.learning) {
      final t = p.time;
      final line = t != null && p.timeShape == TimeShape.known && p.shiftWindow == null
          ? GoalCopy.usualLineAt(usual.minutes, PatternCopy.time(t.afterMinute))
          : GoalCopy.usualLine(usual.minutes);
      return (line: line, header: GoalCopy.fromRecord, offer: null);
    }
  }
  return (line: GoalCopy.slotLine(minutes, inYou: true), header: null, offer: null);
}

class DailyGoalSheet extends ConsumerStatefulWidget {
  const DailyGoalSheet({super.key, this.onSaved});

  /// After a save the server acknowledged (the sheet closes).
  final VoidCallback? onSaved;

  @override
  ConsumerState<DailyGoalSheet> createState() => _DailyGoalSheetState();
}

class _DailyGoalSheetState extends ConsumerState<DailyGoalSheet> {
  int? _minutes;
  int? _days;
  bool _saving = false;
  String? _error;

  Future<void> _save({required int minutes, required int days, required int goalMinutes, required int? serverDays}) async {
    setState(() {
      _saving = true;
      _error = null;
    });
    // The daily time, on this phone (and the nearest length the server holds, never a refusal).
    final phoneDays = ref.read(onboardingAnswersProvider).value?.days;
    ref.read(dailyGoalWriterProvider).set(minutes, days: phoneDays == null || days == phoneDays.length ? null : daysForCount(phoneDays, days));
    if (serverDays != null && days != serverDays) {
      try {
        final goal = ref.read(goalRepositoryProvider).value;
        await ref.read(goalRepositoryProvider.notifier).save(daysPerWeek: days, pausedUntil: pauseToKeep(goal?.pausedUntil, ref.read(nowProvider)()));
      } on ApiError catch (e) {
        if (!mounted) return;
        setState(() {
          _saving = false;
          _minutes = null;
          _error = e.isOffline ? GoalCopy.daysOffline : GoalCopy.daysFailed;
        });
        return;
      }
    }
    if (!mounted) return;
    ref.read(changedSettingsRowProvider.notifier).mark(ChangedRowKeys.rhythm);
    unawaited(ref.read(hapticsProvider).success());
    setState(() => _saving = false);
    widget.onSaved?.call();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final answers = ref.watch(onboardingAnswersProvider).value;
    final goalMinutes = ref.watch(dailyGoalProvider) ?? answers?.minutes ?? 20;
    final serverDays = ref.watch(goalRepositoryProvider.select((s) => s.value?.daysPerWeek));
    final minutes = _minutes ?? goalMinutes;
    final days = _days ?? serverDays ?? answers?.days.length ?? 4;
    final goalSet = ref.watch(dailyGoalProvider) != null;
    final changed = minutes != goalMinutes || days != (serverDays ?? days) || !goalSet;
    final slot = goalSlot(ref.watch(studyPatternProvider), minutes);
    final offer = slot.offer;

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(GoalCopy.sheetLead, style: type.body.copyWith(color: colors.ink2)),
        const SizedBox(height: MmSpace.s20),
        GoalBubbles(
          value: minutes,
          onChanged: _saving
              ? null
              : (m) => setState(() {
                    _minutes = m;
                    _error = null;
                  }),
        ),
        const SizedBox(height: MmSpace.s16),
        // Mobi's line: from the record when it says something, else the plain line for the choice.
        DecoratedBox(
          decoration: ShapeDecoration(
            color: colors.raised.withValues(alpha: colors.isNight ? 0.6 : 0.8),
            shape: RoundedRectangleBorder(borderRadius: MmRadius.keyAll, side: BorderSide(color: colors.line)),
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s12, MmSpace.s16, MmSpace.s12),
            child: Semantics(
              liveRegion: true,
              container: true,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (slot.header != null) ...[
                    Text(slot.header!, style: type.caption.copyWith(color: colors.ink3)),
                    const SizedBox(height: MmSpace.s4),
                  ],
                  Text(slot.line, style: type.body.copyWith(color: colors.ink)),
                  if (offer != null && offer != minutes) ...[
                    const SizedBox(height: MmSpace.s12),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: KeyButton.secondary(
                        label: GoalCopy.useMinutes(offer),
                        expanded: false,
                        onPressed: _saving ? null : () => setState(() => _minutes = offer),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: MmSpace.s20),
        Row(
          children: [
            Expanded(child: Text(GoalCopy.studyDays, style: type.labelLarge.copyWith(fontSize: 17))),
            RoundKey(
              icon: LucideIcons.minus,
              label: GoalCopy.fewerDays,
              onTap: _saving || days <= 1 ? null : () => setState(() => _days = days - 1),
            ),
            SizedBox(
              width: 48,
              child: Semantics(
                liveRegion: true,
                label: GoalCopy.daysSpoken(days),
                excludeSemantics: true,
                child: Text('$days', textAlign: TextAlign.center, style: type.figureCompact.copyWith(fontSize: 30, height: 1)),
              ),
            ),
            RoundKey(
              icon: LucideIcons.plus,
              label: GoalCopy.moreDays,
              onTap: _saving || days >= 7 ? null : () => setState(() => _days = days + 1),
            ),
          ],
        ),
        const SizedBox(height: MmSpace.s20),
        if (_error != null) ...[
          InlineBanner(message: _error!, tone: BannerTone.error),
          const SizedBox(height: MmSpace.s12),
        ],
        KeyButton(
          label: GoalCopy.save,
          loading: _saving,
          onPressed: changed && !_saving ? () => _save(minutes: minutes, days: days, goalMinutes: goalMinutes, serverDays: serverDays) : null,
        ),
      ],
    );
  }
}
