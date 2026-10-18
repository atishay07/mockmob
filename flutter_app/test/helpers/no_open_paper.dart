// A test that does not exercise a paper that is open and not on the phone says so once: nothing is open. The resolver and
// the plan it reads from would otherwise open the real drift database, which a widget test cannot.
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:mockmob/core/models/learning_plan.dart';
import 'package:mockmob/core/repositories/plan_repository.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/features/practice/data/open_paper.dart';

class _NothingOpen implements OpenPaperResolver {
  const _NothingOpen();

  @override
  Future<OpenPaper?> offer(HeldHint? held) async => null;

  @override
  Future<OpenPaper?> blocker(HeldHint? held) async => null;

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _SilentPlan extends PlanRepository {
  _SilentPlan(super.minutes);

  @override
  RemoteState<LearningPlan> build() => const RemoteState<LearningPlan>.idle();

  @override
  Future<void> refresh({bool force = false}) async {}
}

/// The plan Practice and Today read for the open paper is never fetched, and the card that offers one is empty: what a test
/// that brings its own [OpenPaperResolver] keeps.
List<Override> get quietOpenPaperOverrides => [
  openPaperProvider.overrideWith((ref) async => null),
  planRepositoryProvider.overrideWith2(_SilentPlan.new),
];

/// Nothing is open, and the plan Practice and Today read for it is never fetched.
List<Override> get noOpenPaperOverrides => [
  ...quietOpenPaperOverrides,
  openPaperResolverProvider.overrideWithValue(const _NothingOpen()),
];
