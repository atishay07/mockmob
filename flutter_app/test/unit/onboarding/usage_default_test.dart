import 'dart:convert';

import 'package:dio/dio.dart' show RequestOptions;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/models/consent.dart';
import 'package:mockmob/core/repositories/consent_repository.dart';
import 'package:mockmob/core/repositories/local_scope.dart';
import 'package:mockmob/core/router/routes.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/onboarding/choices_copy.dart';
import 'package:mockmob/features/onboarding/copy.dart';
import 'package:mockmob/features/onboarding/model/answers.dart';
import 'package:mockmob/features/onboarding/model/choices.dart';
import 'package:mockmob/features/onboarding/model/deck.dart';
import 'package:mockmob/features/onboarding/screens/after_sign_in_sheet.dart';

import '../../golden/onboarding/support.dart';
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import '../core_data/support/fakes.dart';

/// The server's consent record, as `GET /api/me/consent` returns it.
Map<String, Object?> _record({String band = 'unknown', bool allowed = false, bool withdrawn = false, bool decided = false}) => {
      'ageBand': band,
      'analyticsAllowed': allowed,
      'policyVersion': '2026-10-12',
      // "Rather not say" is the unknown band with a decision time: the server stamps every PUT.
      'decidedAt': band == 'unknown' && !decided ? null : '2026-10-12T10:00:00.000Z',
      'withdrawnAt': withdrawn ? '2026-10-12T11:00:00.000Z' : null,
    };

/// A server that answers the consent read with [start] and echoes every PUT, or fails PUTs that
/// turn usage data on when [failTurnOn] is set.
FakeHttpAdapter _server(Map<String, Object?> start, {bool failTurnOn = false}) {
  final http = FakeHttpAdapter();
  var record = start;
  http.handler = (RequestOptions o) {
    if (o.path.endsWith('/api/me/consent') && o.method == 'PUT') {
      final body = (o.data is String ? jsonDecode(o.data as String) : o.data) as Map;
      if (failTurnOn && body['analyticsAllowed'] == true) return const FakeReply(500, {'error': 'unavailable'});
      record = _record(band: body['ageBand'] as String, allowed: body['analyticsAllowed'] as bool, decided: true);
      return FakeReply(200, record);
    }
    if (o.path.endsWith('/api/me/consent')) return FakeReply(200, record);
    return const FakeReply(200, {});
  };
  return http;
}

List<Map> _puts(FakeHttpAdapter http) => [
      for (final r in http.requests)
        if (r.method == 'PUT' && r.path.endsWith('/api/me/consent')) (r.body is String ? jsonDecode(r.body! as String) : r.body) as Map,
    ];

Future<void> _settle(WidgetTester tester) async {
  for (var i = 0; i < 5; i++) {
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 20)));
    await tester.pump(const Duration(milliseconds: 300));
  }
}

Future<void> _pump(WidgetTester tester, FakeHttpAdapter http, {OnboardingAnswers answers = OnboardingAnswers.empty}) async {
  tester.view.physicalSize = const Size(720, 1600);
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);
  final router = GoRouter(
    initialLocation: '/start',
    routes: [
      GoRoute(path: '/start', builder: (c, s) => const Scaffold(body: SingleChildScrollView(child: AfterSignInSheet()))),
      GoRoute(path: AppRoutes.today, builder: (c, s) => const Scaffold(body: Text('STUB today'))),
    ],
  );
  addTearDown(router.dispose);
  await tester.pumpWidget(ProviderScope(
    overrides: [
      ...onboardingOverrides(http: http, answers: answers),
      userIdProvider.overrideWith((ref) => 'u1'),
    ],
    child: DefaultAssetBundle(
      bundle: FileAssetBundle(),
      child: MaterialApp.router(theme: buildTheme(Brightness.dark), routerConfig: router),
    ),
  ));
  await _settle(tester);
}

Future<void> _tap(WidgetTester tester, Finder f) async {
  await tester.ensureVisible(f);
  await tester.tap(f);
  await _settle(tester);
}

bool _switchOn(WidgetTester tester) => tester.widget<Switch>(find.byType(Switch)).value;

