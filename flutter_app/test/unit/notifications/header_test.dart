import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/permissions/permission_requester.dart';
import 'package:mockmob/features/notifications/logic/next_reminder.dart';
import 'package:mockmob/features/notifications/screens/notification_settings_screen.dart';
import 'package:mockmob/features/notifications/services/notification_providers.dart';
import 'package:mockmob/features/you/widgets/you_motion.dart';

import '../../helpers/golden_harness.dart';
import 'support.dart';
import 'widget_support.dart';

/// The next reminder as the scheduler would have left it, fixed for a test.
class _FixedNext extends NextReminderNotifier {
  _FixedNext(this.fixed);

  final NextReminder? fixed;

  @override
  NextReminder? build() => fixed;
}

void main() {
  Future<void> pump(WidgetTester tester, NextReminder? next) async {
    final prefs = prefsWith(weeklyOn: false);
    final rig = Rig(prefs: prefs);
    await pumpMockmob(
      tester,
      const NotificationSettingsScreen(),
      size: const Size(360, 2400),
      wrapInScaffold: false,
      disableAnimations: true,
      overrides: [
        ...featureOverrides(rig: rig, repo: FakePrefsRepo(prefs), permission: FakePermissionRequester(NotificationPermission.granted)),
        nextReminderProvider.overrideWith(() => _FixedNext(next)),
      ],
    );
    await tester.pumpAndSettle();
  }

  group('the header of the notification settings', () {
    testWidgets('says the real next reminder, with the repair it is about', (tester) async {
      await pump(tester, NextReminder.at(DateTime.now().add(const Duration(days: 3)), NextKind.repair, mistakes: 3));
      expect(find.textContaining('Next reminder: '), findsOneWidget);
      expect(find.textContaining('repair 3 mistakes'), findsOneWidget);
      expect(find.byType(YouMobi), findsOneWidget);
    });

    testWidgets('the dot on the day bar is named in its legend', (tester) async {
      await pump(tester, NextReminder.at(DateTime(2026, 10, 14, 20, 30), NextKind.study));
      expect(find.text('Next reminder 8:30 PM'), findsOneWidget);
    });

    testWidgets('there is no dot, and no legend line for it, when nothing is scheduled', (tester) async {
      await pump(tester, const NextReminder.nothing(NothingReason.off));
      expect(find.textContaining('Next reminder 8'), findsNothing);
      expect(find.textContaining('Next reminder '), findsNothing);
    });

    testWidgets('says Nothing scheduled with the reason, and the line is the way to the study window time', (tester) async {
      await pump(tester, const NextReminder.nothing(NothingReason.quietHours));
      expect(find.text('Nothing scheduled'), findsOneWidget);
      expect(find.text('Quiet hours cover your study window.'), findsOneWidget);
      await tester.tap(find.text('Nothing scheduled'));
      await tester.pumpAndSettle();
      expect(find.text('Set 8:00 PM'), findsOneWidget, reason: 'the time sheet for the study window start is open');
    });

    testWidgets('a running mute is said as the reason', (tester) async {
      await pump(tester, NextReminder.nothing(NothingReason.muted, until: DateTime(2026, 10, 19, 18)));
      expect(find.text('Nothing scheduled'), findsOneWidget);
      expect(find.text('Muted until Mon 19 Oct.'), findsOneWidget);
    });

    testWidgets('says nothing about the next reminder until the scheduler has planned', (tester) async {
      await pump(tester, null);
      expect(find.textContaining('Next reminder'), findsNothing);
      expect(find.text('Nothing scheduled'), findsNothing);
      expect(find.byType(YouMobi), findsOneWidget, reason: 'Mobi is there either way');
    });
  });
}
