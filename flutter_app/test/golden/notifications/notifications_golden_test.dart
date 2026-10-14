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

  // Not a picture: the sheet is at most 680 dp tall and its body scrolls inside it, so a wording
  // that is too long would push a key out of view. Measured with the real fonts, on a 360 dp phone
  // (the body is 320 dp wide), for the student with a study window and the one without.
  group('pre-prompt sheet fit', () {
    testWidgets('every wording keeps both keys in view', (tester) async {
      // 680 dp less the drag handle (24). The bottom padding below the keys (20) may scroll.
      const room = 680.0 - 24;
      final tooTall = <String>[];
      for (final start in [NotificationPermission.notAsked, NotificationPermission.denied]) {
        for (final window in [_window, null]) {
          for (var asks = 0; asks < 6; asks++) {
            // A fresh scope each time, or the earlier run's providers would be reused.
            await tester.pumpWidget(const SizedBox());
            final rig = Rig();
            await rig.store.update((s) => s.copyWith(prePromptNotNowCount: asks));
            await pumpMockmob(
              tester,
              Align(
                alignment: Alignment.topLeft,
                child: SizedBox(
                  width: 320,
                  child: SingleChildScrollView(child: RemindersPromptSheet(key: ValueKey('${start.name}${window == null}$asks'))),
                ),
              ),
              size: const Size(360, 1400),
              overrides: featureOverrides(
                rig: rig,
                repo: FakePrefsRepo(prefsWith(window: window)),
                permission: FakePermissionRequester(start),
              ),
            );
            await tester.pumpAndSettle();
            final height = tester.getSize(find.byType(RemindersPromptSheet)).height;
            // ignore: avoid_print
            print('sheet body, ${start.name}, ${window == null ? 'no window' : 'window'}, ask $asks: $height dp');
            if (height > room) tooTall.add('${start.name}, ${window == null ? 'no window' : 'window'}, ask $asks: $height dp');
          }
        }
      }
      expect(tooTall, isEmpty, reason: 'taller than the $room dp that keeps both keys in view');
    });
  });

  // The sheet stays a bottom sheet below 1.5x text, so at 1.3x and 1.45x the main key must still
  // be in view without scrolling (the first group only measures ordinary text).
  group('pre-prompt sheet fit at larger text', () {
    testWidgets('both keys stay in view below the full-page scale', (tester) async {
      const room = 680.0 - 24;
      final tooTall = <String>[];
      for (final scale in [1.3, 1.45]) {
        for (final repair in [null, const RepairReady(attemptId: 'a', mistakes: 12, minutes: 25)]) {
          for (var asks = 0; asks < 6; asks++) {
            await tester.pumpWidget(const SizedBox());
            final rig = Rig();
            await rig.store.update((s) => s.copyWith(prePromptNotNowCount: asks));
            await pumpMockmob(
              tester,
              Align(
                alignment: Alignment.topLeft,
                child: SizedBox(
                  width: 320,
                  child: SingleChildScrollView(child: RemindersPromptSheet(key: ValueKey('$scale${repair == null}$asks'))),
                ),
              ),
              size: const Size(360, 1800),
              textScale: scale,
              overrides: featureOverrides(
                rig: rig,
                repo: FakePrefsRepo(prefsWith(window: _window)),
                permission: FakePermissionRequester(NotificationPermission.notAsked),
                repair: repair,
              ),
            );
            await tester.pumpAndSettle();
            final height = tester.getSize(find.byType(RemindersPromptSheet)).height;
            // ignore: avoid_print
            print('sheet body at $scale, ${repair == null ? 'no repair' : 'repair'}, ask $asks: $height dp');
            if (height > room) tooTall.add('$scale, ${repair == null ? 'no repair' : 'repair'}, ask $asks: $height dp');
          }
        }
      }
      expect(tooTall, isEmpty, reason: 'taller than the $room dp that keeps both keys in view');
    });
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

      // The sheet comes back after a refusal and asks a different way: the second wording, with
      // the student's own study time.
      testWidgets('ask again, study time', (tester) async {
        final rig = Rig();
        await rig.store.update((s) => s.copyWith(prePromptNotNowCount: 1));
        await _openSheet(
          tester,
          b,
          sheet: (_) => const RemindersPromptSheet(),
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
          sheet: (_) => const RemindersPromptSheet(),
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
