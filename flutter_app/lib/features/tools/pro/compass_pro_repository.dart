import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_providers.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/repositories/json_remote_notifier.dart';
import '../../../core/repositories/remote_state.dart';
import '../../../core/models/my_colleges.dart';
import '../data/my_colleges_actions.dart';
import '../data/tools_store.dart';
import 'compass_pro_models.dart';

/// `GET /api/compass/pro` (60 a minute, no credits, no model): the practice projection. Read
/// only when the screen asks (`refresh`) and only for an account that has access: the server
/// answers `locked` for anyone else, and the screen then shows nothing.
class CompassProRepository extends JsonRemoteNotifier<CompassPro> {
  @override
  String get cacheKey => 'compass-pro';

  @override
  bool get autoLoad => false;

  @override
  CompassPro parse(Object? json) => CompassPro.fromJson(json);

  @override
  Future<Object?> fetchJson() async => (await ref.read(apiClientProvider).get('/api/compass/pro')).data;
}

final compassProRepositoryProvider = NotifierProvider<CompassProRepository, RemoteState<CompassPro>>(CompassProRepository.new);

/// Access comes from the account (the same Pro flag the quote model and Insights use).
final compassProAccessProvider = Provider<bool>((ref) => ref.watch(authSnapshotProvider.select((s) => s.isPro)));

/// The DU programmes and colleges the student is aiming for: the Compass view of My colleges, the
/// one list saved on the server and shared with Today, You and the website. Empty until the list
/// has loaded (the Compass section says so; it never shows an empty list that did not load).
final shortlistProvider = Provider<List<ShortlistTarget>>((ref) {
  final view = ref.watch(myCollegesProvider);
  return [for (final c in view.colleges) ShortlistTarget(groupId: c.programmeId, college: c.college, programme: c.programme)];
});

/// The most colleges the list holds.
abstract final class ShortlistController {
  static const int limit = MyColleges.maxColleges;

  static MyCollege _entry(ShortlistTarget t) => MyCollege(programmeId: t.groupId, programme: t.programme, college: t.college);

  /// Adds a target to My colleges. A college is on the list once for each programme.
  static Future<MyCollegesOutcome> add(WidgetRef ref, ShortlistTarget target) => ref.read(myCollegesActionsProvider.notifier).add(_entry(target));

  static Future<MyCollegesOutcome> remove(WidgetRef ref, ShortlistTarget target) => ref.read(myCollegesActionsProvider.notifier).remove(_entry(target));
}
