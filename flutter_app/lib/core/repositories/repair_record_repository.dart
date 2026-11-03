import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_providers.dart';
import '../models/repair_record.dart';
import 'json_remote_notifier.dart';
import 'remote_state.dart';
import 'repair_local_repository.dart';

/// `GET /api/me/repair-record?limit=100` (read only): the repairs the server holds for the signed-in
/// student, newest first, from any device. Cached per account like the other reads, so the
/// record shows offline with its time. Never written to: the phone's own `repair_local` rows
/// stay the only thing the app writes, and [mergeRepairRecords] puts the two side by side.
///
/// The server reads at most its latest 300 attempts and 100 rows, so a missing row is NOT proof
/// that a repair was never stored: that is why local rows are never dropped by this read.
class RepairRecordRepository extends JsonRemoteNotifier<List<ServerRepair>> {
  /// The route's own maximum (it clamps anything higher).
  static const limit = 100;

  @override
  String get cacheKey => 'repair-record';

  @override
  List<ServerRepair> parse(Object? json) => parseRepairRecord(json);

  /// The decoded body exactly as dio hands it back (a Map for this route), cached as is.
  @override
  Future<Object?> fetchJson() async =>
      (await ref.read(apiClientProvider).get('/api/me/repair-record', query: {'limit': limit}, expectUserId: userId)).data;
}

final repairRecordRepositoryProvider = NotifierProvider<RepairRecordRepository, RemoteState<List<ServerRepair>>>(RepairRecordRepository.new);

/// Which side a merged row came from.
enum RepairRecordSource {
  /// Only the server has it (done on another device, or before this install).
  server,

  /// Both have it: the server's row decided the time.
  both,

  /// Only this phone has it: not (yet) in the server's record. Kept as is.
  phone,
}

/// One mistake of the merged repair record: the phone's row, the server's row, or both joined.
class RepairRecordEntry {
  const RepairRecordEntry({
    required this.attemptId,
    required this.questionId,
    required this.status,
    required this.requestId,
    required this.source,
    this.ackedAt,
    this.chapter,
    this.subject,
    this.foundAt,
    this.checkedState = RepairCheckedState.notAvailable,
    this.retriedAt,
  });

  final String attemptId;
  final String questionId;

  /// A [RepairLocalStatus] word. A row the server holds reads `stored`.
  final String status;

  /// The phone's request id; empty for a repair only the server knows (it is never sent again).
  final String requestId;
  final RepairRecordSource source;

  /// The server acknowledgement time (the server's own time when it holds the row).
  final DateTime? ackedAt;

  /// From the server only; null for a phone-only row.
  final String? chapter;
  final String? subject;
  final DateTime? foundAt;
  final RepairCheckedState checkedState;
  final DateTime? retriedAt;

  String get key => '$attemptId/$questionId';
  bool get isRepaired => RepairLocalStatus.repaired.contains(status);
  bool get isOnServer => source != RepairRecordSource.phone;

  /// A repaired row the server does not list: it stays on this phone until the server's record has it.
  bool get waitsForSync => source == RepairRecordSource.phone && isRepaired;

  /// The shape Review, Today, the notifications and the result screens already read.
  RepairLocalRecord toLocalRecord() =>
      RepairLocalRecord(attemptId: attemptId, questionId: questionId, requestId: requestId, status: status, ackedAt: ackedAt);
}

/// Joins the phone's repair rows with the server's record, one row per mistake.
///
/// - The same mistake (`attemptId/questionId`) in both: the server wins. The row reads `stored`
///   with the server's `repairedAt` as its time, whatever the phone held (a `pending` retry, a
///   local review, a held answer), because the server has the repair on file. The phone's request
///   id is kept so a later call for it stays the same call.
/// - Only on the server: kept (a repair made on another device).
/// - Only on the phone: kept untouched, repaired or not (`pending`, `held_for_recheck`, a local
///   review), until the server's record has it. A read that came back without it never removes it.
///
/// Newest acknowledgement first; rows with no time last, in a stable order.
List<RepairRecordEntry> mergeRepairRecords({required List<RepairLocalRecord> local, required List<ServerRepair> server}) {
  final byKey = <String, RepairRecordEntry>{};
  for (final r in local) {
    byKey['${r.attemptId}/${r.questionId}'] = RepairRecordEntry(
      attemptId: r.attemptId,
      questionId: r.questionId,
      status: r.status,
      requestId: r.requestId,
      source: RepairRecordSource.phone,
      ackedAt: r.ackedAt,
    );
  }
  for (final s in server) {
    final mine = byKey[s.key];
    byKey[s.key] = RepairRecordEntry(
      attemptId: s.attemptId,
      questionId: s.questionId,
      status: RepairLocalStatus.stored,
      requestId: mine?.requestId ?? '',
      source: mine == null ? RepairRecordSource.server : RepairRecordSource.both,
      ackedAt: s.repairedAt,
      chapter: s.chapter,
      subject: s.subject,
      foundAt: s.foundAt,
      checkedState: s.checkedState,
      retriedAt: s.retriedAt,
    );
  }
  final rows = byKey.values.toList();
  // List.sort is not stable, so ties and missing times fall back to the key.
  rows.sort((a, b) {
    final x = a.ackedAt, y = b.ackedAt;
    if (x != null && y != null) {
      final c = y.compareTo(x);
      if (c != 0) return c;
    } else if (x != null) {
      return -1;
    } else if (y != null) {
      return 1;
    }
    return a.key.compareTo(b.key);
  });
  return rows;
}

/// The phone's rows and the server's record, joined (see [mergeRepairRecords]). Shows the phone's
/// rows alone while the server read is loading, offline with nothing cached, or failed, and the
/// server's rows alone before the local table has answered. Never throws and never blocks.
final repairRecordEntriesProvider = Provider<List<RepairRecordEntry>>((ref) {
  final local = ref.watch(repairLocalRecordsProvider).value ?? const <RepairLocalRecord>[];
  final server = ref.watch(repairRecordRepositoryProvider).value ?? const <ServerRepair>[];
  return mergeRepairRecords(local: local, server: server);
});

/// The merged record in the shape every existing reader takes: a drop-in for
/// `ref.watch(repairLocalRecordsProvider).value ?? const []` (Review, Today, the result screens and
/// the notification builders), so a repair made on another device counts as repaired here.
final mergedRepairRecordsProvider = Provider<List<RepairLocalRecord>>((ref) => [
      for (final e in ref.watch(repairRecordEntriesProvider)) e.toLocalRecord(),
    ]);

/// The server's check state per mistake (`attemptId/questionId`), for the Lab and the repair
/// ending. A mistake the server does not list has no entry: say nothing about its check.
final repairCheckStatesProvider = Provider<Map<String, RepairCheckedState>>((ref) => {
      for (final e in ref.watch(repairRecordEntriesProvider))
        if (e.isOnServer) e.key: e.checkedState,
    });
