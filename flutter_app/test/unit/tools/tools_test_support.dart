// Shared fakes for the CUET tools: a DU source backed by the real 2026 files (the bundled index
// and two offerings fixtures), and the overrides a screen needs to render without a network.

import 'dart:async';
import 'dart:io';

import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:mockmob/core/api/api.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/connectivity/connectivity_monitor.dart' show NetworkStatus;
import 'package:mockmob/core/connectivity/connectivity_providers.dart';
import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/core/models/subject.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/onboarding/state/answers_store.dart';
import 'package:mockmob/features/practice/data/practice_catalog.dart';
import 'package:mockmob/features/tools/combo/combo_controller.dart';
import 'package:mockmob/features/tools/compass/score_sources.dart';
import 'package:mockmob/features/tools/data/du_repository.dart';
import 'package:mockmob/features/tools/data/du_source.dart';
import 'package:mockmob/features/tools/data/tools_store.dart';
import 'package:mockmob/features/tools/domain/du_combos.dart';
import 'package:mockmob/features/tools/domain/du_models.dart';
import 'package:mockmob/features/tools/pro/compass_pro_models.dart';
import 'package:mockmob/features/tools/pro/compass_pro_repository.dart';

import 'my_colleges_support.dart';

class FakeSource implements DuSource {
  FakeSource({this.cache = const {}, this.bundled, this.server = const {}, this.offline = false});

  Map<String, ({String body, DateTime savedAt})> cache;
  String? bundled;
  Map<String, String> server;
  bool offline;
  final fetched = <String>[];
  final written = <String, String>{};

  @override
  Future<String> fetch(String file) async {
    fetched.add(file);
    if (offline) throw const ApiError(kind: ApiErrorKind.network, code: 'network');
    final body = server[file];
    if (body == null) throw const ApiError(status: 404, kind: ApiErrorKind.notFound, code: 'not_found');
    return body;
  }

  @override
  Future<({String body, DateTime savedAt})?> readCache(String file) async => cache[file];

  @override
  Future<String?> readBundled(String file) async => bundled;

  @override
  Future<void> writeCache(String file, String body) async => written[file] = body;
}

String get duIndexJson => File('assets/du/2026/index.json').readAsStringSync();

/// The real 2026 data as a server: the index and the B.Com. (Hons.) and Economics offerings.
FakeSource realDuServer() => FakeSource(server: {
      'index.json': duIndexJson,
      'offerings/b-com-hons.json': File('test/unit/tools/fixtures/b-com-hons.json').readAsStringSync(),
      'offerings/b-a-hons-economics.json': File('test/unit/tools/fixtures/b-a-hons-economics.json').readAsStringSync(),
    });

/// A DU repository that never answers (the loading state).
class _NeverRepository extends DuRepository {
  _NeverRepository() : super(FakeSource(), const InlineDuDecoder());

  @override
  Future<DuCatalog> catalog() => Completer<DuCatalog>().future;
}

/// A phone whose network state the test sets.
class FakeToolsNetwork extends NetworkStatusNotifier {
  FakeToolsNetwork(this.status);

  final NetworkStatus status;

  @override
  NetworkStatus build() => status;
}

const commerceSubjects = ['english', 'accountancy', 'business_studies', 'economics'];

final _practiceSubjects = [
  for (final id in [...commerceSubjects, 'mathematics', 'general_test'])
    Subject(id: id, internalId: id, name: id, practice: 'supported'),
];

/// Overrides for a tools screen. [prefs] holds saved choices; [sheet] is the student's subjects.
List<Override> toolsOverrides({
  FakeSource? source,
  bool neverLoads = false,
  PrefsStore? prefs,
  List<String> sheet = commerceSubjects,
  DateTime? now,
  NetworkStatus network = NetworkStatus.online,
  Stream<void>? restored,
  bool pro = false,
  ComboRunner? comboRunner,
  List<Attempt> attempts = const [],
  FakeMyColleges? myColleges,
}) =>
    [
      myCollegesOverride(myColleges ?? FakeMyColleges()),
      answersStoreProvider.overrideWithValue(AnswersStore(MemoryPrefsStore())),
      duRepositoryProvider.overrideWithValue(
        neverLoads ? _NeverRepository() : DuRepository(source ?? realDuServer(), const InlineDuDecoder()),
      ),
      toolsPrefsProvider.overrideWithValue(prefs ?? MemoryPrefsStore()),
      authSnapshotProvider.overrideWithBuild(
        (ref, n) => AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1', name: 'Riya', subjects: sheet, isPro: pro),
      ),
      practiceSubjectsProvider.overrideWith((ref) async => _practiceSubjects),
      comboRunnerProvider.overrideWithValue(
        comboRunner ?? (groups, pool, targets, maxPapers) async => duPlanCombos(groups: groups, pool: pool, targets: targets, maxPapers: maxPapers),
      ),
      networkStatusProvider.overrideWith(() => FakeToolsNetwork(network)),
      networkRestoredProvider.overrideWith((ref) => restored ?? const Stream<void>.empty()),
      if (now != null) nowProvider.overrideWithValue(() => now),
      compassAttemptsProvider.overrideWithValue(attempts),
    ];

