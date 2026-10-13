// `GET /api/me/bests`: best and latest marks per comparable format (same subject, mode, question
// count and scoring version, first unassisted exposure only). There is no core model for it, so
// this feature reads it with the core `JsonRemoteNotifier` (cache, stale state, refresh).
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_providers.dart';
import '../../../core/models/attempt.dart';
import '../../../core/models/json_helpers.dart';
import '../../../core/repositories/attempts_repository.dart';
import '../../../core/repositories/json_remote_notifier.dart';
import '../../../core/repositories/remote_state.dart';

class BestMark {
  const BestMark({required this.marks, required this.max, required this.attemptId, this.completedAt});

  factory BestMark.fromJson(Json j) => BestMark(
        marks: asInt(j['marks']) ?? 0,
        max: asInt(j['max']) ?? 0,
        attemptId: asStringOr(j['attemptId'], ''),
        completedAt: asDate(j['completedAt']),
      );

  final int marks;

  /// The denominator: question count times 5.
  final int max;
  final String attemptId;
  final DateTime? completedAt;
}

class PersonalBest {
  const PersonalBest({
    required this.formatId,
    required this.subject,
    required this.mode,
    required this.attempts,
    required this.best,
    required this.latest,
  });

  factory PersonalBest.fromJson(Json j) => PersonalBest(
        formatId: asStringOr(j['formatId'], ''),
        subject: asStringOr(j['subject'], ''),
        mode: asStringOr(j['mode'], ''),
        attempts: asInt(j['attempts']) ?? 1,
        best: BestMark.fromJson(asJson(j['best'])),
        latest: BestMark.fromJson(asJson(j['latest'])),
      );

  /// `mode:subject:q<count>:<scoringVersion>`.
  final String formatId;
  final String subject;
  final String mode;
  final int attempts;
  final BestMark best;
  final BestMark latest;

  bool get isMock => mode == 'full' || mode == 'nta';

  /// The question count from the format id, or the marks denominator divided by 5.
  int get questions {
    final m = RegExp(r':q(\d+):').firstMatch(formatId);
    return m != null ? int.parse(m.group(1)!) : (best.max ~/ 5);
  }
}

/// Which scored attempts are on the phone: their number and the newest id. It changes when a
/// session is submitted or a list read brings a new attempt, and then the bests are read again.
(int, String?)? _attemptsSignature(RemoteState<List<Attempt>> s) {
  final list = s.value;
  if (list == null) return null;
  return (list.length, list.isEmpty ? null : list.first.id);
}

class BestsRepository extends JsonRemoteNotifier<List<PersonalBest>> {
  @override
  RemoteState<List<PersonalBest>> build() {
    final initial = super.build();
    // A new scored attempt can change a best or the latest marks, or add a format. The attempts
    // list is kept by Today for the whole session; it is followed only once it exists, so
    // reading the bests never starts an attempts read of its own.
    if (userId != null && ref.exists(attemptsRepositoryProvider)) {
      ref.listen<(int, String?)?>(attemptsRepositoryProvider.select(_attemptsSignature), (prev, next) {
        if (prev != null && next != null && next != prev) refresh(force: true);
      });
    }
    return initial;
  }

  @override
  String get cacheKey => 'bests';

  @override
  List<PersonalBest> parse(Object? json) => [for (final b in asJsonList(asJson(json)['bests'])) PersonalBest.fromJson(b)];

  @override
  Future<Object?> fetchJson() async => (await ref.read(apiClientProvider).get('/api/me/bests')).data;
}

final bestsRepositoryProvider = NotifierProvider<BestsRepository, RemoteState<List<PersonalBest>>>(BestsRepository.new);

/// The mock formats that have a comparable id. The You hub shows its Personal bests row only
/// while this is non-empty (spec 5.11: hidden when the server returns no format id).
final bestMocksProvider = Provider<List<PersonalBest>>((ref) {
  final all = ref.watch(bestsRepositoryProvider).value ?? const [];
  return [for (final b in all) if (b.isMock && b.formatId.isNotEmpty) b];
});
