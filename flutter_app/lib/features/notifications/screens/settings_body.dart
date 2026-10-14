import 'package:flutter/material.dart';

import '../../../core/models/notification_prefs.dart';
import '../../../core/motion/motion.dart';
import '../../../core/permissions/permission_requester.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/reminder_state.dart';
import '../logic/reminder_plan.dart' show repairReadyKey;
import '../widgets/day_shape.dart';
import '../widgets/settings_rows.dart';
import '../widgets/settings_sections.dart';
import '../widgets/time_sheet.dart';

/// What the settings body can ask for. The screen turns each into a save.
class SettingsActions {
  const SettingsActions({
    required this.onTurnOn,
    this.onOpenSettings,
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

  /// Opens Android's notification settings (shown while Android blocks reminders).
  final VoidCallback? onOpenSettings;
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
    this.permissionReading = false,
    required this.reminder,
    required this.cap,
    required this.freshChecksOpen,
    required this.actions,
    this.header,
  });

  final NotificationPrefs prefs;

  /// Null while Android has not answered yet (or the read failed): the panel shows its shape
  /// while [permissionReading], nothing otherwise, and no channel is dimmed as blocked, since
  /// nothing is known to be blocked.
  final NotificationPermission? permission;
  final bool permissionReading;

  /// The reminder state on this phone. Its `mutedUntil` is set only while a mute is running,
  /// in the student's own timezone, and dims every reminder channel with its end date.
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
    if (key == repairReadyKey) return reminder.repairReadyOn;
    return prefs.channelOn(key);
  }

  /// Mute for 7 days is running: reminders are on hold until it ends.
  DateTime? get _mutedUntil => reminder.mutedUntil;

  /// Why a reminder channel is on hold: stopped after unopened reminders, or the mute (which
  /// holds the reminders this phone plans: study window, repair ready and weekly plan).
  String? _pausedNote(String key) {
    if (reminder.category(key).paused) return NotificationsCopy.channelPaused;
    final until = _mutedUntil;
    if (until != null && key != NotificationChannelKeys.checkDue && _on(key)) return NotificationsCopy.channelMuted(until);
    return null;
  }

  /// The channel's own name, for the one-time hint.
  static String _reminderName(String key) => switch (key) {
        NotificationChannelKeys.studyWindow => NotificationsCopy.channelStudy,
        repairReadyKey => NotificationsCopy.channelRepair,
        NotificationChannelKeys.weeklyPlan => NotificationsCopy.channelWeekly,
        NotificationChannelKeys.checkDue => NotificationsCopy.channelCheck,
        _ => NotificationsCopy.channelResult,
      };

  /// A reminder channel reads as on hold while Android blocks it or a mute runs.
  bool _dim(bool blocked) => blocked || _mutedUntil != null;

  @override
  Widget build(BuildContext context) {
    final window = prefs.studyWindow;
    // The one-time hint is for a student whose reminders are running; with notifications off the
    // permission panel is the one thing to read.
    final hintKey = permission != NotificationPermission.granted
        ? null
        : [
            for (final e in reminder.categories.entries)
              if (e.value.hintPending) e.key,
          ].firstOrNull;
    final quietOff = prefs.quietStart == prefs.quietEnd;
    final blocked = permission == NotificationPermission.denied || permission == NotificationPermission.unavailable;

    final mutedUntil = _mutedUntil;

    // One authored entrance, riding the page's own transition: the title, the permission pane,
    // then the day and the channels. The groups further down are simply there.
    Widget group(int index, List<Widget> children) => MmStaggerItem(
          index: index,
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children),
        );

    return MmStagger(
      driver: MmStaggerDriver.route,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(
          MmSpace.gutter,
          0,
          MmSpace.gutter,
          MmSpace.s48,
        ),
        children: [
          if (header != null) MmStaggerItem(index: 0, child: header!),
          if (mutedUntil != null) ...[
            InlineBanner(
              message: NotificationsCopy.mutedBanner(mutedUntil),
              actionLabel: NotificationsCopy.unmute,
              onAction: actions.onUnmute,
            ),
            const SizedBox(height: MmRhythm.group),
          ],
          if (hintKey != null) ...[
            InlineBanner(
              message: NotificationsCopy.fewerReminders(_reminderName(hintKey)),
              actionLabel: NotificationsCopy.fewerRemindersDismiss,
              onAction: () => actions.onHintSeen(hintKey),
            ),
            const SizedBox(height: MmRhythm.group),
          ],
          if (permission case final known?)
            MmStaggerItem(
              index: 1,
              child: PermissionPanel(permission: known, onTurnOn: actions.onTurnOn, onOpenSettings: actions.onOpenSettings),
            )
          else if (permissionReading)
            const PermissionPanelSkeleton(),
          group(2, [
            const SectionHeading(NotificationsCopy.dayHeading),
            MmSurface.plain(
              child: DayShape(quietStart: prefs.quietStart, quietEnd: prefs.quietEnd, window: window),
            ),
          ]),
          group(3, [
            const SectionHeading(NotificationsCopy.channelsHeading),
            if (blocked) ...[
              const QuietNote(NotificationsCopy.blockedChannels),
              const SizedBox(height: MmSpace.s8),
            ],
            MmRowGroup(
              dividerIndent: MmSpace.s20,
              children: [
                ChannelRow(
                  title: NotificationsCopy.channelResult,
                  body: NotificationsCopy.channelResultBody,
                  value: prefs.channelOn(NotificationChannelKeys.resultReady),
                  onChanged: (on) => actions.onChannel(NotificationChannelKeys.resultReady, on),
                  dimmed: blocked,
                ),
                ChannelRow(
                  title: NotificationsCopy.channelStudy,
                  body: NotificationsCopy.channelStudyBody,
                  value: _on(NotificationChannelKeys.studyWindow),
                  note: _pausedNote(NotificationChannelKeys.studyWindow),
                  onChanged: (on) => actions.onChannel(NotificationChannelKeys.studyWindow, on),
                  dimmed: _dim(blocked),
                ),
                ChannelRow(
                  title: NotificationsCopy.channelRepair,
                  body: NotificationsCopy.channelRepairBody,
                  value: _on(repairReadyKey),
                  note: _pausedNote(repairReadyKey),
                  onChanged: (on) => actions.onChannel(repairReadyKey, on),
                  dimmed: _dim(blocked),
                ),
                ChannelRow(
                  title: NotificationsCopy.channelWeekly,
                  body: NotificationsCopy.channelWeeklyBody,
                  value: _on(NotificationChannelKeys.weeklyPlan),
                  note: _pausedNote(NotificationChannelKeys.weeklyPlan),
                  onChanged: (on) => actions.onChannel(NotificationChannelKeys.weeklyPlan, on),
                  dimmed: _dim(blocked),
                ),
                if (freshChecksOpen)
                  ChannelRow(
                    title: NotificationsCopy.channelCheck,
                    body: NotificationsCopy.channelCheckBody,
                    value: _on(NotificationChannelKeys.checkDue),
                    note: _pausedNote(NotificationChannelKeys.checkDue),
                    onChanged: (on) => actions.onChannel(NotificationChannelKeys.checkDue, on),
                    dimmed: blocked,
                  ),
              ],
            ),
          ]),
          const SectionHeading(NotificationsCopy.windowHeading),
          if (window == null)
            const QuietNote(NotificationsCopy.windowEmpty)
          else ...[
            MmRowGroup(
              dividerIndent: MmSpace.s20,
              children: [
                ValueRow(label: NotificationsCopy.windowStarts, value: formatClock(window.start), onTap: actions.onWindowStart),
                ValueRow(label: NotificationsCopy.windowEnds, value: formatClock(window.end), onTap: actions.onWindowEnd),
              ],
            ),
            if (prefs.studyWindowInQuietHours) ...[
              const SizedBox(height: MmRhythm.item),
              Padding(
                padding: const EdgeInsets.only(left: 4),
                child: ConflictLine(text: NotificationsCopy.conflict(formatClock(window.start))),
              ),
            ],
            const SizedBox(height: MmRhythm.item),
            Align(
              alignment: Alignment.centerLeft,
              child: KeyButton.secondary(
                label: NotificationsCopy.windowRemove,
                expanded: false,
                onPressed: actions.onRemoveWindow,
              ),
            ),
          ],
          const SectionHeading(NotificationsCopy.quietHeading),
          MmRowGroup(
            dividerIndent: MmSpace.s20,
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
      ),
    );
  }
}
