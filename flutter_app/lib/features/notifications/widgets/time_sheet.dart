import 'package:flutter/material.dart';

import '../../../core/copy/copy.dart';
import '../../../core/models/notification_prefs.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import 'select_chip.dart';

/// "11:30 PM" for a clock time.
String formatClock(ClockTime t) =>
    formatTime12(DateTime(2026, 1, 1, t.hour, t.minute));

/// A 12-hour time picker in a sheet: hour, minute and AM or PM as plain choice keys, so every
/// choice is a 44 dp target and TalkBack reads it as a list of buttons. Returns the chosen
/// time, or null when the sheet is dismissed.
///
/// [mustBeAfter] disables the Set key until the time is later than it (a study window must end
/// after it starts).
Future<ClockTime?> showTimeSheet(
  BuildContext context, {
  required String what,
  required ClockTime initial,
  ClockTime? mustBeAfter,
  String? afterReason,
}) {
  return showMmSheet<ClockTime>(
    context: context,
    builder: (_) => TimeSheetBody(
      label: NotificationsCopy.pickLabel(what),
      initial: initial,
      mustBeAfter: mustBeAfter,
      afterReason: afterReason,
    ),
  );
}

class TimeSheetBody extends StatefulWidget {
  const TimeSheetBody({
    super.key,
    required this.initial,
    this.label,
    this.mustBeAfter,
    this.afterReason,
  });

  /// What is being set, shown small above the time ("Quiet hours start"). Also the sheet's
  /// heading for TalkBack, so it needs no separate title.
  final String? label;
  final ClockTime initial;
  final ClockTime? mustBeAfter;
  final String? afterReason;

  @override
  State<TimeSheetBody> createState() => _TimeSheetBodyState();
}

class _TimeSheetBodyState extends State<TimeSheetBody> {
  late int _hour12 = widget.initial.hour % 12 == 0
      ? 12
      : widget.initial.hour % 12;
  late int _minute = widget.initial.minute;
  late bool _pm = widget.initial.hour >= 12;

  ClockTime get _value => ClockTime((_hour12 % 12) + (_pm ? 12 : 0), _minute);

  List<int> get _minutes {
    const base = [0, 15, 30, 45];
    return base.contains(widget.initial.minute)
        ? base
        : ([...base, widget.initial.minute]..sort());
  }

  bool get _valid =>
      widget.mustBeAfter == null ||
      _value.minutesOfDay > widget.mustBeAfter!.minutesOfDay;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final readout = formatClock(_value);

    Widget group(String label, Widget child) => Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Semantics(
          header: true,
          child: Text(label, style: type.label.copyWith(color: colors.ink3)),
        ),
        const SizedBox(height: MmSpace.s8),
        child,
      ],
    );

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Room under the drag handle, then what is being set, small, over the time it holds.
        const SizedBox(height: MmSpace.s8),
        if (widget.label != null) ...[
          Semantics(
            header: true,
            child: Text(
              widget.label!,
              style: type.labelLarge.copyWith(color: colors.ink2),
              textAlign: TextAlign.center,
            ),
          ),
          const SizedBox(height: MmSpace.s4),
        ],
        Semantics(
          liveRegion: true,
          // Each choice answers on the next frame: the new time fades over the old in place
          // (instant under reduced motion), and nothing around it moves.
          child: AnimatedSwitcher(
            duration: Motion.of(context, Motion.release),
            switchInCurve: Motion.out,
            child: Text(
              readout,
              key: ValueKey(readout),
              // The display cut tracks tight for headlines; as a clock it needs air, or the 1s
              // and the colon run together.
              style: type.display.copyWith(letterSpacing: 0.5),
              textAlign: TextAlign.center,
            ),
          ),
        ),
        const SizedBox(height: MmSpace.s24),
        group(
          NotificationsCopy.pickHour,
          Wrap(
            spacing: MmSpace.s8,
            runSpacing: MmSpace.s8,
            children: [
              for (var h = 1; h <= 12; h++)
                SelectChip(
                  label: '$h',
                  selected: h == _hour12,
                  onSelected: () => setState(() => _hour12 = h),
                ),
            ],
          ),
        ),
        const SizedBox(height: MmSpace.s16),
        group(
          NotificationsCopy.pickMinute,
          Wrap(
            spacing: MmSpace.s8,
            runSpacing: MmSpace.s8,
            children: [
              for (final m in _minutes)
                SelectChip(
                  label: m.toString().padLeft(2, '0'),
                  minWidth: 52,
                  selected: m == _minute,
                  onSelected: () => setState(() => _minute = m),
                ),
            ],
          ),
        ),
        const SizedBox(height: MmSpace.s16),
        group(
          NotificationsCopy.pickPeriod,
          Wrap(
            spacing: MmSpace.s8,
            children: [
              SelectChip(
                label: NotificationsCopy.pickAm,
                minWidth: 64,
                selected: !_pm,
                onSelected: () => setState(() => _pm = false),
              ),
              SelectChip(
                label: NotificationsCopy.pickPm,
                minWidth: 64,
                selected: _pm,
                onSelected: () => setState(() => _pm = true),
              ),
            ],
          ),
        ),
        const SizedBox(height: MmSpace.s24),
        KeyButton(
          label: NotificationsCopy.pickSet(readout),
          onPressed: _valid ? () => Navigator.of(context).pop(_value) : null,
          disabledReason: _valid ? null : widget.afterReason,
        ),
      ],
    );
  }
}
