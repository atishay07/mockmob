import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:timezone/timezone.dart' as tz;

import '../../../core/api/api_error.dart';
import '../../../core/api/api_providers.dart';
import '../../../core/models/notification_prefs.dart';
import '../../../core/motion/motion.dart';
import '../../../core/notifications/timezones.dart';
import '../../../core/repositories/repositories.dart';
import '../../../core/router/routes.dart';
import '../../../core/storage/storage_providers.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../you/widgets/you_page.dart' show BackKey;
import '../copy.dart';
import '../data/reminder_state.dart';
import '../data/reminder_store.dart';
import '../logic/reminder_plan.dart' show repairReadyKey;
import '../services/notification_providers.dart';
import '../services/reminder_scheduler.dart' show muteLength;
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

/// A change shown at once, before the server (or the phone's storage) has confirmed it. It
/// lives until its save finishes: when the save succeeds the real state already says the same,
/// and when it fails the screen falls back to what is really stored.
class _Edit {
  const _Edit({this.prefs, this.reminder, this.cap});

  final NotificationPrefs Function(NotificationPrefs)? prefs;
  final ReminderState Function(ReminderState)? reminder;
  final int? cap;
}

/// A save that failed, kept so Try again can run it once more.
class _Failed {
  const _Failed(this.change, this.local, this.edit);

  final Future<void> Function() change;
  final bool local;
  final _Edit? edit;
}

NotificationPrefs _prefsWith(
  NotificationPrefs p, {
  ClockTime? quietStart,
  ClockTime? quietEnd,
  Map<String, bool>? channels,
  StudyWindow? studyWindow,
  bool clearStudyWindow = false,
}) => NotificationPrefs(
  timezone: p.timezone,
  quietStart: quietStart ?? p.quietStart,
  quietEnd: quietEnd ?? p.quietEnd,
  channels: {...p.channels, ...?channels},
  studyWindow: clearStudyWindow ? null : (studyWindow ?? p.studyWindow),
  weeklyCap: p.weeklyCap,
);

