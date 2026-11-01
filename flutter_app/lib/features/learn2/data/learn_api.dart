import 'package:dio/dio.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/api_error.dart';
import '../../../core/models/json_helpers.dart';
import 'learn_models.dart';
import 'learn_prefs.dart';

/// What kind of failure a Learn call met, exactly the web's `api.js` KINDS ([wire] is the web's string).
enum LearnErrorKind {
  /// 402 FREE_SESSION_USED: Free's Learn session for today is used (`data.line`, `data.options`, `data.resume`).
  sessionUsed('session_used'),

  /// 402 PRO_REQUIRED (a Keep on a card Free cannot open).
  proRequired('pro_required'),

  /// 409 QUESTION_CHANGED: skip the item with one line.
  questionChanged('question_changed'),

  /// 409 QUESTION_HELD (an open Mob paper holds it): skip the item with one line.
  questionHeld('question_held'),

  /// 409 RUN_EXPIRED: go to the end screen (`data.endHref`).
  runExpired('run_expired'),

  /// 409 RUN_ENDED: go to the end screen (`data.endHref`).
  runEnded('run_ended'),

  /// 404 LEARN_OFF: the server has Learn v2 off; the app keeps the legacy Learn door.
  off('off'),

  /// 404 CHAPTER_NOT_FOUND: its own state, trying again would not help.
  chapterNotFound('chapter_not_found'),

  /// Anything else (offline, a 5xx, a 4xx the screens do not name).
  error('error');

  const LearnErrorKind(this.wire);

  final String wire;

  /// The kind of a machine code, as the web maps it (`KINDS[code] || 'error'`).
  static LearnErrorKind forCode(String? code) => switch (code) {
    'FREE_SESSION_USED' => sessionUsed,
    'PRO_REQUIRED' => proRequired,
    'QUESTION_CHANGED' => questionChanged,
    'QUESTION_HELD' => questionHeld,
    'RUN_EXPIRED' => runExpired,
    'RUN_ENDED' => runEnded,
    'LEARN_OFF' => off,
    'CHAPTER_NOT_FOUND' => chapterNotFound,
    _ => error,
  };
}

/// A failed Learn call: the HTTP [status] (null when nothing came back), the server's [code], the [kind] the screens switch
/// on and the route's JSON body in [data] (the 402's line, options and resume; a 409's endHref). [offline] is true when the
/// phone could not reach the server.
class LearnError implements Exception {
  const LearnError({required this.kind, this.status, this.code, this.data = const {}, this.offline = false, this.cause});

  /// The server has Learn v2 off (404 LEARN_OFF), and [OffLearnApi]'s answer to everything.
  const LearnError.off()
    : kind = LearnErrorKind.off,
      status = 404,
      code = 'LEARN_OFF',
      data = const {'error': 'LEARN_OFF'},
      offline = false,
      cause = null;

  /// A non-2xx answer and its body.
  factory LearnError.fromResponse(int status, Object? body, {Object? cause}) {
    final data = asJson(body);
    final code = asString(data['error']);
    return LearnError(kind: LearnErrorKind.forCode(code), status: status, code: code, data: data, cause: cause);
  }

  /// The app's [ApiError] of a Learn call, with the route's body when it was kept ([body]).
  factory LearnError.fromApiError(ApiError e, {Json? body}) {
    final data = body ?? const <String, dynamic>{};
    // The web's code is the body's `error`; without a body it is the app's own machine code (`network`, `not_found`).
    final code = asString(data['error']) ?? e.code;
    final kind = LearnErrorKind.forCode(code);
    return LearnError(
      kind: kind == LearnErrorKind.error ? LearnErrorKind.forCode(e.code) : kind,
      status: e.status,
      code: code,
      data: data,
      offline: e.isOffline,
      cause: e,
    );
  }

  final LearnErrorKind kind;
  final int? status;

  /// The server's `error` (`FREE_SESSION_USED`, `RUN_ENDED`), or the app's code for a failure with no body (`network`).
  final String? code;

  /// The route's JSON body; empty when none came back.
  final Json data;
  final bool offline;

  /// The [ApiError] (or transport error) behind this one.
  final Object? cause;

  bool get isSessionUsed => kind == LearnErrorKind.sessionUsed;
  bool get isQuestionSkipped => kind == LearnErrorKind.questionChanged || kind == LearnErrorKind.questionHeld;
  bool get isRunClosed => kind == LearnErrorKind.runExpired || kind == LearnErrorKind.runEnded;
  bool get isChapterMissing => kind == LearnErrorKind.chapterNotFound;
  bool get isOff => kind == LearnErrorKind.off;

