// "Have a friend's code?" (owner D165): the row draws only once invites are live, keeps a typed code with source 'code',
// hands it to the server and says plainly what the server answered. In the after-sign-in sheet and the Wallet.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/onboarding/screens/after_sign_in_sheet.dart';
import 'package:mockmob/features/onboarding/state/sheet_sync.dart';
import 'package:mockmob/features/referrals/invite_code_row.dart';
import 'package:mockmob/features/referrals/invite_reward.dart';
import 'package:mockmob/features/referrals/referral_copy.dart';
import 'package:mockmob/features/referrals/referral_data.dart';
import 'package:mockmob/features/wallet/data/wallet_data.dart';

import '../../helpers/golden_harness.dart';

const _live = ReferralStatus(live: true, code: 'K7P2M9X', link: 'https://www.mockmob.in/r/K7P2M9X');
const _joined = ReferralStatus(live: true, code: 'K7P2M9X', link: 'https://www.mockmob.in/r/K7P2M9X', invitedState: 'joined');

class FakeClaims implements ReferralClaimService {
  FakeClaims(this.outcome);

  ReferralClaimOutcome outcome;
  int calls = 0;

  @override
  Future<ReferralClaimOutcome> claimPending() async {
    calls++;
    return outcome;
  }
}

const _ok = ReferralClaimOutcome(ok: true, done: true, state: 'joined');
ReferralClaimOutcome _refused(String reason, {bool done = true}) => ReferralClaimOutcome(ok: false, done: done, reason: reason);

