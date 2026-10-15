import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/models/consent.dart';
import 'package:mockmob/core/models/rhythm.dart';
import 'package:mockmob/core/repositories/consent_repository.dart' show ConsentStatus;
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/widgets/widgets.dart' show SubjectPlate;
import 'package:mockmob/core/widgets/account/account_avatar.dart' show AccountAvatar, AccountAvatarButton;
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/you/data/student_target.dart';
import 'package:mockmob/features/you/edit_copy.dart';
import 'package:mockmob/features/you/hub/hub_sections.dart' show HubFacts;
import 'package:mockmob/features/you/you_hub_screen.dart';

import '../../helpers/golden_harness.dart';
import 'you_test_support.dart';

Future<GoRouter> _pumpHub(
  WidgetTester tester, {
  FakeConsent? consent,
  FakeGoal? goal,
  FakeRhythm? rhythm,
  RecordingOpener? opener,
  StudentTarget? target,
}) async {
  // Tall enough for the whole hub, tools shelf included, so every row is built and hit-testable.
  tester.view.physicalSize = const Size(768, 10000);
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);
  final router = GoRouter(
    initialLocation: '/you',
    routes: [
      GoRoute(path: '/you', builder: (_, _) => const YouHubScreen()),
      GoRoute(path: '/you/rhythm', builder: (_, _) => const Text('rhythm page')),
      GoRoute(path: '/you/milestones', builder: (_, _) => const Text('milestones page')),
      GoRoute(path: '/review/record', builder: (_, _) => const Text('record page')),
      GoRoute(path: '/you/privacy', builder: (_, _) => const Text('privacy page')),
      GoRoute(path: '/you/goal', builder: (_, _) => const Text('goal page')),
      GoRoute(path: '/you/credits', builder: (_, _) => const Text('credits page')),
      GoRoute(path: '/you/notifications', builder: (_, _) => const Text('notifications page')),
      GoRoute(path: '/you/account', builder: (_, _) => const Text('account page')),
      GoRoute(path: '/you/help', builder: (_, _) => const Text('help page')),
      GoRoute(path: '/you/appearance', builder: (_, _) => const Text('appearance page')),
    ],
  );
  await tester.pumpWidget(
    ProviderScope(
      overrides: youOverrides(consent: consent, goal: goal, rhythm: rhythm, opener: opener, target: target),
      child: DefaultAssetBundle(
        bundle: FileAssetBundle(),
        child: MaterialApp.router(theme: buildTheme(Brightness.light), routerConfig: router),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return router;
}

void main() {
  testWidgets('identity comes first: the sheet card with name, email, subjects and this week', (tester) async {
    await _pumpHub(tester);
    expect(find.text('Your CUET plan, UG 2027'), findsOneWidget);
    expect(find.text('Asha Verma'), findsOneWidget);
    expect(find.text('asha.verma@example.com'), findsOneWidget);
    for (final subject in ['Accountancy', 'Business Studies', 'Economics', 'English']) {
      expect(find.text(subject), findsOneWidget, reason: subject);
    }
    expect(find.text('3 days to your goal'), findsOneWidget, reason: 'the shared study week says what is left');
    expect(find.text('3 weeks in rhythm'), findsOneWidget);
  });

  testWidgets('each subject is the shared plate, 136 by 104 dp, not a private tile', (tester) async {
    await _pumpHub(tester, target: ashaTarget);
    final plates = find.byType(SubjectPlate);
    expect(plates, findsNWidgets(4));
    for (final plate in plates.evaluate()) {
      expect(tester.getSize(find.byWidget(plate.widget)), const Size(136, 104));
    }
  });

  testWidgets('the course and colleges picked in setup print in order of preference', (tester) async {
    await _pumpHub(tester, target: ashaTarget);
    expect(find.text('B.Com (Hons)'), findsOneWidget);
    expect(find.text('Shri Ram College of Commerce'), findsOneWidget);
    expect(find.bySemanticsLabel('Choice 1, Shri Ram College of Commerce'), findsOneWidget);
    expect(find.bySemanticsLabel('Choice 3, Kirori Mal College'), findsOneWidget);
  });

  testWidgets('fields with nothing in them are left off, never shown as unknown', (tester) async {
    await _pumpHub(tester);
    expect(find.text('Course'), findsNothing);
    expect(find.text('Colleges'), findsOneWidget, reason: 'only the section chip: no Colleges field');
    expect(find.textContaining('unknown'), findsNothing);
  });

  testWidgets('lists the sections of the hub: plan, appearance, study days, reminders, progress, account, tools, help', (tester) async {
    await _pumpHub(tester);
    for (final label in [
      'Plan and credits',
      'Appearance',
      'Study days',
      'Notifications',
      'Progress',
      'Account and privacy',
      'CUET tools',
      'Help',
      'Milestones',
    ]) {
      expect(find.text(label), findsWidgets, reason: label);
    }
    for (final label in [
      'Weekly goal',
      'Planned days',
      'Pause study days',
      'Reminders',
      'Quiet hours',
      'Repair record',
      'Personal bests',
      'Name and email',
      'Ways to sign in',
      'Privacy',
      'Compass',
      'Combo Planner',
      'Help and about',
      'Glass, touch and celebrations',
    ]) {
      expect(find.text(label), findsOneWidget, reason: label);
    }
  });

  testWidgets('the theme is one tap on the hub: Night, Day and Match phone', (tester) async {
    await _pumpHub(tester);
    for (final label in ['Night', 'Day', 'Match phone']) {
      expect(find.text(label), findsOneWidget, reason: label);
    }
    expect(find.text('Night is the dark look. Day is the light look.'), findsOneWidget);
    expect(find.text('Daylight'), findsNothing);
  });

  testWidgets('the weekly goal row shows the goal and what counts as a study day', (tester) async {
    await _pumpHub(tester);
    expect(find.text('4 days a week'), findsOneWidget);
    expect(find.bySemanticsLabel(RegExp(r'^Weekly goal\. A study day is a day you finish a practice, a mock or a repair\. 4 days a week$')), findsOneWidget);
  });

  testWidgets('planned days: a line asking for the weekdays until some are chosen', (tester) async {
    await _pumpHub(tester);
    expect(find.text('Pick the weekdays you will study'), findsOneWidget, reason: 'no weekdays chosen on this phone yet');
  });

  testWidgets('the credit tiles on the hub name both pools and open the Credits page', (tester) async {
    final router = await _pumpHub(tester);
    expect(find.text('Practice credits'), findsOneWidget);
    expect(find.text('AI credits'), findsOneWidget);
    expect(find.text('See history'), findsOneWidget);
    expect(find.text('Free'), findsOneWidget);
    expect(find.text('Free plan'), findsNothing);
    expect(find.text('Renews 1 November'), findsOneWidget);
    await tester.tap(find.text('See history'));
    await tester.pumpAndSettle();
    expect(find.text('credits page'), findsOneWidget);
    router.pop();
    await tester.pumpAndSettle();
    await tester.tap(find.text('AI credits'));
    await tester.pumpAndSettle();
    expect(find.text('credits page'), findsOneWidget);
  });

  testWidgets('the reminders row says when the study reminder is, and quiet hours say the window', (tester) async {
    await _pumpHub(tester);
    expect(find.text('11:00 PM to 7:00 AM'), findsOneWidget);
    expect(find.text('No study time set'), findsOneWidget);
  });

  testWidgets('a run of zero weeks is never printed as a number', (tester) async {
    await _pumpHub(tester, rhythm: FakeRhythm(rhythmState(streak: 0, best: 0)));
    expect(find.text('A run starts the week you reach your goal.'), findsOneWidget);
    expect(find.textContaining('weeks in rhythm'), findsNothing);
  });

  testWidgets('a pause is said on the pause row', (tester) async {
    final until = DateTime.now().add(const Duration(days: 10));
    final iso = '${until.year}-${until.month.toString().padLeft(2, '0')}-${until.day.toString().padLeft(2, '0')}';
    await _pumpHub(tester, goal: FakeGoal(goalState(4, pausedUntil: iso)));
    expect(find.text('Study days are paused'), findsOneWidget);
    expect(find.textContaining('Paused until'), findsWidgets);
  });

  testWidgets('earned tokens carry their date; an empty slot says plainly what fills it', (tester) async {
    await _pumpHub(tester, rhythm: FakeRhythm(rhythmState(milestones: earnedMilestones)));
    // Track names belong to the rhythm feature; You checks the dates and the plain empty line.
    expect(find.bySemanticsLabel(RegExp(r', earned on 27 September$')), findsOneWidget);
    expect(find.bySemanticsLabel(RegExp(r', earned on 9 October$')), findsOneWidget);
    expect(find.bySemanticsLabel(RegExp(r'not earned yet\. Lands when a week meets your goal$')), findsOneWidget);
  });

  testWidgets('a failed rhythm read says so in the week field and on the shelf, with a retry', (tester) async {
    await _pumpHub(tester, rhythm: FakeRhythm(const RemoteState<Rhythm>(error: ApiError(kind: ApiErrorKind.network, code: 'network'))));
    expect(find.text('This week did not load.'), findsOneWidget);
    expect(find.text('Your milestones did not load.'), findsOneWidget);
    expect(find.text('Try again'), findsNWidgets(2));
    expect(find.textContaining('not earned yet'), findsNothing, reason: 'unknown is not shown as empty');
  });

  testWidgets('the privacy row reflects the account', (tester) async {
    await _pumpHub(tester, consent: FakeConsent(consentState(AgeBand.minor)));
    expect(find.text('Off for your account'), findsOneWidget);
  });

  group('the privacy row never says off for a choice it has not read', () {
    for (final status in [ConsentStatus.notLoaded, ConsentStatus.loading, ConsentStatus.failed]) {
      testWidgets('$status: no usage-data line at all', (tester) async {
        await _pumpHub(tester, consent: FakeConsent(consentState(AgeBand.adult, status: status)));
        expect(find.text('Usage data is off'), findsNothing);
        expect(find.text('Usage data is on'), findsNothing);
        expect(find.text('Off for your account'), findsNothing);
        expect(HubFacts.privacyNote(consentState(AgeBand.adult, status: status)), isNull);
      });
    }

    testWidgets('a loaded adult sees the real state, on or off', (tester) async {
      expect(HubFacts.privacyNote(consentState(AgeBand.adult, on: true)), 'Usage data is on');
      expect(HubFacts.privacyNote(consentState(AgeBand.adult)), 'Usage data is off');
      await _pumpHub(tester, consent: FakeConsent(consentState(AgeBand.adult, on: true)));
      expect(find.text('Usage data is on'), findsOneWidget);
    });

    test('a withdrawal the server has not acknowledged reads off', () {
      final pending = consentState(AgeBand.adult, on: true).copyWith(withdrawalPending: true);
      expect(HubFacts.privacyNote(pending), 'Usage data is off');
    });
  });

  testWidgets('rows and the week field open their screens', (tester) async {
    final router = await _pumpHub(tester);
    await tester.tap(find.text('Weekly goal'));
    await tester.pumpAndSettle();
    expect(find.text('goal page'), findsOneWidget);
    router.pop();
    await tester.pumpAndSettle();
    await tester.tap(find.text('Pause study days'));
    await tester.pumpAndSettle();
    expect(find.text('rhythm page'), findsOneWidget);
    router.pop();
    await tester.pumpAndSettle();
    await tester.tap(find.text('Repair record'));
    await tester.pumpAndSettle();
    expect(find.text('record page'), findsOneWidget);
    router.pop();
    await tester.pumpAndSettle();
    await tester.tap(find.text('See all'));
    await tester.pumpAndSettle();
    expect(find.text('milestones page'), findsOneWidget);
    router.pop();
    await tester.pumpAndSettle();
    await tester.tap(find.text('This week'));
    await tester.pumpAndSettle();
    expect(find.text('rhythm page'), findsOneWidget);
  });

  testWidgets('CUET tools open in a Custom Tab on www.mockmob.in', (tester) async {
    final opener = RecordingOpener();
    await _pumpHub(tester, opener: opener);
    await tester.ensureVisible(find.text('Compass'));
    await tester.tap(find.text('Compass'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Combo Planner'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Combo Planner'));
    await tester.pumpAndSettle();
    expect(opener.opened.map((u) => u.toString()), [
      'https://www.mockmob.in/admission-compass',
      'https://www.mockmob.in/cuet-subject-combination',
    ]);
  });

  testWidgets('a tool that will not open says so', (tester) async {
    await _pumpHub(tester, opener: RecordingOpener(result: false));
    await tester.tap(find.text('Compass'));
    await tester.pumpAndSettle();
    expect(find.text('We could not open that page. Check your connection and try again.'), findsOneWidget);
  });

  testWidgets('reduced motion shows the hub at once', (tester) async {
    await pumpMockmob(
      tester,
      const YouHubScreen(),
      disableAnimations: true,
      wrapInScaffold: false,
      size: const Size(384, 6000),
      overrides: youOverrides(),
    );
    await tester.pump();
    expect(find.text('Account and privacy'), findsOneWidget);
  });

  testWidgets('rows are at least 48 dp tall and labelled for TalkBack', (tester) async {
    await _pumpHub(tester);
    expect(tester.getSize(find.bySemanticsLabel('Help and about. All questions, contact and policies')).height, greaterThanOrEqualTo(48));
    expect(find.bySemanticsLabel('Glass, touch and celebrations. How MockMob looks and feels on this phone'), findsOneWidget);
  });

  testWidgets('You is a tab root: the title row has the name of the tab, no back key and no avatar', (tester) async {
    await _pumpHub(tester);
    expect(find.text('You'), findsOneWidget, reason: 'the tab title');
    expect(find.bySemanticsLabel('Back'), findsNothing);
    expect(find.bySemanticsLabel('You, profile and settings'), findsNothing);
    // One side action, Edit sheet, and it is a full 48 dp target.
    expect(tester.getSize(find.bySemanticsLabel(EditCopy.editSheetLabel)).height, greaterThanOrEqualTo(48));
  });

  testWidgets('every block starts on the 16 dp gutter, nothing at 20 or 36', (tester) async {
    await _pumpHub(tester, target: ashaTarget);
    // 384 dp wide view (768 px at 2x): the account key (which leads the tab header, then the title
    // 12 dp after its 40 dp disc), the sheet words and a section title share one edge.
    final edge = tester.getTopLeft(find.byType(AccountAvatar)).dx;
    expect(edge, 16);
    expect(tester.getTopLeft(find.text('You')).dx, 16 + AccountAvatarButton.visual + 12);
    expect(tester.getTopLeft(find.text('Your CUET plan, UG 2027')).dx, edge);
    expect(tester.getTopLeft(find.text('Asha Verma')).dx, edge);
    expect(tester.getTopLeft(find.text('Milestones')).dx, edge);
    expect(tester.getTopLeft(find.text('Account and privacy')).dx, edge);
  });

  testWidgets('the milestone shelf is one way into Milestones, beside See all', (tester) async {
    final router = await _pumpHub(tester, rhythm: FakeRhythm(rhythmState(milestones: earnedMilestones)));
    await tester.tap(find.bySemanticsLabel(RegExp(r', earned on 27 September$')));
    await tester.pumpAndSettle();
    expect(find.text('milestones page'), findsOneWidget);
    router.pop();
  });
}
