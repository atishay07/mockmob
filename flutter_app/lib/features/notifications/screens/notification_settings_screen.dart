import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:timezone/timezone.dart' as tz;

import '../../../core/api/api_error.dart';
import '../../../core/api/api_providers.dart';
import '../../../core/copy/copy.dart';
import '../../../core/models/notification_prefs.dart';
import '../../../core/notifications/timezones.dart';
import '../../../core/permissions/permission_requester.dart';
import '../../../core/repositories/repositories.dart';
import '../../../core/router/routes.dart';
import '../../../core/storage/storage_providers.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../you/widgets/you_page.dart' show BackKey;
import '../copy.dart';
import '../data/reminder_state.dart';
import '../data/reminder_store.dart';
import '../services/notification_providers.dart';
import '../services/system_settings.dart';
import '../widgets/settings_rows.dart' show LoadingRows;
import '../widgets/time_sheet.dart';
import 'settings_body.dart';

/// A default study window, offered when the student turns the channel on with none set.
const StudyWindow defaultStudyWindow = StudyWindow(
  start: ClockTime(20, 0),
  end: ClockTime(21, 0),
);

enum _Save { idle, sending, saved, failed }

/// You, Notifications (spec 5.12.1). Every change is a real save: the line at the top says
/// Sending until the server answers, then that it was saved, or that it was not and what is
/// still in place.
class NotificationSettingsScreen extends ConsumerStatefulWidget {
  const NotificationSettingsScreen({super.key});

  @override
  ConsumerState<NotificationSettingsScreen> createState() =>
      _NotificationSettingsScreenState();
}

