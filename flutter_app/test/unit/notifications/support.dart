import 'package:mockmob/core/models/notification_prefs.dart';
import 'package:mockmob/core/notifications/notification_channels.dart';
import 'package:mockmob/core/notifications/notification_gateway.dart';
import 'package:mockmob/core/notifications/notification_planner.dart';
import 'package:mockmob/core/notifications/notification_service.dart';
import 'package:mockmob/core/notifications/timezones.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/notifications/data/reminder_store.dart';
import 'package:mockmob/features/notifications/logic/reminder_plan.dart';
import 'package:mockmob/features/notifications/services/reminder_scheduler.dart';
import 'package:timezone/timezone.dart' as tz;

tz.TZDateTime kolkata(int y, int m, int d, int h, [int min = 0]) => tz.TZDateTime(locationFor('Asia/Kolkata'), y, m, d, h, min);

NotificationPrefs prefsWith({
  bool studyOn = true,
  bool weeklyOn = true,
  StudyWindow? window = const StudyWindow(start: ClockTime(20, 0), end: ClockTime(21, 0)),
  ClockTime quietStart = const ClockTime(23, 0),
  ClockTime quietEnd = const ClockTime(7, 0),
  int weeklyCap = 5,
}) =>
    NotificationPrefs(
      channels: {
        NotificationChannelKeys.studyWindow: studyOn,
        NotificationChannelKeys.weeklyPlan: weeklyOn,
        NotificationChannelKeys.resultReady: true,
        NotificationChannelKeys.checkDue: true,
      },
      studyWindow: window,
      quietStart: quietStart,
      quietEnd: quietEnd,
      weeklyCap: weeklyCap,
    );

class ScheduledRecord {
  ScheduledRecord(this.id, this.at, this.title, this.body, this.payload, this.actions);

  final int id;
  final tz.TZDateTime at;
  final String title;
  final String body;
  final String? payload;
  final List<NotificationActionSpec> actions;
}

class FakeGateway implements LocalNotificationsGateway {
  bool enabled = true;

  /// The next schedule call throws once, like a plugin PlatformException.
  bool failOnce = false;
  final scheduled = <ScheduledRecord>[];
  final cancelled = <int>[];
  final shown = <int>[];

  @override
  Future<void> initialize({void Function(NotificationTap tap)? onTap}) async {}

  @override
  Future<void> createChannel(NotificationChannelSpec spec) async {}

  @override
  Future<void> schedule({
    required int id,
    required NotificationChannelSpec channel,
    required tz.TZDateTime at,
    required String title,
    required String body,
    String? payload,
    bool silent = false,
    List<NotificationActionSpec> actions = const [],
  }) async {
    if (failOnce) {
      failOnce = false;
      throw StateError('plugin');
    }
    scheduled.removeWhere((s) => s.id == id);
    scheduled.add(ScheduledRecord(id, at, title, body, payload, actions));
  }

  @override
  Future<void> show({
    required int id,
    required NotificationChannelSpec channel,
    required String title,
    required String body,
    String? payload,
    bool silent = false,
    bool ongoing = false,
    List<NotificationActionSpec> actions = const [],
  }) async => shown.add(id);

  @override
  Future<void> cancel(int id) async {
    cancelled.add(id);
    scheduled.removeWhere((s) => s.id == id);
  }

  @override
  Future<void> cancelAll() async => scheduled.clear();

  @override
  Future<bool> areNotificationsEnabled() async => enabled;
}

/// A scheduler on a fake gateway and memory storage, with a clock the test moves.
class Rig {
  Rig({NotificationPrefs? prefs, this.repair, DateTime? start}) : prefs = prefs ?? prefsWith() {
    now = start ?? kolkata(2026, 10, 12, 18).toUtc();
    service = NotificationService(
      gateway: gateway,
      ledger: MemoryNotificationLedgerStore(),
      prefs: () => this.prefs!,
      weeklyCap: () async => cap,
      createdChannels: () async => created,
      saveCreatedChannels: (c) async => created = c,
      now: () => now,
    );
    store = ReminderStore(memory, userId: 'user-1');
    scheduler = ReminderScheduler(
      service: service,
      store: store,
      prefs: () => this.prefs,
      repair: () => repair,
      ensureReady: service.initialize,
      now: () => now,
    );
  }

  final gateway = FakeGateway();
  final memory = MemoryPrefsStore();
  NotificationPrefs? prefs;
  RepairReady? repair;
  int cap = 3;
  Set<String> created = {};
  late DateTime now;
  late final NotificationService service;
  late final ReminderStore store;
  late final ReminderScheduler scheduler;
}
