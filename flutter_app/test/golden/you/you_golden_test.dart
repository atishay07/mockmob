// Goldens for the You feature at 360 by 780 logical px, device pixel ratio 2, light and dark.
// Long screens (appearance, privacy) use a taller frame so everything below the fold is checked.

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_client.dart';
import 'package:mockmob/core/models/consent.dart';
import 'package:mockmob/core/models/rhythm.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/features/you/account/account_screen.dart';
import 'package:mockmob/features/you/account/delete_screen.dart';
import 'package:mockmob/features/you/appearance/appearance_screen.dart';
import 'package:mockmob/features/you/goal/goal_screen.dart';
import 'package:mockmob/features/you/help/help_screen.dart';
import 'package:mockmob/features/you/privacy/privacy_screen.dart';
import 'package:mockmob/features/you/you_hub_screen.dart';
import 'package:mocktail/mocktail.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import '../../unit/you/you_test_support.dart';

typedef _Interact = Future<void> Function(WidgetTester tester);

void _golden(
  String name,
  Widget Function() screen, {
  required List<Override> Function() overrides,
  Size size = kGoldenSize,
  _Interact? interact,
}) {
  for (final brightness in Brightness.values) {
    testWidgets('$name, ${brightness.name}', (tester) async {
      await pumpMockmob(
        tester,
        screen(),
        brightness: brightness,
        size: size,
        wrapInScaffold: false,
        disableAnimations: true,
        overrides: overrides(),
      );
      await tester.pump();
      if (interact != null) await interact(tester);
      // Let a switch thumb or a sheet finish moving before the picture is taken.
      await tester.pumpAndSettle();
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/${name}_${brightness.name}.png'));
    });
  }
}

void main() {
  setUpAll(() async {
    await loadAppFonts();
    await _loadMaterialIcons();
  });

  _golden('hub', () => const YouHubScreen(), overrides: () => youOverrides());

  _golden(
    'goal',
    () => const GoalScreen(),
    overrides: () => youOverrides(goal: FakeGoal(goalState(4, pausedUntil: '2026-10-26'))),
    interact: (tester) async {
      await tester.tap(find.text('3'));
      await tester.pump();
    },
  );

  _golden(
    'goal_saved',
    () => const GoalScreen(),
    overrides: () => youOverrides(goal: FakeGoal(goalState(4))),
    interact: (tester) async {
      await tester.tap(find.text('6'));
      await tester.pump();
      await tester.tap(find.text('Save goal'));
      await tester.pump();
      await tester.pump();
    },
  );

  _golden(
    'goal_error',
    () => const GoalScreen(),
    overrides: () => youOverrides(goal: FakeGoal(const RemoteState<Goal>(error: ApiError(kind: ApiErrorKind.network, code: 'network')))),
  );

  _golden(
    'privacy_adult_off',
    () => const PrivacyScreen(),
    size: const Size(360, 900),
    overrides: () => youOverrides(consent: FakeConsent(consentState(AgeBand.adult))),
  );

  _golden(
    'privacy_adult_on',
    () => const PrivacyScreen(),
    size: const Size(360, 900),
    overrides: () => youOverrides(consent: FakeConsent(consentState(AgeBand.adult, on: true))),
  );

  _golden(
    'privacy_withdrawn',
    () => const PrivacyScreen(),
    size: const Size(360, 900),
    overrides: () => youOverrides(consent: FakeConsent(consentState(AgeBand.adult, on: true))),
    interact: (tester) async {
      await tester.tap(find.text('Allow usage data to improve MockMob'));
      await tester.pump();
      await tester.pump();
    },
  );

  _golden(
    'privacy_minor',
    () => const PrivacyScreen(),
    overrides: () => youOverrides(consent: FakeConsent(consentState(AgeBand.minor))),
  );

  _golden(
    'privacy_unknown',
    () => const PrivacyScreen(),
    overrides: () => youOverrides(consent: FakeConsent(consentState(AgeBand.unknown))),
  );

  _golden(
    'privacy_events',
    () => const PrivacyScreen(),
    overrides: () => youOverrides(consent: FakeConsent(consentState(AgeBand.adult))),
    interact: (tester) async {
      await tester.tap(find.text('See every event we collect'));
      await tester.pumpAndSettle();
    },
  );

  _golden(
    'account_pro',
    () => const AccountScreen(),
    overrides: () => youOverrides(fakeAuth: FakeAuth(userWith(pro: true, until: DateTime(2027, 7, 31, 12)))),
  );

  _golden(
    'account_free',
    () => const AccountScreen(),
    overrides: () => youOverrides(drafts: draftsWithUnsent(0)),
  );

  _golden(
    'sign_out_unsent',
    () => const AccountScreen(),
    overrides: () => youOverrides(drafts: draftsWithUnsent(3)),
    interact: (tester) async {
      await tester.tap(find.text('Sign out'));
      await tester.pumpAndSettle();
    },
  );

  _golden(
    'delete_ask',
    () => const DeleteScreen(),
    overrides: () => youOverrides(drafts: draftsWithUnsent(2), api: MockApi()),
    interact: (tester) async => tester.pump(),
  );

  _golden(
    'delete_recorded',
    () => const DeleteScreen(),
    overrides: () {
      final api = MockApi();
      when(() => api.post('/api/me/delete', body: any(named: 'body'))).thenAnswer(
        (_) async => ApiResponse(200, {
          'status': 'pending',
          'requestedAt': DateTime(2026, 10, 12, 22, 39).toUtc().toIso8601String(),
          'message': 'We delete your account and study records within 30 days. Payment records required by law are kept.',
        }),
      );
      return youOverrides(api: api, drafts: draftsWithUnsent(0));
    },
    interact: (tester) async {
      await tester.tap(find.text('Request deletion'));
      // The warn haptic reaches the platform channel on the real event loop, then waits 80 ms.
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 200)));
      await tester.pump(const Duration(milliseconds: 200));
      await tester.pump();
    },
  );

  _golden(
    'appearance',
    () => const AppearanceScreen(),
    size: const Size(360, 1180),
    overrides: () => youOverrides(),
  );

  _golden('help', () => const HelpScreen(), overrides: () => youOverrides());
}

/// The check glyph on a switch thumb comes from the Material icon font, which the test font
/// loader does not include. Load it from the Flutter SDK so the golden shows what a phone shows.
Future<void> _loadMaterialIcons() async {
  final root = Platform.environment['FLUTTER_ROOT'];
  if (root == null) return;
  final file = File('$root/bin/cache/artifacts/material_fonts/materialicons-regular.otf');
  if (!file.existsSync()) return;
  final bytes = await file.readAsBytes();
  final loader = FontLoader('MaterialIcons')..addFont(Future.value(ByteData.sublistView(Uint8List.fromList(bytes))));
  await loader.load();
}