/// Prefs with Compass choices saved.
MemoryPrefsStore savedCompass(String subjects, {String category = 'UR', String score = ''}) =>
    MemoryPrefsStore()..values['mm.tools.compass.v1'] = '{"s":"$subjects","c":"$category","score":"$score"}';

/// Prefs with Combo choices saved.
MemoryPrefsStore savedCombo(List<String> targets, List<String> pool, {int maxPapers = 5}) => MemoryPrefsStore()
  ..values['mm.tools.combo.v1'] =
      '{"targets":[${targets.map((t) => '"$t"').join(',')}],"pool":[${pool.map((t) => '"$t"').join(',')}],"maxPapers":$maxPapers}';

/// Compass Pro's server read, answered from [body] (or failing offline) without a database.
class FakeCompassPro extends CompassProRepository {
  FakeCompassPro(this.body, {this.fail = false});

  final Object? body;
  final bool fail;
  int fetches = 0;

  @override
  Future<CachedValue<CompassPro>?> readCache(String userId) async => null;

  @override
  Future<void> writeCache(String userId, Fetched<CompassPro> fetched, DateTime at) async {}

  @override
  Future<Object?> fetchJson() async {
    fetches++;
    if (fail) throw const ApiError(kind: ApiErrorKind.network, code: 'network');
    return body;
  }
}


/// A projection as `GET /api/compass/pro` returns it: two papers ready, one that needs more practice.
const compassProReady = {
  'ok': true,
  'locked': false,
  'sessions': 9,
  'projection': {
    'papers': [
      {
        'subject': 'accountancy', 'name': 'Accountancy', 'n': 120, 'right': 70, 'wrong': 30, 'skip': 20, 'language': false,
        'status': 'ready', 'attemptShare': 83, 'accuracy': {'pct': 70, 'low': 60, 'high': 78}, 'mid': 150, 'low': 110, 'high': 185, 'open': 100,
      },
      {
        'subject': 'english', 'name': 'English', 'n': 40, 'right': 25, 'wrong': 10, 'skip': 5, 'language': true,
        'status': 'ready', 'attemptShare': 88, 'accuracy': {'pct': 71, 'low': 55, 'high': 83}, 'mid': 150, 'low': 100, 'high': 190, 'open': 100,
      },
      {'subject': 'economics', 'name': 'Economics', 'n': 12, 'right': 6, 'wrong': 4, 'skip': 2, 'language': false, 'status': 'thin', 'needed': 18},
    ],
    'total': {'papers': ['english', 'accountancy'], 'count': 2, 'complete': false, 'max': 500, 'mid': 300, 'low': 210, 'high': 375},
    'next': {
      'subject': 'accountancy', 'name': 'Accountancy', 'open': 100, 'mid': 150,
      'chapter': {'name': 'Admission of a partner', 'wrong': 6, 'skip': 2, 'n': 20},
    },
    'minSample': 30,
    'paperMax': 250,
  },
};


/// One full mock (50 questions) per commerce subject, as `GET /api/attempts` returns them:
/// English 200, Accountancy 150, Business Studies 210 and Economics 180, so 740 in all.
List<Attempt> commerceMocks() => [
      for (final (subject, correct) in const [('english', 40), ('accountancy', 30), ('business_studies', 42), ('economics', 36)])
        Attempt.fromJson({
          'id': 'mock-$subject',
          'subject': subject,
          'score': 0,
          'correct': correct,
          'wrong': 0,
          'unattempted': 50 - correct,
          'total': 50,
          'mode': 'full',
          'completedAt': DateTime.utc(2026, 10, 12).toIso8601String(),
        }),
    ];
