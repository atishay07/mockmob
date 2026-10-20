// The invite read (D185): a read that fails or times out is tried once more after 2 seconds; a second failure is an error
// (never "invites are off"), so the Wallet can say so quietly and offer a retry.

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_providers.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/referrals/referral_data.dart';

import '../../helpers/referral_fixtures.dart';
import '../core_data/support/fakes.dart';

void main() {
  late FakeHttpAdapter http;
  late ProviderContainer c;

  ProviderContainer start({Duration delay = Duration.zero, bool signedIn = true}) {
    http = FakeHttpAdapter();
    c = ProviderContainer(retry: (_, _) => null, overrides: [
      apiClientProvider.overrideWithValue(newApiClient(http)),
      referralPrefsProvider.overrideWithValue(MemoryPrefsStore()),
      referralRetryDelayProvider.overrideWithValue(delay),
      authSnapshotProvider.overrideWithBuild(
        (ref, n) => signedIn ? const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1') : AuthSnapshot.signedOut,
      ),
    ]);
    addTearDown(c.dispose);
    return c;
  }

  const live = FakeReply(200, freshAccountInvitesJson);

  test('a fresh account with live invites reads as live, with nothing joined and no invite used', () async {
    start();
    http.replies.add(live);
    final s = await c.read(referralStatusProvider.future);
    expect([s.live, s.code, s.joined, s.invitedState], [true, 'K7P2M9X', 0, null]);
  });

  test('a first read that fails is tried once more and the second answer is used', () async {
    start();
    http.replies
      ..add(const FakeReply.network())
      ..add(live);
    final s = await c.read(referralStatusProvider.future);
    expect(s.live, isTrue);
    expect(http.requests.where((r) => r.path == '/api/referrals'), hasLength(2));
  });

  test('a server error then a good answer: used', () async {
    start();
    http.replies
      ..add(const FakeReply(500, {'ok': false}))
      ..add(live);
    expect((await c.read(referralStatusProvider.future)).live, isTrue);
  });

  test('two failures end in an error, never in "off"; reading again asks the server again', () async {
    start();
    http.replies
      ..add(const FakeReply.network())
      ..add(const FakeReply.network());
    await expectLater(c.read(referralStatusProvider.future), throwsA(anything));
    expect(http.requests, hasLength(2), reason: 'one try and one retry, no more');
    http.replies.add(live);
    c.invalidate(referralStatusProvider);
    expect((await c.read(referralStatusProvider.future)).live, isTrue);
  });

  test('an answer that is not ok is a failed read, not "off"', () async {
    start();
    http.replies
      ..add(const FakeReply(200, {'ok': false}))
      ..add(const FakeReply(200, {'ok': false}));
    await expectLater(c.read(referralStatusProvider.future), throwsA(anything));
  });

  test('the server saying invites are off is an answer: off, with no retry', () async {
    start();
    http.replies.add(const FakeReply(200, {'ok': true, 'live': false}));
    final s = await c.read(referralStatusProvider.future);
    expect(s.live, isFalse);
    expect(http.requests, hasLength(1));
  });

  test('the retry waits 2 seconds by default and one read never waits long', () {
    final plain = ProviderContainer();
    addTearDown(plain.dispose);
    expect(plain.read(referralRetryDelayProvider), const Duration(seconds: 2));
    expect(referralReadTimeout, lessThanOrEqualTo(const Duration(seconds: 10)));
  });

  test('signed out: off, nothing sent', () async {
    start(signedIn: false);
    expect((await c.read(referralStatusProvider.future)).live, isFalse);
    expect(http.requests, isEmpty);
  });
}
