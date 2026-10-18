// The panels built for the You hub in audit 3: Plan and credits, the one-tap theme, Study days,
// Notifications with their times, the course and colleges, Account and privacy with Sign out, and
// Help with its questions open in place. You is now the student's study (app-you-1016), so most of
// these left the hub for the account sheet; the panels themselves are still tested here, on a
// host page, until the account sheet takes them over.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/models/notification_prefs.dart';
import 'package:mockmob/core/permissions/permission_requester.dart';
import 'package:mockmob/core/repositories/remote_state.dart' show RemoteState;
import 'package:mockmob/core/settings/appearance_settings.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart' show MmSegmented;
import 'package:mockmob/features/notifications/logic/next_reminder.dart';
import 'package:mockmob/features/credits/data/credits_models.dart' show CreditsOverview;
import 'package:mockmob/features/credits/widgets/credit_tile.dart' show CreditTiles;
import 'package:mockmob/features/notifications/services/notification_providers.dart'
    show NextReminderNotifier, nextReminderProvider, notificationPermissionProvider;
import 'package:mockmob/features/rhythm/data/study_days.dart' show PlannedDays, plannedDaysProvider;
import 'package:mockmob/features/credits/credits_screen.dart' show CreditsScreen;
import 'package:mockmob/features/you/help/faq.dart';
import 'package:mockmob/features/you/help/help_screen.dart';
import 'package:mockmob/features/you/hub/hub_cards.dart';
import 'package:mockmob/features/you/hub/sheet_card.dart' show TargetFields;
import 'package:mockmob/features/you/data/student_target.dart' show studentTargetProvider;
import 'package:mockmob/features/you/you_hub_screen.dart';

import '../../helpers/golden_harness.dart';
import 'you_test_support.dart';

/// The panels that left the You hub, on one page, so they stay covered while they exist.
class _Panels extends ConsumerWidget {
  const _Panels();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final target = ref.watch(studentTargetProvider);
    return Scaffold(
      body: ListView(
        children: [
          const PlanCreditsCard(),
          const AppearanceCard(),
          const StudyDaysPanel(),
          const NotificationsPanel(),
          TargetFields(target: target, subjects: target.subjects, onEdit: () => GoRouter.of(context).push('/you/sheet')),
          const AccountPanel(),
          const HelpPanel(),
        ],
      ),
    );
  }
}

class _Next extends NextReminderNotifier {
  _Next(this.value);

  final NextReminder? value;

  @override
  NextReminder? build() => value;
}

