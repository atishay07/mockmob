import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/models/notification_prefs.dart';
import 'package:mockmob/core/permissions/permission_requester.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/notifications/screens/notification_settings_screen.dart';
import 'package:mockmob/features/notifications/screens/reminders_prompt_sheet.dart';
import 'package:mockmob/features/notifications/widgets/select_chip.dart';
import 'package:mockmob/features/notifications/widgets/settings_rows.dart';
import 'package:mockmob/features/rhythm/data/rhythm_prefs.dart' show CelebrationMode, celebrationModeProvider;

import '../../helpers/golden_harness.dart';
import 'support.dart';
import 'widget_support.dart';

/// A prefs repository whose saves wait for the test, so a screen can be looked at while a save
/// is still on its way, and made to fail afterwards.
class _SlowRepo extends FakePrefsRepo {
  _SlowRepo(super.initial);

  /// One gate per save, in the order the saves were made.
  final gates = <Completer<void>>[];
  bool fail = false;

  @override
  Future<NotificationPrefs> update({
    String? timezone,
    ClockTime? quietStart,
    ClockTime? quietEnd,
    int? weeklyCap,
    Map<String, bool>? channels,
    StudyWindow? studyWindow,
    bool clearStudyWindow = false,
    String? expectUserId,
  }) async {
    final gate = Completer<void>();
    gates.add(gate);
    await gate.future;
    if (fail) throw const ApiError(kind: ApiErrorKind.unavailable, code: 'unavailable');
    return super.update(
      timezone: timezone,
      quietStart: quietStart,
      quietEnd: quietEnd,
      weeklyCap: weeklyCap,
      channels: channels,
      studyWindow: studyWindow,
      clearStudyWindow: clearStudyWindow,
      expectUserId: expectUserId,
    );
  }
}

