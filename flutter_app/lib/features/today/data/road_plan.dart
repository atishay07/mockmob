// The student's own road (the Road to May): the exam day they aim for and how many full mocks
// they want behind them. Owner decision Q4 (17 Oct): both belong on the account, so the website
// shows the same road. The server fields (`examDate`, `mockTarget` on `/api/study/preferences`,
// TODAY-1017 P0) are built by the website track; this store feature-detects them:
//
// * Always: the choice is kept on this phone, per account, in the same store as the rhythm
//   choices. That is the whole store until the server has the fields, and the offline cache after.
// * When the preferences read answers `state: ready` and carries either field, the account wins on
//   read (the phone copy is refreshed from it) and every change is written to the account too,
//   naming the revision it read. A failed account write throws, so the road says it did not save;
//   the phone keeps the choice for the next try.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api.dart';
import '../../../core/models/json_helpers.dart';
import '../../../core/repositories/local_scope.dart';
import '../../rhythm/data/rhythm_prefs.dart' show rhythmPrefsStoreProvider;
import '../logic/road_board.dart';

/// The account endpoint that holds the road once the server has the fields.
const String roadPreferencesPath = '/api/study/preferences';

class RoadPlanStore extends Notifier<RoadPlan> {
  /// Bumped on every rebuild (an account switch): a read that began for the previous account
  /// never fills the new one.
  int _generation = 0;

  /// A choice made while the stored plan was still being read wins over the read.
  bool _touched = false;

  /// The account holds the road (the preferences read carried the fields), with the revision read.
  bool _onAccount = false;
  int _revision = 0;

  static String _key(String? user, String name) => 'road_${name}_${user ?? 'none'}';

  @override
  RoadPlan build() {
    ref.watch(userIdProvider);
    _generation++;
    _touched = false;
    _onAccount = false;
    final generation = _generation;
    scheduleMicrotask(() => _load(generation));
    return const RoadPlan();
  }

  static DateTime? _parseDay(String? s) {
    final parsed = s == null ? null : DateTime.tryParse(s);
    return parsed == null ? null : DateTime.utc(parsed.year, parsed.month, parsed.day);
  }

  static String _iso(DateTime day) {
    final m = day.month.toString().padLeft(2, '0'), d = day.day.toString().padLeft(2, '0');
    return '${day.year}-$m-$d';
  }

  Future<void> _load(int generation) async {
    try {
      final store = ref.read(rhythmPrefsStoreProvider);
      final user = ref.read(userIdProvider);
      final date = await store.getString(_key(user, 'exam_date'));
      final target = await store.getInt(_key(user, 'mock_target'));
      if (!ref.mounted || generation != _generation || _touched) return;
      state = RoadPlan(examDate: _parseDay(date), mockTarget: target);
    } on Object {
      // Nothing stored, or unreadable: the expected window and no target.
    }
    await _readAccount(generation);
  }

  /// The account's road, when the server has the fields; otherwise nothing changes.
  Future<void> _readAccount(int generation) async {
    final user = ref.read(userIdProvider);
    if (user == null) return;
    try {
      final body = (await ref.read(apiClientProvider).get(roadPreferencesPath, expectUserId: user)).map;
      if (asString(body['state']) != 'ready') return;
      final hasDate = body.containsKey('examDate') || body.containsKey('exam_date');
      final hasTarget = body.containsKey('mockTarget') || body.containsKey('mock_target');
      if (!hasDate && !hasTarget) return;
      if (!ref.mounted || generation != _generation) return;
      _onAccount = true;
      _revision = asInt(body['revision']) ?? 0;
      if (_touched) return;
      final day = _parseDay(asString(body['examDate'] ?? body['exam_date']));
      final target = asInt(body['mockTarget'] ?? body['mock_target']);
      state = RoadPlan(examDate: day, mockTarget: target);
      await _keepOnPhone(user, day, target);
    } on Object {
      // Offline, refused or not built yet: the phone's copy stands.
    }
  }

  Future<void> _keepOnPhone(String? user, DateTime? day, int? target) async {
    final store = ref.read(rhythmPrefsStoreProvider);
    final dateKey = _key(user, 'exam_date'), targetKey = _key(user, 'mock_target');
    if (day == null) {
      await store.remove(dateKey);
    } else {
      await store.setString(dateKey, _iso(day));
    }
    if (target == null) {
      await store.remove(targetKey);
    } else {
      await store.setInt(targetKey, target);
    }
  }

  /// Writes the road to the account when it holds it. A 409 (another device wrote first) reads
  /// the revision again and retries once.
  Future<void> _writeAccount(Map<String, Object?> fields) async {
    if (!_onAccount) return;
    final user = ref.read(userIdProvider);
    final api = ref.read(apiClientProvider);
    for (var attempt = 0; ; attempt++) {
      try {
        await api.put(roadPreferencesPath, body: {...fields, 'expectedRevision': _revision}, expectUserId: user);
        _revision++;
        return;
      } on ApiError catch (e) {
        if (e.kind != ApiErrorKind.conflict || attempt > 0) rethrow;
        final body = (await api.get(roadPreferencesPath, expectUserId: user)).map;
        _revision = asInt(body['revision']) ?? _revision;
      }
    }
  }

  /// The day the student aims for, or null to count to the expected window again.
  Future<void> setExamDate(DateTime? date) async {
    _touched = true;
    final day = date == null ? null : DateTime.utc(date.year, date.month, date.day);
    state = day == null ? state.copyWith(clearDate: true) : state.copyWith(examDate: day);
    final store = ref.read(rhythmPrefsStoreProvider);
    final key = _key(ref.read(userIdProvider), 'exam_date');
    if (day == null) {
      await store.remove(key);
    } else {
      await store.setString(key, _iso(day));
    }
    await _writeAccount({'examDate': day == null ? null : _iso(day)});
  }

  /// How many full mocks the student wants before the exam, or null to clear it.
  Future<void> setMockTarget(int? target) async {
    _touched = true;
    state = target == null ? state.copyWith(clearTarget: true) : state.copyWith(mockTarget: target.clamp(mockTargetMin, mockTargetMax));
    final store = ref.read(rhythmPrefsStoreProvider);
    final key = _key(ref.read(userIdProvider), 'mock_target');
    if (target == null) {
      await store.remove(key);
    } else {
      await store.setInt(key, state.mockTarget!);
    }
    await _writeAccount({'mockTarget': state.mockTarget});
  }
}

final roadPlanProvider = NotifierProvider<RoadPlanStore, RoadPlan>(RoadPlanStore.new);
