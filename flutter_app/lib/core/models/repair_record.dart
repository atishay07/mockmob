import 'dart:convert';

import 'json_helpers.dart';

/// Where the server says a repaired mistake's "check it held" stands (`checkedState` of
/// `GET /api/me/repair-record`). `notAvailable` is also what an unknown or missing word reads as:
/// the app never claims a check it was not told about.
enum RepairCheckedState {
  pending,
  passed,
  notPassed,
  notAvailable;

  static RepairCheckedState fromWire(Object? v) => switch (v) {
        'pending' => pending,
        'passed' => passed,
        'not_passed' => notPassed,
        _ => notAvailable,
      };
}

/// One row of the server's repair record: a mistake whose explained repair was stored, on any of
/// the student's devices. The server never sends the key or the explanation here, only where the
/// mistake stands.
class ServerRepair {
  const ServerRepair({
    required this.attemptId,
    required this.questionId,
    required this.repairedAt,
    this.chapter,
    this.subject,
    this.foundAt,
    this.checkedState = RepairCheckedState.notAvailable,
    this.retriedAt,
  });

  /// One row, or null when it cannot name its mistake or says when it was repaired: a repair
  /// with no id or no time is no record, so it is left out rather than guessed.
  static ServerRepair? tryParse(Object? v) {
    if (v is! Map) return null;
    final j = asJson(v);
    final attemptId = asString(j['attemptId']);
    final questionId = asString(j['questionId']);
    final repairedAt = asDate(j['repairedAt']);
    if (attemptId == null || attemptId.isEmpty || questionId == null || questionId.isEmpty || repairedAt == null) return null;
    String? text(Object? x) {
      final s = asString(x)?.trim();
      return s == null || s.isEmpty ? null : s;
    }

    return ServerRepair(
      attemptId: attemptId,
      questionId: questionId,
      repairedAt: repairedAt,
      chapter: text(j['chapter']),
      subject: text(j['subject']),
      foundAt: asDate(j['foundAt']),
      checkedState: RepairCheckedState.fromWire(j['checkedState']),
      retriedAt: asDate(j['retriedAt']),
    );
  }

  final String attemptId;
  final String questionId;

  /// When the explained repair was stored (the server's acknowledgement).
  final DateTime repairedAt;
  final String? chapter;

  /// The attempt's internal subject id.
  final String? subject;

  /// When the paper holding this mistake was completed.
  final DateTime? foundAt;
  final RepairCheckedState checkedState;
  final DateTime? retriedAt;

  String get key => '$attemptId/$questionId';
}

/// The decoded body of `GET /api/me/repair-record`: `{ "repairs": [ ... ] }`, newest first.
///
/// [body] is whatever dio decoded: a Map for the real route, a bare List if a proxy or an older
/// build ever sends the rows alone, and a JSON string only if a response lost its content type.
/// A body that is none of these, or a Map with no `repairs` list, throws [FormatException]:
/// an empty record is `{"repairs": []}`, so a body that merely lacks the field is not "no repairs".
List<ServerRepair> parseRepairRecord(Object? body) {
  var decoded = body;
  if (decoded is String) {
    try {
      decoded = jsonDecode(decoded);
    } on FormatException {
      throw const FormatException('repair record is not JSON');
    }
  }
  final Object? rows = decoded is Map ? decoded['repairs'] : decoded;
  if (rows is! List) throw const FormatException('repair record has no repairs list');
  final seen = <String>{};
  final out = <ServerRepair>[];
  for (final row in rows) {
    final repair = ServerRepair.tryParse(row);
    // The server keeps one row per mistake; if a repeat ever arrives the first (newest) wins.
    if (repair != null && seen.add(repair.key)) out.add(repair);
  }
  return out;
}
