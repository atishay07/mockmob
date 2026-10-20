// Friend invites that reach a friend who installs from Google Play (owner D165 + D182): the install referrer is read once
// on a first launch (Android only), `invite=<code>` is kept as the pending invite (source 'link'), a typed code is kept
// (source 'code'), and the claim path hands it to the server once signed in and says plainly what the server answered.

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_providers.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/referrals/install_referrer.dart';
import 'package:mockmob/features/referrals/referral_copy.dart';
import 'package:mockmob/features/referrals/referral_data.dart';

import '../core_data/support/fakes.dart';

class _Source implements InstallReferrerSource {
  _Source(this.read_);

  final Future<InstallReferrerRead> Function() read_;
  int calls = 0;

  @override
  Future<InstallReferrerRead> read() {
    calls++;
    return read_();
  }
}

void main() {
  final now = DateTime(2026, 10, 20, 12);

  group('the Play install referrer', () {
    test('reads invite=<code>, alone or among other parameters, as a friend link', () {
      final a = inviteFromInstallReferrer('invite=K7P2M9X', now: now)!;
      expect([a.code, a.source, a.explicit], ['K7P2M9X', 'link', false]);
      expect(inviteFromInstallReferrer('utm_source=web&invite=k7p-2m9x&utm_medium=invite', now: now)?.code, 'K7P2M9X');
      expect(inviteFromInstallReferrer('INVITE=K7P2M9X', now: now)?.code, 'K7P2M9X');
      expect(inviteFromInstallReferrer('invite%3DK7P2M9X', now: now)?.code, 'K7P2M9X', reason: 'encoded twice');
    });

    test('a Mob invite code is a Mob invite, as for a link opened in the app', () {
      final m = inviteFromInstallReferrer('invite=ABCDEF', now: now)!;
      expect([m.code, m.source, m.explicit], ['ABCDEF', 'mob_invite', true]);
    });

    test('Play\'s own organic referrer, junk and codes of the wrong shape carry no invite', () {
      expect(inviteFromInstallReferrer('utm_source=google-play&utm_medium=organic', now: now), isNull);
      expect(inviteFromInstallReferrer(null, now: now), isNull);
      expect(inviteFromInstallReferrer('', now: now), isNull);
      expect(inviteFromInstallReferrer('invite=', now: now), isNull);
      expect(inviteFromInstallReferrer('invite=SHORT', now: now), isNull);
      expect(inviteFromInstallReferrer('invite=K7P2M9X!', now: now), isNull);
      expect(inviteFromInstallReferrer('ref=K7P2M9X', now: now), isNull, reason: 'only invite= is an invite');
      expect(inviteFromInstallReferrer('%ZZ', now: now), isNull);
      expect(inviteFromInstallReferrer('invite=${'A' * 600}', now: now), isNull);
    });

    test('the link\'s age comes from the tap time: older than 30 days is dropped, a future time counts as now', () {
      final fresh = inviteFromInstallReferrer('invite=K7P2M9X', now: now, clickedAt: now.subtract(const Duration(days: 2)))!;
      expect(fresh.at, now.subtract(const Duration(days: 2)));
      expect(inviteFromInstallReferrer('invite=K7P2M9X', now: now, clickedAt: now.subtract(const Duration(days: 31))), isNull);
      expect(inviteFromInstallReferrer('invite=K7P2M9X', now: now, clickedAt: now.add(const Duration(days: 3)))!.at, now);
    });

    test('a first launch on Android keeps the invite once and never asks Play again', () async {
      final prefs = MemoryPrefsStore();
      final store = PendingInviteStore(prefs, now: () => now);
      final source = _Source(() async => const InstallReferrerRead(referrer: 'invite=K7P2M9X'));
      InstallReferrerCapture capture() => InstallReferrerCapture(source: source, store: store, prefs: prefs, now: () => now, isAndroid: true);
      expect((await capture().run())?.code, 'K7P2M9X');
      final kept = (await store.read())!;
      expect([kept.code, kept.source], ['K7P2M9X', 'link']);
      expect(await capture().run(), isNull, reason: 'read once per install');
      expect(source.calls, 1);
    });

    test('not Android: the plugin is never touched', () async {
      final prefs = MemoryPrefsStore();
      final source = _Source(() async => const InstallReferrerRead(referrer: 'invite=K7P2M9X'));
      final capture = InstallReferrerCapture(source: source, store: PendingInviteStore(prefs), prefs: prefs, isAndroid: false);
      expect(await capture.run(), isNull);
      expect(source.calls, 0);
      expect(prefs.values, isEmpty);
    });

    test('an install with no invite is marked read, and keeps nothing', () async {
      final prefs = MemoryPrefsStore();
      final store = PendingInviteStore(prefs, now: () => now);
      final source = _Source(() async => const InstallReferrerRead(referrer: 'utm_source=google-play&utm_medium=organic'));
      final capture = InstallReferrerCapture(source: source, store: store, prefs: prefs, now: () => now, isAndroid: true);
      expect(await capture.run(), isNull);
      expect(await store.read(), isNull);
      expect(prefs.values[InstallReferrerCapture.doneKey], isTrue);
    });

    test('Play that cannot answer is asked again on the next launches, three times at most, and never throws', () async {
      final prefs = MemoryPrefsStore();
      final store = PendingInviteStore(prefs, now: () => now);
      final source = _Source(() async => throw StateError('service unavailable'));
      InstallReferrerCapture capture() => InstallReferrerCapture(source: source, store: store, prefs: prefs, now: () => now, isAndroid: true);
      for (var i = 0; i < 5; i++) {
        expect(await capture().run(), isNull);
      }
      expect(source.calls, InstallReferrerCapture.maxTries);
      expect(await store.read(), isNull);
    });

    test('a referrer never replaces the invite already kept (the first friend keeps it), but a typed code does', () async {
      final prefs = MemoryPrefsStore();
      final store = PendingInviteStore(prefs, now: () => now);
      await store.captureUri(Uri.parse('https://www.mockmob.in/r/Q2W3E4R'));
      final source = _Source(() async => const InstallReferrerRead(referrer: 'invite=K7P2M9X'));
      await InstallReferrerCapture(source: source, store: store, prefs: prefs, now: () => now, isAndroid: true).run();
      expect((await store.read())!.code, 'Q2W3E4R');
      final typed = await store.captureCode('k7p 2m9x');
      expect([typed!.code, typed.source], ['K7P2M9X', 'code']);
      expect((await store.read())!.source, 'code');
    });
  });

  group('a typed code', () {
    test('is read the way the server reads it; a pasted invite link works; nonsense is not kept', () async {
      final store = PendingInviteStore(MemoryPrefsStore(), now: () => now);
      expect(await store.captureCode('hello'), isNull);
      expect(await store.captureCode('   '), isNull);
      expect(await store.captureCode(null), isNull);
      expect(await store.read(), isNull);
      expect(inviteCodeFromInput('https://www.mockmob.in/r/k7p2m9x'), 'K7P2M9X');
      expect(inviteCodeFromInput('https://evil.example/r/K7P2M9X'), isNull);
      expect(inviteCodeFromInput(' o1lIabc '), '0111ABC');
      final kept = await store.captureCode('K7P-2M9X');
      expect([kept!.code, kept.source, kept.explicit], ['K7P2M9X', 'code', true]);
    });
  });

  group('the claim path', () {
    late FakeHttpAdapter http;
    late MemoryPrefsStore prefs;
    late ProviderContainer container;

    ProviderContainer start({bool signedIn = true}) {
      http = FakeHttpAdapter();
      prefs = MemoryPrefsStore();
      container = ProviderContainer(retry: (_, _) => null, overrides: [
        apiClientProvider.overrideWithValue(newApiClient(http)),
        referralPrefsProvider.overrideWithValue(prefs),
        authSnapshotProvider.overrideWithBuild(
          (ref, n) => signedIn ? const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1') : AuthSnapshot.signedOut,
        ),
      ]);
      addTearDown(container.dispose);
      return container;
    }

    Map<String, dynamic> sent() => Map<String, dynamic>.from(http.requests.single.body! as Map);

    test('signed in: the kept link is handed over with its source, age and the install id, then forgotten when settled', () async {
      final c = start();
      await c.read(pendingInviteStoreProvider).capture(PendingInvite(code: 'K7P2M9X', source: 'link', at: DateTime.now().subtract(const Duration(seconds: 90))));
      http.replies.add(const FakeReply(200, {'ok': true, 'state': 'joined', 'reason': null, 'done': true}));
      final out = await c.read(referralClaimServiceProvider).claimPending();
      expect([out.ok, out.done, out.reason], [true, true, null]);
      expect(http.requests.single.path, '/api/referrals/claim');
      final body = sent();
      expect([body['code'], body['source']], ['K7P2M9X', 'link']);
      expect(body['linkAgeSeconds'], inInclusiveRange(90, 100));
      expect(body['device'], matches(RegExp(r'^[0-9a-f]{32}$')));
      expect(await c.read(pendingInviteStoreProvider).read(), isNull, reason: 'forgotten once the server settled it');
    });

    test('nothing kept: nothing is sent', () async {
      final c = start();
      final out = await c.read(referralClaimServiceProvider).claimPending();
      expect([out.ok, out.done, out.reason], [false, true, 'no_invite']);
      expect(http.requests, isEmpty);
    });

    test('signed out: nothing is sent and the invite stays for sign-in', () async {
      final c = start(signedIn: false);
      await c.read(pendingInviteStoreProvider).captureCode('K7P2M9X');
      final out = await c.read(referralClaimServiceProvider).claimPending();
      expect(out.done, isFalse);
      expect(http.requests, isEmpty);
      expect(await c.read(pendingInviteStoreProvider).read(), isNotNull);
    });

    test('a refusal that settles the invite forgets it and says why; a failure to reach the server keeps it', () async {
      final c = start();
      final store = c.read(pendingInviteStoreProvider);
      await store.captureCode('K7P2M9X');
      http.replies.add(const FakeReply(200, {'ok': false, 'state': null, 'reason': 'unknown_code', 'done': true}));
      var out = await c.read(referralClaimServiceProvider).claimPending();
      expect([out.ok, out.done, out.reason], [false, true, 'unknown_code']);
      expect(await store.read(), isNull);

      await store.captureCode('K7P2M9X');
      http.replies.add(const FakeReply.network());
      out = await c.read(referralClaimServiceProvider).claimPending();
      expect([out.ok, out.done, out.reason], [false, false, 'unavailable']);
      expect((await store.read())!.code, 'K7P2M9X', reason: 'kept for the next try');

      http.replies.add(const FakeReply(200, {'ok': false, 'state': null, 'reason': 'unavailable', 'done': false}));
      out = await c.read(referralClaimServiceProvider).claimPending();
      expect([out.done, out.reason], [false, 'unavailable']);
      expect(await store.read(), isNotNull);
    });

    test('two callers at once make one request', () async {
      final c = start();
      await c.read(pendingInviteStoreProvider).captureCode('K7P2M9X');
      http.replies.add(const FakeReply(200, {'ok': true, 'state': 'joined', 'done': true}));
      final service = c.read(referralClaimServiceProvider);
      final both = await Future.wait([service.claimPending(), service.claimPending()]);
      expect(both.map((o) => o.ok), [true, true]);
      expect(http.requests, hasLength(1));
    });

    test('the claimer hands a kept invite over as soon as a student is signed in', () async {
      final c = start();
      await c.read(pendingInviteStoreProvider).captureCode('K7P2M9X');
      http.replies.add(const FakeReply(200, {'ok': true, 'state': 'joined', 'done': true}));
      c.read(referralClaimerProvider);
      await pumpEventQueue();
      expect(http.requests.where((r) => r.path == '/api/referrals/claim'), hasLength(1));
      expect(await c.read(pendingInviteStoreProvider).read(), isNull);
    });

    test('every refusal has a plain line that says what to do, and none is shouted', () {
      final reasons = ['bad_code', 'no_invite', 'unknown_code', 'self', 'already_referred', 'existing_account', 'user_not_found', 'rate_limited', 'off', 'unavailable', null];
      final lines = {for (final r in reasons) ReferralCopy.codeProblem(r)};
      expect(ReferralCopy.codeProblem('unknown_code'), isNot(ReferralCopy.codeProblem('self')));
      expect(ReferralCopy.codeProblem('self'), isNot(ReferralCopy.codeProblem('already_referred')));
      expect(ReferralCopy.codeProblem('mystery'), ReferralCopy.codeOffline);
      for (final w in [...lines, ReferralCopy.codeAdded(100), ReferralCopy.haveCode, ReferralCopy.codeLabel, ReferralCopy.codeAdd]) {
        expect(w, isNot(contains('!')), reason: w);
        expect(w, isNot(contains('—')), reason: w);
        expect(w, isNot(contains('·')), reason: w);
      }
      expect(ReferralCopy.codeAdded(100), contains('finish one practice'));
    });

    test('D182: every line says one practice, never a first practice', () {
      final all = [
        ReferralCopy.how(100), ReferralCopy.mobLine(100), ReferralCopy.shareText(100, 'https://www.mockmob.in/r/K7P2M9X'),
        ReferralCopy.invitedJoined(100), ReferralCopy.invitedRewarded(100), ReferralCopy.codeAdded(100),
      ];
      for (final w in all) {
        expect(w, isNot(contains('first practice')), reason: w);
        expect(w, contains('one practice'), reason: w);
      }
    });
  });
}
