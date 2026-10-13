import 'package:flutter/material.dart';

import '../../../core/models/notification_prefs.dart';
import '../../../core/permissions/permission_requester.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../you/widgets/you_row.dart' show YouPanel;
import '../copy.dart';
import '../data/reminder_state.dart';
import '../widgets/day_shape.dart';
import '../widgets/settings_rows.dart';
import '../widgets/settings_sections.dart';
import '../widgets/time_sheet.dart';

/// What the settings body can ask for. The screen turns each into a save.
class SettingsActions {
  const SettingsActions({
    required this.onTurnOn,
    required this.onChannel,
    required this.onQuietStart,
    required this.onQuietEnd,
    required this.onWindowStart,
    required this.onWindowEnd,
    required this.onRemoveWindow,
    required this.onCap,
    required this.onMute,
    required this.onUnmute,
    required this.onHintSeen,
  });

  final VoidCallback onTurnOn;
  final void Function(String key, bool on) onChannel;
  final VoidCallback onQuietStart;
  final VoidCallback onQuietEnd;
  final VoidCallback onWindowStart;
  final VoidCallback onWindowEnd;
  final VoidCallback onRemoveWindow;
  final ValueChanged<int> onCap;
  final VoidCallback onMute;
  final VoidCallback onUnmute;
  final ValueChanged<String> onHintSeen;
}

/// The settings list of spec 5.12.1, as a pure view of its inputs.
class SettingsBody extends StatelessWidget {
  const SettingsBody({
    super.key,
    required this.prefs,
    required this.permission,
    required this.reminder,
    required this.cap,
    required this.freshChecksOpen,
    required this.actions,
    this.header,
  });

  final NotificationPrefs prefs;
  final NotificationPermission permission;
  final ReminderState reminder;
  final int cap;
  final bool freshChecksOpen;
  final SettingsActions actions;

  /// Sits above the list, inside the scroll (the title and the save line).
  final Widget? header;

  bool _on(String key) {
    if (reminder.category(key).paused) return false;
    if (key == NotificationChannelKeys.weeklyPlan) {
      return prefs.channelOn(key) && reminder.weeklyPlanOn;
    }
    return prefs.channelOn(key);
  }

  String? _pausedNote(String key) =>
      reminder.category(key).paused ? NotificationsCopy.channelPaused : null;

  @override
  Widget build(BuildContext context) {
    final window = prefs.studyWindow;
    final hintKey = [
      for (final e in reminder.categories.entries)
        if (e.value.hintPending) e.key,
    ].firstOrNull;
    final quietOff = prefs.quietStart == prefs.quietEnd;

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        MmSpace.gutter,
        0,
        MmSpace.gutter,
        MmSpace.s48,
      ),
      children: [
        ?header,
        if (hintKey != null) ...[
          InlineBanner(
            message: NotificationsCopy.fewerReminders,
            actionLabel: NotificationsCopy.fewerRemindersDismiss,
            onAction: () => actions.onHintSeen(hintKey),
          ),
          const SizedBox(height: MmSpace.s16),
        ],
        PermissionPanel(permission: permission, onTurnOn: actions.onTurnOn),
        const SectionHeading(NotificationsCopy.dayHeading),
        YouPanel(
          margin: EdgeInsets.zero,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s12, MmSpace.gutter, MmSpace.gutter),
              child: DayShape(quietStart: prefs.quietStart, quietEnd: prefs.quietEnd, window: window),
            ),
          ],
        ),
        const SectionHeading(NotificationsCopy.channelsHeading),
        YouPanel(
          margin: EdgeInsets.zero,
          children: [
            ChannelRow(
              title: NotificationsCopy.channelResult,
              body: NotificationsCopy.channelResultBody,
              value: prefs.channelOn(NotificationChannelKeys.resultReady),
              onChanged: (on) => actions.onChannel(NotificationChannelKeys.resultReady, on),
            ),
            ChannelRow(
              title: NotificationsCopy.channelStudy,
              body: NotificationsCopy.channelStudyBody,
              value: _on(NotificationChannelKeys.studyWindow),
              note: _pausedNote(NotificationChannelKeys.studyWindow),
              onChanged: (on) => actions.onChannel(NotificationChannelKeys.studyWindow, on),
            ),
            ChannelRow(
              title: NotificationsCopy.channelWeekly,
              body: NotificationsCopy.channelWeeklyBody,
              value: _on(NotificationChannelKeys.weeklyPlan),
              note: _pausedNote(NotificationChannelKeys.weeklyPlan),
              onChanged: (on) => actions.onChannel(NotificationChannelKeys.weeklyPlan, on),
            ),
            if (freshChecksOpen)
              ChannelRow(
                title: NotificationsCopy.channelCheck,
                body: NotificationsCopy.channelCheckBody,
                value: _on(NotificationChannelKeys.checkDue),
                note: _pausedNote(NotificationChannelKeys.checkDue),
                onChanged: (on) => actions.onChannel(NotificationChannelKeys.checkDue, on),
              ),
          ],
        ),
        const SectionHeading(NotificationsCopy.windowHeading),
        if (window == null)
          const QuietNote(NotificationsCopy.windowEmpty)
        else ...[
          YouPanel(
            margin: EdgeInsets.zero,
            children: [
              ValueRow(label: NotificationsCopy.windowStarts, value: formatClock(window.start), onTap: actions.onWindowStart),
              ValueRow(label: NotificationsCopy.windowEnds, value: formatClock(window.end), onTap: actions.onWindowEnd),
            ],
          ),
          if (prefs.studyWindowInQuietHours) ...[
            const SizedBox(height: MmSpace.s12),
            Padding(
              padding: const EdgeInsets.only(left: 4),
              child: ConflictLine(text: NotificationsCopy.conflict(formatClock(window.start))),
            ),
          ],
          const SizedBox(height: MmSpace.s4),
          Align(
            alignment: Alignment.centerLeft,
            child: Transform.translate(
              offset: const Offset(-MmSpace.s12, 0),
              child: KeyButton.quiet(label: NotificationsCopy.windowRemove, onPressed: actions.onRemoveWindow),
            ),
          ),
        ],
        const SectionHeading(NotificationsCopy.quietHeading),
        YouPanel(
          margin: EdgeInsets.zero,
          children: [
            ValueRow(label: NotificationsCopy.quietStarts, value: formatClock(prefs.quietStart), onTap: actions.onQuietStart),
            ValueRow(label: NotificationsCopy.quietEnds, value: formatClock(prefs.quietEnd), onTap: actions.onQuietEnd),
          ],
        ),
        QuietNote(quietOff ? NotificationsCopy.dayQuietOff : NotificationsCopy.quietBody),
        const SectionHeading(NotificationsCopy.capHeading),
        CapChips(value: cap, onChanged: actions.onCap),
        const QuietNote(NotificationsCopy.capBody),
        const SectionHeading(NotificationsCopy.muteHeading),
        MuteSection(
          mutedUntil: reminder.mutedUntil,
          onMute: actions.onMute,
          onUnmute: actions.onUnmute,
        ),
      ],
    );
  }
}