Future<GoRouter> _pump(
  WidgetTester tester, {
  List<dynamic> extra = const [],
  FakeGoal? goal,
  RemoteState<CreditsOverview>? credits,
  NotificationPrefs? prefs,
  double height = 10000,
}) async {
  tester.view.physicalSize = Size(768, height);
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);
  final router = GoRouter(
    initialLocation: '/you',
    routes: [
      GoRoute(path: '/you', builder: (_, _) => const _Panels()),
      GoRoute(path: '/you/sheet', builder: (_, _) => const Text('sheet editor page')),
      GoRoute(path: '/you/subjects', builder: (_, _) => const Text('subjects page')),
      GoRoute(path: '/you/goal', builder: (_, _) => const Text('goal page')),
      GoRoute(path: '/you/credits', builder: (_, _) => const Text('credits page')),
      GoRoute(path: '/you/notifications', builder: (_, _) => const Text('notifications page')),
      GoRoute(path: '/you/account', builder: (_, _) => const Text('account page')),
      GoRoute(path: '/you/help', builder: (_, _) => const Text('help page')),
      GoRoute(path: '/you/appearance', builder: (_, _) => const Text('appearance page')),
    ],
  );
  addTearDown(router.dispose);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        ...youOverrides(goal: goal, notificationPrefs: prefs, target: ashaTarget, credits: credits, drafts: draftsWithUnsent(0)),
        for (final o in extra) o,
      ],
      child: DefaultAssetBundle(
        bundle: FileAssetBundle(),
        child: Consumer(
          builder: (context, ref, _) => MaterialApp.router(
            theme: buildTheme(Brightness.light),
            darkTheme: buildTheme(Brightness.dark),
            themeMode: ref.watch(themeModeProvider),
            routerConfig: router,
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return router;
}

void main() {
  group('Plan and credits', () {
    testWidgets('a Pro student sees the date and unlimited practice, and AI credits still count', (tester) async {
      await _pump(tester, credits: creditsState(pro: true, proUntil: '2027-01-12'));
      expect(find.text('Pro until 12 January 2027'), findsOneWidget);
      expect(find.text('Unlimited'), findsOneWidget);
      expect(find.bySemanticsLabel(RegExp(r'^AI credits, 8\.')), findsOneWidget);
    });

    testWidgets('balances that did not load say so, never 0', (tester) async {
      await _pump(tester, credits: creditsState(practice: null, ai: null));
      expect(find.text('Not loaded'), findsNWidgets(2));
      expect(find.descendant(of: find.byType(CreditTiles), matching: find.text('0')), findsNothing);
    });

    testWidgets('no price and no purchase anywhere on the hub', (tester) async {
      await _pump(tester);
      expect(find.textContaining('₹'), findsNothing);
      expect(find.textContaining('Buy'), findsNothing);
      expect(find.textContaining('Upgrade'), findsNothing);
    });
  });

  group('Appearance', () {
    testWidgets('one tap on Day changes the theme at once, and Night changes it back', (tester) async {
      await _pump(tester);
      Brightness brightness() => Theme.of(tester.element(find.byType(_Panels))).brightness;
      // The harness starts on the app default, Match phone, which is light under the test view.
      await tester.tap(find.descendant(of: find.byType(MmSegmented<ThemeMode>), matching: find.text('Night')));
      await tester.pumpAndSettle();
      expect(brightness(), Brightness.dark);
      await tester.tap(find.descendant(of: find.byType(MmSegmented<ThemeMode>), matching: find.text('Day')));
      await tester.pumpAndSettle();
      expect(brightness(), Brightness.light);
    });

    testWidgets('the other looks are one row down and open the Appearance page', (tester) async {
      final router = await _pump(tester);
      await tester.tap(find.text('Glass, touch and celebrations'));
      await tester.pumpAndSettle();
      expect(find.text('appearance page'), findsOneWidget);
      router.pop();
    });
  });

  group('Study days', () {
    testWidgets('planned weekdays are named and drawn, 28 dp marks', (tester) async {
      await _pump(tester, goal: FakeGoal(goalState(4)), extra: [
        plannedDaysProvider.overrideWith(() => _Planned({0, 2, 4, 5})),
      ]);
      // The marks show the plan; the names are spoken, not printed a second time.
      expect(find.bySemanticsLabel(RegExp('Planned days. Monday, Wednesday, Friday and Saturday')), findsOneWidget);
      expect(find.text('Monday, Wednesday, Friday and Saturday'), findsNothing);
      expect(find.text('Pick the weekdays you will study'), findsNothing);
    });

    testWidgets('the planned days row opens the plan editor', (tester) async {
      final router = await _pump(tester);
      await tester.tap(find.text('Planned days'));
      await tester.pumpAndSettle();
      expect(find.text('sheet editor page'), findsOneWidget);
      router.pop();
    });

    testWidgets('a running pause is said, with its date', (tester) async {
      final until = DateTime.now().add(const Duration(days: 10));
      final iso = '${until.year}-${until.month.toString().padLeft(2, '0')}-${until.day.toString().padLeft(2, '0')}';
      await _pump(tester, goal: FakeGoal(goalState(4, pausedUntil: iso)));
      expect(find.text('Study days are paused'), findsOneWidget);
      expect(find.text('Pause study days'), findsNothing);
    });
  });

  group('Notifications', () {
    testWidgets('on: the next reminder the scheduler really planned, and the quiet window', (tester) async {
      await _pump(tester, extra: [
        nextReminderProvider.overrideWith(() => _Next(NextReminder.at(DateTime(2026, 10, 12, 20, 30), NextKind.study))),
      ]);
      expect(find.text('On'), findsOneWidget);
      expect(find.text('Next reminder: tonight 8:30 PM, study window'), findsOneWidget);
      expect(find.text('11:00 PM to 7:00 AM'), findsOneWidget);
    });

    testWidgets('a study window with nothing planned yet says the time it is set for', (tester) async {
      await _pump(tester, prefs: NotificationPrefs(studyWindow: StudyWindow(start: const ClockTime(19, 30), end: const ClockTime(21, 0))));
      expect(find.text('Study reminder at 7:30 PM'), findsOneWidget);
    });

    testWidgets('blocked in the phone settings is said as blocked', (tester) async {
      await _pump(tester, extra: [
        notificationPermissionProvider.overrideWith((ref) async => NotificationPermission.denied),
      ]);
      expect(find.text('Blocked'), findsOneWidget);
      expect(find.text('Blocked in your phone settings'), findsOneWidget);
    });

    testWidgets('every reminder off reads Off, with no promise of a time', (tester) async {
      await _pump(tester, prefs: const NotificationPrefs(channels: {
        NotificationChannelKeys.checkDue: false,
        NotificationChannelKeys.weeklyPlan: false,
        NotificationChannelKeys.studyWindow: false,
        NotificationChannelKeys.resultReady: false,
      }));
      expect(find.text('Off'), findsOneWidget);
      expect(find.text('No study time set'), findsNothing);
    });

    test('quiet hours with the same start and end read as off', () {
      expect(NotificationsPanel.quietLine(const NotificationPrefs(quietStart: ClockTime(23, 0), quietEnd: ClockTime(23, 0))), 'Quiet hours are off');
      expect(NotificationsPanel.quietLine(NotificationPrefs.defaults), '11:00 PM to 7:00 AM');
    });

    testWidgets('both rows open the Notifications page', (tester) async {
      final router = await _pump(tester);
      await tester.tap(find.text('Quiet hours'));
      await tester.pumpAndSettle();
      expect(find.text('notifications page'), findsOneWidget);
      router.pop();
      await tester.pumpAndSettle();
      await tester.tap(find.text('Reminders'));
      await tester.pumpAndSettle();
      expect(find.text('notifications page'), findsOneWidget);
    });
  });

  group('My subjects and colleges', () {
    testWidgets('the course and the colleges are keys that open the plan editor', (tester) async {
      final router = await _pump(tester);
      await tester.tap(find.text('B.Com (Hons)'));
      await tester.pumpAndSettle();
      expect(find.text('sheet editor page'), findsOneWidget);
      router.pop();
      await tester.pumpAndSettle();
      await tester.tap(find.text('Hansraj College'));
      await tester.pumpAndSettle();
      expect(find.text('sheet editor page'), findsOneWidget);
    });

    testWidgets('the name is a key that opens the name sheet', (tester) async {
      await pumpMockmob(tester, const YouHubScreen(), wrapInScaffold: false, disableAnimations: true, size: const Size(384, 4000), overrides: youOverrides(target: ashaTarget));
      await tester.pump();
      await tester.tap(find.bySemanticsLabel('Edit name. Asha Verma'));
      await tester.pumpAndSettle();
      expect(find.text('Save name'), findsOneWidget);
    });
  });

  group('Account and privacy', () {
    test('the ways to sign in are said as a plain list, Google and phone only when the build has them', () {
      expect(AccountPanel.methodsNote(google: false, phone: false), 'Email code and password');
      expect(AccountPanel.methodsNote(google: true, phone: false), 'Email code, password and Google');
      expect(AccountPanel.methodsNote(google: true, phone: true), 'Email code, password, Google and phone code');
    });

    testWidgets('sign-in ways are listed, and Sign out asks before it signs out', (tester) async {
      await _pump(tester);
      expect(find.text('Ways to sign in'), findsOneWidget);
      expect(find.textContaining('Email code'), findsOneWidget);
      await tester.tap(find.text('Sign out'));
      // Mobi never stops breathing on this page, so the sheet is waited for in frames.
      for (var i = 0; i < 12; i++) {
        await tester.pump(const Duration(milliseconds: 100));
      }
      expect(find.text('Stay signed in'), findsOneWidget);
    });
  });

  group('small phone, large text', () {
    for (final entry in {'Credits at 360 dp and 1.3x text': 1.3, 'Credits at 360 dp and 1.0x text': 1.0}.entries) {
      testWidgets(entry.key, (tester) async {
        await pumpMockmob(
          tester,
          const CreditsScreen(),
          wrapInScaffold: false,
          disableAnimations: true,
          size: const Size(360, 3000),
          textScale: entry.value,
          overrides: youOverrides(credits: creditsState(history: [
            {'at': '2026-10-12T14:00:00Z', 'pool': 'ai', 'what': 'Repair, Q7 Accountancy and a long chapter name', 'delta': -1, 'balanceAfter': 8},
          ])),
        );
        await tester.pump();
        expect(tester.takeException(), isNull);
      });
    }

    testWidgets('the hub at 360 dp and 1.3x text has no overflow', (tester) async {
      await pumpMockmob(
        tester,
        const YouHubScreen(),
        wrapInScaffold: false,
        disableAnimations: true,
        size: const Size(360, 9000),
        textScale: 1.3,
        overrides: youOverrides(target: ashaTarget),
      );
      await tester.pump();
      expect(tester.takeException(), isNull);
    });
  });

  group('Help', () {
    testWidgets('the four common questions open in place, one at a time', (tester) async {
      await _pump(tester);
      for (final q in FaqCopy.quick) {
        expect(find.text(q.question), findsOneWidget, reason: q.id);
      }
      expect(find.text(FaqCopy.credits.answer.first), findsNothing);
      await tester.tap(find.text(FaqCopy.credits.question));
      await tester.pumpAndSettle();
      expect(find.text(FaqCopy.credits.answer.first), findsOneWidget);
      await tester.tap(find.text(FaqCopy.nta.question));
      await tester.pumpAndSettle();
      expect(find.text(FaqCopy.nta.answer.first), findsOneWidget);
      expect(find.text(FaqCopy.credits.answer.first), findsNothing, reason: 'one open at a time');
      await tester.tap(find.text(FaqCopy.nta.question));
      await tester.pumpAndSettle();
      expect(find.text(FaqCopy.nta.answer.first), findsNothing);
    });

    testWidgets('the Help page lists every question and opens the one asked for', (tester) async {
      await pumpMockmob(
        tester,
        const HelpScreen(openFaq: 'sign-in'),
        wrapInScaffold: false,
        disableAnimations: true,
        size: const Size(384, 2600),
        overrides: youOverrides(),
      );
      await tester.pump();
      for (final q in FaqCopy.all) {
        expect(find.text(q.question), findsOneWidget, reason: q.id);
      }
      expect(find.textContaining('8-digit code'), findsOneWidget);
      expect(find.text(FaqCopy.credits.answer.first), findsNothing);
    });

    test('the answers say credits, one balance, and no wallet or pool names', () {
      final text = FaqCopy.all.expand((q) => [q.question, ...q.answer]).join('\n');
      expect(text, contains('Credits pay for'));
      for (final banned in ['explanation credit', 'wallet', 'practice credits', 'ai credits']) {
        expect(text.contains(banned), isFalse, reason: banned);
      }
      expect(text.contains('!'), isFalse);
      expect(text.contains('—'), isFalse);
      expect(text.contains('·'), isFalse);
    });

    testWidgets('each question is a full-size target', (tester) async {
      await _pump(tester);
      for (final q in FaqCopy.quick) {
        expect(tester.getSize(find.bySemanticsLabel('${q.question}. Closed')).height, greaterThanOrEqualTo(48));
      }
    });
  });
}

class _Planned extends PlannedDays {
  _Planned(this.days);

  final Set<int> days;

  @override
  Set<int>? build() => days;
}
