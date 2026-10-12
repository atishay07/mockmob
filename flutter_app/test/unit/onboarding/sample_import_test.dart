import 'dart:async';
import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/features/onboarding/state/onboarding_providers.dart';
import 'package:mockmob/features/onboarding/state/sample_import.dart';

import '../core_data/support/fakes.dart';
import 'support.dart';

const _saved = FakeReply(200, {'status': 'saved', 'savedAt': '2026-10-12T17:00:00.000Z', 'correct': 5, 'total': 5});
const _hasSubject = AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1', subjects: ['accountancy']);

void main() {
  late OnboardingHarness h;
  late ProviderContainer container;

  Future<void> start({AuthSnapshot auth = signedInAuth, bool complete = true, bool imported = false}) async {
    h = OnboardingHarness(guest: guestWith(keys: complete ? rightKeys : ['B', 'B'], imported: imported));
    container = ProviderContainer(overrides: h.overrides(auth: auth));
    addTearDown(container.dispose);
    await container.read(guestSampleProvider.future);
  }

  Future<void> settle() async {
    for (var i = 0; i < 30; i++) {
      await Future<void>.delayed(Duration.zero);
    }
  }

  List<RecordedRequest> posts() => h.http.requests.where((r) => r.path == '/api/me/sample-import').toList();

  test('after sign-in it sends the five answers once and only then says saved', () async {
    await start(auth: _hasSubject);
    final gate = h.http.hold = Completer<void>();
    h.http.replies.add(_saved);

    container.read(sampleImportProvider);
    await settle();
    // Sent, not yet acknowledged: the line says Saving and nothing claims saved.
    expect(container.read(sampleImportProvider).phase, SampleImportPhase.pending);
    expect((await h.store.load()).imported, isFalse);

    gate.complete();
    await settle();
    expect(container.read(sampleImportProvider).phase, SampleImportPhase.accepted);
    expect((await h.store.load()).imported, isTrue);

    final body = jsonDecode(jsonEncode(posts().single.body)) as Map<String, dynamic>;
    expect(body['importKey'], 'import-key-0000000001');
    expect(body['sampleVersion'], 'landing-v1');
    expect(body['subject'], 'accountancy');
    expect(body['answers'], [
      {'sampleQuestionId': 'q1', 'optionKey': 'B'},
      {'sampleQuestionId': 'q2', 'optionKey': 'B'},
      {'sampleQuestionId': 'q3', 'optionKey': 'C'},
      {'sampleQuestionId': 'q4', 'optionKey': 'C'},
      {'sampleQuestionId': 'q5', 'optionKey': 'B'},
    ]);
  });

  test('an already imported sample is never sent again', () async {
    await start(imported: true, auth: _hasSubject);
    container.read(sampleImportProvider);
    await settle();
    expect(posts(), isEmpty);
    expect(container.read(sampleImportProvider).phase, SampleImportPhase.idle);
  });

  test('a signed out guest sends nothing', () async {
    await start(auth: AuthSnapshot.signedOut);
    container.read(sampleImportProvider);
    await settle();
    expect(h.http.requests, isEmpty);
  });

  test('an unfinished sample is not sent', () async {
    await start(complete: false, auth: _hasSubject);
    container.read(sampleImportProvider);
    await settle();
    expect(posts(), isEmpty);
  });

  test('a failure keeps the answers on the phone and Try again sends the same key', () async {
    await start(auth: _hasSubject);
    h.http.replies
      ..add(const FakeReply(503, {'error': 'unavailable'}))
      ..add(_saved);

    container.read(sampleImportProvider);
    await settle();
    expect(container.read(sampleImportProvider).phase, SampleImportPhase.failed);
    expect((await h.store.load()).imported, isFalse);
    expect((await h.store.load()).answers, hasLength(5));

    await container.read(sampleImportProvider.notifier).run();
    expect(container.read(sampleImportProvider).phase, SampleImportPhase.accepted);
    final keys = [for (final r in posts()) (r.body as Map)['importKey']];
    expect(keys.toSet(), {'import-key-0000000001'});
  });

  test('offline is a failure, not "saved"', () async {
    await start(auth: _hasSubject);
    h.http.replies.add(const FakeReply.network());
    container.read(sampleImportProvider);
    await settle();
    expect(container.read(sampleImportProvider).phase, SampleImportPhase.failed);
  });

  test('a taken import key is replaced once', () async {
    await start(auth: _hasSubject);
    h.http.replies
      ..add(const FakeReply(409, {'error': 'import_key_taken'}))
      ..add(_saved);
    container.read(sampleImportProvider);
    await settle();
    expect(container.read(sampleImportProvider).phase, SampleImportPhase.accepted);
    final keys = [for (final r in posts()) (r.body as Map)['importKey']];
    expect(keys, hasLength(2));
    expect(keys.first, isNot(keys.last));
  });

  test('a missing route leaves the sample on the phone with no saved line', () async {
    await start(auth: _hasSubject);
    h.http.replies.add(const FakeReply(404, {'error': 'not_found'}));
    container.read(sampleImportProvider);
    await settle();
    final state = container.read(sampleImportProvider);
    expect(state.phase, SampleImportPhase.unavailable);
    expect(state.showsStatus, isFalse);
    expect((await h.store.load()).imported, isFalse);
  });

  test('the chosen subject is written with subjects only when the profile has none', () async {
    await start();
    h.http.handler = (options) => options.path.startsWith('/api/users/') ? const FakeReply(200, {}) : _saved;
    container.read(sampleImportProvider);
    await settle();
    final patch = h.http.requests.firstWhere((r) => r.method == 'PATCH');
    expect(patch.path, '/api/users/u1');
    expect((patch.body as Map).keys, ['subjects']);
    expect((patch.body as Map)['subjects'], ['accountancy']);
  });

  test('a profile that already has subjects is left alone', () async {
    await start(auth: const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1', subjects: ['english']));
    h.http.replies.add(_saved);
    container.read(sampleImportProvider);
    await settle();
    expect(h.http.requests.where((r) => r.method == 'PATCH'), isEmpty);
  });
}
