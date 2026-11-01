// Learn v2 in the device demo (APP-1101 decision 3): the demo build talks to the web dev preview's real engine, the
// production service (web src/lib/server/learn.js) over the preview's in-memory student, through this debug-only client.
// Never compiled into the real app (it lives under test/).
//
//   http://localhost:3452/preview/arena/realdeck?_to=/api/learn/<route>&<the route's query>&_plan=&_student=&_s=
//
// Run the web preview on the PC, then `adb reverse tcp:3452 tcp:3452` so the emulator's localhost reaches it (debug builds
// already allow cleartext HTTP: android/app/src/debug/AndroidManifest.xml). The client has its own Dio, never the app's
// ApiClient, so the app's origin guard and its API base stay as they are.
//
// Flags: `--dart-define=DEMO_PRO=true` (Pro; Free otherwise, as for Key cards), `--dart-define=DEMO_NEW=true` (the
// preview's new student, nothing studied; the returning commerce student otherwise), `--dart-define=DEMO_LEARN_S=<name>`
// (the preview session: each name is its own fresh student; default app-demo), `--dart-define=DEMO_LEARN_BASE=<url>`
// (default http://localhost:3452).
//
// The preview has no bookmarks route, so Save is answered here, in memory (Free's 25 saves included).
// ignore_for_file: depend_on_referenced_packages
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart' show debugPrint;
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:mockmob/core/models/json_helpers.dart';
import 'package:mockmob/features/learn2/data/learn_api.dart';
import 'package:mockmob/features/learn2/data/learn_providers.dart';

import 'demo_keycards.dart' show demoPro;

/// `--dart-define=DEMO_NEW=true`: the preview's new student (nothing studied); the returning commerce student otherwise.
const bool demoNew = bool.fromEnvironment('DEMO_NEW');

/// `--dart-define=DEMO_LEARN_S=<name>`: the preview session; each name is its own fresh in-memory student.
const String demoLearnSession = String.fromEnvironment('DEMO_LEARN_S', defaultValue: 'app-demo');

/// `--dart-define=DEMO_LEARN_BASE=<url>`: where the web dev preview answers (through `adb reverse`).
const String demoLearnBase = String.fromEnvironment('DEMO_LEARN_BASE', defaultValue: 'http://localhost:3452');

/// The Learn routes answered by the web dev preview. Same bodies and queries as [HttpLearnApi] ([LearnRoutes]); only the
/// transport differs.
class PreviewLearnApi extends LearnRoutes {
  PreviewLearnApi({
    Dio? dio,
    this.base = demoLearnBase,
    this.pro = demoPro,
    this.newStudent = demoNew,
    this.session = demoLearnSession,
    super.keys,
  }) : _dio = dio ?? Dio(BaseOptions(connectTimeout: const Duration(seconds: 10), receiveTimeout: const Duration(seconds: 60)));

  final Dio _dio;
  final String base;
  final bool pro;
  final bool newStudent;
  final String session;

  final Set<String> _saved = {};

  /// The preview's query for [path]: the route's own parameters and the student.
  Map<String, String> previewQuery(String path, Map<String, String>? query) => {
    '_to': path,
    ...?query,
    '_plan': pro ? 'pro' : 'free',
    '_student': newStudent ? 'new' : 'commerce',
    '_s': session,
  };

  @override
  Future<Object?> send(String method, String path, {Map<String, String>? query, Json? body, bool write = false}) async {
    if (path == LearnPaths.bookmarks) return _save(asStringOr(body?['questionId'], ''));
    final Response<Object?> response;
    try {
      response = await _dio.request<Object?>(
        '${base.replaceAll(RegExp(r'/+$'), '')}/preview/arena/realdeck',
        queryParameters: previewQuery(path, query),
        data: body,
        options: Options(
          method: method,
          contentType: Headers.jsonContentType,
          responseType: ResponseType.json,
          validateStatus: (_) => true,
        ),
      );
    } on DioException catch (e) {
      debugPrint('[demo-learn] $method $path: ${e.type.name} (is the web preview running, and `adb reverse tcp:3452 tcp:3452` set?)');
      throw LearnError(kind: LearnErrorKind.error, code: 'network', offline: true, cause: e);
    }
    final status = response.statusCode ?? 0;
    if (status >= 200 && status < 300) return response.data;
    debugPrint('[demo-learn] $method $path: $status ${response.data}');
    throw LearnError.fromResponse(status, response.data);
  }

  Json _save(String questionId) {
    if (!pro && !_saved.contains(questionId) && _saved.length >= 25) {
      throw LearnError.fromResponse(402, {'error': 'Free bookmark limit reached', 'limit': 25});
    }
    _saved.add(questionId);
    return {'saved': true, 'count': _saved.length, 'limit': pro ? null : 25};
  }
}

/// Learn v2 in the demo: the preview's engine, and the server switch on (the demo build always shows Learn v2).
List<Override> demoLearnOverrides() => [
  learnApiProvider.overrideWith((ref) => PreviewLearnApi(keys: ref.watch(learnRequestKeysProvider))),
  learnOnProvider.overrideWithBuild((ref, notifier) => true),
];
