import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_error.dart';
import '../../../core/api/api_providers.dart';
import '../../../core/models/json_helpers.dart';
import '../../../core/repositories/json_remote_notifier.dart';
import '../../../core/repositories/remote_state.dart';
import 'credits_models.dart';

/// `GET /api/me/credits` (read only, signed in): both balances, the plan and the first page of
/// the history. Cached like the other reads, so Credits and the hub open with the last figures
/// while the server answers. The balances are never made up: with nothing read they stay null.
class MeCreditsRepository extends JsonRemoteNotifier<CreditsOverview> {
  @override
  String get cacheKey => 'me-credits';

  @override
  CreditsOverview parse(Object? json) => CreditsOverview.fromJson(asJson(json));

  @override
  Future<Object?> fetchJson() async => (await ref.read(apiClientProvider).get('/api/me/credits')).data;
}

final meCreditsProvider = NotifierProvider<MeCreditsRepository, RemoteState<CreditsOverview>>(MeCreditsRepository.new);

/// The pages after the first, read with `?cursor=` one at a time as the student asks for them.
class CreditsMoreState {
  const CreditsMoreState({this.rows = const [], this.cursor, this.started = false, this.loading = false, this.failed = false});

  final List<CreditEntry> rows;

  /// The cursor for the next page once at least one extra page was read. Null with [started]
  /// means the history has ended.
  final String? cursor;
  final bool started;
  final bool loading;
  final bool failed;

  CreditsMoreState copyWith({List<CreditEntry>? rows, String? cursor, bool? started, bool? loading, bool? failed}) => CreditsMoreState(
        rows: rows ?? this.rows,
        cursor: started == true ? cursor : (cursor ?? this.cursor),
        started: started ?? this.started,
        loading: loading ?? this.loading,
        failed: failed ?? this.failed,
      );
}

class CreditsMore extends Notifier<CreditsMoreState> {
  @override
  CreditsMoreState build() {
    // A new first page (a refresh, another account) starts the extra pages over.
    ref.watch(meCreditsProvider.select((s) => s.fetchedAt));
    return const CreditsMoreState();
  }

  /// The cursor the next page would use, or null when there is no next page.
  String? get nextCursor => state.started ? state.cursor : ref.read(meCreditsProvider).value?.nextCursor;

  bool get hasMore => nextCursor != null;

  Future<void> loadMore() async {
    final cursor = nextCursor;
    if (cursor == null || state.loading) return;
    state = state.copyWith(loading: true, failed: false);
    try {
      final response = await ref.read(apiClientProvider).get('/api/me/credits', query: {'cursor': cursor});
      final page = CreditsPage.fromJson(asJson(response.data));
      if (!ref.mounted) return;
      state = CreditsMoreState(rows: [...state.rows, ...page.rows], cursor: page.nextCursor, started: true);
    } on ApiError {
      if (ref.mounted) state = state.copyWith(loading: false, failed: true);
    } on Object {
      if (ref.mounted) state = state.copyWith(loading: false, failed: true);
    }
  }
}

final creditsMoreProvider = NotifierProvider<CreditsMore, CreditsMoreState>(CreditsMore.new);