/// You, Notifications (spec 5.12.1). Every change is a real save, and every control answers on
/// the next frame: the switch, chip or time moves at once and stays moved while the save runs.
/// The line at the top right says Sending until the server answers, then that it was saved; if
/// it was not, the control goes back and a notice says what is still in place, with Try again.
/// Changes kept only on this phone (mute, the repair switch, the fewer-reminders hint) say
/// "Saved on this phone", never "on the server".
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

  /// The last save was kept on this phone only.
  bool _savedLocal = false;
  AppLifecycleListener? _lifecycle;

  /// Changes shown ahead of their save, in the order they were made.
  final Map<int, _Edit> _edits = {};
  int _nextEdit = 0;

  /// Saves started and not finished. The status says Sending until it is zero.
  int _inFlight = 0;
  final List<_Failed> _failed = [];

  /// Saves run one after another, in the order of the taps, so two quick changes to the same
  /// setting cannot land out of order.
  Future<void> _queue = Future<void>.value();

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

  /// Runs one change as a save. [change] must finish only after the server acknowledged it, or,
  /// with [local], after this phone stored it. [edit] is what the screen shows meanwhile.
  Future<void> _run(Future<void> Function() change, {bool local = false, _Edit? edit}) {
    final id = _nextEdit++;
    if (edit != null) _edits[id] = edit;
    _inFlight++;
    _failed.clear();
    setState(() => _save = _Save.sending);
    final done = Completer<void>();
    _queue = _queue.then((_) async {
      try {
        await _execute(id, change, local, edit);
      } finally {
        done.complete();
      }
    });
    return done.future;
  }

  Future<void> _execute(int id, Future<void> Function() change, bool local, _Edit? edit) async {
    try {
      await change();
    } on Object {
      // The server did not confirm (or a local step threw): the control goes back and the
      // notice offers a retry.
      _edits.remove(id);
      _inFlight--;
      if (!mounted) return;
      setState(() {
        _save = _Save.failed;
        _failed.add(_Failed(change, local, edit));
      });
      return;
    }
    // Stored. Read the phone's own state again and wait for it, so the shown value is the stored
    // one before the early answer is dropped (no flicker back to the old value in between).
    if (mounted) {
      ref.invalidate(weeklyCapProvider);
      ref.invalidate(reminderStateProvider);
      try {
        await Future.wait([ref.read(reminderStateProvider.future), ref.read(weeklyCapProvider.future)]);
      } on Object {
        // The next read gets it.
      }
    }
    _edits.remove(id);
    if (mounted) setState(() {});
    // Scheduling this phone is best effort and never turns a saved change into a failed one.
    try {
      await ref.read(reminderSchedulerProvider).sync();
    } on Object {
      // The next app open syncs again.
    }
    _inFlight--;
    if (!mounted) return;
    if (_inFlight == 0 && _failed.isEmpty) {
      ref.invalidate(reminderStateProvider);
      setState(() {
        _save = _Save.saved;
        _savedLocal = local;
        _savedAt = ref.read(nowProvider)();
      });
    } else {
      setState(() {});
    }
  }

  /// Runs every save that failed once more, in the order they were made.
  void _retryFailed() {
    final again = List<_Failed>.of(_failed);
    for (final f in again) {
      unawaited(_run(f.change, local: f.local, edit: f.edit));
    }
  }

  /// Times are shown in the student's own timezone.
  DateTime _inStudentZone(DateTime t) =>
      tz.TZDateTime.from(t, locationFor(_prefs.timezone));

  NotificationPrefs _shownPrefs(NotificationPrefs base) {
    var shown = base;
    for (final e in _edits.values) {
      final edit = e.prefs;
      if (edit != null) shown = edit(shown);
    }
    return shown;
  }

  ReminderState _shownReminder(ReminderState base) {
    var shown = base;
    for (final e in _edits.values) {
      final edit = e.reminder;
      if (edit != null) shown = edit(shown);
    }
    return shown;
  }

  int _shownCap(int base) {
    var shown = base;
    for (final e in _edits.values) {
      final cap = e.cap;
      if (cap != null) shown = cap;
    }
    return shown;
  }

  NotificationPrefs get _prefs => _shownPrefs(
    ref.read(notificationPrefsRepositoryProvider).value ?? NotificationPrefs.defaults,
  );

  Future<void> _setChannel(String key, bool on) {
    // Turning a stopped reminder on starts its count again, and says so at once.
    ReminderState resumed(ReminderState s) => on ? s.withCategory(key, const CategoryStatus()) : s;
    // Repair ready has no key on the server: its switch is kept on this phone.
    if (key == repairReadyKey) {
      return _run(
        () async {
          final scheduler = ref.read(reminderSchedulerProvider);
          await scheduler.setRepairReady(on);
          if (on) await scheduler.resumeCategory(key);
        },
        local: true,
        edit: _Edit(reminder: (s) => resumed(s.copyWith(repairReadyOn: on))),
      );
    }
    final needsWindow = on && key == NotificationChannelKeys.studyWindow && _prefs.studyWindow == null;
    return _run(
      () async {
        final scheduler = ref.read(reminderSchedulerProvider);
        await _repo.update(
          channels: {key: on},
          studyWindow: needsWindow ? defaultStudyWindow : null,
        );
        if (key == NotificationChannelKeys.weeklyPlan) {
          await scheduler.setWeeklyPlan(on);
        }
        if (on) await scheduler.resumeCategory(key);
      },
      edit: _Edit(
        prefs: (p) => _prefsWith(p, channels: {key: on}, studyWindow: needsWindow ? defaultStudyWindow : null),
        reminder: (s) => resumed(key == NotificationChannelKeys.weeklyPlan ? s.copyWith(weeklyPlanOn: on) : s),
      ),
    );
  }

  Future<void> _pickQuiet({required bool start}) async {
    final p = _prefs;
    final picked = await showTimeSheet(
      context,
      what: start ? 'quiet hours start' : 'quiet hours end',
      initial: start ? p.quietStart : p.quietEnd,
    );
    if (picked == null || !mounted) return;
    await _run(
      () async {
        await _repo.update(
          quietStart: start ? picked : null,
          quietEnd: start ? null : picked,
        );
      },
      edit: _Edit(prefs: (p) => _prefsWith(p, quietStart: start ? picked : null, quietEnd: start ? null : picked)),
    );
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
    final saved = next;
    await _run(
      () => _repo.update(studyWindow: saved).then((_) {}),
      edit: _Edit(prefs: (p) => _prefsWith(p, studyWindow: saved)),
    );
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
      _run(
        () async {
          await _repo.update(
            clearStudyWindow: true,
            channels: {NotificationChannelKeys.studyWindow: false},
          );
        },
        edit: _Edit(
          prefs: (p) => _prefsWith(p, clearStudyWindow: true, channels: {NotificationChannelKeys.studyWindow: false}),
        ),
      ),
    ),
    onCap: (n) => unawaited(
      _run(
        () async {
          await _repo.update(weeklyCap: n);
          await ref.read(appPrefsProvider).setWeeklyCap(n);
        },
        edit: _Edit(cap: n),
      ),
    ),
    onMute: () {
      final until = ref.read(nowProvider)().add(muteLength);
      unawaited(
        _run(
          () => ref.read(reminderSchedulerProvider).mute(),
          local: true,
          edit: _Edit(reminder: (s) => s.copyWith(mutedUntil: until)),
        ),
      );
    },
    onUnmute: () => unawaited(
      _run(
        () => ref.read(reminderSchedulerProvider).unmute(),
        local: true,
        edit: _Edit(reminder: (s) => s.copyWith(clearMute: true)),
      ),
    ),
    onHintSeen: (key) => unawaited(
      _run(
        () => ref.read(reminderSchedulerProvider).markFewerRemindersShown(key),
        local: true,
        edit: _Edit(reminder: (s) => s.withCategory(key, s.category(key).copyWith(hintPending: false))),
      ),
    ),
  );

  /// The save line, small, at the right of the back key: it takes no height of its own, so
  /// nothing on the page moves when it appears. It fades between its states.
  Widget _status(BuildContext context) {
    final Widget line;
    switch (_save) {
      case _Save.idle:
      case _Save.failed:
        // A failure is not a line here: it is the notice pinned at the foot of the screen.
        line = const SizedBox.shrink(key: ValueKey('idle'));
      case _Save.sending:
        line = const SavePill(key: ValueKey('sending'), state: SaveState.sending);
      case _Save.saved:
        final at = _inStudentZone(_savedAt!);
        line = _SaveReceipt(
          key: ValueKey('saved-${_savedAt!.millisecondsSinceEpoch}'),
          text: _savedLocal ? NotificationsCopy.savedOnPhone(at) : NotificationsCopy.savedOnServer(at),
          recorded: !_savedLocal,
        );
    }
    return AnimatedSwitcher(
      duration: Motion.of(context, Motion.ui),
      switchInCurve: Motion.out,
      child: line,
    );
  }

  /// The notice for a save that did not go through, pinned above the foot of the screen so it
  /// is seen wherever the list is scrolled. The control it belongs to has already gone back.
  Widget _failure(BuildContext context) {
    final bottom = MediaQuery.viewPaddingOf(context).bottom;
    final banner = _save == _Save.failed
        ? Padding(
            key: const ValueKey('failed'),
            padding: EdgeInsets.fromLTRB(MmSpace.gutter, 0, MmSpace.gutter, MmSpace.s16 + bottom),
            child: InlineBanner(
              message: NotificationsCopy.saveFailed,
              tone: BannerTone.error,
              actionLabel: NotificationsCopy.retry,
              onAction: _retryFailed,
            ),
          )
        : const SizedBox.shrink(key: ValueKey('none'));
    return Align(
      alignment: Alignment.bottomCenter,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: MmSpace.contentMaxWidth),
        child: AnimatedSwitcher(
          duration: Motion.of(context, Motion.ui),
          switchInCurve: Motion.out,
          transitionBuilder: (child, animation) => FadeTransition(
            opacity: animation,
            child: SlideTransition(
              position: Tween<Offset>(begin: const Offset(0, 0.15), end: Offset.zero).animate(animation),
              child: child,
            ),
          ),
          child: banner,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final prefsState = ref.watch(notificationPrefsRepositoryProvider);
    // What the student sees: the stored settings with the changes still being saved on top.
    final stored = prefsState.value;
    final prefs = stored == null ? null : _shownPrefs(stored);
    // Unknown until Android answers: never shown as blocked while it is still being read.
    final permissionState = ref.watch(notificationPermissionProvider);
    final permission = permissionState.value;
    final now = ref.read(nowProvider)();
    var reminder = _shownReminder(
      ref.watch(reminderStateProvider).value ?? const ReminderState(),
    );
    reminder = reminder.isMuted(now)
        ? reminder.copyWith(mutedUntil: _inStudentZone(reminder.mutedUntil!))
        : reminder.copyWith(clearMute: true);
    final cap = _shownCap(ref.watch(weeklyCapProvider).value ?? 3);
    final freshOpen = ref.watch(freshChecksOpenProvider);

    final Widget content;
    if (prefs != null) {
      content = SettingsBody(
        prefs: prefs,
        permission: permission,
        permissionReading: permission == null && permissionState.isLoading,
        reminder: reminder,
        cap: cap,
        freshChecksOpen: freshOpen,
        actions: _actions,
        // Room under the last row for the notice, while it is up.
        footerClearance: _save == _Save.failed ? 96 : 0,
        header: _Header(
          onBack: _back,
          status: _status(context),
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
          // The real layout in outline. It scrolls without a finger so large text cannot overflow.
          const Expanded(
            child: SingleChildScrollView(
              physics: NeverScrollableScrollPhysics(),
              padding: EdgeInsets.all(MmSpace.gutter),
              child: LoadingRows(),
            ),
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
          _failure(context),
        ],
      ),
    );
  }
}

/// The back key with the save line at its right, the title, and the cached-copy notice. The
/// save line sits in the back key's row, so it costs the page no height and nothing moves when
/// it appears.
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
        // The back key's disc (44 inside its 48 dp target) starts on the gutter.
        SizedBox(
          height: MmRhythm.screenTop + 56,
          child: Padding(
            padding: const EdgeInsets.only(top: MmRhythm.screenTop),
            child: Row(
              children: [
                Transform.translate(offset: const Offset(-2, 0), child: BackKey(onTap: onBack)),
                const SizedBox(width: MmSpace.s8),
                Expanded(child: Align(alignment: Alignment.centerRight, child: status)),
              ],
            ),
          ),
        ),
        Semantics(header: true, child: Text(NotificationsCopy.settingsTitle, style: type.headline)),
        const SizedBox(height: MmSpace.s16),
        if (stale != null) ...[
          InlineBanner.offlineStrip(message: stale!),
          const SizedBox(height: MmSpace.s16),
        ],
      ],
    );
  }
}

/// "Saved on this phone at 6:00 PM." as a small right-aligned line: a check where the server has
/// it, a phone where only this phone does. Wraps to two lines on a narrow screen.
class _SaveReceipt extends StatelessWidget {
  const _SaveReceipt({super.key, required this.text, required this.recorded});

  final String text;
  final bool recorded;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Semantics(
      container: true,
      liveRegion: true,
      label: text,
      excludeSemantics: true,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: MmSpace.s2),
            child: Icon(
              recorded ? LucideIcons.circleCheck : LucideIcons.smartphone,
              size: 16,
              color: colors.ink.withValues(alpha: 0.7),
            ),
          ),
          const SizedBox(width: MmSpace.s8),
          Flexible(
            child: Text(
              text,
              textAlign: TextAlign.end,
              style: context.mmType.small.copyWith(color: colors.ink2),
            ),
          ),
        ],
      ),
    );
  }
}
