import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/widgets/controls/mm_switch.dart';
import 'package:mockmob/core/analytics/event_allowlist.dart';
import 'package:mockmob/core/models/consent.dart';
import 'package:mockmob/core/repositories/consent_repository.dart';
import 'package:mockmob/features/you/privacy/privacy_screen.dart';

import '../../helpers/golden_harness.dart';
import 'you_test_support.dart';

Future<void> _pump(WidgetTester tester, FakeConsent consent) => pumpMockmob(
      tester,
      const PrivacyScreen(),
      wrapInScaffold: false,
      disableAnimations: true,
      size: const Size(360, 1100),
      overrides: youOverrides(consent: consent),
    );

Finder get _switch => find.byType(MmSwitch);

bool _on(WidgetTester tester) => tester.widget<MmSwitch>(_switch).value;

const _withdrawn = 'Usage data is off and earlier data was deleted.';

void main() {
  group('adult', () {
    testWidgets('the exact label appears once, unaltered, with the exact explanation', (tester) async {
      await _pump(tester, FakeConsent(consentState(AgeBand.adult)));
      expect(find.text('Allow usage data to improve MockMob'), findsOneWidget);
      expect(find.text(usageDataConsentLabel), findsOneWidget);
      expect(
        find.text(
          'We count which parts of the app are used, such as starting a mock or finishing a repair, '
          'along with the app version. We do not collect your answers, marks, questions, contacts, '
          'location or an advertising ID. Turn this off any time and collection stops straight away.',
        ),
        findsOneWidget,
      );
      expect(find.text('See every event we collect'), findsOneWidget);
      expect(_on(tester), isFalse);
    });

    testWidgets('turning on: the switch stays off until the server acknowledges', (tester) async {
      final consent = FakeConsent(consentState(AgeBand.adult))..gate = Completer<Consent>();
      await _pump(tester, consent);
      await tester.tap(find.text(usageDataConsentLabel));
      await tester.pump();
      expect(consent.allowedCalls, [true]);
      expect(_on(tester), isFalse, reason: 'no success before the server answers');
      expect(find.text('Saving your choice'), findsOneWidget);

      consent.gate!.complete(Consent(ageBand: AgeBand.adult, analyticsAllowed: true, decidedAt: DateTime(2026, 10, 12)));
      await tester.pump();
      await tester.pump();
      expect(_on(tester), isTrue);
      expect(find.text('Saving your choice'), findsNothing);
    });

    testWidgets('a failed turn-on leaves the switch off and says so', (tester) async {
      final consent = FakeConsent(consentState(AgeBand.adult))..failWith = offlineError();
      await _pump(tester, consent);
      await tester.tap(find.text(usageDataConsentLabel));
      await tester.pump();
      await tester.pump();
      expect(_on(tester), isFalse);
      expect(find.text('We could not save that. Usage data is still off. Try again.'), findsOneWidget);
    });

    testWidgets('withdrawal: the switch reads off at once, the confirmation waits for the server', (tester) async {
      final consent = FakeConsent(consentState(AgeBand.adult, on: true))..gate = Completer<Consent>();
      await _pump(tester, consent);
      expect(_on(tester), isTrue);

      await tester.tap(find.text(usageDataConsentLabel));
      await tester.pump();
      // Collection has stopped, but nothing is confirmed yet.
      expect(_on(tester), isFalse);
      expect(find.text(_withdrawn), findsNothing);
      expect(find.text('Turning off. Collection has already stopped.'), findsOneWidget);

      consent.gate!.complete(const Consent(ageBand: AgeBand.adult, deletedEvents: 12));
      await tester.pump();
      await tester.pump();
      expect(find.text(_withdrawn), findsOneWidget);
      expect(find.text('Turning off. Collection has already stopped.'), findsNothing);
    });

    testWidgets('withdrawal on a 503 says the choice was saved but the delete failed, with Try again', (tester) async {
      final consent = FakeConsent(consentState(AgeBand.adult, on: true))..failWith = unavailableError();
      await _pump(tester, consent);
      await tester.tap(find.text(usageDataConsentLabel));
      await tester.pump();
      await tester.pump();
      expect(find.text('Your choice was saved, but deleting earlier data failed. Try again.'), findsOneWidget);
      expect(find.text(_withdrawn), findsNothing);
      expect(_on(tester), isFalse);

      consent.failWith = null;
      await tester.tap(find.text('Try again'));
      await tester.pump();
      await tester.pump();
      expect(consent.allowedCalls, [false, false]);
      expect(find.text(_withdrawn), findsOneWidget);
    });

    testWidgets('withdrawal that never reaches the server is not confirmed', (tester) async {
      final consent = FakeConsent(consentState(AgeBand.adult, on: true))..failWith = offlineError();
      await _pump(tester, consent);
      await tester.tap(find.text(usageDataConsentLabel));
      await tester.pump();
      await tester.pump();
      expect(find.textContaining('We could not reach the server to delete earlier data'), findsOneWidget);
      expect(find.text(_withdrawn), findsNothing);
    });

    testWidgets('See every event we collect lists every allowlisted event in plain words', (tester) async {
      await _pump(tester, FakeConsent(consentState(AgeBand.adult)));
      await tester.tap(find.text('See every event we collect'));
      await tester.pumpAndSettle();
      expect(find.text('Every event we collect'), findsOneWidget);
      for (final text in analyticsEventDescriptions.values) {
        expect(find.text(text), findsOneWidget, reason: text);
      }
      expect(analyticsEventDescriptions.length, AnalyticsEvents.all.length);
    });

    testWidgets('the operational data note says the switch does not control it', (tester) async {
      await _pump(tester, FakeConsent(consentState(AgeBand.adult)));
      expect(find.textContaining('This switch controls neither'), findsOneWidget);
      expect(find.textContaining('Google Play also reports crashes'), findsOneWidget);
    });
  });

  group('minor', () {
    testWidgets('reads "Off for your account." with no switch, says why, and offers the age question', (tester) async {
      await _pump(tester, FakeConsent(consentState(AgeBand.minor)));
      expect(find.text('Off for your account.'), findsOneWidget);
      expect(find.text('Usage data stays off because you said you are under 18.'), findsOneWidget);
      expect(_switch, findsNothing);
      expect(find.text(usageDataConsentLabel), findsNothing);
      expect(find.text('Change my age answer'), findsOneWidget);
    });
  });

  group('prefer not to say (D183)', () {
    testWidgets('gets the switch like an adult, and anyone can turn it off here', (tester) async {
      final consent = FakeConsent(consentState(AgeBand.unknown, on: true));
      await _pump(tester, consent);
      expect(find.text('Off for your account.'), findsNothing);
      expect(find.text(usageDataConsentLabel), findsOneWidget);
      expect(_on(tester), isTrue);
      await tester.tap(_switch);
      await tester.pumpAndSettle();
      expect(consent.allowedCalls, [false]);
      expect(_on(tester), isFalse);
    });

    testWidgets('an age never answered still reads off, and its one key answers the age question', (tester) async {
      final consent = FakeConsent(const ConsentState(status: ConsentStatus.loaded, consent: Consent()));
      await _pump(tester, consent);
      expect(find.text('Off for your account.'), findsOneWidget);
      expect(find.text('Usage data stays off until you answer the age question.'), findsOneWidget);
      expect(_switch, findsNothing);
      // The key says what it does for a student who never answered: there is no answer to change.
      expect(find.text('Change my age answer'), findsNothing);
      await tester.tap(find.text('Answer the age question'));
      await tester.pumpAndSettle();
      expect(find.text('Are you 18 or older?'), findsOneWidget);
      await tester.tap(find.text('Prefer not to say'));
      await tester.pumpAndSettle();
      expect(consent.ageCalls, [AgeBand.unknown]);
      expect(find.text(usageDataConsentLabel), findsOneWidget);
      expect(_on(tester), isFalse, reason: 'nothing was on before, so nothing turns on');
      expect(find.text('Change my age answer'), findsOneWidget, reason: 'answered now');
    });
  });

  testWidgets('Change my age answer re-asks the age question and saves the choice', (tester) async {
    final consent = FakeConsent(consentState(AgeBand.adult, on: true));
    await _pump(tester, consent);
    await tester.tap(find.text('Change my age answer'));
    await tester.pumpAndSettle();
    expect(find.text('Are you 18 or older?'), findsOneWidget);
    expect(find.text('This only decides your data settings.'), findsNothing, reason: 'the defensive caption is gone');
    expect(find.text('Yes'), findsOneWidget);
    expect(find.text('No'), findsOneWidget);
    expect(find.text('Prefer not to say'), findsOneWidget);
    await tester.tap(find.text('Prefer not to say'));
    await tester.pumpAndSettle();
    expect(consent.ageCalls, [AgeBand.unknown]);
    // The screen now follows the new record: "Prefer not to say" gets the switch (D183), and an adult who had
    // usage data on keeps it on (the repository keeps an earlier "allowed" for this answer).
    expect(find.text('Off for your account.'), findsNothing);
    expect(find.text(usageDataConsentLabel), findsOneWidget);
    expect(_on(tester), isTrue);
    expect(consent.allowedCalls, isEmpty, reason: 'changing the age answer alone never touches the switch');
  });

  testWidgets('an adult with usage data off who picks "Prefer not to say" gets the switch, still off', (tester) async {
    final consent = FakeConsent(consentState(AgeBand.adult));
    await _pump(tester, consent);
    await tester.tap(find.text('Change my age answer'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Prefer not to say'));
    await tester.pumpAndSettle();
    expect(consent.ageCalls, [AgeBand.unknown]);
    expect(find.text(usageDataConsentLabel), findsOneWidget);
    expect(_on(tester), isFalse);
  });

  testWidgets('a minor who says Yes gets the switch, still off', (tester) async {
    final consent = FakeConsent(consentState(AgeBand.minor));
    await _pump(tester, consent);
    await tester.tap(find.text('Change my age answer'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Yes'));
    await tester.pumpAndSettle();
    expect(consent.ageCalls, [AgeBand.adult]);
    expect(find.text(usageDataConsentLabel), findsOneWidget);
    expect(_on(tester), isFalse);
  });

  testWidgets('a failed age change is reported', (tester) async {
    final consent = FakeConsent(consentState(AgeBand.minor))..failWith = offlineError();
    await _pump(tester, consent);
    await tester.tap(find.text('Change my age answer'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Yes'));
    await tester.pumpAndSettle();
    expect(find.text('We could not save your answer. Try again.'), findsOneWidget);
  });

  testWidgets('a failed consent read keeps usage data off and offers Try again', (tester) async {
    final consent = FakeConsent(consentState(AgeBand.unknown, status: ConsentStatus.failed));
    await _pump(tester, consent);
    expect(find.text('We could not load your usage-data choice'), findsOneWidget);
    expect(_switch, findsNothing);
    await tester.tap(find.text('Try again'));
    await tester.pump();
    expect(consent.loads, 1);
  });

  testWidgets('while the choice loads it shows a skeleton and no switch', (tester) async {
    await _pump(tester, FakeConsent(consentState(AgeBand.unknown, status: ConsentStatus.loading)));
    expect(find.bySemanticsLabel('Loading your usage-data choice'), findsOneWidget);
    expect(_switch, findsNothing);
  });
}
