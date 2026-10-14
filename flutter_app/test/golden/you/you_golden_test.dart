// Goldens for the You feature at 384 by 853 logical px, DPR 2, Night and Daylight. Long screens
// use a taller frame so everything below the fold is checked.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_client.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/models/consent.dart';
import 'package:mockmob/core/models/rhythm.dart';
import 'package:mockmob/core/repositories/consent_repository.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/features/you/account/account_screen.dart';
import 'package:mockmob/features/you/account/delete_screen.dart';
import 'package:mockmob/features/you/appearance/appearance_screen.dart';
import 'package:mockmob/features/you/goal/goal_screen.dart';
import 'package:mockmob/features/you/help/help_screen.dart';
import 'package:mockmob/features/you/privacy/privacy_screen.dart';
import 'package:mockmob/features/you/you_hub_screen.dart';
import 'package:mocktail/mocktail.dart';

import '../../unit/you/you_test_support.dart';
import 'you_golden_kit.dart';

/// The Security section pushed the sign-out key below the fold, and the list builds lazily: scroll
/// to the end so the key is fully on screen, then open its sheet.
Future<void> _openSignOut(WidgetTester tester) async {
  await tester.scrollUntilVisible(find.text('Sign out'), 200, scrollable: find.byType(Scrollable).first);
  await tester.drag(find.byType(Scrollable).first, const Offset(0, -600));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Sign out'));
  await tester.pumpAndSettle();
}

void main() {
  setUpGoldenFonts();

  sheetGolden(
    'hub',
    () => const YouHubScreen(),
    overrides: () => youOverrides(target: ashaTarget, rhythm: FakeRhythm(rhythmState(milestones: earnedMilestones))),
  );

  sheetGolden(
    'hub_full_page',
    () => const YouHubScreen(),
    size: const Size(384, 2000),
    overrides: () => youOverrides(target: ashaTarget, rhythm: FakeRhythm(rhythmState(milestones: earnedMilestones))),
  );

  // Day one: no setup answers kept, no milestones, no run yet.
  sheetGolden(
    'hub_new',
    () => const YouHubScreen(),
    overrides: () => youOverrides(rhythm: FakeRhythm(rhythmState(streak: 0, best: 0, studyDayDates: const []))),
  );

  sheetGolden(
    'hub_loading',
    () => const YouHubScreen(),
    settle: false,
    overrides: () => youOverrides(target: ashaTarget, rhythm: FakeRhythm(const RemoteState<Rhythm>(loading: true))),
  );

  sheetGolden(
    'hub_failed',
    () => const YouHubScreen(),
    overrides: () => youOverrides(
      target: ashaTarget,
      rhythm: FakeRhythm(const RemoteState<Rhythm>(error: ApiError(kind: ApiErrorKind.network, code: 'network'))),
    ),
  );

  sheetGolden(
    'goal',
    () => const GoalScreen(),
    overrides: () => youOverrides(goal: FakeGoal(goalState(4, pausedUntil: '2026-10-26'))),
    interact: (tester) async {
      await tester.tap(find.bySemanticsLabel('3 days a week'));
      await tester.pump();
    },
  );

  sheetGolden(
    'goal_saved',
    () => const GoalScreen(),
    overrides: () => youOverrides(goal: FakeGoal(goalState(4))),
    interact: (tester) async {
      await tester.tap(find.bySemanticsLabel('6 days a week'));
      await tester.pump();
      await tester.tap(find.text('Save goal'));
      await tester.pump();
      await tester.pump();
    },
  );

  sheetGolden(
    'goal_error',
    () => const GoalScreen(),
    overrides: () => youOverrides(goal: FakeGoal(const RemoteState<Goal>(error: ApiError(kind: ApiErrorKind.network, code: 'network')))),
  );

  sheetGolden(
    'privacy_adult_off',
    () => const PrivacyScreen(),
    size: const Size(384, 960),
    overrides: () => youOverrides(consent: FakeConsent(consentState(AgeBand.adult))),
  );

  sheetGolden(
    'privacy_withdrawn',
    () => const PrivacyScreen(),
    size: const Size(384, 960),
    overrides: () => youOverrides(consent: FakeConsent(consentState(AgeBand.adult, on: true))),
    interact: (tester) async {
      await tester.tap(find.text('Allow usage data to improve MockMob'));
      await tester.pump();
      await tester.pump();
    },
  );

  sheetGolden(
    'privacy_minor',
    () => const PrivacyScreen(),
    overrides: () => youOverrides(consent: FakeConsent(consentState(AgeBand.minor))),
  );

  sheetGolden(
    'privacy_loading',
    () => const PrivacyScreen(),
    settle: false,
    overrides: () => youOverrides(consent: FakeConsent(consentState(AgeBand.unknown, status: ConsentStatus.loading))),
  );

  sheetGolden(
    'privacy_events',
    () => const PrivacyScreen(),
    overrides: () => youOverrides(consent: FakeConsent(consentState(AgeBand.adult))),
    interact: (tester) async {
      await tester.tap(find.text('See every event we collect'));
      await tester.pumpAndSettle();
    },
  );

  sheetGolden(
    'account_pro',
    () => const AccountScreen(),
    overrides: () => youOverrides(
      fakeAuth: FakeAuth(
        AuthSnapshot(
          status: AuthStatus.signedIn,
          userId: 'u1',
          email: 'asha.verma@example.com',
          name: 'Asha Verma',
          subjects: const ['accountancy', 'business_studies', 'economics', 'english'],
          isPro: true,
          premiumUntil: DateTime(2027, 7, 31, 12),
        ),
      ),
    ),
  );

  sheetGolden(
    'sign_out_unsent',
    () => const AccountScreen(),
    overrides: () => youOverrides(drafts: draftsWithUnsent(3)),
    interact: (tester) async {
      await _openSignOut(tester);
    },
  );

  sheetGolden(
    'sign_out_plain',
    () => const AccountScreen(),
    overrides: () => youOverrides(drafts: draftsWithUnsent(0)),
    interact: (tester) async {
      await _openSignOut(tester);
    },
  );

  sheetGolden(
    'delete_ask',
    () => const DeleteScreen(),
    overrides: () => youOverrides(drafts: draftsWithUnsent(2), api: MockApi()),
    interact: (tester) async => tester.pump(),
  );

  sheetGolden(
    'delete_recorded',
    () => const DeleteScreen(),
    overrides: () {
      final api = MockApi();
      when(() => api.post('/api/me/delete', body: any(named: 'body'), expectUserId: any(named: 'expectUserId'))).thenAnswer(
        (_) async => ApiResponse(200, {
          'status': 'pending',
          'requestedAt': DateTime(2026, 10, 12, 22, 39).toUtc().toIso8601String(),
          'message': 'We delete your account and study records within 30 days. Payment records required by law are kept.',
        }),
      );
      return youOverrides(api: api, drafts: draftsWithUnsent(0));
    },
    interact: (tester) async {
      await tester.enterText(find.byType(TextField), 'DELETE');
      await tester.pump();
      await tester.tap(find.text('Request deletion'));
      // The warn haptic reaches the platform channel on the real event loop, then waits 80 ms.
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 200)));
      await tester.pump(const Duration(milliseconds: 200));
      await tester.pump();
    },
  );

  sheetGolden('appearance', () => const AppearanceScreen(), size: const Size(384, 1090), overrides: () => youOverrides());

  sheetGolden('help', () => const HelpScreen(), size: const Size(384, 1240), overrides: () => youOverrides());
}
