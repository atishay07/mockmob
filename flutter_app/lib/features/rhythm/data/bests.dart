// `GET /api/me/bests`: best and latest marks per comparable format (same subject, mode, question
// count and scoring version, first unassisted exposure only). There is no core model for it, so
// this feature reads it with the core `JsonRemoteNotifier` (cache, stale state, refresh).
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_providers.dart';
import '../../../core/models/json_helpers.dart';
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

class BestsRepository extends JsonRemoteNotifier<List<PersonalBest>> {
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
