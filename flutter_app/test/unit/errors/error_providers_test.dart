import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_providers.dart';
import 'package:mockmob/core/connectivity/connectivity.dart' show networkRestoredProvider;
import 'package:mockmob/core/errors/error_buffer.dart';
import 'package:mockmob/core/errors/error_report.dart';
import 'package:mockmob/core/errors/error_reporter.dart';
import 'package:mockmob/core/errors/error_reporting.dart';
import 'package:mockmob/core/repositories/consent_repository.dart';
import 'package:mockmob/core/repositories/local_scope.dart';
import 'package:mockmob/core/storage/app_prefs.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/storage/storage_providers.dart';

import '../core_data/support/fakes.dart';

class _User extends Notifier<String?> {
  @override
  String? build() => 'u1';

  void set(String? id) => state = id;
}

final _userProvider = NotifierProvider<_User, String?>(_User.new);

Map<String, dynamic> consent({String band = 'adult', bool allowed = true}) => {
      'ageBand': band,
      'analyticsAllowed': allowed,
      'policyVersion': '2026-10-12',
      'decidedAt': '2026-10-12T10:00:00.000Z',
      'withdrawnAt': allowed ? null : '2026-10-12T11:00:00.000Z',
    };

void main() {
  late FakeHttpAdapter http;
  late ErrorBuffer buffer;
  late ErrorReporter reporter;
  late ProviderContainer container;
  late FakeReply consentReply;
  late FakeReply errorReply;

  setUp(() {
    consentReply = FakeReply(200, consent());
    errorReply = const FakeReply(202, {'accepted': 1, 'dropped': 0, 'collecting': true});
    http = FakeHttpAdapter()
      ..handler = (o) {
        if (o.path == '/api/app/errors') return errorReply;
        if (o.path == '/api/me/consent' && o.method == 'GET') return consentReply;
        return consentReply;
      };
    buffer = ErrorBuffer(MemoryPrefsStore());
    reporter = ErrorReporter(buffer: buffer, factsLoader: () async => const DeviceFacts(appVersion: '1.0.0', platform: 'android'), run: 1);
    container = ProviderContainer(overrides: [
      userIdProvider.overrideWith((ref) => ref.watch(_userProvider)),
      appPrefsProvider.overrideWithValue(AppPrefs(MemoryPrefsStore())),
      apiClientProvider.overrideWithValue(newApiClient(http)),
      errorReporterProvider.overrideWithValue(reporter),
      networkRestoredProvider.overrideWith((ref) => const Stream<void>.empty()),
    ]);
  });

  tearDown(() => container.dispose());

  Future<void> keepOne() async {
    reporter.report(StateError('boom'), StackTrace.fromString('#0 A.b (package:mockmob/a.dart:1:1)'), kind: ErrorKinds.flutter);
    for (var i = 0; i < 20; i++) {
      await Future<void>.delayed(Duration.zero);
    }
  }

  Future<void> settle() async {
    for (var i = 0; i < 60; i++) {
      await Future<void>.delayed(Duration.zero);
    }
  }

  /// Starts the uploader and waits for the consent read to finish.
  Future<void> start(FakeReply reply) async {
    consentReply = reply;
    // The app keeps the uploader listened to (the host does), so its own listeners stay awake.
    container.listen(errorUploaderProvider, (previous, next) {});
    container.read(consentRepositoryProvider);
    for (var i = 0; i < 200; i++) {
      await Future<void>.delayed(Duration.zero);
      final status = container.read(consentRepositoryProvider).status;
      if (status == ConsentStatus.loaded || status == ConsentStatus.failed) break;
    }
    await settle();
  }

  List<RecordedRequest> errorPosts() => http.requests.where((r) => r.path == '/api/app/errors').toList();

  test('an adult who allowed usage data: the buffered error is sent through the API client with the bearer header', () async {
    await keepOne();
    await start(FakeReply(200, consent()));
    final post = errorPosts().single;
    expect(post.method, 'POST');
    expect(post.headers['Authorization'], startsWith('Bearer '));
    final body = post.body! as Map;
    expect((body['errors'] as List).single, containsPair('kind', 'flutter'));
    expect(await buffer.count(), 0);
  });

  test('usage data off: nothing is sent, the buffer is emptied and no more is kept', () async {
    await keepOne();
    await start(FakeReply(200, consent(allowed: false)));
    expect(errorPosts(), isEmpty);
    expect(await buffer.count(), 0);
    expect(reporter.collectionAllowed, isFalse);
    await keepOne();
    expect(await buffer.count(), 0);
  });

  test('a minor never sends, even if the flag says allowed', () async {
    await keepOne();
    await start(FakeReply(200, consent(band: 'minor')));
    expect(errorPosts(), isEmpty);
    expect(await buffer.count(), 0);
  });

  test('the consent read failing means nothing is sent, and nothing is lost', () async {
    await keepOne();
    await start(const FakeReply(503, {'error': 'unavailable'}));
    expect(errorPosts(), isEmpty);
    expect(await buffer.count(), 1);
  });

  test('withdrawal empties the buffer before the network call returns', () async {
    await start(FakeReply(200, consent()));
    // A new error arrives after the first flush, then the student withdraws.
    await keepOne();
    expect(await buffer.count(), 1);
    http.hold = Completer<void>();
    consentReply = FakeReply(200, consent(allowed: false));
    final pending = container.read(consentRepositoryProvider.notifier).setAnalyticsAllowed(false);
    for (var i = 0; i < 50 && (http.requests.isEmpty || http.requests.last.method != 'PUT'); i++) {
      await Future<void>.delayed(Duration.zero);
    }
    expect(await buffer.count(), 0);
    expect(reporter.collectionAllowed, isFalse);
    http.hold!.complete();
    await pending;
    expect(errorPosts().length, lessThanOrEqualTo(1));
  });

  test('signing out empties the buffer so nothing is sent for the next account', () async {
    await keepOne();
    await start(const FakeReply(503, {'error': 'unavailable'}));
    expect(await buffer.count(), 1);
    container.read(_userProvider.notifier).set(null);
    await settle();
    expect(await buffer.count(), 0);
  });

  test('the server saying it is not collecting stops the sending', () async {
    await keepOne();
    errorReply = const FakeReply(202, {'accepted': 0, 'dropped': 1, 'collecting': false});
    await start(FakeReply(200, consent()));
    expect(errorPosts().length, 1);
    expect(await buffer.count(), 0);
    await keepOne();
    await container.read(errorUploaderProvider).flush();
    expect(errorPosts().length, 1);
  });
}