void main() {
  late Rig rig;
  late _SlowRepo repo;

  Future<void> pumpScreen(WidgetTester tester, {NotificationPrefs? prefs}) async {
    final initial = prefs ?? prefsWith(weeklyOn: false, window: null, studyOn: false);
    rig = Rig(prefs: initial);
    repo = _SlowRepo(initial);
    await pumpMockmob(
      tester,
      const NotificationSettingsScreen(),
      size: const Size(360, 2400),
      wrapInScaffold: false,
      overrides: featureOverrides(rig: rig, repo: repo, permission: FakePermissionRequester(NotificationPermission.granted)),
    );
    await tester.pumpAndSettle();
  }

  Finder rowSwitch(String title) =>
      find.descendant(of: find.widgetWithText(ChannelRow, title), matching: find.byType(MmSwitch));

  bool switchOn(WidgetTester tester, String title) => tester.widget<MmSwitch>(rowSwitch(title)).value;

  Future<void> release(WidgetTester tester, int index) async {
    repo.gates[index].complete();
    await tester.pumpAndSettle();
  }

  /// Lets a save answer while another is still waiting behind it: the Sending pill loops, so the
  /// screen never settles, and a fixed run of frames is used instead.
  Future<void> releaseWhileBusy(WidgetTester tester, int index) async {
    repo.gates[index].complete();
    for (var i = 0; i < 10; i++) {
      await tester.pump(const Duration(milliseconds: 50));
    }
  }

  group('every control answers on the next frame', () {
    testWidgets('a channel switch moves at once and stays moved while the server saves', (tester) async {
      await pumpScreen(tester);
      expect(switchOn(tester, 'Weekly plan'), isFalse);

      await tester.tap(find.widgetWithText(ChannelRow, 'Weekly plan'));
      await tester.pump();
      expect(repo.gates, hasLength(1), reason: 'the save has started and has not answered');
      expect(switchOn(tester, 'Weekly plan'), isTrue, reason: 'the switch does not wait for the server');
      expect(find.byType(SavePill), findsOneWidget);

      await release(tester, 0);
      expect(switchOn(tester, 'Weekly plan'), isTrue);
      expect(find.byType(SavePill), findsNothing);
      expect(find.textContaining('Settings saved to your account'), findsOneWidget);
    });

    testWidgets('a save that fails puts the switch back and says so, with Try again', (tester) async {
      await pumpScreen(tester);
      repo.fail = true;
      await tester.tap(find.widgetWithText(ChannelRow, 'Weekly plan'));
      await tester.pump();
      expect(switchOn(tester, 'Weekly plan'), isTrue);

      await release(tester, 0);
      expect(switchOn(tester, 'Weekly plan'), isFalse, reason: 'what is stored is still off');
      expect(find.text('We could not save that. Your earlier setting is still in place.'), findsOneWidget);
      expect(find.text('Try again'), findsOneWidget);

      // Try again runs the same change once more, and the notice goes.
      repo.fail = false;
      await tester.tap(find.text('Try again'));
      await tester.pump();
      expect(switchOn(tester, 'Weekly plan'), isTrue);
      await release(tester, 1);
      expect(switchOn(tester, 'Weekly plan'), isTrue);
      expect(find.text('Try again'), findsNothing);
      expect(repo.saved.last['channels'], {'weekly_plan': true});
    });

    testWidgets('two quick taps on one switch are saved in the order they were made', (tester) async {
      await pumpScreen(tester);
      final row = find.widgetWithText(ChannelRow, 'Weekly plan');
      await tester.tap(row);
      await tester.pump();
      await tester.tap(row);
      await tester.pump();
      expect(switchOn(tester, 'Weekly plan'), isFalse, reason: 'the second tap turned it off again');
      // The second save has not started: it waits for the first.
      expect(repo.gates, hasLength(1));

      await releaseWhileBusy(tester, 0);
      expect(repo.gates, hasLength(2));
      await release(tester, 1);
      expect([for (final s in repo.saved) (s['channels'] as Map)['weekly_plan']], [true, false]);
      expect(switchOn(tester, 'Weekly plan'), isFalse);
    });

    testWidgets('a weekly cap chip is inked at once', (tester) async {
      await pumpScreen(tester, prefs: prefsWith());
      Color? fillOf(String label) {
        final box = tester.widget<AnimatedContainer>(
          find.descendant(of: find.bySemanticsLabel(RegExp('^$label')), matching: find.byType(AnimatedContainer)).first,
        );
        return (box.decoration as ShapeDecoration?)?.color;
      }

      final before = fillOf('1');
      await tester.tap(find.text('1'));
      await tester.pump(const Duration(milliseconds: 200));
      expect(repo.gates, hasLength(1), reason: 'the save is still waiting');
      expect(fillOf('1'), isNot(before), reason: 'the chip inks without waiting for the server');
    });

    testWidgets('the study window appears on the day bar as soon as it is turned on', (tester) async {
      await pumpScreen(tester);
      expect(find.textContaining('Study window 8:00 PM'), findsNothing);
      await tester.tap(find.widgetWithText(ChannelRow, 'Study window'));
      await tester.pump();
      expect(find.textContaining('Study window 8:00 PM to 9:00 PM'), findsOneWidget);
      await release(tester, 0);
      expect(find.textContaining('Study window 8:00 PM to 9:00 PM'), findsOneWidget);
    });

    testWidgets('the save line takes no height: nothing on the page moves when it appears', (tester) async {
      await pumpScreen(tester);
      final titleBefore = tester.getTopLeft(find.text('Notifications')).dy;
      final dayBefore = tester.getTopLeft(find.text('Your day')).dy;

      await tester.tap(find.widgetWithText(ChannelRow, 'Weekly plan'));
      await tester.pump();
      expect(find.byType(SavePill), findsOneWidget);
      expect(tester.getTopLeft(find.text('Notifications')).dy, titleBefore);
      expect(tester.getTopLeft(find.text('Your day')).dy, dayBefore);

      await release(tester, 0);
      expect(find.textContaining('Settings saved to your account'), findsOneWidget);
      expect(tester.getTopLeft(find.text('Notifications')).dy, titleBefore);
      expect(tester.getTopLeft(find.text('Your day')).dy, dayBefore);
    });
  });

  group('one left edge', () {
    testWidgets('the headings, notes and cards all start on the 16 dp gutter, after the one page header', (tester) async {
      await pumpScreen(tester, prefs: prefsWith(window: const StudyWindow(start: ClockTime(20, 0), end: ClockTime(21, 0))));
      // The one page header (G2): the back arrow is on the gutter and the title follows it.
      expect(tester.getTopLeft(find.text('Notifications').first).dx, 56, reason: 'the title sits after the back arrow');
      for (final text in ['Your day', 'What I want to hear about', 'Quiet hours', 'Reminders a week', 'Take a break']) {
        expect(tester.getTopLeft(find.text(text).first).dx, 16, reason: '$text sits on the gutter');
      }
      // Text inside a card sits on the card's own text edge: the gutter plus its 16 dp padding.
      for (final text in ['Study window']) {
        expect(tester.getTopLeft(find.text(text).first).dx, 32, reason: '$text sits on the card text edge');
      }
      expect(tester.getTopLeft(find.byType(MmRowGroup).first).dx, 16);
      final chip = find.ancestor(of: find.text('1'), matching: find.byType(SelectChip)).first;
      expect(tester.getTopLeft(chip).dx, 16, reason: 'the cap chips start on the gutter');
    });
  });

  group('the permission sheet', () {
    Future<void> pumpSheet(WidgetTester tester, CelebrationMode mode) async {
      final rig = Rig();
      await pumpMockmob(
        tester,
        const SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [RemindersPromptSheet(), RemindersPromptKeys()],
          ),
        ),
        size: const Size(360, 1200),
        overrides: [
          ...featureOverrides(
            rig: rig,
            repo: FakePrefsRepo(NotificationPrefs.defaults),
            permission: FakePermissionRequester(NotificationPermission.notAsked),
          ),
          celebrationModeProvider.overrideWithValue(mode),
        ],
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Allow reminders'));
      await tester.pumpAndSettle();
    }

    Finder mobi(MobiPose pose) => find.byWidgetPredicate((w) => w is Mobi && w.pose == pose);

    testWidgets('Mobi cheers that reminders are on while Celebrations is Full', (tester) async {
      await pumpSheet(tester, CelebrationMode.full);
      expect(find.text('Reminders are on'), findsOneWidget);
      expect(mobi(MobiPose.cheer), findsOneWidget);
    });

    testWidgets('Quiet and Off keep Mobi calm; the words say the same', (tester) async {
      for (final mode in [CelebrationMode.quiet, CelebrationMode.off]) {
        await tester.pumpWidget(const SizedBox());
        await pumpSheet(tester, mode);
        expect(find.text('Reminders are on'), findsOneWidget);
        expect(mobi(MobiPose.cheer), findsNothing, reason: mode.name);
        expect(mobi(MobiPose.rest), findsOneWidget, reason: mode.name);
      }
    });

    testWidgets('two Mobis are never on the sheet at once while it changes state', (tester) async {
      final rig = Rig();
      await pumpMockmob(
        tester,
        const SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [RemindersPromptSheet(), RemindersPromptKeys()],
          ),
        ),
        size: const Size(360, 1200),
        overrides: featureOverrides(
          rig: rig,
          repo: FakePrefsRepo(NotificationPrefs.defaults),
          permission: FakePermissionRequester(NotificationPermission.notAsked),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Allow reminders'));
      var mostSeen = 0;
      for (var i = 0; i < 40; i++) {
        await tester.pump(const Duration(milliseconds: 16));
        // Count the Mobis that are drawn with any opacity at all.
        final visible = find.byType(Mobi).evaluate().where((e) {
          var shown = true;
          e.visitAncestorElements((a) {
            final w = a.widget;
            if (w is FadeTransition && w.opacity.value == 0) shown = false;
            return shown;
          });
          return shown;
        }).length;
        if (visible > mostSeen) mostSeen = visible;
      }
      expect(mostSeen, lessThanOrEqualTo(1));
    });
  });
}
