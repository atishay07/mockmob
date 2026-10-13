import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/notifications/notification_gateway.dart';
import 'package:mockmob/core/notifications/notification_planner.dart';
import 'package:mockmob/features/notifications/logic/reminder_plan.dart';

void main() {
  group('Android manifest', () {
    // flutter_local_notifications does not declare its receivers in its own manifest.
    final manifest = File('android/app/src/main/AndroidManifest.xml').readAsStringSync();

    test('declares the scheduled reminder receiver', () {
      expect(manifest, contains('com.dexterous.flutterlocalnotifications.ScheduledNotificationReceiver'));
    });

    test('declares the boot receiver with the reboot and update actions', () {
      expect(manifest, contains('com.dexterous.flutterlocalnotifications.ScheduledNotificationBootReceiver'));
      for (final action in [
        'android.intent.action.BOOT_COMPLETED',
        'android.intent.action.MY_PACKAGE_REPLACED',
        'android.intent.action.QUICKBOOT_POWERON',
      ]) {
        expect(manifest, contains(action));
      }
    });

    test('declares the action receiver', () {
      expect(manifest, contains('com.dexterous.flutterlocalnotifications.ActionBroadcastReceiver'));
    });
  });

  group('reminder actions', () {
    test('every action opens the app, so the tap reaches the main isolate', () {
      for (final id in [ReminderActions.start, ReminderActions.notTonight, ReminderActions.mute]) {
        final action = androidActionFor(NotificationActionSpec(id: id, label: id));
        expect(action.id, id);
        expect(action.showsUserInterface, isTrue, reason: id);
      }
    });
  });
}
