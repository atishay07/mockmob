import 'package:flutter/material.dart';

import '../../../core/models/notification_prefs.dart';
import '../../../core/motion/motion.dart';
import '../../../core/permissions/permission_requester.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/reminder_state.dart';
import '../logic/next_reminder.dart';
import '../logic/reminder_plan.dart' show repairReadyKey;
import '../widgets/day_shape.dart';
import '../widgets/notification_header.dart';
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
    this.footerClearance = 0,
    this.next,
    this.mobi,
    this.now,
    this.onNextTap,
  });

  /// What the scheduler left after its last plan (null before the first one). Drives the line
  /// at the top and the dot on the day bar.
  final NextReminder? next;

  /// The header Mobi's controller (the screen cheers him when a save confirms). Null leaves the
  /// header out (tests of the plain list).
  final MobiController? mobi;
  final DateTime? now;

  /// Opens the time sheet for the study window's start.
  final VoidCallback? onNextTap;

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

  /// Sits above the list, inside the scroll (the back key and the title).
  final Widget? header;

  /// Extra room under the last row, for a notice pinned over the foot of the screen.
  final double footerClearance;

  bool _on(String key) {
    if (reminder.category(key).paused) return false;
    if (key == NotificationChannelKeys.weeklyPlan) {
      return prefs.channelOn(key) && reminder.weeklyPlanOn;
    }
    if (key == repairReadyKey) return reminder.repairReadyOn;
    return prefs.channelOn(key);
  }

  /// Any reminder is switched on (and not stopped).
  bool get _anyOn => [
        NotificationChannelKeys.resultReady,
        NotificationChannelKeys.studyWindow,
        repairReadyKey,
        NotificationChannelKeys.weeklyPlan,
        if (freshChecksOpen) NotificationChannelKeys.checkDue,
      ].any(_on);

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
    final panePending = permission == NotificationPermission.notAsked || blocked;
    final showMuteRow = mutedUntil != null && !panePending;
    final showHint = hintKey != null && !showMuteRow;
    // When all is well the "Notifications are on" row steps aside for whichever status is showing.
    final showPane = panePending || (!showMuteRow && !showHint);

    // Whether anything stands above "Your day": it then sits 24 below it (a hero to the next
    // block), where the section gaps are 32.
    final leadShown = showMuteRow || showHint || (permission != null && showPane) || permissionReading;

    // One authored entrance, riding the page's own transition: the title, the permission pane,
    // then the day and the channels. The groups further down are simply there.
    Widget group(int index, List<Widget> children) => MmStaggerItem(
          index: index,
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children),
        );

    return MmStagger(
      driver: MmStaggerDriver.route,
      child: ListView(
        // 32 of air under the last row, then the system bar, then any notice pinned over it.
        padding: EdgeInsets.fromLTRB(
          MmSpace.gutter,
          0,
          MmSpace.gutter,
          MmSpace.s32 + MediaQuery.viewPaddingOf(context).bottom + footerClearance,
        ),
        children: [
          if (header != null) MmStaggerItem(index: 0, child: header!),
          if (mobi != null)
            MmStaggerItem(
              index: 0,
              child: NotificationsHeader(
                mobi: mobi!,
                resting: _mutedUntil != null || !_anyOn,
                next: next,
                now: now ?? DateTime.now(),
                onNextTap: window == null ? null : onNextTap,
              ),
            ),
          // One status at a time, the most blocking first: a pane that needs an action (Turn on, Open
          // Android settings), then a running mute, then the one-time hint. The mute also shows
          // under Take a break and as a note on each held channel, so nothing is lost.
          if (showMuteRow) ...[
            MutedRow(message: NotificationsCopy.mutedBanner(mutedUntil), onUnmute: actions.onUnmute),
          ],
          if (showHint) ...[
            InlineBanner(
              message: NotificationsCopy.fewerReminders(_reminderName(hintKey)),
              actionLabel: NotificationsCopy.fewerRemindersDismiss,
              onAction: () => actions.onHintSeen(hintKey),
            ),
          ],
          if (permission case final known? when showPane)
            MmStaggerItem(
              index: 1,
              child: PermissionPanel(permission: known, onTurnOn: actions.onTurnOn, onOpenSettings: actions.onOpenSettings),
            )
          else if (permissionReading)
            const PermissionPanelSkeleton(),
          group(2, [
            SectionHeading(NotificationsCopy.dayHeading, topGap: leadShown ? MmSpace.s24 : 0),
            // The hero of the page: it sits straight on the ground, not in a card.
            DayShape(quietStart: prefs.quietStart, quietEnd: prefs.quietEnd, window: window, nextMinute: next?.minuteOfDay),
          ]),
          group(3, [
            const SectionHeading(NotificationsCopy.channelsHeading),
            if (blocked) ...[
              const QuietNote(NotificationsCopy.blockedChannels, afterHeading: true),
              const SizedBox(height: MmSpace.s8),
            ],
            MmRowGroup(
              dividerIndent: MmSpace.s16,
              children: [
                ChannelRow(
                  title: NotificationsCopy.channelResult,
                  body: NotificationsCopy.channelResultBody,
                  value: prefs.channelOn(NotificationChannelKeys.resultReady),
                  onChanged: (on) => actions.onChannel(NotificationChannelKeys.resultReady, on),
                  dimmed: blocked,
                  blocked: blocked,
                ),
                ChannelRow(
                  title: NotificationsCopy.channelStudy,
                  body: NotificationsCopy.channelStudyBody,
                  value: _on(NotificationChannelKeys.studyWindow),
                  note: _pausedNote(NotificationChannelKeys.studyWindow),
                  onChanged: (on) => actions.onChannel(NotificationChannelKeys.studyWindow, on),
                  dimmed: _dim(blocked),
                  blocked: blocked,
                ),
                ChannelRow(
                  title: NotificationsCopy.channelRepair,
                  body: NotificationsCopy.channelRepairBody,
                  value: _on(repairReadyKey),
                  note: _pausedNote(repairReadyKey),
                  onChanged: (on) => actions.onChannel(repairReadyKey, on),
                  dimmed: _dim(blocked),
                  blocked: blocked,
                ),
                ChannelRow(
                  title: NotificationsCopy.channelWeekly,
                  body: NotificationsCopy.channelWeeklyBody,
                  value: _on(NotificationChannelKeys.weeklyPlan),
                  note: _pausedNote(NotificationChannelKeys.weeklyPlan),
                  onChanged: (on) => actions.onChannel(NotificationChannelKeys.weeklyPlan, on),
                  dimmed: _dim(blocked),
                  blocked: blocked,
                ),
                if (freshChecksOpen)
                  ChannelRow(
                    title: NotificationsCopy.channelCheck,
                    body: NotificationsCopy.channelCheckBody,
                    value: _on(NotificationChannelKeys.checkDue),
                    note: _pausedNote(NotificationChannelKeys.checkDue),
                    onChanged: (on) => actions.onChannel(NotificationChannelKeys.checkDue, on),
                    dimmed: blocked,
                    blocked: blocked,
                  ),
              ],
            ),
          ]),
          const SectionHeading(NotificationsCopy.windowHeading),
          if (window == null)
            const QuietNote(NotificationsCopy.windowEmpty, afterHeading: true)
          else ...[
            MmRowGroup(
              dividerIndent: MmSpace.s16,
              children: [
                ValueRow(label: NotificationsCopy.windowStarts, value: formatClock(window.start), onTap: actions.onWindowStart),
                ValueRow(label: NotificationsCopy.windowEnds, value: formatClock(window.end), onTap: actions.onWindowEnd),
                // Inside the group it belongs to, as a quiet full-width row: not a pill floating
                // between sections, and never the weight of the primary key.
                ActionRow(label: NotificationsCopy.windowRemove, onTap: actions.onRemoveWindow),
              ],
            ),
            if (prefs.studyWindowInQuietHours) ...[
              const SizedBox(height: MmSpace.s12),
              ConflictLine(text: NotificationsCopy.conflict(formatClock(window.start))),
            ],
          ],
          const SectionHeading(NotificationsCopy.quietHeading),
          MmRowGroup(
            dividerIndent: MmSpace.s16,
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
