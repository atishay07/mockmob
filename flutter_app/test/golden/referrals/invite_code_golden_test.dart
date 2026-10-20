// Goldens for "Have a friend's code?" (owner D165): in the after-sign-in sheet and in the Wallet's invite section, closed,
// open with the server's refusal, and added; Night and Day, at 1.0 and 1.3 text. Pictures: goldens/<name>_<1.0|1.3>_<night|day>.png.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/onboarding/screens/after_sign_in_sheet.dart';
import 'package:mockmob/features/onboarding/state/colleges_move.dart' show CollegesMove;
import 'package:mockmob/features/onboarding/state/sheet_sync.dart';
import 'package:mockmob/features/referrals/invite_code_row.dart';
import 'package:mockmob/features/referrals/invite_reward.dart';
import 'package:mockmob/features/referrals/referral_copy.dart';
import 'package:mockmob/features/referrals/referral_data.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import '../../widget/referrals/invite_code_row_test.dart' show FakeClaims;

const _live = ReferralStatus(
  live: true,
  code: 'K7P2M9X',
  link: 'https://www.mockmob.in/r/K7P2M9X',
  joined: 2,
  practised: 1,
  rewarded: 1,
  earned: 100,
);

Widget _sheet() => Align(
      alignment: Alignment.bottomCenter,
      child: Builder(
        builder: (context) => DecoratedBox(
          decoration: BoxDecoration(color: context.mmColors.raised, borderRadius: const BorderRadius.vertical(top: Radius.circular(32))),
          child: SizedBox(
            width: double.infinity,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 28, 20, 40),
              child: SheetSavedView(
                phase: SheetSyncPhase.saved,
                colleges: CollegesMove.moved,
                startLabel: 'Start now, about 10 minutes',
                laterLabel: 'Tomorrow at 8:00 PM',
                onStart: () {},
                onLater: () {},
                onRetry: () {},
                onToggleUsage: (_) {},
                onToggleEvents: () {},
                onDone: () {},
                inviteRow: const InviteCodeRow(),
              ),
            ),
          ),
        ),
      ),
    );

Widget _wallet() => const SingleChildScrollView(child: WalletInviteSection());

Future<void> _settle(WidgetTester tester) async {
  for (var i = 0; i < 4; i++) {
    await tester.runAsync(() => Future<void>.delayed(Duration.zero));
    await tester.pump(const Duration(milliseconds: 120));
  }
}

Future<void> _addCode(WidgetTester tester) async {
  await tester.tap(find.text(ReferralCopy.haveCode));
  await _settle(tester);
  await tester.enterText(find.byType(TextField), 'K7P 2M9X');
  await tester.pump();
  await tester.tap(find.text(ReferralCopy.codeAdd));
  await _settle(tester);
}

void _golden(String name, Widget Function() build, {ReferralClaimOutcome? answer, bool add = false, bool openOnly = false}) {
  for (final scale in [1.0, 1.3]) {
    for (final brightness in [Brightness.dark, Brightness.light]) {
      final tag = brightness == Brightness.dark ? 'night' : 'day';
      testWidgets('$name, ${scale}x, $tag', (tester) async {
        final claims = FakeClaims(answer ?? const ReferralClaimOutcome(ok: true, done: true, state: 'joined'));
        await pumpMockmob(
          tester,
          RepaintBoundary(
            child: Builder(builder: (context) => ColoredBox(color: context.mmColors.ground, child: build())),
          ),
          brightness: brightness,
          size: const Size(360, 780),
          textScale: scale,
          disableAnimations: true,
          overrides: [
            referralStatusProvider.overrideWith((ref) async => _live),
            referralPrefsProvider.overrideWithValue(MemoryPrefsStore()),
            referralClaimServiceProvider.overrideWithValue(claims),
          ],
        );
        await _settle(tester);
        if (add) await _addCode(tester);
        if (openOnly) {
          await tester.tap(find.text(ReferralCopy.haveCode));
          await _settle(tester);
        }
        expect(tester.takeException(), isNull);
        await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/${name}_${scale}_$tag.png'));
      });
    }
  }
}

void main() {
  setUpAll(loadAppFonts);

  _golden('sheet_closed', _sheet);
  _golden('sheet_open', _sheet, openOnly: true);
  _golden('sheet_unknown_code', _sheet, add: true, answer: const ReferralClaimOutcome(ok: false, done: true, reason: 'unknown_code'));
  _golden('sheet_added', _sheet, add: true);
  _golden('wallet_closed', _wallet);
  _golden('wallet_open', _wallet, openOnly: true);
  _golden('wallet_added', _wallet, add: true);
  _golden('wallet_own_code', _wallet, add: true, answer: const ReferralClaimOutcome(ok: false, done: true, reason: 'self'));
  _golden('wallet_offline', _wallet, add: true, answer: ReferralClaimOutcome.unavailable);
}