  /// A 402 of any kind (Free's session, a locked card, Free's save limit).
  bool get isPaymentRequired => status == 402;

  /// Where a closed run's end is (`/explore/run?run=<id>&end=1`), for [isRunClosed].
  String? get endHref => asString(data['endHref']);

  /// What a 402 FREE_SESSION_USED says ([isSessionUsed]).
  LearnSessionUsed get sessionUsed => LearnSessionUsed.parse(data);

  @override
  String toString() => 'LearnError(${kind.wire}, $status, $code${offline ? ', offline' : ''})';
}

/// Free's Learn session for today is used (402): show `error.sessionUsed.line`, never a modal.
bool isSessionUsed(Object? error) => error is LearnError && error.isSessionUsed;

/// The question changed or is held by an open Mob paper (409): skip the item with one line.
bool isQuestionSkipped(Object? error) => error is LearnError && error.isQuestionSkipped;

/// The run ended or expired (409): go to its end screen (`error.endHref`).
bool isRunClosed(Object? error) => error is LearnError && error.isRunClosed;

/// The chapter is not there (404 CHAPTER_NOT_FOUND): draw the missing-chapter state; trying again would not help.
bool isChapterMissing(Object? error) => error is LearnError && error.isChapterMissing;

/// The server has Learn v2 off (404 LEARN_OFF): the legacy Learn door stays.
bool isLearnOff(Object? error) => error is LearnError && error.isOff;

/// `POST /api/bookmarks`: `{ saved, count, limit }` (limit null on Pro).
class LearnSaved {
  const LearnSaved({required this.saved, this.count = 0, this.limit, this.raw = const {}});

  static LearnSaved parse(Object? raw) {
    final j = asJson(raw);
    return LearnSaved(saved: asBool(j['saved']) ?? true, count: asInt(j['count']) ?? 0, limit: asInt(j['limit']), raw: j);
  }

  final bool saved;
  final int count;
  final int? limit;
  final Json raw;
}

/// The Learn v2 routes, one method per route, as the web's `api.js`. Behind an interface so tests (FixtureLearnApi), the
/// device demo (PreviewLearnApi) and the real app ([HttpLearnApi]) each give their own. Every method throws a [LearnError].
abstract interface class LearnApi {
  /// `GET /api/learn/subject?subject=`.
  Future<LearnSubjectData> subject(String subject);

  /// `POST /api/learn/runs/preview` `{ chapterKey, minutes, leaveOut, addNext? }`.
  Future<LearnPreview> preview({required String chapterKey, required int minutes, List<String> leaveOut = const [], bool addNext = false});

  /// `POST /api/learn/runs`: a run or a feed, or one picked up. A start without its own request key takes the key kept
  /// for its scope ([LearnRequestKeys]); `fresh` takes a new one.
  Future<LearnRun> startRun(RunStart start);

  /// `GET /api/learn/runs/:id`: the run as it stands, only the items not done.
  Future<LearnRun> getRun(String runId);

  /// `POST /api/learn/runs/:id/answer` `{ itemId, choice }`.
  Future<LearnAnswer> answer(String runId, String itemId, String choice);

  /// `POST /api/learn/runs/:id/rate` `{ itemId, rating: 1 | 3 | 4 }`.
  Future<LearnRateResult> rate(String runId, String itemId, int rating);

  /// The feed's Keep: `POST /api/learn/runs/:id/rate` `{ itemId, keep: true }`.
  Future<LearnRateResult> keep(String runId, String itemId);

  /// `GET /api/learn/runs/:id/end`; lets the run's request key go.
  Future<LearnEnd> end(String runId);

  /// `GET /api/learn/cards?chapter=&filter=all|must|revise|missed|due`.
  Future<LearnChapterCards> chapterCards(String chapter, {String filter = 'all'});

  /// `GET /api/learn/cards?subject=&filter=`: Find's shelf over a whole subject.
  Future<LearnSubjectCards> subjectCards(String subject, {String filter = 'all'});

  /// `GET /api/learn/shelves?subject=` (no subject: the student's first).
  Future<LearnShelves> shelves([String? subject]);

  /// `GET /api/learn/search?subject=&q=`.
  Future<LearnSearch> search(String subject, String query);

  /// `GET /api/learn/covers?subject=`.
  Future<LearnCovers> covers(String subject);

