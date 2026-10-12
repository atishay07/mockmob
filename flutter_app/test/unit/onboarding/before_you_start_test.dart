import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/router/routes.dart';
import 'package:mockmob/features/onboarding/copy.dart';

import '../../helpers/fonts.dart';
import '../core_data/support/fakes.dart';
import 'support.dart';

Map<String, dynamic> _consent(String band, {bool allowed = false}) => {
      'ageBand': band,
      'analyticsAllowed': allowed,
      'policyVersion': '2026-10-12',
      'decidedAt': allowed || band != 'unknown' ? '2026-10-12T10:00:00.000Z' : null,
      'withdrawnAt': null,
    };

Future<void> _tap(WidgetTester tester, String text) async {
  await tester.tap(find.text(text).first);
  await settleFlow(tester);
}

Future<(OnboardingHarness, GoRouter)> _open(WidgetTester tester, {FakeReply? consent}) async {
  final h = OnboardingHarness();
  h.http.replies.add(consent ?? FakeReply(200, _consent('unknown')));
  final router = await h.pumpFlow(tester, initial: AppRoutes.beforeYouStart, auth: signedInAuth);
  return (h, router);
}

List<RecordedRequest> _puts(OnboardingHarness h) => h.http.requests.where((r) => r.method == 'PUT').toList();

void main() {
  setUpAll(loadAppFonts);

  testWidgets('step 1 asks the age question with three rows and the note', (tester) async {
    await _open(tester);
    expect(find.text(OnboardingCopy.beforeTitle), findsOneWidget);
    expect(find.text(OnboardingCopy.ageQuestion), findsOneWidget);
    expect(find.text(OnboardingCopy.ageYes), findsOneWidget);
    expect(find.text(OnboardingCopy.ageNo), findsOneWidget);
    expect(find.text(OnboardingCopy.agePreferNot), findsOneWidget);
    expect(find.text(OnboardingCopy.ageNote), findsOneWidget);
    expect(find.text(OnboardingCopy.skipForNow), findsOneWidget);
  });

  testWidgets('Yes writes adult with usage data off, then shows the usage card with the switch off', (tester) async {
    final (h, _) = await _open(tester);
    h.http.replies.add(FakeReply(200, {..._consent('adult'), 'deletedEvents': 0}));
    await _tap(tester, OnboardingCopy.ageYes);

    expect(_puts(h).single.path, '/api/me/consent');
    expect(_puts(h).single.body, {'ageBand': 'adult', 'analyticsAllowed': false});

    // The exact label, once, the explanation, the event link and a single Done key; switch off.
    expect(find.text('Allow usage data to improve MockMob'), findsOneWidget);
    expect(find.text(OnboardingCopy.usageExplanation), findsOneWidget);
    expect(find.text(OnboardingCopy.seeEvents), findsOneWidget);
    expect(find.text(OnboardingCopy.usageDone), findsOneWidget);
    expect(tester.widget<Switch>(find.byType(Switch)).value, isFalse);
  });

  testWidgets('the switch shows on only after the server acknowledges', (tester) async {
    final (h, _) = await _open(tester);
    h.http.replies.add(FakeReply(200, _consent('adult')));
    await _tap(tester, OnboardingCopy.ageYes);

    final gate = h.http.hold = Completer<void>();
    h.http.replies.add(FakeReply(200, _consent('adult', allowed: true)));
    await tester.tap(find.byType(Switch));
    await tester.pump(const Duration(milliseconds: 100));
    // In flight: no switch is showing on, a spinner and "Saving" stand in.
    expect(find.byType(Switch), findsNothing);
    expect(find.text(OnboardingCopy.usageSaving), findsOneWidget);

    gate.complete();
    await settleFlow(tester);
    expect(_puts(h).last.body, {'ageBand': 'adult', 'analyticsAllowed': true});
    expect(tester.widget<Switch>(find.byType(Switch)).value, isTrue);
  });

  testWidgets('a refused turn-on leaves the switch off and says so', (tester) async {
    final (h, _) = await _open(tester);
    h.http.replies.add(FakeReply(200, _consent('adult')));
    await _tap(tester, OnboardingCopy.ageYes);

    h.http.replies.add(const FakeReply(503, {'error': 'unavailable'}));
    await tester.tap(find.byType(Switch));
    await settleFlow(tester);
    expect(tester.widget<Switch>(find.byType(Switch)).value, isFalse);
    expect(find.text(OnboardingCopy.usageTurnOnFailed), findsOneWidget);
  });

  testWidgets('See every event we collect lists the events in plain words', (tester) async {
    final (h, _) = await _open(tester);
    h.http.replies.add(FakeReply(200, _consent('adult')));
    await _tap(tester, OnboardingCopy.ageYes);
    await _tap(tester, OnboardingCopy.seeEvents);
    for (final line in OnboardingCopy.eventsPlain) {
      expect(find.text(line), findsOneWidget, reason: line);
    }
    expect(find.text(OnboardingCopy.hideEvents), findsOneWidget);
  });

  testWidgets('Done leaves for Today', (tester) async {
    final (h, router) = await _open(tester);
    h.http.replies.add(FakeReply(200, _consent('adult')));
    await _tap(tester, OnboardingCopy.ageYes);
    await _tap(tester, OnboardingCopy.usageDone);
    expect(locationOf(router), AppRoutes.today);
    // Done with the switch off changes nothing: only the age write happened.
    expect(_puts(h), hasLength(1));
  });

  testWidgets('No writes minor, shows no usage card and goes to Today', (tester) async {
    final (h, router) = await _open(tester);
    h.http.replies.add(FakeReply(200, _consent('minor')));
    await _tap(tester, OnboardingCopy.ageNo);
    expect(_puts(h).single.body, {'ageBand': 'minor', 'analyticsAllowed': false});
    expect(find.text(OnboardingCopy.usageSwitchLabel), findsNothing);
    expect(locationOf(router), AppRoutes.today);
  });

  testWidgets('Prefer not to say writes unknown, with usage data off', (tester) async {
    final (h, router) = await _open(tester);
    h.http.replies.add(FakeReply(200, _consent('unknown')));
    await _tap(tester, OnboardingCopy.agePreferNot);
    expect(_puts(h).single.body, {'ageBand': 'unknown', 'analyticsAllowed': false});
    expect(locationOf(router), AppRoutes.today);
  });

  testWidgets('Skip writes nothing and goes to Today', (tester) async {
    final (h, router) = await _open(tester);
    await _tap(tester, OnboardingCopy.skipForNow);
    expect(_puts(h), isEmpty);
    expect(locationOf(router), AppRoutes.today);
  });

  testWidgets('a failed age write keeps the sheet, the rows and the choice open', (tester) async {
    final (h, router) = await _open(tester);
    h.http.replies.add(const FakeReply(503, {'error': 'unavailable'}));
    await _tap(tester, OnboardingCopy.ageYes);
    expect(find.text(OnboardingCopy.consentSaveFailed), findsOneWidget);
    expect(find.text(OnboardingCopy.ageYes), findsOneWidget);
    expect(locationOf(router), AppRoutes.beforeYouStart);
  });

  testWidgets('an offline age write says so', (tester) async {
    final (h, _) = await _open(tester);
    h.http.replies.add(const FakeReply.network());
    await _tap(tester, OnboardingCopy.ageYes);
    expect(find.text(OnboardingCopy.consentOffline), findsOneWidget);
  });

  testWidgets('an answer already on the server skips the sheet', (tester) async {
    final (_, router) = await _open(tester, consent: FakeReply(200, _consent('adult')));
    expect(locationOf(router), AppRoutes.today);
  });
}