void main() {
  setUpAll(loadAppFonts);

  test('who can be collected (D183): anyone who did not say under 18, who allowed it and never withdrew', () {
    expect(const Consent(ageBand: AgeBand.adult, analyticsAllowed: true).canCollect, isTrue);
    expect(Consent(ageBand: AgeBand.unknown, analyticsAllowed: true, decidedAt: DateTime(2026, 10, 12)).canCollect, isTrue, reason: '"Rather not say" is on');
    expect(const Consent(ageBand: AgeBand.unknown, analyticsAllowed: true).canCollect, isFalse, reason: 'an age never answered collects nothing');
    expect(const Consent(ageBand: AgeBand.minor, analyticsAllowed: true).canCollect, isFalse, reason: 'under 18 is never collected');
    expect(const Consent(ageBand: AgeBand.adult).canCollect, isFalse);
    expect(const Consent(ageBand: AgeBand.unknown).canCollect, isFalse, reason: 'not allowed yet');
    expect(Consent(ageBand: AgeBand.unknown, analyticsAllowed: true, decidedAt: DateTime(2026, 10, 12), withdrawnAt: DateTime(2026, 10, 12)).canCollect, isFalse);
  });

  test('the age answer: "Rather not say" is answered once the server stamped it, and gets the switch (D183)', () {
    expect(const Consent().answered, isFalse, reason: 'never asked');
    expect(Consent(ageBand: AgeBand.unknown, decidedAt: DateTime(2026, 10, 12)).answered, isTrue);
    expect(Consent(ageBand: AgeBand.unknown, decidedAt: DateTime(2026, 10, 12)).switchAvailable, isTrue);
    expect(const Consent().switchAvailable, isFalse);
    expect(Consent(ageBand: AgeBand.minor, decidedAt: DateTime(2026, 10, 12)).switchAvailable, isFalse);
    expect(const Consent(ageBand: AgeBand.adult).switchAvailable, isTrue);
  });

  testWidgets('an adult sees the switch on, with where to turn it off; continuing saves allowed', (tester) async {
    final http = _server(_record());
    await _pump(tester, http);
    await _tap(tester, find.text(OnboardingCopy.ageYes));
    expect(find.text(OnboardingCopy.usageSwitchLabel), findsWidgets);
    expect(_switchOn(tester), isTrue);
    expect(find.text(ChoicesCopy.usageOffAnyTime), findsOneWidget);
    expect(_puts(http), [{'ageBand': 'adult', 'analyticsAllowed': false}], reason: 'nothing turns on before they continue');

    await _tap(tester, find.text(OnboardingCopy.done));
    expect(_puts(http).last, {'ageBand': 'adult', 'analyticsAllowed': true});
    expect(find.text('STUB today'), findsOneWidget);
  });

  testWidgets('an adult who switches it off continues with nothing turned on', (tester) async {
    final http = _server(_record());
    await _pump(tester, http);
    await _tap(tester, find.text(OnboardingCopy.ageYes));
    await _tap(tester, find.byType(Switch));
    expect(_switchOn(tester), isFalse);
    expect(find.text(ChoicesCopy.usageChangeAnyTime), findsOneWidget);
    await _tap(tester, find.text(OnboardingCopy.done));
    expect(_puts(http).any((b) => b['analyticsAllowed'] == true), isFalse);
    expect(find.text('STUB today'), findsOneWidget);
  });

  testWidgets('"No" to 18 or older never sees the switch and sends it off', (tester) async {
    final http = _server(_record());
    await _pump(tester, http);
    await _tap(tester, find.text(OnboardingCopy.ageNo));
    expect(find.byType(Switch), findsNothing);
    expect(_puts(http).single, {'ageBand': 'minor', 'analyticsAllowed': false});
    expect(find.text('STUB today'), findsOneWidget);
  });

  testWidgets('"Prefer not to say" sees the switch on and continuing saves allowed on the unknown band (D183)', (tester) async {
    final http = _server(_record());
    await _pump(tester, http);
    await _tap(tester, find.text(OnboardingCopy.agePreferNot));
    expect(find.text(OnboardingCopy.usageSwitchLabel), findsWidgets);
    expect(_switchOn(tester), isTrue);
    expect(find.text(ChoicesCopy.usageOffAnyTime), findsOneWidget);
    expect(_puts(http), [{'ageBand': 'unknown', 'analyticsAllowed': false}], reason: 'nothing turns on before they continue');

    await _tap(tester, find.text(OnboardingCopy.done));
    expect(_puts(http).last, {'ageBand': 'unknown', 'analyticsAllowed': true}, reason: 'the band stays unknown; usage data is on');
    expect(find.text('STUB today'), findsOneWidget);
  });

  testWidgets('"Prefer not to say" can switch it off before continuing', (tester) async {
    final http = _server(_record());
    await _pump(tester, http);
    await _tap(tester, find.text(OnboardingCopy.agePreferNot));
    await _tap(tester, find.byType(Switch));
    expect(_switchOn(tester), isFalse);
    await _tap(tester, find.text(OnboardingCopy.done));
    expect(_puts(http).any((b) => b['analyticsAllowed'] == true), isFalse);
    expect(find.text('STUB today'), findsOneWidget);
  });

  testWidgets('an account that already said "Prefer not to say" is not asked again', (tester) async {
    final http = _server(_record(decided: true, allowed: true));
    await _pump(tester, http);
    expect(find.text(OnboardingCopy.agePreferNot), findsNothing);
    expect(_puts(http), isEmpty);
    expect(find.text('STUB today'), findsOneWidget);
  });

  testWidgets('a failed turn-on shows the switch off with the reason; the next tap continues', (tester) async {
    final http = _server(_record(), failTurnOn: true);
    await _pump(tester, http);
    await _tap(tester, find.text(OnboardingCopy.ageYes));
    await _tap(tester, find.text(OnboardingCopy.done));
    expect(find.text(OnboardingCopy.usageTurnOnFailed), findsOneWidget);
    expect(_switchOn(tester), isFalse);
    expect(find.text('STUB today'), findsNothing);
    await _tap(tester, find.text(OnboardingCopy.done));
    expect(find.text('STUB today'), findsOneWidget);
  });

  group('after a sealed sheet', () {
    final sealedAdult = studentUpTo(Steps.plan).copyWith(age: AgeAnswer.adult);

    testWidgets('an adult starts on, and the later key saves allowed', (tester) async {
      final http = _server(_record(band: 'adult'));
      await _pump(tester, http, answers: sealedAdult);
      expect(_switchOn(tester), isTrue);
      await _tap(tester, find.textContaining('Tomorrow at'));
      expect(_puts(http).last['analyticsAllowed'], isTrue);
    });

    testWidgets('"Rather not say" starts on too, and the later key saves allowed on the unknown band', (tester) async {
      final http = _server(_record(band: 'unknown', decided: true));
      await _pump(tester, http, answers: studentUpTo(Steps.plan).copyWith(age: AgeAnswer.ratherNot));
      expect(_switchOn(tester), isTrue);
      await _tap(tester, find.textContaining('Tomorrow at'));
      expect(_puts(http).last, {'ageBand': 'unknown', 'analyticsAllowed': true});
    });

    testWidgets('under 18 sees no switch after a sealed sheet', (tester) async {
      final http = _server(_record(band: 'minor', decided: true));
      await _pump(tester, http, answers: studentUpTo(Steps.plan).copyWith(age: AgeAnswer.minor));
      expect(find.byType(Switch), findsNothing);
    });

    // Review v15 (consent): the switch follows the account's record, never this phone's answer alone, and a tap
    // never records an under-18 or unanswered account as 18 or older.
    testWidgets('an account that already said under 18 sees no switch after a sealed "Yes", and is never made adult', (tester) async {
      final http = _server(_record(band: 'minor', decided: true));
      await _pump(tester, http, answers: sealedAdult);
      expect(find.byType(Switch), findsNothing);
      await _tap(tester, find.textContaining('Tomorrow at'));
      expect(_puts(http).where((b) => b['ageBand'] == 'adult' || b['analyticsAllowed'] == true), isEmpty);
    });

    testWidgets('an account whose age answer is not saved yet: no switch until the server has it, then on', (tester) async {
      final http = _server(_record());
      await _pump(tester, http, answers: sealedAdult);
      expect(find.byType(Switch), findsNothing, reason: 'the record is still unanswered');
      final container = ProviderScope.containerOf(tester.element(find.byType(AfterSignInSheet)));
      // The sheet's own save writes the age answer the student gave (here, as it lands).
      await tester.runAsync(() => container.read(consentRepositoryProvider.notifier).setAgeBand(AgeBand.adult));
      await _settle(tester);
      expect(_switchOn(tester), isTrue);
      await _tap(tester, find.textContaining('Tomorrow at'));
      expect(_puts(http), [
        {'ageBand': 'adult', 'analyticsAllowed': false},
        {'ageBand': 'adult', 'analyticsAllowed': true},
      ]);
    });

    testWidgets('an account whose age answer is not saved yet continues with nothing turned on', (tester) async {
      final http = _server(_record());
      await _pump(tester, http, answers: sealedAdult);
      await _tap(tester, find.textContaining('Tomorrow at'));
      expect(_puts(http), isEmpty, reason: 'no switch was shown, so nothing is sent and nothing is promoted');
    });

    testWidgets('an account that turned it off before starts off and stays off', (tester) async {
      final http = _server(_record(band: 'adult', withdrawn: true));
      await _pump(tester, http, answers: sealedAdult);
      expect(_switchOn(tester), isFalse);
      await _tap(tester, find.textContaining('Tomorrow at'));
      expect(_puts(http).any((b) => b['analyticsAllowed'] == true), isFalse);
    });
  });
}