  /// `POST /api/bookmarks` `{ questionId, saved: true }` (the same route as Explore's save; 402 is Free's save limit).
  Future<LearnSaved> saveQuestion(String questionId);
}

/// The paths.
abstract final class LearnPaths {
  static const String subject = '/api/learn/subject';
  static const String preview = '/api/learn/runs/preview';
  static const String runs = '/api/learn/runs';
  static const String cards = '/api/learn/cards';
  static const String shelves = '/api/learn/shelves';
  static const String search = '/api/learn/search';
  static const String covers = '/api/learn/covers';
  static const String bookmarks = '/api/bookmarks';

  static String run(String id) => '$runs/${Uri.encodeComponent(id)}';
  static String answer(String id) => '${run(id)}/answer';
  static String rate(String id) => '${run(id)}/rate';
  static String end(String id) => '${run(id)}/end';

  /// True for a path of the Learn v2 routes.
  static bool isLearn(String path) {
    final clean = path.split('?').first;
    return clean == '/api/learn' || clean.startsWith('/api/learn/');
  }
}

/// The routes over one transport ([send]): [HttpLearnApi] sends through the app's [ApiClient], the device demo's
/// PreviewLearnApi to the web dev preview. Bodies and queries are exactly the web's; start keys come from [keys].
abstract class LearnRoutes implements LearnApi {
  LearnRoutes({LearnRequestKeys? keys}) : keys = keys ?? LearnRequestKeys.memory();

  final LearnRequestKeys keys;

  /// One call: the decoded body of a 2xx answer, or a thrown [LearnError]. [write] is true for a POST the server makes
  /// idempotent (a start by its request key, an answer and a rating by their item id), which may be sent once more after
  /// a dropped connection.
  Future<Object?> send(String method, String path, {Map<String, String>? query, Json? body, bool write = false});

  /// The web's `q()`: no empty or missing values.
  static Map<String, String> clean(Map<String, String?> params) => {
    for (final e in params.entries)
      if (e.value != null && e.value!.isNotEmpty) e.key: e.value!,
  };

  @override
  Future<LearnSubjectData> subject(String subject) async =>
      LearnSubjectData.parse(await send('GET', LearnPaths.subject, query: clean({'subject': subject})));

  @override
  Future<LearnPreview> preview({required String chapterKey, required int minutes, List<String> leaveOut = const [], bool addNext = false}) async =>
      LearnPreview.parse(await send('POST', LearnPaths.preview, body: LearnPreviewKey(chapterKey: chapterKey, minutes: minutes, leaveOut: leaveOut, addNext: addNext).toJson(), write: true));

  @override
  Future<LearnRun> startRun(RunStart start) async {
    final scope = start.scope;
    final key = start.requestKey ?? await keys.keyFor(scope, renew: start.fresh);
    final run = LearnRun.parse(await send('POST', LearnPaths.runs, body: start.copyWith(requestKey: key).toJson(), write: true));
    if (run.id.isNotEmpty) await keys.keep(scope, key, run.id);
    return run;
  }

  @override
  Future<LearnRun> getRun(String runId) async => LearnRun.parse(await send('GET', LearnPaths.run(runId)));

  @override
  Future<LearnAnswer> answer(String runId, String itemId, String choice) async =>
      LearnAnswer.parse(await send('POST', LearnPaths.answer(runId), body: {'itemId': itemId, 'choice': choice}, write: true));

  @override
  Future<LearnRateResult> rate(String runId, String itemId, int rating) async =>
      LearnRateResult.parse(await send('POST', LearnPaths.rate(runId), body: {'itemId': itemId, 'rating': rating}, write: true));

  @override
  Future<LearnRateResult> keep(String runId, String itemId) async =>
      LearnRateResult.parse(await send('POST', LearnPaths.rate(runId), body: {'itemId': itemId, 'keep': true}, write: true));

  @override
  Future<LearnEnd> end(String runId) async {
    final end = LearnEnd.parse(await send('GET', LearnPaths.end(runId)));
    await keys.forget(runId);
    return end;
  }

  @override
  Future<LearnChapterCards> chapterCards(String chapter, {String filter = 'all'}) async =>
      LearnChapterCards.parse(await send('GET', LearnPaths.cards, query: clean({'chapter': chapter, 'filter': filter})));

  @override
  Future<LearnSubjectCards> subjectCards(String subject, {String filter = 'all'}) async =>
      LearnSubjectCards.parse(await send('GET', LearnPaths.cards, query: clean({'subject': subject, 'filter': filter})));

