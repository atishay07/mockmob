import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/analytics/analytics_client.dart';
import 'package:mockmob/core/analytics/analytics_queue_store.dart';
import 'package:mockmob/core/analytics/event_allowlist.dart';
import 'package:mockmob/core/api/api_providers.dart';
import 'package:mockmob/core/models/consent.dart';
import 'package:mockmob/core/repositories/consent_repository.dart';
import 'package:mockmob/core/repositories/local_scope.dart';
import 'package:mockmob/core/storage/app_prefs.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/storage/storage_providers.dart';

import 'support/fakes.dart';

class _User extends Notifier<String?> {
  @override
  String? build() => 'u1';

  void set(String? id) => state = id;
}

final _userProvider = NotifierProvider<_User, String?>(_User.new);

Map<String, dynamic> consent({String band = 'adult', bool allowed = true, int? deleted}) => {
      'ageBand': band,
      'analyticsAllowed': allowed,
      'policyVersion': '2026-10-12',
      'decidedAt': '2026-10-12T10:00:00.000Z',
      'withdrawnAt': allowed ? null : '2026-10-12T11:00:00.000Z',
      'deletedEvents': ?deleted,
    };

void main() {
  late FakeHttpAdapter http;
  late MemoryAnalyticsQueueStore store;
  late MemoryPrefsStore prefsBacking;
  late ProviderContainer container;

  setUp(() {
    http = FakeHttpAdapter();
    store = MemoryAnalyticsQueueStore();
    prefsBacking = MemoryPrefsStore();
    container = ProviderContainer(overrides: [
      userIdProvider.overrideWith((ref) => ref.watch(_userProvider)),
      appPrefsProvider.overrideWithValue(AppPrefs(prefsBacking)),
      apiClientProvider.overrideWithValue(newApiClient(http)),
      analyticsQueueStoreProvider.overrideWithValue(store),
      appVersionProvider.overrideWith((ref) async => '1.0.0'),
    ]);
  });

  tearDown(() => container.dispose());

  ConsentRepository repo() => container.read(consentRepositoryProvider.notifier);
  AnalyticsClient analytics() => container.read(analyticsClientProvider);

  /// The repository loads by itself when first read; wait for that load to finish.
  Future<void> loadConsent(FakeReply reply) async {
    http.replies.add(reply);
    container.read(analyticsClientProvider); // starts the listeners
    container.read(consentRepositoryProvider);
    for (var i = 0; i < 200; i++) {
      await Future<void>.delayed(Duration.zero);
      final status = container.read(consentRepositoryProvider).status;
      if (status == ConsentStatus.loaded || status == ConsentStatus.failed) return;
    }
    fail('consent did not finish loading');
  }

  Future<void> signInAdultWithUsageOn() => loadConsent(FakeReply(200, consent()));

  test('the consent read failing means analytics is off: nothing is queued', () async {
    // A GET is tried three times before giving up.
    http.replies
      ..add(const FakeReply(503, {'error': 'unavailable'}))
      ..add(const FakeReply(503, {'error': 'unavailable'}));
    await loadConsent(const FakeReply(503, {'error': 'unavailable'}));
    expect(container.read(consentRepositoryProvider).status, ConsentStatus.failed);
    expect(await analytics().track(AnalyticsEvents.appOpened), isFalse);
    expect(store.events, isEmpty);
  });

  test('before the consent has loaded nothing is queued', () async {
    expect(await analytics().track(AnalyticsEvents.appOpened), isFalse);
    expect(store.events, isEmpty);
  });

  test('a minor never collects, even if the flag says allowed', () async {
    await loadConsent(FakeReply(200, consent(band: 'minor')));
    expect(await analytics().track(AnalyticsEvents.appOpened), isFalse);
    expect(store.events, isEmpty);
  });

  test('"Rather not say" with usage data allowed collects, as 18 or older does (D183)', () async {
    await loadConsent(FakeReply(200, consent(band: 'unknown')));
    expect(container.read(consentRepositoryProvider).consent.answered, isTrue);
    expect(await analytics().track(AnalyticsEvents.appOpened), isTrue);
    expect(store.events.single.userId, 'u1');
  });

  test('an age never answered collects nothing: it was never allowed', () async {
    await loadConsent(const FakeReply(200, {'ageBand': 'unknown', 'analyticsAllowed': false, 'decidedAt': null, 'withdrawnAt': null}));
    expect(container.read(consentRepositoryProvider).consent.answered, isFalse);
    expect(await analytics().track(AnalyticsEvents.appOpened), isFalse);
  });

  test('an allowed adult queues events tagged with their id and a flush sends them', () async {
    await signInAdultWithUsageOn();
    expect(await analytics().track(AnalyticsEvents.appOpened), isTrue);
    expect(store.events.single.userId, 'u1');
    http.replies.add(const FakeReply(202, {'accepted': 1, 'dropped': 0, 'collecting': true}));
    await analytics().flush();
    final sent = http.requests.last;
    expect(sent.path, '/api/events');
    expect(sent.headers['Authorization'], startsWith('Bearer '));
    expect(store.events, isEmpty);
  });

  test('withdrawal clears the queue and closes the gate before the network call returns', () async {
    await signInAdultWithUsageOn();
    await analytics().track(AnalyticsEvents.appOpened);
    await analytics().track(AnalyticsEvents.resultOpened);
    expect(store.events.length, 2);

    http.hold = Completer<void>();
    http.replies.add(FakeReply(200, consent(allowed: false, deleted: 2)));
    final pending = repo().setAnalyticsAllowed(false);
    for (var i = 0; i < 50 && http.requests.last.method != 'PUT'; i++) {
      await Future<void>.delayed(Duration.zero);
    }

    // The PUT has not returned. Collection is already off and the queue is gone.
    expect(http.requests.last.method, 'PUT');
    expect(container.read(consentRepositoryProvider).analyticsActive, isFalse);
    expect(store.events, isEmpty);
    expect(await analytics().track(AnalyticsEvents.appOpened), isFalse);

    http.hold!.complete();
    final result = await pending;
    expect(result.deletedEvents, 2);
    expect(http.requests.last.body, {'ageBand': 'adult', 'analyticsAllowed': false});
    expect(container.read(consentRepositoryProvider).analyticsActive, isFalse);
    expect(await analytics().track(AnalyticsEvents.appOpened), isFalse);
  });

  test('a withdrawal that fails stays off, is remembered, and is re-sent on the next load', () async {
    await signInAdultWithUsageOn();
    http.replies.add(const FakeReply(503, {'error': 'Your choice was saved, but deleting earlier data failed.'}));
    await expectLater(repo().setAnalyticsAllowed(false), throwsA(isA<Object>()));
    expect(container.read(consentRepositoryProvider).analyticsActive, isFalse);
    expect(await AppPrefs(prefsBacking).pendingWithdrawalFor(), 'u1');
    expect(await analytics().track(AnalyticsEvents.appOpened), isFalse);

    // Next load: the server still says allowed, but the pending withdrawal is sent first.
    http.replies
      ..add(FakeReply(200, consent()))
      ..add(FakeReply(200, consent(allowed: false, deleted: 3)));
    await repo().load();
    expect(http.requests.where((r) => r.method == 'PUT').length, 2);
    expect(container.read(consentRepositoryProvider).analyticsActive, isFalse);
    expect(await AppPrefs(prefsBacking).pendingWithdrawalFor(), isNull);
  });

  test('turning usage data on shows on only after the server acknowledges', () async {
    await loadConsent(FakeReply(200, consent(allowed: false)));
    expect(container.read(consentRepositoryProvider).consent.analyticsAllowed, isFalse);

    http.hold = Completer<void>();
    http.replies.add(FakeReply(200, consent()));
    final pending = repo().setAnalyticsAllowed(true);
    await Future<void>.delayed(Duration.zero);
    expect(container.read(consentRepositoryProvider).consent.analyticsAllowed, isFalse);
    expect(await analytics().track(AnalyticsEvents.appOpened), isFalse);

    http.hold!.complete();
    await pending;
    expect(container.read(consentRepositoryProvider).analyticsActive, isTrue);
    expect(http.requests.last.body, {'ageBand': 'adult', 'analyticsAllowed': true});
    expect(await analytics().track(AnalyticsEvents.appOpened), isTrue);
  });

  test('the server saying collecting false stops tracking for that account', () async {
    await signInAdultWithUsageOn();
    await analytics().track(AnalyticsEvents.appOpened);
    http.replies.add(const FakeReply(202, {'accepted': 0, 'dropped': 1, 'collecting': false}));
    await analytics().flush();
    expect(store.events, isEmpty);
    expect(await AppPrefs(prefsBacking).analyticsStoppedFor(), 'u1');
    expect(await analytics().track(AnalyticsEvents.appOpened), isFalse);
  });

  test('sign-out clears the queue', () async {
    await signInAdultWithUsageOn();
    await analytics().track(AnalyticsEvents.appOpened);
    container.read(_userProvider.notifier).set(null);
    // Signed out: the next use drops the queue and refuses to queue anything new.
    expect(await analytics().track(AnalyticsEvents.appOpened), isFalse);
    expect(store.events, isEmpty);
  });

  test('an account switch clears the queue, resets consent and never posts the old events', () async {
    await signInAdultWithUsageOn();
    await analytics().track(AnalyticsEvents.appOpened);
    expect(store.events.single.userId, 'u1');

    http.replies.add(FakeReply(200, consent(band: 'minor', allowed: false)));
    container.read(_userProvider.notifier).set('u2');
    for (var i = 0; i < 20; i++) {
      await Future<void>.delayed(Duration.zero);
    }

    // The first use under the new account drops the old queue; nothing is posted under u2.
    await analytics().flush();
    expect(store.events, isEmpty);
    expect(http.requests.where((r) => r.path == '/api/events'), isEmpty);
    // The new account is a minor: nothing queues.
    expect(await analytics().track(AnalyticsEvents.appOpened), isFalse);
    expect(store.events, isEmpty);
  });

  test('"Rather not say" turns usage data on without becoming 18 or older: the band stays unknown (D183)', () async {
    await loadConsent(FakeReply(200, consent(band: 'unknown', allowed: false)));
    http.replies.add(FakeReply(200, consent(band: 'unknown')));
    await repo().setAnalyticsAllowed(true);
    expect(http.requests.last.body, {'ageBand': 'unknown', 'analyticsAllowed': true});
    expect(container.read(consentRepositoryProvider).analyticsActive, isTrue);
  });

  test('changing the age answer between 18 or older and "Rather not say" keeps usage data on (D183)', () async {
    await signInAdultWithUsageOn();
    http.replies.add(FakeReply(200, consent(band: 'unknown')));
    await repo().setAgeBand(AgeBand.unknown);
    expect(http.requests.last.body, {'ageBand': 'unknown', 'analyticsAllowed': true});
    http.replies.add(FakeReply(200, consent()));
    await repo().setAgeBand(AgeBand.adult);
    expect(http.requests.last.body, {'ageBand': 'adult', 'analyticsAllowed': true});
  });

  test('answering "Rather not say" for the first time waits for the switch: it writes allowed false first', () async {
    await loadConsent(const FakeReply(200, {'ageBand': 'unknown', 'analyticsAllowed': false, 'decidedAt': null, 'withdrawnAt': null}));
    http.replies.add(FakeReply(200, consent(band: 'unknown', allowed: false)));
    await repo().setAgeBand(AgeBand.unknown);
    expect(http.requests.last.body, {'ageBand': 'unknown', 'analyticsAllowed': false});
  });

  test('an under-18 record that is turned on becomes 18 or older, as before', () async {
    await loadConsent(FakeReply(200, consent(band: 'minor', allowed: false)));
    http.replies.add(FakeReply(200, consent()));
    await repo().setAnalyticsAllowed(true);
    expect(http.requests.last.body, {'ageBand': 'adult', 'analyticsAllowed': true});
  });

  test('changing the age answer to a minor withdraws usage data first', () async {
    await signInAdultWithUsageOn();
    await analytics().track(AnalyticsEvents.appOpened);
    http.replies.add(FakeReply(200, consent(band: 'minor', allowed: false, deleted: 1)));
    await repo().setAgeBand(AgeBand.minor);
    expect(store.events, isEmpty);
    expect(http.requests.last.body, {'ageBand': 'minor', 'analyticsAllowed': false});
  });
}
