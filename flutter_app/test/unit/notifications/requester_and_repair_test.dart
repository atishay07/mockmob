import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/permissions/permission_requester.dart';
import 'package:mockmob/core/repositories/repair_local_repository.dart';
import 'package:mockmob/core/storage/app_prefs.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/notifications/logic/repair_ready.dart';
import 'package:mockmob/features/notifications/services/android_permission_requester.dart';

import '../core_data/support/fixtures.dart';

class _Driver implements NotificationPermissionDriver {
  _Driver({this.enabled = false, this.allowOnRequest = false});

  bool enabled;
  bool allowOnRequest;
  int requests = 0;

  @override
  Future<bool> isEnabled() async => enabled;

  @override
  Future<bool> request() async {
    requests++;
    if (allowOnRequest) enabled = true;
    return allowOnRequest;
  }
}

void main() {
  group('AndroidPermissionRequester', () {
    late MemoryPrefsStore memory;
    late AppPrefs prefs;

    setUp(() {
      memory = MemoryPrefsStore();
      prefs = AppPrefs(memory);
    });

    test('never asks just to read the state', () async {
      final driver = _Driver();
      final requester = AndroidPermissionRequester(driver: driver, prefs: prefs);
      expect(await requester.notificationPermission(), NotificationPermission.notAsked);
      expect(driver.requests, 0);
    });

    test('already allowed is granted without a dialog', () async {
      final driver = _Driver(enabled: true);
      final requester = AndroidPermissionRequester(driver: driver, prefs: prefs);
      expect(await requester.notificationPermission(), NotificationPermission.granted);
      expect(await requester.requestNotificationPermission(), NotificationPermission.granted);
      expect(driver.requests, 0);
    });

    test('allowing in the system dialog is granted', () async {
      final driver = _Driver(allowOnRequest: true);
      final requester = AndroidPermissionRequester(driver: driver, prefs: prefs);
      expect(await requester.requestNotificationPermission(), NotificationPermission.granted);
      expect(await requester.notificationPermission(), NotificationPermission.granted);
      expect(await prefs.notificationPermissionAsked(), isTrue);
    });

    test('refusing is denied and remembered, so it is never asked again by us', () async {
      final driver = _Driver();
      final requester = AndroidPermissionRequester(driver: driver, prefs: prefs);
      expect(await requester.requestNotificationPermission(), NotificationPermission.denied);
      expect(await requester.notificationPermission(), NotificationPermission.denied);
      expect(await prefs.notificationPermissionAsked(), isTrue);
    });

    test('turned on later in Android settings reads as granted', () async {
      final driver = _Driver();
      final requester = AndroidPermissionRequester(driver: driver, prefs: prefs);
      await requester.requestNotificationPermission();
      driver.enabled = true;
      expect(await requester.notificationPermission(), NotificationPermission.granted);
    });
  });

  group('computeRepairReady', () {
    final now = DateTime.utc(2026, 10, 12, 20);
    int ms(Duration ago) => now.subtract(ago).millisecondsSinceEpoch;

    test('counts the wrong answers of the newest recent attempt', () {
      final attempt = attemptOf(
        id: 'att-1',
        completedAt: ms(const Duration(days: 1)),
        questions: chapterOf('Ratios', right: 4, wrong: 3, blank: 2),
      );
      final ready = computeRepairReady(attempts: [attempt], records: const [], now: now);
      expect(ready!.attemptId, 'att-1');
      expect(ready.mistakes, 3);
      expect(ready.minutes, 10);
    });

    test('blank questions are never candidates', () {
      final attempt = attemptOf(completedAt: ms(const Duration(days: 1)), questions: chapterOf('Ratios', right: 4, blank: 5));
      expect(computeRepairReady(attempts: [attempt], records: const [], now: now), isNull);
    });

    test('repaired mistakes are taken off, and nothing is left when all are done', () {
      final attempt = attemptOf(id: 'a', completedAt: ms(const Duration(days: 1)), questions: chapterOf('Ratios', wrong: 2));
      List<RepairLocalRecord> records(int n) => [
            for (var i = 1; i <= n; i++)
              RepairLocalRecord(attemptId: 'a', questionId: 'a-q$i', requestId: 'r$i', status: RepairLocalStatus.explained, ackedAt: now),
          ];
      expect(computeRepairReady(attempts: [attempt], records: records(1), now: now)!.mistakes, 1);
      expect(computeRepairReady(attempts: [attempt], records: records(2), now: now), isNull);
    });

    test('an attempt older than 7 days is past validity', () {
      final attempt = attemptOf(completedAt: ms(const Duration(days: 8)), questions: chapterOf('Ratios', wrong: 3));
      expect(computeRepairReady(attempts: [attempt], records: const [], now: now), isNull);
    });

    test('promises at most 6 mistakes, about 20 minutes', () {
      final attempt = attemptOf(completedAt: ms(const Duration(days: 1)), questions: chapterOf('Ratios', wrong: 14));
      final ready = computeRepairReady(attempts: [attempt], records: const [], now: now)!;
      expect(ready.mistakes, 6);
      expect(ready.minutes, 20);
    });

    test('the newest attempt with mistakes wins', () {
      final old = attemptOf(id: 'old', completedAt: ms(const Duration(days: 3)), questions: chapterOf('A', wrong: 3));
      final fresh = attemptOf(id: 'fresh', completedAt: ms(const Duration(days: 1)), questions: chapterOf('B', wrong: 4));
      expect(computeRepairReady(attempts: [old, fresh], records: const [], now: now)!.attemptId, 'fresh');
    });
  });
}