  @override
  Future<LearnShelves> shelves([String? subject]) async => LearnShelves.parse(await send('GET', LearnPaths.shelves, query: clean({'subject': subject})));

  @override
  Future<LearnSearch> search(String subject, String query) async =>
      LearnSearch.parse(await send('GET', LearnPaths.search, query: clean({'subject': subject, 'q': query})));

  @override
  Future<LearnCovers> covers(String subject) async => LearnCovers.parse(await send('GET', LearnPaths.covers, query: clean({'subject': subject})));

  @override
  Future<LearnSaved> saveQuestion(String questionId) async =>
      LearnSaved.parse(await send('POST', LearnPaths.bookmarks, body: {'questionId': questionId, 'saved': true}, write: true));
}

/// The real routes, through the app's [ApiClient] (bearer auth, the origin guard, the 429 hold of the `learn` family, GET
/// retries). Writes the server makes idempotent are sent once more after a dropped connection (`retries: 1`).
class HttpLearnApi extends LearnRoutes {
  HttpLearnApi(this._api, {super.keys}) {
    LearnErrorBodies.install(_api.dio);
  }

  final ApiClient _api;

  @override
  Future<Object?> send(String method, String path, {Map<String, String>? query, Json? body, bool write = false}) async {
    try {
      final response = await _api.request(method, path, query: query, body: body, options: ApiOptions(retries: write ? 1 : null));
      return response.data;
    } on ApiError catch (e) {
      throw LearnError.fromApiError(e, body: e is LearnApiError ? e.body : null);
    }
  }
}

/// An [ApiError] of a Learn route that keeps the route's JSON body. The app's ApiError keeps only a machine code (nothing
/// from a body reaches the screens on other routes); Learn's bodies are written for the student (the 402's line, options
/// and resume; a 409's endHref), so [LearnErrorBodies] keeps them for these routes only.
class LearnApiError extends ApiError {
  LearnApiError(ApiError e, this.body) : super(kind: e.kind, code: e.code, status: e.status, retryAfter: e.retryAfter, details: e.details);

  final Json body;
}

/// Keeps the JSON body of a failed `/api/learn/*` call on its error ([LearnApiError]). Installed once on the app's Dio by
/// [HttpLearnApi]; every other route is passed through untouched, and the client's own handling (the 429 hold, retries,
/// the typed error) is unchanged because the error it reads is still an [ApiError] with the same status, kind and code.
class LearnErrorBodies extends Interceptor {
  static void install(Dio dio) {
    if (dio.interceptors.any((i) => i is LearnErrorBodies)) return;
    dio.interceptors.add(LearnErrorBodies());
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    final response = err.response;
    final body = response?.data;
    if (response == null || err.error is ApiError || body is! Map || !LearnPaths.isLearn(err.requestOptions.path)) {
      handler.next(err);
      return;
    }
    handler.next(err.copyWith(error: LearnApiError(ApiError.fromDio(err), Json.from(body))));
  }
}

/// The default before the app wires the real routes (and in every test that does not give its own): Learn v2 is off, so
/// nothing is fetched and the legacy Learn door stays.
class OffLearnApi implements LearnApi {
  const OffLearnApi();

  Never _off() => throw const LearnError.off();

  @override
  Future<LearnSubjectData> subject(String subject) async => _off();
  @override
  Future<LearnPreview> preview({required String chapterKey, required int minutes, List<String> leaveOut = const [], bool addNext = false}) async => _off();
  @override
  Future<LearnRun> startRun(RunStart start) async => _off();
  @override
  Future<LearnRun> getRun(String runId) async => _off();
  @override
  Future<LearnAnswer> answer(String runId, String itemId, String choice) async => _off();
  @override
  Future<LearnRateResult> rate(String runId, String itemId, int rating) async => _off();
  @override
  Future<LearnRateResult> keep(String runId, String itemId) async => _off();
  @override
  Future<LearnEnd> end(String runId) async => _off();
  @override
  Future<LearnChapterCards> chapterCards(String chapter, {String filter = 'all'}) async => _off();
  @override
  Future<LearnSubjectCards> subjectCards(String subject, {String filter = 'all'}) async => _off();
  @override
  Future<LearnShelves> shelves([String? subject]) async => _off();
  @override
  Future<LearnSearch> search(String subject, String query) async => _off();
  @override
  Future<LearnCovers> covers(String subject) async => _off();
  @override
  Future<LearnSaved> saveQuestion(String questionId) async => _off();
}