class _NotificationSettingsScreenState
    extends ConsumerState<NotificationSettingsScreen> {
  _Save _save = _Save.idle;
  DateTime? _savedAt;
  Future<void> Function()? _retry;
  AppLifecycleListener? _lifecycle;

  @override
  void initState() {
    super.initState();
    // The prefs load once per sign-in; read them again on open so an earlier failed read does
    // not leave the screen stale until the app restarts.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) unawaited(_repo.refresh());
    });
    // A student who turned notifications on in Android settings comes back to a current screen.
    _lifecycle = AppLifecycleListener(
      onResume: () {
        ref.invalidate(notificationPermissionProvider);
        unawaited(_repo.refresh());
      },
    );
  }

  @override
  void dispose() {
    _lifecycle?.dispose();
    super.dispose();
  }

  NotificationPrefsRepository get _repo =>
      ref.read(notificationPrefsRepositoryProvider.notifier);

  /// Runs one change as a save. [change] must finish only after the server acknowledged it.
  Future<void> _run(Future<void> Function() change) async {
    _retry = () => _run(change);
    setState(() => _save = _Save.sending);
    try {
      await change();
    } on Object {
      // The server did not confirm (or a local step threw): the pill resolves and offers a retry.
      if (mounted) setState(() => _save = _Save.failed);
      return;
    }
    // The server has acknowledged the change. Scheduling this phone is best effort and never
    // turns a saved change into a failed one.
    try {
      await ref.read(reminderSchedulerProvider).sync();
    } on Object {
      // The next app open syncs again.
    }
    if (!mounted) return;
    ref.invalidate(reminderStateProvider);
    ref.invalidate(weeklyCapProvider);
    setState(() {
      _save = _Save.saved;
      _savedAt = ref.read(nowProvider)();
    });
  }

  /// Times are shown in the student's own timezone.
  DateTime _inStudentZone(DateTime t) =>
      tz.TZDateTime.from(t, locationFor(_prefs.timezone));

  NotificationPrefs get _prefs =>
      ref.read(notificationPrefsRepositoryProvider).value ??
      NotificationPrefs.defaults;

  Future<void> _setChannel(String key, bool on) => _run(() async {
    final scheduler = ref.read(reminderSchedulerProvider);
    final needsWindow =
        on &&
        key == NotificationChannelKeys.studyWindow &&
        _prefs.studyWindow == null;
    await _repo.update(
      channels: {key: on},
      studyWindow: needsWindow ? defaultStudyWindow : null,
    );
    if (key == NotificationChannelKeys.weeklyPlan) {
      await scheduler.setWeeklyPlan(on);
    }
    if (on) await scheduler.resumeCategory(key);
  });

  Future<void> _pickQuiet({required bool start}) async {
    final p = _prefs;
    final picked = await showTimeSheet(
      context,
      what: start ? 'quiet hours start' : 'quiet hours end',
      initial: start ? p.quietStart : p.quietEnd,
    );
    if (picked == null || !mounted) return;
    await _run(() async {
      await _repo.update(
        quietStart: start ? picked : null,
        quietEnd: start ? null : picked,
      );
    });
  }

  Future<void> _pickWindow({required bool start}) async {
    final window = _prefs.studyWindow;
    if (window == null) return;
    final picked = await showTimeSheet(
      context,
      what: start ? 'study window start' : 'study window end',
      initial: start ? window.start : window.end,
      mustBeAfter: start ? null : window.start,
      afterReason: 'The window must end after it starts.',
    );
    if (picked == null || !mounted) return;
    var next = StudyWindow(
      start: start ? picked : window.start,
      end: start ? window.end : picked,
    );
    if (start && next.end.minutesOfDay <= next.start.minutesOfDay) {
      // Moving the start past the end carries the end along, an hour later (never past 11:59 PM).
      final end = (picked.minutesOfDay + 60).clamp(0, 23 * 60 + 59);
      next = StudyWindow(start: picked, end: ClockTime(end ~/ 60, end % 60));
    }
    await _run(() => _repo.update(studyWindow: next).then((_) {}));
  }

  Future<void> _turnOn() async {
    await openRemindersSheet(context);
    if (mounted) ref.invalidate(notificationPermissionProvider);
  }

  Future<void> _openSettings() async {
    final opened = await ref.read(systemSettingsProvider).openNotificationSettings();
    if (!opened && mounted) {
      ScaffoldMessenger.maybeOf(context)?.showSnackBar(const SnackBar(content: Text(NotificationsCopy.settingsDidNotOpen)));
    }
  }

  void _back() {
    final router = GoRouter.of(context);
    if (router.canPop()) {
      router.pop();
    } else {
      router.go(AppRoutes.you);
    }
  }

  SettingsActions get _actions => SettingsActions(
    onTurnOn: () => unawaited(_turnOn()),
    onOpenSettings: () => unawaited(_openSettings()),
    onChannel: (key, on) => unawaited(_setChannel(key, on)),
    onQuietStart: () => unawaited(_pickQuiet(start: true)),
    onQuietEnd: () => unawaited(_pickQuiet(start: false)),
    onWindowStart: () => unawaited(_pickWindow(start: true)),
    onWindowEnd: () => unawaited(_pickWindow(start: false)),
    onRemoveWindow: () => unawaited(
      _run(() async {
        await _repo.update(
          clearStudyWindow: true,
          channels: {NotificationChannelKeys.studyWindow: false},
        );
      }),
    ),
    onCap: (n) => unawaited(
      _run(() async {
        await _repo.update(weeklyCap: n);
        await ref.read(appPrefsProvider).setWeeklyCap(n);
      }),
    ),
    onMute: () => unawaited(ref.read(reminderSchedulerProvider).mute()),
    onUnmute: () => unawaited(ref.read(reminderSchedulerProvider).unmute()),
    onHintSeen: (key) => unawaited(
      ref.read(reminderSchedulerProvider).markFewerRemindersShown(key),
    ),
  );

  Widget _status() {
    switch (_save) {
      case _Save.idle:
        return const SizedBox.shrink();
      case _Save.sending:
        return const Align(
          alignment: Alignment.centerLeft,
          child: SavePill(state: SaveState.sending),
        );
      case _Save.saved:
        return ReceiptLine(
          text:
              'Settings saved on the server at ${formatTime12(_inStudentZone(_savedAt!))}.',
        );
      case _Save.failed:
        return InlineBanner(
          message: NotificationsCopy.saveFailed,
          tone: BannerTone.error,
          actionLabel: NotificationsCopy.retry,
          onAction: () => unawaited(_retry?.call()),
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final prefsState = ref.watch(notificationPrefsRepositoryProvider);
    final prefs = prefsState.value;
    final permission =
        ref.watch(notificationPermissionProvider).value ??
        NotificationPermission.unavailable;
    final now = ref.read(nowProvider)();
    var reminder =
        ref.watch(reminderStateProvider).value ?? const ReminderState();
    reminder = reminder.isMuted(now)
        ? reminder.copyWith(mutedUntil: _inStudentZone(reminder.mutedUntil!))
        : reminder.copyWith(clearMute: true);
    final cap = ref.watch(weeklyCapProvider).value ?? 3;
    final freshOpen = ref.watch(freshChecksOpenProvider);

    final Widget content;
    if (prefs != null) {
      content = SettingsBody(
        prefs: prefs,
        permission: permission,
        reminder: reminder,
        cap: cap,
        freshChecksOpen: freshOpen,
        actions: _actions,
        header: _Header(
          onBack: _back,
          status: _status(),
          stale: prefsState.isStale
              ? (prefsState.error!.isOffline
                    ? NotificationsCopy.staleBanner(
                        _inStudentZone(prefsState.fetchedAt ?? now),
                      )
                    : NotificationsCopy.staleBannerFailed(
                        _inStudentZone(prefsState.fetchedAt ?? now),
                      ))
              : null,
        ),
      );
    } else if (prefsState.isFailedEmpty) {
      final offline =
          prefsState.error?.kind == ApiErrorKind.network ||
          prefsState.error?.kind == ApiErrorKind.timeout;
      content = Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
            child: _Header(onBack: _back),
          ),
          Expanded(
            child: StateView(
              kind: offline ? StateViewKind.offline : StateViewKind.error,
              title: offline
                  ? NotificationsCopy.offlineTitle
                  : NotificationsCopy.loadFailedTitle,
              message: offline
                  ? NotificationsCopy.offlineBody
                  : NotificationsCopy.loadFailedBody,
              primary: StateAction(
                NotificationsCopy.retry,
                () => unawaited(_repo.refresh()),
              ),
            ),
          ),
        ],
      );
    } else {
      content = Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
            child: _Header(onBack: _back),
          ),
          const Padding(
            padding: EdgeInsets.all(MmSpace.gutter),
            child: LoadingRows(),
          ),
        ],
      );
    }

    return Scaffold(
      backgroundColor: colors.ground,
      body: Stack(
        children: [
          Positioned(
            left: 0,
            right: 0,
            top: 0,
            height: 300,
            child: IgnorePointer(
              child: LightField(
                pools: [
                  LightPool(
                    color: colors.lamp.withValues(alpha: colors.isNight ? 0.13 : 0.10),
                    center: const Alignment(-1.15, -1.25),
                    radius: 0.95,
                    aspect: 1.4,
                  ),
                ],
              ),
            ),
          ),
          SafeArea(
            bottom: false,
            child: Align(
              alignment: Alignment.topCenter,
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: MmSpace.contentMaxWidth),
                child: content,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// The back key, the title, the cached-copy notice and the save line.
class _Header extends StatelessWidget {
  const _Header({required this.onBack, this.status, this.stale});

  final VoidCallback onBack;
  final Widget? status;
  final String? stale;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: MmSpace.s8),
          child: Align(alignment: Alignment.centerLeft, child: Transform.translate(offset: const Offset(-4, 0), child: BackKey(onTap: onBack))),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(4, MmSpace.s12, 0, 0),
          child: Semantics(header: true, child: Text(NotificationsCopy.settingsTitle, style: type.headline)),
        ),
        const SizedBox(height: MmSpace.s12),
        if (stale != null) ...[
          InlineBanner.offlineStrip(message: stale!),
          const SizedBox(height: MmSpace.s12),
        ],
        // A slot that keeps its height, so the save line appearing does not shift the list.
        ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 28),
          child: Align(alignment: Alignment.centerLeft, child: status),
        ),
        const SizedBox(height: MmSpace.s12),
      ],
    );
  }
}