void main() {
  late MemoryPrefsStore prefs;
  late FakeClaims claims;

  List<Override> overrides(ReferralStatus status) => [
        referralStatusProvider.overrideWith((ref) async => status),
        referralPrefsProvider.overrideWithValue(prefs),
        referralClaimServiceProvider.overrideWithValue(claims),
      ];

  setUp(() {
    prefs = MemoryPrefsStore();
    claims = FakeClaims(_ok);
  });

  Future<void> typeAndAdd(WidgetTester tester, String text) async {
    await tester.tap(find.text(ReferralCopy.haveCode));
    await tester.pump(const Duration(milliseconds: 300));
    await tester.enterText(find.byType(TextField), text);
    await tester.tap(find.text(ReferralCopy.codeAdd));
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pump(const Duration(milliseconds: 300));
  }

  testWidgets('off: nothing is drawn', (tester) async {
    await pumpMockmob(tester, const InviteCodeRow());
    await tester.pump();
    expect(find.text(ReferralCopy.haveCode), findsNothing);
  });

  testWidgets('already joined with an invite: nothing is drawn', (tester) async {
    await pumpMockmob(tester, const InviteCodeRow(), overrides: overrides(_joined));
    await tester.pump();
    expect(find.text(ReferralCopy.haveCode), findsNothing);
  });

  testWidgets('live: one quiet key, the field opens on a tap', (tester) async {
    await pumpMockmob(tester, const InviteCodeRow(), overrides: overrides(_live));
    await tester.pump();
    expect(find.text(ReferralCopy.haveCode), findsOneWidget);
    expect(find.byType(TextField), findsNothing);
    await tester.tap(find.text(ReferralCopy.haveCode));
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.byType(TextField), findsOneWidget);
    expect(find.text(ReferralCopy.codeAdd), findsOneWidget);
  });

  testWidgets('a good code is kept as a typed code, handed over, and the added line says you both get 100 credits', (tester) async {
    await pumpMockmob(tester, const InviteCodeRow(), overrides: overrides(_live));
    await tester.pump();
    await typeAndAdd(tester, 'k7p 2m9x');
    expect(claims.calls, 1);
    final kept = await PendingInviteStore(prefs).read();
    expect([kept?.code, kept?.source], ['K7P2M9X', 'code']);
    expect(find.text(ReferralCopy.codeAdded(100)), findsOneWidget);
    expect(find.byType(TextField), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('a pasted invite link works', (tester) async {
    await pumpMockmob(tester, const InviteCodeRow(), overrides: overrides(_live));
    await tester.pump();
    await typeAndAdd(tester, 'https://www.mockmob.in/r/K7P2M9X');
    final kept = await PendingInviteStore(prefs).read();
    expect([kept?.code, kept?.source], ['K7P2M9X', 'code']);
    expect(find.text(ReferralCopy.codeAdded(100)), findsOneWidget);
  });

  testWidgets('a code that is not a code is refused on the phone and never sent', (tester) async {
    await pumpMockmob(tester, const InviteCodeRow(), overrides: overrides(_live));
    await tester.pump();
    await typeAndAdd(tester, 'hello');
    expect(find.text(ReferralCopy.codeBad), findsOneWidget);
    expect(claims.calls, 0);
    expect(await PendingInviteStore(prefs).read(), isNull);
  });

  for (final c in <(String, String)>[
    ('unknown_code', ReferralCopy.codeUnknown),
    ('self', ReferralCopy.codeOwn),
    ('already_referred', ReferralCopy.codeUsed),
    ('existing_account', ReferralCopy.codeNotNew),
    ('rate_limited', ReferralCopy.codeBusy),
  ]) {
    testWidgets('the server says ${c.$1}: the line says so and the field stays', (tester) async {
      claims.outcome = _refused(c.$1);
      await pumpMockmob(tester, const InviteCodeRow(), overrides: overrides(_live));
      await tester.pump();
      await typeAndAdd(tester, 'K7P2M9X');
      expect(find.text(c.$2), findsOneWidget);
      expect(find.byType(TextField), findsOneWidget);
      expect(find.text(ReferralCopy.codeAdded(100)), findsNothing);
    });
  }

  testWidgets('the server cannot be reached: the line says to check the connection, and a second try works', (tester) async {
    claims.outcome = ReferralClaimOutcome.unavailable;
    await pumpMockmob(tester, const InviteCodeRow(), overrides: overrides(_live));
    await tester.pump();
    await typeAndAdd(tester, 'K7P2M9X');
    expect(find.text(ReferralCopy.codeOffline), findsOneWidget);
    claims.outcome = _ok;
    await tester.tap(find.text(ReferralCopy.codeAdd));
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text(ReferralCopy.codeAdded(100)), findsOneWidget);
    expect(claims.calls, 2);
  });

  Widget sheet() => SingleChildScrollView(
        child: SheetSavedView(
          phase: SheetSyncPhase.saved,
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
      );

  testWidgets('the after-sign-in sheet draws no row while invites are off', (tester) async {
    await pumpMockmob(tester, sheet());
    await tester.pump();
    expect(find.text(ReferralCopy.haveCode), findsNothing);
    expect(find.text('Start now, about 10 minutes'), findsOneWidget);
  });

  testWidgets('the after-sign-in sheet shows the row above the first move once invites are live', (tester) async {
    await pumpMockmob(tester, sheet(), overrides: overrides(_live));
    await tester.pump();
    expect(find.text(ReferralCopy.haveCode), findsOneWidget);
    expect(tester.getTopLeft(find.text(ReferralCopy.haveCode)).dy, lessThan(tester.getTopLeft(find.text('Start now, about 10 minutes')).dy));
  });

  testWidgets('the Wallet invite section holds the row', (tester) async {
    await pumpMockmob(tester, const SingleChildScrollView(child: WalletInviteSection()), overrides: overrides(_live));
    await tester.pump();
    expect(find.text(ReferralCopy.haveCode), findsOneWidget);
  });

  testWidgets('the Wallet invite section has no row once the student joined with an invite', (tester) async {
    await pumpMockmob(tester, const SingleChildScrollView(child: WalletInviteSection()), overrides: overrides(_joined));
    await tester.pump();
    expect(find.text(ReferralCopy.haveCode), findsNothing);
    expect(find.text(ReferralCopy.invitedJoined(100)), findsOneWidget);
  });

  Widget probe(void Function(bool) seen) => Consumer(builder: (context, ref, _) {
        seen(ref.watch(referralOfferLiveProvider));
        return const SizedBox.shrink();
      });

  testWidgets('the Wallet offer is off while the server says invites are off', (tester) async {
    bool? seen;
    await pumpMockmob(tester, probe((v) => seen = v));
    await tester.pump();
    expect(seen, isFalse);
  });

  testWidgets('the Wallet offer is live when the server says so', (tester) async {
    bool? seen;
    await pumpMockmob(tester, probe((v) => seen = v), overrides: overrides(_live));
    await tester.pump();
    expect(seen, isTrue);
  });

  testWidgets('at 1.3x text on a narrow phone nothing overflows, open with a problem line', (tester) async {
    claims.outcome = _refused('already_referred');
    await pumpMockmob(
      tester,
      const SingleChildScrollView(padding: EdgeInsets.all(20), child: InviteCodeRow()),
      size: const Size(320, 700),
      textScale: 1.3,
      overrides: overrides(_live),
    );
    await tester.pump();
    await typeAndAdd(tester, 'K7P2M9X');
    expect(find.text(ReferralCopy.codeUsed), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
