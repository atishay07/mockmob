import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api.dart';
import 'package:mockmob/features/tools/data/du_repository.dart';
import 'package:mockmob/features/tools/data/du_source.dart';

/// The network is down and nothing is kept on the phone: only the copy inside the app is left.
class _OfflineFirstRun implements DuSource {
  @override
  Future<String> fetch(String file) async => throw const ApiError(kind: ApiErrorKind.network, code: 'network');

  @override
  Future<({String body, DateTime savedAt})?> readCache(String file) async => null;

  @override
  Future<void> writeCache(String file, String body) async {}

  @override
  Future<String?> readBundled(String file) async {
    try {
      return await rootBundle.loadString('assets/$duCycleFolder/$file');
    } on Object {
      return null;
    }
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('Compass and Combo work on a first run with no network, from the files bundled with the app', () async {
    final repo = DuRepository(_OfflineFirstRun(), const InlineDuDecoder());
    final catalog = await repo.catalog();
    expect(catalog.groups, hasLength(73));
    final offerings = await repo.offerings('b-com-hons');
    expect(offerings, isNotNull);
  });

  test('the rules file ships beside the index', () async {
    expect(await rootBundle.loadString('assets/du/2026/rules.json'), isNotEmpty);
  });
}
