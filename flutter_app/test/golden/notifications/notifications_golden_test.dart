import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/models/notification_prefs.dart';
import 'package:mockmob/core/permissions/permission_requester.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/notifications/data/reminder_state.dart';
import 'package:mockmob/features/notifications/logic/reminder_plan.dart' show RepairReady;
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
  WidgetBuilder? footer,
  required List<Override> overrides,
  Size size = kSheetSize,
  double textScale = 1,
}) async {
  await pumpMockmob(
    tester,
    Builder(
      builder: (context) => Center(
        child: TextButton(onPressed: () => showMmSheet<void>(context: context, builder: sheet, footer: footer), child: const Text('open')),
      ),
    ),
    brightness: brightness,
    size: size,
    textScale: textScale,
    overrides: overrides,
  );
  await tester.tap(find.text('open'));
  await tester.pumpAndSettle();
}

/// The pre-prompt sheet as its route lays it out: the body scrolls, the keys are pinned under it.
Widget _promptBody(BuildContext _) => const RemindersPromptSheet();
Widget _promptKeys(BuildContext _) => const RemindersPromptKeys();

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

  // Not a picture: on a 360 dp phone, at ordinary and larger text (the sheet stays a bottom sheet
  // below 1.5x), every wording keeps both keys fully in view without scrolling. The body scrolls
  // under them when it is long; the keys sit in the sheet's footer. Measured with the real fonts.
  group('pre-prompt sheet fit', () {
    testWidgets('every wording keeps both keys in view on a 360 dp phone', (tester) async {
      const screen = Size(360, 640);
      final outOfView = <String>[];
      for (final scale in [1.0, 1.3, 1.45]) {
        for (final start in [NotificationPermission.notAsked, NotificationPermission.denied]) {
          for (final window in [_window, null]) {
            for (var asks = 0; asks < 6; asks++) {
              // A fresh scope each time, or the earlier run's providers would be reused.
              await tester.pumpWidget(const SizedBox());
              final rig = Rig();
              await rig.store.update((s) => s.copyWith(prePromptNotNowCount: asks));
              await _openSheet(
                tester,
                Brightness.light,
                sheet: _promptBody,
                footer: _promptKeys,
                size: screen,
                textScale: scale,
                overrides: featureOverrides(
                  rig: rig,
                  repo: FakePrefsRepo(prefsWith(window: window)),
                  permission: FakePermissionRequester(start),
                  repair: const RepairReady(attemptId: 'a', mistakes: 12, minutes: 25),
                ),
              );
              // Once Android has stopped asking (denied), the main key opens settings, whatever the wording.
              final main = start == NotificationPermission.denied ? 'Open settings' : 'Allow reminders';
              for (final label in [main, 'Not now']) {
                final key = find.widgetWithText(KeyButton, label);
                final rect = key.evaluate().isEmpty ? null : tester.getRect(key.first);
                if (rect == null || rect.top < 0 || rect.bottom > screen.height) {
                  outOfView.add('$scale, ${start.name}, ${window == null ? 'no window' : 'window'}, ask $asks: $label at $rect');
                }
              }
            }
          }
        }
      }
      expect(outOfView, isEmpty, reason: 'a key out of view on a 360 x 640 dp phone');
    });
  });

  for (final b in [Brightness.dark, Brightness.light]) {
    group('pre-prompt sheet, ${b.name}', () {
      testWidgets('ask', (tester) async {
        final rig = Rig();
        await _openSheet(
          tester,
          b,
          sheet: _promptBody,
          footer: _promptKeys,
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
          sheet: _promptBody,
          footer: _promptKeys,
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
          sheet: _promptBody,
          footer: _promptKeys,
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

      // The sheet comes back after a refusal and asks a different way: the second wording, with
      // the student's own study time.
      testWidgets('ask again, study time', (tester) async {
        final rig = Rig();
        await rig.store.update((s) => s.copyWith(prePromptNotNowCount: 1));
        await _openSheet(
          tester,
          b,
          sheet: _promptBody,
          footer: _promptKeys,
          overrides: featureOverrides(
            rig: rig,
            repo: FakePrefsRepo(prefsWith(window: _window)),
            permission: FakePermissionRequester(NotificationPermission.notAsked),
          ),
        );
        await _shoot(tester, 'prompt_ask_again_study', b);
      });

      // Android no longer shows its question: the main key opens Android settings.
      testWidgets('ask again, open settings', (tester) async {
        final rig = Rig();
        await rig.store.update((s) => s.copyWith(prePromptNotNowCount: 2));
        await _openSheet(
          tester,
          b,
          sheet: _promptBody,
          footer: _promptKeys,
          overrides: featureOverrides(
            rig: rig,
            repo: FakePrefsRepo(NotificationPrefs.defaults),
            permission: FakePermissionRequester(NotificationPermission.denied),
          ),
        );
        await _shoot(tester, 'prompt_ask_again_settings', b);
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
