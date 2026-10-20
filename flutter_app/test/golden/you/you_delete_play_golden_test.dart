// Goldens for Delete account when the student has a Google Play subscription that can still charge them
// (owner CTO call, 20 Oct 2026): the warning that deleting the account does not cancel it, with the key that
// opens Google Play's subscription page. 360 dp wide, Night and Day, at 1x and 1.3x text: the ask step (the
// warning is read before DELETE is typed) and the recorded step (the warning stays above Sign out).

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_client.dart';
import 'package:mockmob/core/auth/sign_out_cleanup.dart';
import 'package:mockmob/core/models/auth_me.dart' show PlaySubscriptionInfo;
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/you/account/delete_screen.dart';
import 'package:mocktail/mocktail.dart';

import '../../helpers/golden_harness.dart';
import '../../unit/billing/billing_test_support.dart';
import '../../unit/you/you_test_support.dart';
import 'you_golden_kit.dart' show setUpGoldenFonts;

final _renewing = PlaySubscriptionInfo(
  productId: 'mockmob_pro_monthly',
  state: 'active',
  active: true,
  autoRenewing: true,
  expiresAt: DateTime(2026, 11, 20),
);

void _deleteGolden(String name, {required Future<void> Function(WidgetTester tester, MockApi api) interact}) {
  for (final brightness in [Brightness.dark, Brightness.light]) {
    final tag = brightness == Brightness.dark ? 'night' : 'day';
    for (final scale in const [1.0, 1.3]) {
      final file = '${name}_${tag}_360${scale == 1 ? '' : '_text130'}';
      testWidgets(file, (tester) async {
        final api = MockApi();
        final rig = BillingRig(userId: 'u1', subscription: _renewing);
        await pumpMockmob(
          tester,
          const DeleteScreen(),
          brightness: brightness,
          size: Size(360, scale == 1 ? 780 : 960),
          textScale: scale,
          wrapInScaffold: false,
          disableAnimations: true,
          overrides: [
            ...youOverrides(api: api, drafts: draftsWithUnsent(0)),
            ...rig.overrides,
            pendingAskPrefsProvider.overrideWithValue(MemoryPrefsStore()),
          ],
        );
        await tester.pump();
        await interact(tester, api);
        await tester.pumpAndSettle();
        await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/$file.png'));
      });
    }
  }
}

void main() {
  setUpGoldenFonts();

  _deleteGolden('delete_ask_play', interact: (tester, api) async => tester.pump());

  _deleteGolden(
    'delete_recorded_play',
    interact: (tester, api) async {
      when(() => api.post('/api/me/delete', body: any(named: 'body'), expectUserId: any(named: 'expectUserId'))).thenAnswer(
        (_) async => ApiResponse(200, {
          'status': 'pending',
          'requestedAt': DateTime(2026, 10, 20, 22, 39).toUtc().toIso8601String(),
          'message': 'We delete your account and study records within 30 days. Payment records required by law are kept.',
        }),
      );
      await tester.enterText(find.byType(TextField), 'DELETE');
      await tester.pump();
      await tester.tap(find.text('Request deletion'));
      // The warn haptic reaches the platform channel on the real event loop, then waits 80 ms.
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 200)));
      await tester.pump(const Duration(milliseconds: 200));
      await tester.pump();
    },
  );
}
