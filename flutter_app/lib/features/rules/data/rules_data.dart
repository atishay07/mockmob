import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/api_error.dart';
import '../../../core/api/api_providers.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/models/lab_loop.dart';
import '../../../core/repositories/attempts_repository.dart';
import '../../../core/repositories/json_remote_notifier.dart';
import '../../../core/repositories/remote_state.dart';

/// `GET /api/me/rules` (spec 4.9, 4.10): the Rule book and Across your mocks, cached for offline
/// reading. Read when Review or You first shows them, again when the student opens the Rule book,
/// and again whenever the attempts list gains a paper (a new mock changes both).
class RulesRepository extends JsonRemoteNotifier<RulesRead> {
  @override
  String get cacheKey => 'me-rules';

  @override
  RemoteState<RulesRead> build() {
    final initial = super.build();
    // A paper added to the list (a mock just submitted, or one from the website) changes the
    // record and the habit evidence: read again. The first value of the list is not a change.
    ref.listen<int?>(attemptsRepositoryProvider.select((s) => s.value?.length), (before, after) {
      if (before != null && after != null && after != before) refresh(force: true);
    });
    return initial;
  }

  @override
  RulesRead parse(Object? json) => RulesRead.parse(json);

  @override
  Future<Object?> fetchJson() async => (await ref.read(apiClientProvider).get('/api/me/rules')).data;

  /// The server confirmed [rule] as the one in force: the book on screen says so at once, and a
  /// fresh read follows so the cached copy agrees.
  void confirmActive(RuleRef rule) {
    final read = state.value;
    final book = read?.book;
    if (read != null && book != null) {
      state = RemoteState(value: read.withBook(book.withActive(rule)), fetchedAt: state.fetchedAt);
    }
    refresh(force: true);
  }
}

final rulesRepositoryProvider = NotifierProvider<RulesRepository, RemoteState<RulesRead>>(RulesRepository.new);

/// "Use in my next mock" and the start sheet's read. Behind an interface so tests replace it.
abstract interface class PlaybookApi {
  /// `POST /api/me/playbook {ruleId}`: the rule in force as the server now has it. Throws
  /// [ApiError] for a refusal and [FormatException] for a body without an active rule.
  Future<RuleRef> use(String ruleId);

  /// `GET /api/me/playbook[?subject=]`: the rule in force and the start sheet's two strings.
  Future<PlaybookRead> read({String? subject});
}

class HttpPlaybookApi implements PlaybookApi {
  HttpPlaybookApi(this._api);

  final ApiClient _api;

  @override
  Future<RuleRef> use(String ruleId) async {
    final response = await _api.post('/api/me/playbook', body: {'ruleId': ruleId});
    final active = RuleRef.tryParse(response.map['active']);
    if (active == null) throw const FormatException('playbook: no active rule');
    return active;
  }

  @override
  Future<PlaybookRead> read({String? subject}) async {
    final response = await _api.get('/api/me/playbook', query: {'subject': ?subject});
    return PlaybookRead.fromJson(response.map);
  }
}

final playbookApiProvider = Provider<PlaybookApi>((ref) => HttpPlaybookApi(ref.watch(apiClientProvider)));

/// A subject id the playbook route accepts (`[a-z0-9_-]`, up to 40).
final RegExp _subjectId = RegExp(r'^[a-z0-9_-]{1,40}$');

/// The start sheet's two strings for a mock in [subject] (the attempt-side id, like
/// `accountancy`), or null: signed out, no rule in force, a repair rule of another subject, or
/// a read that failed. Never an error on screen: the sheet simply has no line. Read once each
/// time a sheet opens, before the clock exists; nothing here reaches a timed paper.
final startSheetProvider = FutureProvider.autoDispose.family<StartSheetLines?, String>((ref, subject) async {
  final userId = ref.watch(authSnapshotProvider.select((s) => s.userId));
  if (userId == null) return null;
  try {
    final read = await ref.read(playbookApiProvider).read(subject: _subjectId.hasMatch(subject) ? subject : null);
    return read.startSheet;
  } on Object {
    return null;
  }
});
