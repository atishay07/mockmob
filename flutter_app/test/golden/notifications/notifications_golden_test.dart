import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/models/notification_prefs.dart';
import 'package:mockmob/core/permissions/permission_requester.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/notifications/data/reminder_state.dart';
import 'package:mockmob/features/notifications/screens/notification_settings_screen.dart';
import 'package:mockmob/features/notifications/screens/reminders_prompt_sheet.dart';
import 'package:mockmob/features/notifications/widgets/time_sheet.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import '../../unit/notifications/support.dart';
import '../you/you_golden_kit.dart' show kSheetSize, loadMaterialIcons;
import '../../unit/notifications/widget_support.dart';

const _window = StudyWindow(start: ClockTime(20, 0), end: ClockTime(21, 0));

Future<void> _shoot(WidgetTester tester, String name, Brightness b) =>
    expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/${name}_${b == Brightness.dark ? 'night' : 'day'}.png'));

Future<void> _openSheet(
  WidgetTester tester,
  Brightness brightness, {
  required WidgetBuilder sheet,
  required List<Override> overrides,
}) async {
  await pumpMockmob(
    tester,
    Builder(
      builder: (context) => Center(
        child: TextButton(onPressed: () => showMmSheet<void>(context: context, builder: sheet), child: const Text('open')),
      ),
    ),
    brightness: brightness,
    size: kSheetSize,
    overrides: overrides,
  );
  await tester.tap(find.text('open'));
  await tester.pumpAndSettle();
}

Future<void> _settings(
  WidgetTester tester,
  Brightness brightness, {
  NotificationPrefs? prefs,
  NotificationPermission permission = NotificationPermission.granted,
  ApiError? loadError,
  ReminderState? reminder,
  double scrollTo = 0,
}) async {
  final rig = Rig(prefs: prefs ?? prefsWith(weeklyOn: false, window: _window));
  if (reminder != null) await rig.store.update((_) => reminder);
  await pumpMockmob(
    tester,
    const NotificationSettingsScreen(),
    brightness: brightness,
    size: kSheetSize,
    wrapInScaffold: false,
    overrides: featureOverrides(
      rig: rig,
      repo: FakePrefsRepo(loadError == null ? (prefs ?? prefsWith(weeklyOn: false, window: _window)) : null, loadError: loadError),
      permission: FakePermissionRequester(permission),
    ),
  );
  await tester.pumpAndSettle();
  if (scrollTo > 0) {
    await tester.drag(find.byType(ListView), Offset(0, -scrollTo));
    await tester.pumpAndSettle();
  }
}

void main() {
  setUpAll(() async {
    await loadAppFonts();
    await loadMaterialIcons();
  });

  for (final b in [Brightness.dark, Brightness.light]) {
    group('pre-prompt sheet, ${b.name}', () {
      testWidgets('ask', (tester) async {
        final rig = Rig();
        await _openSheet(
          tester,
          b,
          sheet: (_) => const RemindersPromptSheet(),
          overrides: featureOverrides(
            rig: rig,
            repo: FakePrefsRepo(NotificationPrefs.defaults),
            permission: FakePermissionRequester(NotificationPermission.notAsked),
          ),
        );
        await _shoot(tester, 'prompt_ask', b);
      });

      testWidgets('granted', (tester) async {
        final rig = Rig();
        await _openSheet(
          tester,
          b,
          sheet: (_) => const RemindersPromptSheet(),
          overrides: featureOverrides(
            rig: rig,
            repo: FakePrefsRepo(NotificationPrefs.defaults),
            permission: FakePermissionRequester(NotificationPermission.notAsked),
          ),
        );
        await tester.tap(find.text('Allow reminders'));
        await tester.pumpAndSettle();
        await _shoot(tester, 'prompt_granted', b);
      });

      testWidgets('denied', (tester) async {
        final rig = Rig();
        await _openSheet(
          tester,
          b,
          sheet: (_) => const RemindersPromptSheet(),
          overrides: featureOverrides(
            rig: rig,
            repo: FakePrefsRepo(NotificationPrefs.defaults),
            permission: FakePermissionRequester(NotificationPermission.notAsked, afterRequest: NotificationPermission.denied),
          ),
        );
        await tester.tap(find.text('Allow reminders'));
        await tester.pumpAndSettle();
        await _shoot(tester, 'prompt_denied', b);
      });
    });

    group('time sheet, ${b.name}', () {
      testWidgets('quiet hours start', (tester) async {
        await _openSheet(
          tester,
          b,
          sheet: (_) => const TimeSheetBody(initial: ClockTime(23, 0)),
          overrides: const [],
        );
        await _shoot(tester, 'time_sheet', b);
      });
    });

    group('settings, ${b.name}', () {
      testWidgets('top', (tester) async {
        await _settings(tester, b);
        await _shoot(tester, 'settings_top', b);
      });

      testWidgets('window and quiet hours', (tester) async {
        await _settings(tester, b, scrollTo: 560);
        await _shoot(tester, 'settings_middle', b);
      });

      testWidgets('cap and mute', (tester) async {
        await _settings(tester, b, scrollTo: 2000);
        await _shoot(tester, 'settings_bottom', b);
      });

      testWidgets('study window inside quiet hours', (tester) async {
        await _settings(
          tester,
          b,
          prefs: prefsWith(weeklyOn: false, window: const StudyWindow(start: ClockTime(23, 30), end: ClockTime(23, 59))),
          scrollTo: 330,
        );
        await _shoot(tester, 'settings_conflict', b);
      });

      testWidgets('not asked, paused after 3 unopened, muted', (tester) async {
        await _settings(
          tester,
          b,
          permission: NotificationPermission.notAsked,
          reminder: ReminderState(
            mutedUntil: kolkata(2026, 10, 19, 18).toUtc(),
            categories: const {'study_window': CategoryStatus(ignoredInRow: 3, paused: true, hintPending: true)},
          ),
        );
        await _shoot(tester, 'settings_paused', b);
      });

      testWidgets('blocked in Android settings, no window yet', (tester) async {
        await _settings(
          tester,
          b,
          permission: NotificationPermission.denied,
          prefs: prefsWith(weeklyOn: false, studyOn: false, window: null),
          scrollTo: 330,
        );
        await _shoot(tester, 'settings_blocked', b);
      });

      testWidgets('loading', (tester) async {
        final rig = Rig();
        await pumpMockmob(
          tester,
          const NotificationSettingsScreen(),
          brightness: b,
          size: kSheetSize,
          wrapInScaffold: false,
          overrides: featureOverrides(rig: rig, repo: FakePrefsRepo(null), permission: FakePermissionRequester(NotificationPermission.granted)),
        );
        await _shoot(tester, 'settings_loading', b);
      });

      testWidgets('load failed', (tester) async {
        await _settings(tester, b, loadError: const ApiError(kind: ApiErrorKind.server, code: 'server_error'));
        await _shoot(tester, 'settings_error', b);
      });
    });
  }
}
