// Shared fakes for the CUET tools: a DU source backed by the real 2026 files (the bundled index
// and two offerings fixtures), and the overrides a screen needs to render without a network.

import 'dart:async';
import 'dart:io';

import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:mockmob/core/api/api.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/models/subject.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/practice/data/practice_catalog.dart';
import 'package:mockmob/features/tools/combo/combo_controller.dart';
import 'package:mockmob/features/tools/data/du_repository.dart';
import 'package:mockmob/features/tools/data/du_source.dart';
import 'package:mockmob/features/tools/data/tools_store.dart';
import 'package:mockmob/features/tools/domain/du_combos.dart';
import 'package:mockmob/features/tools/domain/du_models.dart';

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
}) =>
    [
      duRepositoryProvider.overrideWithValue(
        neverLoads ? _NeverRepository() : DuRepository(source ?? realDuServer(), const InlineDuDecoder()),
      ),
      toolsPrefsProvider.overrideWithValue(prefs ?? MemoryPrefsStore()),
      authSnapshotProvider.overrideWithBuild(
        (ref, n) => AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1', name: 'Riya', subjects: sheet),
      ),
      practiceSubjectsProvider.overrideWith((ref) async => _practiceSubjects),
      comboRunnerProvider.overrideWithValue(
        (groups, pool, targets, maxPapers) async => duPlanCombos(groups: groups, pool: pool, targets: targets, maxPapers: maxPapers),
      ),
      if (now != null) nowProvider.overrideWithValue(() => now),
    ];

/// Prefs with Compass choices saved.
MemoryPrefsStore savedCompass(String subjects, {String category = 'UR', String score = ''}) =>
    MemoryPrefsStore()..values['mm.tools.compass.v1'] = '{"s":"$subjects","c":"$category","score":"$score"}';

/// Prefs with Combo choices saved.
MemoryPrefsStore savedCombo(List<String> targets, List<String> pool, {int maxPapers = 5}) => MemoryPrefsStore()
  ..values['mm.tools.combo.v1'] =
      '{"targets":[${targets.map((t) => '"$t"').join(',')}],"pool":[${pool.map((t) => '"$t"').join(',')}],"maxPapers":$maxPapers}';
