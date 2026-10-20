// The invite lines on the Mob invite and in the Wallet (owner D165): nothing at all until the server says invites are
// live; then "you both get 100", the status in counts only and the link to share.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/referrals/invite_reward.dart';
import 'package:mockmob/features/referrals/referral_copy.dart';
import 'package:mockmob/features/referrals/referral_data.dart';

import '../../helpers/golden_harness.dart';

const _live = ReferralStatus(
  live: true,
  code: 'K7P2M9X',
  link: 'https://www.mockmob.in/r/K7P2M9X',
  joined: 2,
  practised: 1,
  rewarded: 1,
  earned: 100,
);

void main() {
  testWidgets('off: the Mob line and the Wallet section draw nothing', (tester) async {
    await pumpMockmob(tester, const SingleChildScrollView(child: Column(children: [InviteRewardLine(), WalletInviteSection()])));
    await tester.pump();
    expect(find.textContaining('100 credits'), findsNothing);
    expect(find.text(ReferralCopy.share), findsNothing);
  });

  testWidgets('live: the Mob invite says the link is also a friend invite', (tester) async {
    await pumpMockmob(tester, const InviteRewardLine(), overrides: [referralStatusProvider.overrideWith((ref) async => _live)]);
    await tester.pump();
    expect(find.text(ReferralCopy.mobLine(100)), findsOneWidget);
  });

  testWidgets('live: the Wallet shows the offer, the owner’s status line, what was earned and the keys', (tester) async {
    await pumpMockmob(
      tester,
      const SingleChildScrollView(child: WalletInviteSection()),
      overrides: [referralStatusProvider.overrideWith((ref) async => _live)],
    );
    await tester.pump();
    expect(find.text(ReferralCopy.title(100)), findsOneWidget);
    expect(find.text(ReferralCopy.how(100)), findsOneWidget);
    expect(find.text('2 friends joined, 1 practised: +100 each.'), findsOneWidget);
    expect(find.text(ReferralCopy.earned(100)), findsOneWidget);
    expect(find.text(ReferralCopy.share), findsOneWidget);
    expect(find.text(ReferralCopy.copy), findsOneWidget);
    expect(find.text(ReferralCopy.cap(10)), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('live at 1.3x text on a narrow phone: nothing overflows', (tester) async {
    await pumpMockmob(
      tester,
      const SingleChildScrollView(child: WalletInviteSection()),
      size: const Size(320, 700),
      textScale: 1.3,
      overrides: [referralStatusProvider.overrideWith((ref) async => const ReferralStatus(live: true, code: 'K7P2M9X', link: 'https://www.mockmob.in/r/K7P2M9X', joined: 11, practised: 11, rewarded: 10, notCounted: 1, earned: 1000, capReached: true))],
    );
    await tester.pump();
    expect(find.text(ReferralCopy.capReached(10, 100)), findsOneWidget);
    expect(find.text(ReferralCopy.notCounted(1)), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
