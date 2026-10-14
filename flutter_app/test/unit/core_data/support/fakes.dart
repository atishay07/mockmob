import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:mockmob/core/api/api_client.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/api/token_provider.dart';
import 'package:mockmob/core/config/app_config.dart';
import 'package:mockmob/core/models/session.dart';
import 'package:mockmob/core/sync/session/session_api.dart';

const testConfig = AppConfig(apiBaseUrl: 'https://api.test', supabaseUrl: 'https://sb.test', supabaseAnonKey: 'anon');

/// One scripted HTTP answer.
class FakeReply {
  const FakeReply(this.status, [this.body, this.headers = const {}]);

  const FakeReply.network() : this(-1);

  final int status;
  final Object? body;
  final Map<String, String> headers;
}

class RecordedRequest {
  RecordedRequest(this.method, this.path, this.headers, this.body);

  final String method;
  final String path;
  final Map<String, dynamic> headers;
  final Object? body;
}

/// A dio adapter that answers from a queue and records what was sent.
class FakeHttpAdapter implements HttpClientAdapter {
  final List<FakeReply> replies = [];
  final List<RecordedRequest> requests = [];
  FakeReply Function(RequestOptions)? handler;

  /// When set, every request waits for it before answering (to observe in-flight state).
  Completer<void>? hold;

  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async {
    requests.add(RecordedRequest(options.method, options.path, Map.of(options.headers), options.data));
    if (hold != null) await hold!.future;
    final reply = handler != null ? handler!(options) : (replies.isEmpty ? const FakeReply(200, {}) : replies.removeAt(0));
    if (reply.status == -1) {
      throw DioException(requestOptions: options, type: DioExceptionType.connectionError, error: 'offline');
    }
    final text = reply.body is String ? reply.body! as String : jsonEncode(reply.body ?? {});
    return ResponseBody.fromString(text, reply.status, headers: {
      Headers.contentTypeHeader: [reply.body is String ? 'text/html' : Headers.jsonContentType],
      for (final e in reply.headers.entries) e.key: [e.value],
    });
  }

  @override
  void close({bool force = false}) {}
}

class FakeTokens implements ApiTokenProvider {
  FakeTokens({this.token = 'tok-1', this.refreshResult = true, this.userId = 'u1'});

  String? token;
  bool refreshResult;

  /// The account the token belongs to: 'u1', like most tests' signed-in student. Null when the
  /// provider cannot say (a session whose profile has not loaded).
  String? userId;

  /// When set, every token read waits for it (to change accounts while a write waits).
  Completer<void>? tokenGate;

  /// The refresh cannot finish (offline, slow): throws [RefreshUnavailable].
  bool refreshUnavailable = false;
  int refreshCalls = 0;
  int lostCalls = 0;
  String? tokenAfterRefresh = 'tok-2';

  @override
  Future<String?> accessToken() async => token;

  @override
  Future<ApiToken?> accountToken() async {
    if (tokenGate != null) await tokenGate!.future;
    final value = token;
    return value == null ? null : ApiToken(value, userId: userId);
  }

  @override
  Future<bool> refresh() async {
    refreshCalls++;
    if (refreshUnavailable) throw const RefreshUnavailable();
    if (refreshResult) token = tokenAfterRefresh;
    return refreshResult;
  }

  @override
  Future<void> onSessionLost() async => lostCalls++;
}

ApiClient newApiClient(FakeHttpAdapter adapter, {ApiTokenProvider? tokens, DateTime Function()? now, ApiNetworkObserver? observer}) {
  final dio = Dio()..httpClientAdapter = adapter;
  return ApiClient(
    config: testConfig,
    tokens: tokens ?? FakeTokens(),
    dio: dio,
    now: now,
    sleep: (_) async {},
    observer: observer,
  );
}

/// A scripted [SessionApi].
class FakeSessionApi implements SessionApi {
  final List<List<SessionEvent>> puts = [];
  final List<Map<String, dynamic>> submits = [];
  Object? Function()? putFailure;
  int ackOffset = 0;
  Map<String, dynamic>? attemptOnFetch;
  Object? submitFailure;
  Map<String, dynamic> submitResult = {'id': 'sess-1', 'subject': 'accountancy', 'correct': 1, 'wrong': 0, 'unattempted': 0, 'total': 1};
  SessionView? resumeView;
  Object? resumeFailure;
  int resumeCalls = 0;
  int fetchCalls = 0;

  /// The owner each attempt read named.
  final List<String?> fetchedFor = [];

  @override
  Future<int> putEvents({required String sessionId, required List<SessionEvent> events}) async {
    final failure = putFailure?.call();
    if (failure != null) throw failure;
    puts.add(List.of(events));
    return events.last.seq - ackOffset;
  }

  @override
  Future<SessionView> resume(String sessionId) async {
    resumeCalls++;
    if (resumeFailure != null) throw resumeFailure!;
    return resumeView ?? (throw const ApiError(kind: ApiErrorKind.network, code: 'network'));
  }

  @override
  Future<Map<String, dynamic>> submit({
    required String sessionId,
    String? sessionTicket,
    required Map<String, int> answers,
    required List<SessionEvent> events,
    String? forUserId,
  }) async {
    submits.add({'sessionId': sessionId, 'sessionTicket': sessionTicket, 'answers': answers, 'events': List.of(events), 'forUserId': forUserId});
    if (submitFailure != null) throw submitFailure!;
    return submitResult;
  }

  @override
  Future<Map<String, dynamic>?> fetchAttempt(String attemptId, {String? forUserId}) async {
    fetchCalls++;
    fetchedFor.add(forUserId);
    return attemptOnFetch;
  }
}

/// A manual timer queue so debounces are driven by the test.
class ManualTimers {
  final List<_ManualTimer> _timers = [];

  Timer create(Duration delay, void Function() callback) {
    final t = _ManualTimer(delay, callback);
    _timers.add(t);
    return t;
  }

  List<Duration> get pendingDelays => [for (final t in _timers) if (t.isActive) t.delay];
  int get pendingCount => _timers.where((t) => t.isActive).length;

  /// Fires the oldest active timer.
  void fireNext() {
    final t = _timers.firstWhere((t) => t.isActive);
    t.fire();
  }

  void fireAll() {
    for (final t in List.of(_timers)) {
      if (t.isActive) t.fire();
    }
  }
}

class _ManualTimer implements Timer {
  _ManualTimer(this.delay, this._callback);

  final Duration delay;
  final void Function() _callback;
  bool _active = true;

  void fire() {
    if (!_active) return;
    _active = false;
    _callback();
  }

  @override
  void cancel() => _active = false;

  @override
  bool get isActive => _active;

  @override
  int get tick => 0;
}
