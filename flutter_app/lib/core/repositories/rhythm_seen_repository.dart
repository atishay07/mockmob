import 'dart:convert';

import 'package:drift/drift.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/json_helpers.dart';
import '../models/rhythm.dart';
import '../storage/app_database.dart';
import 'local_scope.dart';

/// The last week state seen from the server, kept to detect a week that just closed or a run
/// that ended while the endpoint returns no history (design spec 6.1). Best effort.
class LastSeenWeek {
  const LastSeenWeek({
    required this.weekStart,
    required this.studyDays,
    required this.daysGoal,
    required this.metThisWeek,
    required this.weeksMetStreak,
  });

  factory LastSeenWeek.fromRhythm(Rhythm r) => LastSeenWeek(
        weekStart: r.weekStart,
        studyDays: r.studyDays,
        daysGoal: r.daysGoal,
        metThisWeek: r.metThisWeek,
        weeksMetStreak: r.weeksMetStreak,
      );

  factory LastSeenWeek.fromJson(Json j) => LastSeenWeek(
        weekStart: asStringOr(j['weekStart'], ''),
        studyDays: asInt(j['studyDays']) ?? 0,
        daysGoal: asInt(j['daysGoal']) ?? 4,
        metThisWeek: asBool(j['metThisWeek']) ?? false,
        weeksMetStreak: asInt(j['weeksMetStreak']) ?? 0,
      );

  final String weekStart;
  final int studyDays;
  final int daysGoal;
  final bool metThisWeek;
  final int weeksMetStreak;

  Json toJson() => {
        'weekStart': weekStart,
        'studyDays': studyDays,
        'daysGoal': daysGoal,
        'metThisWeek': metThisWeek,
        'weeksMetStreak': weeksMetStreak,
      };
}

class RhythmSeenState {
  const RhythmSeenState({this.lastSeenWeek, this.lastCelebratedWeekStart, this.celebratedIds = const {}});

  final LastSeenWeek? lastSeenWeek;
  final String? lastCelebratedWeekStart;

  /// Celebration ids that already fired (milestones, `repair:<attemptId>:<requestId>`, `week:<weekStart>`).
  final Set<String> celebratedIds;
}

/// `rhythm_seen`: the local, best-effort records behind celebration ids and week-closed detection.
class RhythmSeenRepository {
  RhythmSeenRepository(this._scope);

  final LocalScope _scope;

  AppDatabase get _db => _scope.db;

  Future<RhythmSeenState> read() async {
    final row = await (_db.select(_db.rhythmSeen)..where((t) => t.userId.equals(_scope.userId))).getSingleOrNull();
    if (row == null) return const RhythmSeenState();
    LastSeenWeek? week;
    final raw = row.lastSeenWeekJson;
    if (raw != null) {
      try {
        week = LastSeenWeek.fromJson(asJson(jsonDecode(raw)));
      } on FormatException {
        week = null;
      }
    }
    Set<String> ids = {};
    try {
      ids = asStringList(jsonDecode(row.celebratedIdsJson)).toSet();
    } on FormatException {
      ids = {};
    }
    return RhythmSeenState(lastSeenWeek: week, lastCelebratedWeekStart: row.lastCelebratedWeekStart, celebratedIds: ids);
  }

  Future<void> _upsert({LastSeenWeek? week, String? celebratedWeekStart, Set<String>? ids}) async {
    final current = await read();
    final nextWeek = week ?? current.lastSeenWeek;
    await _db.into(_db.rhythmSeen).insertOnConflictUpdate(
          RhythmSeenCompanion.insert(
            userId: _scope.userId,
            lastSeenWeekJson: Value(nextWeek == null ? null : jsonEncode(nextWeek.toJson())),
            lastCelebratedWeekStart: Value(celebratedWeekStart ?? current.lastCelebratedWeekStart),
            celebratedIdsJson: Value(jsonEncode((ids ?? current.celebratedIds).toList())),
          ),
        );
  }

  /// Written after every successful rhythm read.
  Future<void> saveSeen(Rhythm rhythm) => _upsert(week: LastSeenWeek.fromRhythm(rhythm));

  Future<bool> hasCelebrated(String id) async => (await read()).celebratedIds.contains(id);

  /// Records a celebration id so it fires once. Returns false when it had already fired.
  Future<bool> markCelebrated(String id) async {
    final current = await read();
    if (current.celebratedIds.contains(id)) return false;
    await _upsert(ids: {...current.celebratedIds, id});
    return true;
  }

  Future<void> setLastCelebratedWeekStart(String weekStart) => _upsert(celebratedWeekStart: weekStart);
}

final rhythmSeenRepositoryProvider = Provider<RhythmSeenRepository>((ref) => RhythmSeenRepository(ref.watch(localScopeProvider)));
