import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/models/notification_prefs.dart';
import 'package:mockmob/core/permissions/permission_requester.dart';
import 'package:mockmob/core/router/routes.dart';
import 'package:mockmob/core/storage/app_prefs.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/notifications/data/reminder_state.dart';
import 'package:mockmob/features/notifications/data/reminder_store.dart';
import 'package:mockmob/features/notifications/logic/reminder_plan.dart' show RepairReady;
import 'package:mockmob/features/notifications/screens/notification_settings_screen.dart';
import 'package:mockmob/features/notifications/screens/reminders_prompt_sheet.dart';
import 'package:mockmob/features/notifications/services/system_settings.dart';
import 'package:mockmob/features/notifications/widgets/balanced_text.dart';
import 'package:mockmob/features/notifications/widgets/notification_preview.dart';
import 'package:mockmob/features/notifications/widgets/day_shape.dart';
import 'package:mockmob/features/notifications/widgets/settings_rows.dart';
import 'package:mockmob/features/notifications/widgets/time_sheet.dart';

import '../../helpers/golden_harness.dart';
import 'support.dart';
import 'widget_support.dart';

Finder _text(String s) => find.text(s);

/// The sheet's body over its keys, the way the sheet lays them out (the keys pinned under it).
const Widget _sheetWithKeys = Column(
  mainAxisSize: MainAxisSize.min,
  crossAxisAlignment: CrossAxisAlignment.stretch,
  children: [RemindersPromptSheet(), RemindersPromptKeys()],
);

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

    testWidgets('the label above the time says what is being set', (tester) async {
      await pumpMockmob(
        tester,
        Builder(
          builder: (context) => TextButton(
            onPressed: () => showTimeSheet(context, what: 'study window end', initial: const ClockTime(21, 0)),
            child: const Text('open'),
          ),
        ),
      );
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      expect(_text('Study window end'), findsOneWidget);
      expect(_text('Set 9:00 PM'), findsOneWidget);
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

  group('balanced title', () {
    // The test font gives every glyph a square of the font size, so widths are exact.
    Future<Size> sizeOf(WidgetTester tester, String text, double width) async {
      await tester.pumpWidget(
        Directionality(
          textDirection: TextDirection.ltr,
          child: MediaQuery(
            data: const MediaQueryData(),
            child: Align(
              alignment: Alignment.topLeft,
              child: SizedBox(width: width, child: BalancedText(text, style: const TextStyle(fontSize: 10))),
            ),
          ),
        ),
      );
      return tester.getSize(find.byType(Text));
    }

    testWidgets('an orphan is pulled back into an even second line', (tester) async {
      // Plain wrap at 150: "aaaaa bbbbb cc" over "d". Balanced: "aaaaa bbbbb" over "cc d".
      final size = await sizeOf(tester, 'aaaaa bbbbb cc d', 150);
      expect(size.width, lessThan(125));
      expect(size.height, 20, reason: 'still two lines');
    });

    testWidgets('a title that fits one line is left alone', (tester) async {
      final size = await sizeOf(tester, 'aaaa bbbb', 150);
      expect(size.height, 10);
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
      expect(find.textContaining('Settings saved to your account at 6:00 PM'), findsOneWidget);
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
      // And once near the top, with its own way back, so it is not missed below the fold.
      expect(_text('Muted until Mon 19 Oct'), findsOneWidget);
      // Nothing is armed inside the mute; the week after it is already planned.
      final muteEnd = rig.now.add(const Duration(days: 7));
      expect(rig.gateway.scheduled.where((s) => s.at.isBefore(muteEnd)), isEmpty);
      // The mute is kept on this phone, and the receipt says exactly that.
      expect(find.textContaining('Saved on this phone at 6:00 PM.'), findsOneWidget);
      expect(find.textContaining('on the server'), findsNothing);
      // The reminder channels read as on hold until the mute ends; Result ready does not.
      expect(find.textContaining('Paused until Monday, 19 October.'), findsWidgets);
      await tester.tap(_text('Unmute').first);
      await tester.pumpAndSettle();
      expect(_text('Mute for 7 days'), findsOneWidget);
      expect(find.textContaining('Paused until'), findsNothing);
    });

    testWidgets('Repair ready has its own switch, kept on this phone', (tester) async {
      await pumpScreen(tester, prefs: prefsWith(studyOn: false));
      expect(_text('Repair ready'), findsOneWidget);
      await tester.tap(_text('Repair ready'));
      await tester.pumpAndSettle();
      expect((await rig.store.load()).repairReadyOn, isFalse);
      expect(repo.saved, isEmpty, reason: 'the server has no key for it');
      expect(find.textContaining('Saved on this phone at 6:00 PM.'), findsOneWidget);
    });

    testWidgets('the weekly cap is saved to your account and on this phone', (tester) async {
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

    Future<void> pumpWithPermission(WidgetTester tester, FakePermissionRequester requester) async {
      rig = Rig(prefs: prefsWith());
      repo = FakePrefsRepo(prefsWith());
      await pumpMockmob(
        tester,
        const NotificationSettingsScreen(),
        size: const Size(360, 2400),
        wrapInScaffold: false,
        overrides: featureOverrides(rig: rig, repo: repo, permission: requester),
      );
      await tester.pumpAndSettle();
    }

    testWidgets('while Android has not answered, nothing reads as blocked', (tester) async {
      final pending = _PendingPermission();
      await pumpWithPermission(tester, pending);
      expect(find.bySemanticsLabel('Checking notifications'), findsOneWidget);
      expect(_text('Notifications are blocked in Android settings'), findsNothing);
      expect(_text('Android is blocking MockMob, so these will not arrive yet.'), findsNothing);
      expect(_text('Open Android settings'), findsNothing);

      pending.answer.complete(NotificationPermission.granted);
      await tester.pumpAndSettle();
      expect(_text('Notifications are on'), findsOneWidget);
      expect(find.bySemanticsLabel('Checking notifications'), findsNothing);
    });

    testWidgets('a failed permission read does not claim notifications are blocked', (tester) async {
      await pumpWithPermission(tester, _FailingPermission());
      expect(_text('Notifications are blocked in Android settings'), findsNothing);
      expect(_text('Android is blocking MockMob, so these will not arrive yet.'), findsNothing);
      expect(find.bySemanticsLabel('Checking notifications'), findsNothing);
    });

    testWidgets('blocked: keeps the choices, says nothing arrives yet, and opens Android settings', (tester) async {
      await pumpScreen(tester, prefs: prefsWith(), perm: NotificationPermission.denied);
      expect(_text('Notifications are blocked in Android settings'), findsOneWidget);
      expect(_text('Android is blocking MockMob, so these will not arrive yet.'), findsOneWidget);
      expect(_text('Open Android settings'), findsOneWidget);
      expect(_text('Turn on'), findsNothing);
    });

    testWidgets('blocked: no toggle reads as working, and Open Android settings is the volt key', (tester) async {
      await pumpScreen(tester, prefs: prefsWith(), perm: NotificationPermission.denied);
      // The on choices say Blocked and the off ones say Off, in words, in place of a switch.
      expect(find.byType(MmSwitch), findsNothing);
      expect(_text('Blocked'), findsWidgets);
      expect(_text('Off'), findsWidgets);
      final open = tester.widget<KeyButton>(find.widgetWithText(KeyButton, 'Open Android settings'));
      expect(open.variant, KeyVariant.primary);
    });

    testWidgets('one status at a time: a pane that needs an action wins over a running mute', (tester) async {
      await pumpScreen(tester, prefs: prefsWith(), perm: NotificationPermission.notAsked);
      await tester.tap(_text('Mute for 7 days'));
      await tester.pumpAndSettle();
      expect(_text('Turn on'), findsOneWidget);
      expect(_text('Notifications are off'), findsOneWidget);
      // No second banner at the top: the mute is still said under Take a break.
      expect(_text('Muted until Mon 19 Oct'), findsNothing);
      expect(find.textContaining('Muted on this phone until Monday, 19 October, 6:00 PM.'), findsOneWidget);
    });

    testWidgets('Remove study window is a quiet row inside the study window group', (tester) async {
      await pumpScreen(tester, prefs: prefsWith(window: const StudyWindow(start: ClockTime(20, 0), end: ClockTime(21, 0))));
      expect(find.byType(ActionRow), findsOneWidget);
      expect(find.widgetWithText(KeyButton, 'Remove study window'), findsNothing);
      await tester.tap(find.widgetWithText(ActionRow, 'Remove study window'));
      await tester.pumpAndSettle();
      expect(repo.saved.single['clearStudyWindow'], isTrue);
    });

    testWidgets('a paused category says so and the one-time line can be dismissed', (tester) async {
      await pumpScreen(tester, prefs: prefsWith());
      await rig.store.update((s) => s.withCategory('study_window', const CategoryStatus(ignoredInRow: 3, paused: true, hintPending: true)));
      final container = ProviderScope.containerOf(tester.element(find.byType(NotificationSettingsScreen)));
      container.invalidate(reminderStateProvider);
      await tester.pumpAndSettle();
      expect(_text('Want fewer reminders? You can turn off Study window.'), findsOneWidget);
      expect(find.textContaining('Paused after 3 reminders went unopened'), findsOneWidget);
      await tester.tap(_text('Got it'));
      await tester.pumpAndSettle();
      expect(_text('Want fewer reminders? You can turn off Study window.'), findsNothing);
      expect(find.textContaining('Saved on this phone at 6:00 PM.'), findsOneWidget);
    });

    testWidgets('the fewer-reminders hint waits while notifications are off', (tester) async {
      await pumpScreen(tester, prefs: prefsWith(), perm: NotificationPermission.notAsked);
      await rig.store.update((s) => s.withCategory('study_window', const CategoryStatus(ignoredInRow: 3, paused: true, hintPending: true)));
      final container = ProviderScope.containerOf(tester.element(find.byType(NotificationSettingsScreen)));
      container.invalidate(reminderStateProvider);
      await tester.pumpAndSettle();
      expect(_text('Notifications are off'), findsOneWidget);
      expect(find.textContaining('Want fewer reminders?'), findsNothing);
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
    late _FakeSystemSettings settings;
    late FakePermissionRequester permission;
    late AppPrefs appPrefs;
    late MemoryPrefsStore memory;

    Future<void> pumpSheet(
      WidgetTester tester, {
      NotificationPermission after = NotificationPermission.granted,
      NotificationPermission start = NotificationPermission.notAsked,
      RepairReady? repair,
      NotificationPrefs prefs = NotificationPrefs.defaults,
      int asks = 0,
    }) async {
      rig = Rig();
      settings = _FakeSystemSettings();
      permission = FakePermissionRequester(start, afterRequest: after);
      memory = MemoryPrefsStore();
      appPrefs = AppPrefs(memory);
      if (asks > 0) await rig.store.update((s) => s.copyWith(prePromptNotNowCount: asks));
      await pumpMockmob(
        tester,
        const SingleChildScrollView(child: _sheetWithKeys),
        size: const Size(360, 1200),
        overrides: [
          ...featureOverrides(rig: rig, repo: FakePrefsRepo(prefs), permission: permission, appPrefs: appPrefs, repair: repair),
          systemSettingsProvider.overrideWithValue(settings),
        ],
      );
      await tester.pumpAndSettle();
    }

    testWidgets('with no data yet the previews describe each kind with no number', (tester) async {
      await pumpSheet(tester);
      expect(find.byType(NotificationPreview), findsNWidgets(3));
      expect(_text('Remind me when it matters'), findsOneWidget);
      expect(_text('Your mock was received. Your result is ready.'), findsOneWidget);
      expect(_text('When a mock leaves mistakes, a short repair is waiting for you.'), findsOneWidget);
      expect(_text('Your study window has started. Pick a small next step when you are ready.'), findsOneWidget);
      expect(find.textContaining(RegExp(r'\d+ mistakes')), findsNothing);
      expect(_text('Allow reminders'), findsOneWidget);
      final notNow = tester.getSize(find.widgetWithText(KeyButton, 'Not now'));
      final allow = tester.getSize(find.widgetWithText(KeyButton, 'Allow reminders'));
      expect(notNow.width, allow.width);
      expect(find.textContaining('Quiet hours are 11:00 PM to 7:00 AM.'), findsOneWidget);
    });

    testWidgets("the previews use the student's own waiting repair and study time", (tester) async {
      await pumpSheet(
        tester,
        repair: const RepairReady(attemptId: 'a', mistakes: 4, minutes: 10),
        prefs: prefsWith(window: const StudyWindow(start: ClockTime(20, 30), end: ClockTime(21, 30))),
      );
      expect(_text('Your repair is ready: 4 mistakes, about 10 minutes.'), findsOneWidget);
      expect(_text('At 8:30 PM: your study window has started.'), findsOneWidget);
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
      // Not a dead end: Android settings is one tap away, with a plain line if it will not open.
      expect(_text('Open Android settings'), findsOneWidget);
      await tester.tap(_text('Open Android settings'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));
      expect(settings.opened, 1);
      expect(find.textContaining('Android did not open its settings.'), findsOneWidget);
    });

    testWidgets('Not now is recorded with its date and never asks the system', (tester) async {
      await pumpSheet(tester);
      await tester.tap(find.text('Not now'));
      await tester.pumpAndSettle();
      expect(permission.requests, 0);
      expect((await rig.store.load()).prePromptNotNowCount, 1);
      expect((await appPrefs.lastPrePromptAt())!.isAtSameMomentAs(rig.now), isTrue);
    });

    testWidgets('the first ask uses the original wording', (tester) async {
      await pumpSheet(tester);
      expect(_text('Remind me when it matters'), findsOneWidget);
      // The examples below already say what the lead says, so the sheet leaves it out (audit F2);
      // the screen reader still hears it in the sheet's label.
      expect(_text('Three kinds of reminder, and you choose which ones stay on.'), findsNothing);
    });

    testWidgets('each ask after a refusal or a close uses the next wording, chosen by the ask count', (tester) async {
      await pumpSheet(tester, asks: 3);
      expect(_text('Know when your result is ready'), findsOneWidget);
      expect(
        _text('If you submit a mock and leave the app, a reminder tells you when the result is ready.'),
        findsOneWidget,
      );
      expect(_text('Remind me when it matters'), findsNothing);
      // Mobi stays, and so does the main key. The ask is about the result, so it shows that one example.
      expect(find.byType(Mobi), findsOneWidget);
      expect(find.byType(NotificationPreview), findsOneWidget);
      expect(_text('Your mock was received. Your result is ready.'), findsOneWidget);
      expect(_text('What they would say'), findsNothing);
      expect(_text('Allow reminders'), findsOneWidget);
      expect(_text('Not now'), findsOneWidget);
    });

    testWidgets("the study-time wording says the start of the student's own study window", (tester) async {
      await pumpSheet(
        tester,
        asks: 1,
        prefs: prefsWith(window: const StudyWindow(start: ClockTime(20, 30), end: ClockTime(21, 30))),
      );
      expect(_text('A nudge at your study time'), findsOneWidget);
      expect(find.textContaining('your study window starts at 8:30 PM.'), findsOneWidget);
    });

    testWidgets('the repair ask shows the repair reminder only, with no examples label', (tester) async {
      await pumpSheet(tester, asks: 2);
      expect(_text('Hear when a repair is waiting'), findsOneWidget);
      expect(find.byType(NotificationPreview), findsOneWidget);
      expect(_text('When a mock leaves mistakes, a short repair is waiting for you.'), findsOneWidget);
      expect(_text('What they would say'), findsNothing);
    });

    testWidgets('the wording starts over after the sixth', (tester) async {
      await pumpSheet(tester, asks: 6);
      expect(_text('Remind me when it matters'), findsOneWidget);
    });

    testWidgets('opening the sheet counts as one ask, and closing it adds no second', (tester) async {
      await pumpSheet(tester);
      expect((await rig.store.load()).prePromptAskCount, 1);
      expect((await appPrefs.lastPrePromptAt())!.isAtSameMomentAs(rig.now), isTrue);
      // The wording on screen is the one it opened with, not the next.
      expect(_text('Remind me when it matters'), findsOneWidget);
      await tester.tap(find.text('Not now'));
      await tester.pumpAndSettle();
      expect((await rig.store.load()).prePromptAskCount, 1);
    });

    testWidgets('a refusal after opening is not counted twice', (tester) async {
      await pumpSheet(tester, after: NotificationPermission.denied);
      await tester.tap(find.text('Allow reminders'));
      await tester.pumpAndSettle();
      expect((await rig.store.load()).prePromptAskCount, 1);
    });

    testWidgets('reminders already on: the sheet does not count an ask', (tester) async {
      await pumpSheet(tester, start: NotificationPermission.granted);
      expect((await rig.store.load()).prePromptAskCount, 0);
      expect(await appPrefs.lastPrePromptAt(), isNull);
    });

    testWidgets('once Android no longer asks, the main key says Open settings and opens them', (tester) async {
      await pumpSheet(tester, start: NotificationPermission.denied, asks: 2);
      expect(_text('Open settings'), findsOneWidget);
      expect(_text('Allow reminders'), findsNothing);
      expect(find.textContaining('Android no longer asks from inside the app.'), findsOneWidget);
      expect(_text('Not now'), findsOneWidget);
      // The wording still rotates in this state.
      expect(_text('Hear when a repair is waiting'), findsOneWidget);
      await tester.tap(find.text('Open settings'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));
      expect(settings.opened, 1);
      expect(permission.requests, 0, reason: 'Android would show nothing');
      expect(find.textContaining('Android did not open its settings.'), findsOneWidget);
    });

    testWidgets('the Open settings key is the same size as Not now', (tester) async {
      await pumpSheet(tester, start: NotificationPermission.denied);
      final key = tester.getSize(find.widgetWithText(KeyButton, 'Open settings'));
      final notNow = tester.getSize(find.widgetWithText(KeyButton, 'Not now'));
      expect(key.width, notNow.width);
    });

    Future<void> comeBackToTheApp(WidgetTester tester) async {
      for (final state in [
        AppLifecycleState.inactive,
        AppLifecycleState.hidden,
        AppLifecycleState.paused,
        AppLifecycleState.hidden,
        AppLifecycleState.inactive,
        AppLifecycleState.resumed,
      ]) {
        tester.binding.handleAppLifecycleStateChanged(state);
      }
      await tester.pumpAndSettle();
    }

    testWidgets('back from Android settings with notifications on ends on the granted state', (tester) async {
      await pumpSheet(tester, start: NotificationPermission.denied);
      permission.current = NotificationPermission.granted;
      await comeBackToTheApp(tester);
      expect(_text('Reminders are on'), findsOneWidget);
      expect(_text('Choose a study time'), findsOneWidget);
      expect(permission.requests, 0);
    });

    testWidgets('back from Android settings with notifications still off stays on the sheet', (tester) async {
      await pumpSheet(tester, start: NotificationPermission.denied);
      await comeBackToTheApp(tester);
      expect(_text('Open settings'), findsOneWidget);
      expect(_text('Reminders are on'), findsNothing);
    });

    testWidgets('after a refusal, back from Android settings with notifications on ends on the granted state', (tester) async {
      await pumpSheet(tester, after: NotificationPermission.denied);
      await tester.tap(find.text('Allow reminders'));
      await tester.pumpAndSettle();
      expect(_text('Reminders stay off'), findsOneWidget);
      // The student turns notifications on in Android settings and comes back.
      permission.current = NotificationPermission.granted;
      await comeBackToTheApp(tester);
      expect(_text('Reminders stay off'), findsNothing);
      expect(_text('Reminders are on'), findsOneWidget);
      expect(_text('Choose a study time'), findsOneWidget);
    });

    testWidgets('after a refusal, back from Android settings with notifications still off keeps the denied state', (tester) async {
      await pumpSheet(tester, after: NotificationPermission.denied);
      await tester.tap(find.text('Allow reminders'));
      await tester.pumpAndSettle();
      await comeBackToTheApp(tester);
      expect(_text('Reminders stay off'), findsOneWidget);
      expect(_text('Reminders are on'), findsNothing);
    });

    testWidgets('a re-plan that fails after Allow does not become an unhandled error', (tester) async {
      await pumpSheet(tester, prefs: prefsWith(weeklyOn: false));
      rig.gateway.failOnce = true;
      await tester.tap(find.text('Allow reminders'));
      await tester.pumpAndSettle();
      // The test fails on any unhandled async error; the sheet still ends on the granted state.
      expect(_text('Reminders are on'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('at larger text the ask shows one example', (tester) async {
      for (final scale in [1.3, 1.45]) {
        rig = Rig();
        permission = FakePermissionRequester(NotificationPermission.notAsked);
        await tester.pumpWidget(const SizedBox());
        await pumpMockmob(
          tester,
          const Align(
            alignment: Alignment.topLeft,
            child: SizedBox(width: 320, child: SingleChildScrollView(child: RemindersPromptSheet())),
          ),
          size: const Size(360, 1600),
          textScale: scale,
          overrides: featureOverrides(
            rig: rig,
            repo: FakePrefsRepo(NotificationPrefs.defaults),
            permission: permission,
            appPrefs: AppPrefs(MemoryPrefsStore()),
          ),
        );
        await tester.pumpAndSettle();
        expect(find.byType(NotificationPreview), findsOneWidget, reason: 'text scale $scale');
      }
    });

    testWidgets('as a sheet route at 1.3x text on a 360 dp phone, Allow and Not now stay pinned in view', (tester) async {
      rig = Rig();
      permission = FakePermissionRequester(NotificationPermission.notAsked);
      final router = GoRouter(
        routes: [
          GoRoute(
            path: '/',
            builder: (_, _) => const SizedBox.expand(),
            routes: [
              GoRoute(
                path: 'ask',
                pageBuilder: (_, state) =>
                    MmSheetPage<void>(key: state.pageKey, footer: const RemindersPromptKeys(), child: const RemindersPromptSheet()),
              ),
            ],
          ),
        ],
      );
      addTearDown(router.dispose);
      const screen = Size(360, 640);
      await pumpMockmob(
        tester,
        Router<Object>.withConfig(config: router),
        size: screen,
        textScale: 1.3,
        wrapInScaffold: false,
        overrides: featureOverrides(
          rig: rig,
          repo: FakePrefsRepo(prefsWith(window: const StudyWindow(start: ClockTime(20, 30), end: ClockTime(21, 30)))),
          permission: permission,
          appPrefs: AppPrefs(MemoryPrefsStore()),
          repair: const RepairReady(attemptId: 'a', mistakes: 12, minutes: 25),
        ),
      );
      unawaited(router.push('/ask'));
      await tester.pumpAndSettle();

      Rect keyRect(String label) => tester.getRect(find.widgetWithText(KeyButton, label));
      final allow = keyRect('Allow reminders');
      final notNow = keyRect('Not now');
      for (final rect in [allow, notNow]) {
        expect(rect.top, greaterThanOrEqualTo(0));
        expect(rect.bottom, lessThanOrEqualTo(screen.height), reason: 'in view without scrolling');
        // The primary key is 56 and the quiet one paints 40; each reaches 48 through its hit slop.
        expect(rect.height, greaterThanOrEqualTo(40));
      }
      expect(allow.height, greaterThanOrEqualTo(48));
      // The keys sit in the sheet's footer, outside the body's scroll, so scrolling the body never moves them.
      final body = find.ancestor(of: find.byType(RemindersPromptSheet), matching: find.byType(SingleChildScrollView));
      expect(body, findsOneWidget);
      expect(find.descendant(of: body, matching: find.byType(KeyButton)), findsNothing);
      await tester.drag(find.byType(RemindersPromptSheet), const Offset(0, -300));
      await tester.pumpAndSettle();
      expect(keyRect('Allow reminders'), allow);
      expect(keyRect('Not now'), notNow);

      await tester.tap(find.text('Not now'));
      await tester.pumpAndSettle();
      expect(find.byType(RemindersPromptSheet), findsNothing, reason: 'Not now closes the sheet');
      expect((await rig.store.load()).prePromptAskCount, 1);
    });

    testWidgets('a refusal in the system dialog still ends on a designed state with Android settings one tap away', (tester) async {
      await pumpSheet(tester, after: NotificationPermission.denied);
      await tester.tap(find.text('Allow reminders'));
      await tester.pumpAndSettle();
      expect(_text('Reminders stay off'), findsOneWidget);
      expect(_text('Open Android settings'), findsOneWidget);
    });
  });

  group('Turn on in Notifications settings', () {
    testWidgets('opens the sheet, and Allow turns reminders on', (tester) async {
      final rig = Rig(prefs: prefsWith());
      final permission = FakePermissionRequester(NotificationPermission.notAsked);
      final router = GoRouter(
        routes: [
          GoRoute(path: '/', builder: (_, _) => const NotificationSettingsScreen()),
          GoRoute(
            path: AppRoutes.permissionsNotifications,
            builder: (_, _) => const Scaffold(body: SingleChildScrollView(child: _sheetWithKeys)),
          ),
        ],
      );
      addTearDown(router.dispose);
      await pumpMockmob(
        tester,
        Router<Object>.withConfig(config: router),
        size: const Size(360, 2400),
        wrapInScaffold: false,
        overrides: featureOverrides(
          rig: rig,
          repo: FakePrefsRepo(prefsWith()),
          permission: permission,
          appPrefs: AppPrefs(MemoryPrefsStore()),
        ),
      );
      await tester.pumpAndSettle();
      expect(_text('Notifications are off'), findsOneWidget);
      await tester.tap(find.text('Turn on'));
      await tester.pumpAndSettle();
      expect(_text('Remind me when it matters'), findsOneWidget);
      await tester.tap(find.text('Allow reminders'));
      await tester.pumpAndSettle();
      expect(permission.requests, 1);
      expect(_text('Reminders are on'), findsOneWidget);
      await tester.tap(find.text('Done'));
      await tester.pumpAndSettle();
      expect(_text('Notifications are on'), findsOneWidget);
    });
  });
}

/// Android settings that never open, as in a test or on an Android that refuses the intent.
class _FakeSystemSettings extends SystemSettings {
  int opened = 0;

  @override
  Future<bool> openNotificationSettings() async {
    opened++;
    return false;
  }
}

class _PendingPermission extends FakePermissionRequester {
  _PendingPermission() : super(NotificationPermission.granted);

  final answer = Completer<NotificationPermission>();

  @override
  Future<NotificationPermission> notificationPermission() => answer.future;
}

class _FailingPermission extends FakePermissionRequester {
  _FailingPermission() : super(NotificationPermission.granted);

  @override
  Future<NotificationPermission> notificationPermission() async => throw StateError('platform');
}
