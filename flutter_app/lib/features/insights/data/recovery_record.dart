import 'dart:convert';
import 'dart:isolate';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/api_error.dart';
import '../../../core/api/api_providers.dart';
import '../../../core/models/json_helpers.dart';
import '../../../core/repositories/json_remote_notifier.dart';
import '../../../core/repositories/remote_state.dart';

/// One concept check as the server reports it: a delayed, fresh-question check and what it can
/// and cannot show.
class ConceptCheck {
  const ConceptCheck({required this.concept, required this.evidenceLabel, this.state = '', this.sampleSize = 0});

  factory ConceptCheck.fromJson(Json j) => ConceptCheck(
        concept: asStringOr(j['concept'], '').trim(),
        state: asStringOr(j['state'], ''),
        sampleSize: asInt(j['sampleSize']) ?? 0,
        evidenceLabel: asStringOr(j['evidenceLabel'], '').trim(),
      );

  final String concept;
  final String state;
  final int sampleSize;
  final String evidenceLabel;

  Json toJson() => {'concept': concept, 'state': state, 'sampleSize': sampleSize, 'evidenceLabel': evidenceLabel};
}

/// A strategy and the reason the student saved from a result (`POST /api/recovery`).
class PlaybookEntry {
  const PlaybookEntry({required this.id, required this.strategy, this.attemptId, this.reflection = '', this.savedAt});

  factory PlaybookEntry.fromJson(Json j) => PlaybookEntry(
        id: asString(j['id']) ?? '',
        attemptId: asString(j['attempt_id'] ?? j['attemptId']),
        strategy: asStringOr(j['strategy'], ''),
        reflection: asStringOr(j['reflection'], '').trim(),
        savedAt: asDate(j['created_at'] ?? j['savedAt']),
      );

  final String id;

  /// The session the note was written about, when the server still holds it.
  final String? attemptId;

  /// `two_pass`, `concept_repair` or `timed_practice`.
  final String strategy;
  final String reflection;
  final DateTime? savedAt;

  /// Sentence-case name of the strategy. An id this build does not know is shown plainly, with
  /// its underscores read as spaces, never hidden.
  String get strategyLabel => switch (strategy) {
        'two_pass' => 'Two-pass approach',
        'concept_repair' => 'Concept repair',
        'timed_practice' => 'Timed practice',
        _ => _sentence(strategy),
      };

  Json toJson() => {
        'id': id,
        'attempt_id': attemptId,
        'strategy': strategy,
        'reflection': reflection,
        'created_at': savedAt?.toUtc().toIso8601String(),
      };
}

String _sentence(String id) {
  final t = id.replaceAll('_', ' ').trim();
  return t.isEmpty ? 'Strategy' : '${t[0].toUpperCase()}${t.substring(1)}';
}

/// What `GET /api/recovery` holds for the Progress surface: concept checks and the playbook.
/// The server also sends every attempt with its questions; none of that is read or kept.
class RecoveryRecord {
  const RecoveryRecord({this.checks = const [], this.playbook = const [], this.playbookAvailable = true});

  factory RecoveryRecord.fromJson(Object? json) {
    final j = asJson(json);
    return RecoveryRecord(
      checks: [for (final c in asJsonList(j['progress'])) ConceptCheck.fromJson(c)].where((c) => c.concept.isNotEmpty).toList(growable: false),
      playbook: [for (final p in asJsonList(j['playbook'])) PlaybookEntry.fromJson(p)].where((p) => p.strategy.isNotEmpty).toList(growable: false),
      playbookAvailable: j['playbookState'] != 'unavailable',
    );
  }

  final List<ConceptCheck> checks;
  final List<PlaybookEntry> playbook;

  /// False when the server said the playbook table could not be read (not the same as empty).
  final bool playbookAvailable;

  /// The slim copy kept for offline reading, in the server's own field names.
  Json toJson() => {
        'progress': [for (final c in checks) c.toJson()],
        'playbook': [for (final p in playbook) p.toJson()],
        'playbookState': playbookAvailable ? 'ready' : 'unavailable',
      };
}

/// Payloads above this are decoded off the main isolate (the response holds every attempt).
const _isolateThresholdChars = 50000;

RecoveryRecord _parseBody(String body) => RecoveryRecord.fromJson(jsonDecode(body));

/// `GET /api/recovery`, read only when the record page opens or is pulled to refresh. It is
/// heavy on the server, so it is decoded in an isolate and only the slim result is cached.
class RecoveryRecordRepository extends JsonRemoteNotifier<RecoveryRecord> {
  @override
  String get cacheKey => 'recovery-record';

  @override
  RecoveryRecord parse(Object? json) => RecoveryRecord.fromJson(json);

  @override
  Future<Object?> fetchJson() async => throw UnimplementedError('fetchRemote reads the body itself');

  @override
  Future<Fetched<RecoveryRecord>> fetchRemote() async {
    final ApiClient api = ref.read(apiClientProvider);
    final response = await api.get('/api/recovery', options: const ApiOptions(plainBody: true, receiveTimeout: Duration(seconds: 60)));
    final data = response.data;
    try {
      // Text is decoded off the main isolate when it is big (the body holds every attempt).
      final record = data is! String
          ? RecoveryRecord.fromJson(data)
          : data.length > _isolateThresholdChars
              ? await Isolate.run(() => _parseBody(data))
              : _parseBody(data);
      return Fetched(record, record.toJson());
    } on Object {
      throw const ApiError(kind: ApiErrorKind.unknown, code: 'unusable_response');
    }
  }
}

final recoveryRecordRepositoryProvider =
    NotifierProvider<RecoveryRecordRepository, RemoteState<RecoveryRecord>>(RecoveryRecordRepository.new);
