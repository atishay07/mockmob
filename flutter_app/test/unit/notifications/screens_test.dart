import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/models/notification_prefs.dart';
import 'package:mockmob/core/permissions/permission_requester.dart';
import 'package:mockmob/core/storage/app_prefs.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/notifications/data/reminder_state.dart';
import 'package:mockmob/features/notifications/data/reminder_store.dart';
import 'package:mockmob/features/notifications/screens/notification_settings_screen.dart';
import 'package:mockmob/features/notifications/screens/reminders_prompt_sheet.dart';
import 'package:mockmob/features/notifications/widgets/day_shape.dart';
import 'package:mockmob/features/notifications/widgets/settings_rows.dart';
import 'package:mockmob/features/notifications/widgets/time_sheet.dart';

import '../../helpers/golden_harness.dart';
import 'support.dart';
import 'widget_support.dart';

Finder _text(String s) => find.text(s);

void main() {
  group('day shape maths', () {
    test('a span that crosses midnight is two spans', () {
      expect(daySpans(const ClockTime(23, 0), const ClockTime(7, 0)).length, 2);
      expect(daySpans(const ClockTime(20, 0), const ClockTime(21, 0)).length, 1);
      expect(daySpans(const ClockTime(7, 0), const ClockTime(7, 0)), isEmpty);
    });

    test('overlap is found across midnight', () {
      final quiet = daySpans(const ClockTime(23, 0), const ClockTime(7, 0));
      final study = daySpans(const ClockTime(23, 30), const ClockTime(23, 59));
      expect(overlapOf(quiet, study), isNotEmpty);
      expect(overlapOf(quiet, daySpans(const ClockTime(20, 0), const ClockTime(21, 0))), isEmpty);
    });
  });

  group('time sheet', () {
    Future<ClockTime?> open(WidgetTester tester, {ClockTime initial = const ClockTime(23, 0), ClockTime? after}) async {
      ClockTime? result;
      await pumpMockmob(
        tester,
        Builder(
          builder: (context) => TextButton(
            onPressed: () async => result = await showTimeSheet(context, what: 'quiet hours start', initial: initial, mustBeAfter: after),
            child: const Text('open'),
          ),
        ),
      );
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      return Future.value(result);
    }

    testWidgets('shows the current time in 12-hour form', (tester) async {
      await open(tester);
      expect(_text('11:00 PM'), findsOneWidget);
      expect(_text('Set 11:00 PM'), findsOneWidget);
    });

    testWidgets('changing hour, minute and period updates the readout and Set returns 24-hour time', (tester) async {
      ClockTime? result;
      await pumpMockmob(
        tester,
        Builder(
          builder: (context) => TextButton(
            onPressed: () async => result = await showTimeSheet(context, what: 'quiet hours end', initial: const ClockTime(7, 0)),
            child: const Text('open'),
          ),
        ),
      );
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('9'));
      await tester.tap(find.text('30'));
      await tester.tap(find.text('PM'));
      await tester.pump();
      expect(_text('9:30 PM'), findsWidgets);
      await tester.tap(find.text('Set 9:30 PM'));
      await tester.pumpAndSettle();
      expect(result, const ClockTime(21, 30));
    });

    testWidgets('12 AM is midnight, 12 PM is noon', (tester) async {
      ClockTime? result;
      await pumpMockmob(
        tester,
        Builder(
          builder: (context) => TextButton(
            onPressed: () async => result = await showTimeSheet(context, what: 'x', initial: const ClockTime(0, 0)),
            child: const Text('open'),
          ),
        ),
      );
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      expect(_text('12:00 AM'), findsWidgets);
      await tester.tap(find.text('Set 12:00 AM'));
      await tester.pumpAndSettle();
      expect(result, const ClockTime(0, 0));
    });

    testWidgets('a time that must come later keeps Set disabled with a reason', (tester) async {
      await pumpMockmob(
        tester,
        Builder(
          builder: (context) => TextButton(
            onPressed: () => showTimeSheet(
              context,
              what: 'study window end',
              initial: const ClockTime(20, 0),
              mustBeAfter: const ClockTime(20, 0),
              afterReason: 'The window must end after it starts.',
            ),
            child: const Text('open'),
          ),
        ),
      );
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      expect(_text('The window must end after it starts.'), findsOneWidget);
    });

    testWidgets('an odd stored minute stays available', (tester) async {
      await open(tester, initial: const ClockTime(21, 20));
      expect(find.text('20'), findsOneWidget);
    });
  });

  group('settings screen', () {
    late Rig rig;
    late FakePrefsRepo repo;
    late FakePermissionRequester permission;
    late AppPrefs appPrefs;

    Future<void> pumpScreen(
      WidgetTester tester, {
      NotificationPrefs? prefs,
      ApiError? loadError,
      ApiError? updateError,
      NotificationPermission perm = NotificationPermission.granted,
      DateTime? cachedAt,
    }) async {
      rig = Rig(prefs: prefs ?? prefsWith(weeklyOn: false, window: null, studyOn: false));
      repo = FakePrefsRepo(prefs, loadError: loadError, updateError: updateError, cachedAt: cachedAt);
      permission = FakePermissionRequester(perm);
      appPrefs = AppPrefs(MemoryPrefsStore());
      await pumpMockmob(
        tester,
        const NotificationSettingsScreen(),
        size: const Size(360, 2400),
        wrapInScaffold: false,
        overrides: featureOverrides(rig: rig, repo: repo, permission: permission, appPrefs: appPrefs),
      );
      await tester.pumpAndSettle();
    }

    testWidgets('shows the settings in 12-hour times', (tester) async {
      await pumpScreen(tester, prefs: prefsWith(weeklyOn: false, window: const StudyWindow(start: ClockTime(20, 0), end: ClockTime(21, 0))));
      expect(_text('Notifications'), findsOneWidget);
      expect(_text('Notifications are on'), findsOneWidget);
      expect(find.text('11:00 PM'), findsWidgets);
      expect(find.text('7:00 AM'), findsWidgets);
      expect(find.text('8:00 PM'), findsWidgets);
      expect(_text('Check due'), findsNothing);
    });

    testWidgets('a study window inside quiet hours shows the conflict line and does not block', (tester) async {
      await pumpScreen(
        tester,
        prefs: prefsWith(window: const StudyWindow(start: ClockTime(23, 30), end: ClockTime(23, 59))),
      );
      expect(_text('Your 11:30 PM reminder falls inside quiet hours. Move one of them.'), findsOneWidget);
    });

    testWidgets('no conflict line when the window is outside quiet hours', (tester) async {
      await pumpScreen(tester, prefs: prefsWith());
      expect(find.textContaining('falls inside quiet hours'), findsNothing);
    });

    testWidgets('turning on Study window with none set creates 8:00 PM to 9:00 PM and saves it', (tester) async {
      await pumpScreen(tester, prefs: prefsWith(weeklyOn: false, window: null, studyOn: false));
      await tester.tap(find.widgetWithText(ChannelRow, 'Study window'));
      await tester.pumpAndSettle();
      expect(repo.saved.single['channels'], {'study_window': true});
      expect(repo.saved.single['studyWindow'], '20:00-21:00');
      expect(find.textContaining('Settings saved on the server at 6:00 PM'), findsOneWidget);
    });

    testWidgets('a failed save keeps the old setting and offers Try again', (tester) async {
      await pumpScreen(tester, prefs: prefsWith(window: null, studyOn: false), updateError: const ApiError(kind: ApiErrorKind.unavailable, code: 'unavailable'));
      await tester.tap(find.widgetWithText(ChannelRow, 'Study window'));
      await tester.pumpAndSettle();
      expect(_text('We could not save that. Your earlier setting is still in place.'), findsOneWidget);
      expect(_text('Try again'), findsOneWidget);
      expect(rig.gateway.scheduled, isEmpty);
    });

    testWidgets('Mute for 7 days says until when, and Unmute undoes it', (tester) async {
      await pumpScreen(tester, prefs: prefsWith());
      await tester.tap(_text('Mute for 7 days'));
      await tester.pumpAndSettle();
      expect(find.textContaining('Muted on this phone until Monday, 19 October, 6:00 PM.'), findsOneWidget);
      expect(rig.gateway.scheduled, isEmpty);
      await tester.tap(_text('Unmute'));
      await tester.pumpAndSettle();
      expect(_text('Mute for 7 days'), findsOneWidget);
    });

    testWidgets('the weekly cap is saved on the server and on this phone', (tester) async {
      await pumpScreen(tester, prefs: prefsWith());
      await tester.tap(find.text('2'));
      await tester.pumpAndSettle();
      expect(repo.saved.single['weeklyCap'], 2);
      expect(await appPrefs.weeklyCap(), 2);
    });

    testWidgets('not asked: Turn on is offered', (tester) async {
      await pumpScreen(tester, prefs: prefsWith(), perm: NotificationPermission.notAsked);
      expect(_text('Notifications are off'), findsOneWidget);
      expect(_text('Turn on'), findsOneWidget);
    });

    testWidgets('blocked: says how to change it in Android settings and offers no key', (tester) async {
      await pumpScreen(tester, prefs: prefsWith(), perm: NotificationPermission.denied);
      expect(_text('Notifications are blocked in Android settings'), findsOneWidget);
      expect(find.textContaining('Settings, Apps, MockMob, Notifications'), findsOneWidget);
      expect(_text('Turn on'), findsNothing);
    });

    testWidgets('a paused category says so and the one-time line can be dismissed', (tester) async {
      await pumpScreen(tester, prefs: prefsWith());
      await rig.store.update((s) => s.withCategory('study_window', const CategoryStatus(ignoredInRow: 3, paused: true, hintPending: true)));
      final container = ProviderScope.containerOf(tester.element(find.byType(NotificationSettingsScreen)));
      container.invalidate(reminderStateProvider);
      await tester.pumpAndSettle();
      expect(_text('Want fewer reminders? You can turn this one off.'), findsOneWidget);
      expect(find.textContaining('Paused after 3 reminders went unopened'), findsOneWidget);
      await tester.tap(_text('Got it'));
      await tester.pumpAndSettle();
      expect(_text('Want fewer reminders? You can turn this one off.'), findsNothing);
    });

    testWidgets('loading shows skeleton rows and no stale words', (tester) async {
      rig = Rig();
      repo = FakePrefsRepo(null);
      await pumpMockmob(
        tester,
        const NotificationSettingsScreen(),
        wrapInScaffold: false,
        overrides: featureOverrides(rig: rig, repo: repo, permission: FakePermissionRequester(NotificationPermission.granted)),
      );
      expect(find.byType(Skeleton), findsWidgets);
    });

    testWidgets('a failed first load is an error state with a way back in', (tester) async {
      await pumpScreen(tester, loadError: const ApiError(kind: ApiErrorKind.server, code: 'server_error'));
      expect(_text('We could not load your reminder settings'), findsOneWidget);
      expect(_text('Try again'), findsOneWidget);
    });

    testWidgets('offline first load says so', (tester) async {
      await pumpScreen(tester, loadError: const ApiError(kind: ApiErrorKind.network, code: 'network'));
      expect(_text('You are offline'), findsOneWidget);
    });

    testWidgets('cached settings with a failed refresh are labelled with their time', (tester) async {
      await pumpScreen(
        tester,
        prefs: prefsWith(),
        loadError: const ApiError(kind: ApiErrorKind.network, code: 'network'),
        cachedAt: kolkata(2026, 10, 12, 9, 40).toUtc(),
      );
      expect(find.textContaining('Showing settings from 9:40 AM'), findsOneWidget);
    });
  });

  group('pre-prompt sheet', () {
    late Rig rig;
    late FakePermissionRequester permission;
    late AppPrefs appPrefs;
    late MemoryPrefsStore memory;

    Future<void> pumpSheet(WidgetTester tester, {NotificationPermission after = NotificationPermission.granted}) async {
      rig = Rig();
      permission = FakePermissionRequester(NotificationPermission.notAsked, afterRequest: after);
      memory = MemoryPrefsStore();
      appPrefs = AppPrefs(memory);
      await pumpMockmob(
        tester,
        const SingleChildScrollView(child: RemindersPromptSheet()),
        size: const Size(360, 1200),
        overrides: featureOverrides(rig: rig, repo: FakePrefsRepo(NotificationPrefs.defaults), permission: permission, appPrefs: appPrefs),
      );
      await tester.pumpAndSettle();
    }

    testWidgets('lists the three kinds with their example words and a full-width Not now', (tester) async {
      await pumpSheet(tester);
      expect(_text('Remind me when it matters'), findsOneWidget);
      expect(_text('Mock 7 was received. Your result is ready.'), findsOneWidget);
      expect(_text('Your repair is ready: 3 mistakes, about 10 minutes.'), findsOneWidget);
      expect(_text('Your week is ready to look at.'), findsOneWidget);
      expect(_text('Allow reminders'), findsOneWidget);
      final notNow = tester.getSize(find.widgetWithText(KeyButton, 'Not now'));
      final allow = tester.getSize(find.widgetWithText(KeyButton, 'Allow reminders'));
      expect(notNow.width, allow.width);
      expect(find.textContaining('Quiet hours are 11:00 PM to 7:00 AM.'), findsOneWidget);
    });

    testWidgets('Allow asks the system once and ends on a designed state', (tester) async {
      await pumpSheet(tester);
      await tester.tap(find.text('Allow reminders'));
      await tester.pumpAndSettle();
      expect(permission.requests, 1);
      expect(_text('Reminders are on'), findsOneWidget);
      expect(_text('Choose a study time'), findsOneWidget);
    });

    testWidgets('a refusal says reminders stay off and studying is unaffected', (tester) async {
      await pumpSheet(tester, after: NotificationPermission.denied);
      await tester.tap(find.text('Allow reminders'));
      await tester.pumpAndSettle();
      expect(_text('Reminders stay off'), findsOneWidget);
      expect(find.textContaining('Studying works the same without them.'), findsOneWidget);
    });

    testWidgets('Not now is recorded with its date and never asks the system', (tester) async {
      await pumpSheet(tester);
      await tester.tap(find.text('Not now'));
      await tester.pumpAndSettle();
      expect(permission.requests, 0);
      expect((await rig.store.load()).prePromptNotNowCount, 1);
      expect((await appPrefs.lastPrePromptAt())!.isAtSameMomentAs(rig.now), isTrue);
    });
  });
}
