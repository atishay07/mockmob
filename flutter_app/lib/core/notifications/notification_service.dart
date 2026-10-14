import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_providers.dart';
import '../models/notification_prefs.dart';
import '../repositories/notification_prefs_repository.dart';
import '../storage/app_prefs.dart';
import '../storage/storage_providers.dart';
import 'notification_channels.dart';
import 'notification_gateway.dart';
import 'notification_ids.dart';
import 'notification_planner.dart';
import 'timezones.dart';

/// Persists the cap ledger between runs.
abstract class NotificationLedgerStore {
  Future<List<LedgerEntry>> load();
  Future<void> save(List<LedgerEntry> entries);
}

class PrefsNotificationLedgerStore implements NotificationLedgerStore {
  PrefsNotificationLedgerStore(this._prefs);

  final AppPrefs _prefs;

  @override
  Future<List<LedgerEntry>> load() async {
    final out = <LedgerEntry>[];
    for (final raw in await _prefs.notificationLedger()) {
      final i = raw.lastIndexOf('|');
      final ms = i < 0 ? null : int.tryParse(raw.substring(i + 1));
      if (ms != null) out.add(LedgerEntry(taskId: raw.substring(0, i), at: DateTime.fromMillisecondsSinceEpoch(ms)));
    }
    return out;
  }

  @override
  Future<void> save(List<LedgerEntry> entries) => _prefs.setNotificationLedger([for (final e in entries) '${e.taskId}|${e.at.millisecondsSinceEpoch}']);
}

class MemoryNotificationLedgerStore implements NotificationLedgerStore {
  List<LedgerEntry> entries = [];

  @override
  Future<List<LedgerEntry>> load() async => List.of(entries);

  @override
  Future<void> save(List<LedgerEntry> next) async => entries = List.of(next);
}

class ScheduleOutcome {
  const ScheduleOutcome({this.deliverAt, this.skipped, this.silent = false});

  /// When it will show. Null when it was skipped.
  final DateTime? deliverAt;
  final NotificationSkip? skipped;
  final bool silent;

  bool get scheduled => skipped == null;
}

/// Local notifications engine skeleton (design spec 8, amendments A3 and A4).
///
/// - Channels are created at first value, not at install.
/// - Scheduling is inexact only and uses the student's IANA timezone from their prefs.
/// - Reminders inside quiet hours (default 11:00 PM to 7:00 AM) wait for 7:00 AM.
/// - A weekly cap (default 3) and one a day apply to reminders.
/// - Everything is cancelled by task id.
/// Copy, the permission prompt and the token upload belong to the notifications module.
class NotificationService {
  NotificationService({
    required this._gateway,
    required this._ledger,
    required this._prefs,
    required this._weeklyCap,
    required this._createdChannels,
    required this._saveCreatedChannels,
    DateTime Function()? now,
  }) : _now = now ?? DateTime.now;

  final LocalNotificationsGateway _gateway;
  final NotificationLedgerStore _ledger;
  final NotificationPrefs Function() _prefs;
  final Future<int> Function() _weeklyCap;
  final Future<Set<String>> Function() _createdChannels;
  final Future<void> Function(Set<String>) _saveCreatedChannels;
  final DateTime Function() _now;

  bool _initialized = false;
  int _clearEpoch = 0;

  /// The tail of the ledger's write queue.
  Future<void> _ledgerTail = Future<void>.value();

  /// Changes the ledger as one load, change and save with nothing in between, in the order the
  /// calls came. The reminder scheduler and the background result post both change it. Each used
  /// to load a snapshot, wait for the plugin, and save that snapshot back, so one erased the
  /// other's entry and the one-push-a-day cap let a second reminder through (you-04).
  /// [change] returns the new list, or null to leave the stored one alone (nothing is written).
  Future<void> _changeLedger(List<LedgerEntry>? Function(List<LedgerEntry> current) change) {
    final run = _ledgerTail.then((_) async {
      final next = change(await _ledger.load());
      if (next != null) await _ledger.save(next);
    });
    _ledgerTail = run.then((_) {}, onError: (Object _) {});
    return run;
  }

  /// Counts the times everything was cancelled. A planning pass that read it before awaiting
  /// and finds it changed knows its student is gone and must stop scheduling.
  int get clearEpoch => _clearEpoch;

  /// Prepares the plugin and the timezone database. Does not create channels or ask for
  /// permission.
  Future<void> initialize({void Function(NotificationTap tap)? onTap}) async {
    if (_initialized) return;
    ensureTimeZones();
    await _gateway.initialize(onTap: onTap);
    _initialized = true;
  }

  Future<void> _ensureChannel(NotificationChannelSpec channel) async {
    final created = await _createdChannels();
    if (created.contains(channel.id)) return;
    await _gateway.createChannel(channel);
    await _saveCreatedChannels({...created, channel.id});
  }

  /// Schedules a reminder, or posts a response to the student's own action. Returns what
  /// happened: scheduled (with the delivery time), or skipped with the reason.
  Future<ScheduleOutcome> schedule(NotificationRequest request) async {
    final epoch = _clearEpoch;
    await initialize();
    final now = _now();
    // The decision reads a snapshot; the write at the end re-reads (see [_changeLedger]).
    var ledger = await _ledger.load();
    // Entries older than two weeks no longer matter for any cap.
    ledger = [for (final e in ledger) if (now.difference(e.at) < const Duration(days: 14)) e];

    final plan = planNotification(
      request: request,
      now: now,
      prefs: _prefs(),
      weeklyCap: await _effectiveCap(),
      ledger: ledger,
    );
    if (!plan.shouldDeliver) return ScheduleOutcome(skipped: plan.skipped);

    await _ensureChannel(request.channel);
    if (_clearEpoch != epoch) return const ScheduleOutcome(skipped: NotificationSkip.cleared);
    final id = notificationIdFor(request.taskId);
    final at = plan.at!;
    final immediate = !at.isAfter(now);
    if (immediate) {
      await _gateway.show(
        id: id,
        channel: request.channel,
        title: request.title,
        body: request.body,
        payload: request.payload,
        silent: plan.silent,
        actions: request.actions,
      );
    } else {
      await _gateway.schedule(
        id: id,
        channel: request.channel,
        at: at,
        title: request.title,
        body: request.body,
        payload: request.payload,
        silent: plan.silent,
        actions: request.actions,
      );
    }
    if (_clearEpoch != epoch) {
      // Cleared while the plugin call was running: take back what it just armed and leave the
      // emptied ledger alone.
      await _gateway.cancel(id);
      return const ScheduleOutcome(skipped: NotificationSkip.cleared);
    }
    // A response to the student's own action never counts against the caps, so it never writes.
    if (!request.respondsToStudentAction) {
      await _changeLedger((current) {
        final kept = [for (final e in current) if (_now().difference(e.at) < const Duration(days: 14) && e.taskId != request.taskId) e];
        return [...kept, LedgerEntry(taskId: request.taskId, at: at)];
      });
    }
    return ScheduleOutcome(deliverAt: at, silent: plan.silent);
  }

  /// The cap in force: the client-side default, lowered by the server's `weeklyCap` when that
  /// is smaller (an explicit lower choice, or 0 to switch pushes off).
  Future<int> _effectiveCap() async {
    final local = await _weeklyCap();
    final server = _prefs().weeklyCap;
    return server < local ? server : local;
  }

  /// A silent ongoing status (the mock in progress, then sending while a submit is pending).
  Future<void> showOngoing({required String taskId, required NotificationChannelSpec channel, required String title, required String body, String? payload}) async {
    await initialize();
    await _ensureChannel(channel);
    await _gateway.show(id: notificationIdFor(taskId), channel: channel, title: title, body: body, payload: payload, silent: true, ongoing: true);
  }

  /// Replaces an ongoing status in place with a plain one the student can swipe away. Used when
  /// the backup job ends a submit without it being recorded, so "Sending" does not stay pinned.
  Future<void> settleOngoing({required String taskId, required NotificationChannelSpec channel, required String title, required String body, String? payload}) async {
    await initialize();
    await _ensureChannel(channel);
    await _gateway.show(id: notificationIdFor(taskId), channel: channel, title: title, body: body, payload: payload, silent: true);
  }

  /// Cancels a scheduled or shown notification by task id and frees its place in the caps.
  Future<void> cancel(String taskId) async {
    await initialize();
    await _gateway.cancel(notificationIdFor(taskId));
    await _changeLedger((current) => current.any((e) => e.taskId == taskId) ? [for (final e in current) if (e.taskId != taskId) e] : null);
  }

  /// Cancels everything (sign-out, account switch).
  Future<void> cancelAll() async {
    _clearEpoch++;
    await initialize();
    await _gateway.cancelAll();
    await _changeLedger((_) => const []);
  }

  Future<bool> areNotificationsEnabled() => _gateway.areNotificationsEnabled();
}

final localNotificationsGatewayProvider = Provider<LocalNotificationsGateway>((ref) => FlutterLocalNotificationsGateway());

final notificationLedgerStoreProvider = Provider<NotificationLedgerStore>((ref) => PrefsNotificationLedgerStore(ref.watch(appPrefsProvider)));

/// The engine. It reads the student's prefs when it plans, so it follows edits at once.
final notificationServiceProvider = Provider<NotificationService>((ref) {
  final prefs = ref.watch(appPrefsProvider);
  return NotificationService(
    gateway: ref.watch(localNotificationsGatewayProvider),
    ledger: ref.watch(notificationLedgerStoreProvider),
    prefs: () => ref.read(notificationPrefsRepositoryProvider).value ?? NotificationPrefs.defaults,
    weeklyCap: prefs.weeklyCap,
    createdChannels: prefs.createdNotificationChannels,
    saveCreatedChannels: prefs.setCreatedNotificationChannels,
    now: ref.watch(nowProvider),
  );
});
