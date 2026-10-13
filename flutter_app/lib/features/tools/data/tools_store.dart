// The student's choices in the tools stay on this phone (as on the website, where they stay in
// the browser): Compass subjects, category and score; the Combo planner's targets and pool.

import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/storage/prefs_store.dart';

class SavedCompass {
  const SavedCompass({required this.subjects, this.category = 'UR', this.score = ''});

  /// Comma-separated ids in the website's `?s=` form.
  final String subjects;
  final String category;
  final String score;
}

class SavedCombo {
  const SavedCombo({this.targets = const [], this.pool = const [], this.maxPapers = 5});

  final List<String> targets;

  /// `language:english`, `domain:accountancy`, `gat:gat`.
  final List<String> pool;
  final int maxPapers;
}

/// One DU programme at one college that the student is aiming for.
class ShortlistTarget {
  const ShortlistTarget({required this.groupId, required this.college});

  final String groupId;
  final String college;

  @override
  bool operator ==(Object other) => other is ShortlistTarget && other.groupId == groupId && other.college == college;

  @override
  int get hashCode => Object.hash(groupId, college);
}

class ToolsStore {
  ToolsStore(this._prefs);

  final PrefsStore _prefs;

  static const _compass = 'mm.tools.compass.v1';
  static const _combo = 'mm.tools.combo.v1';
  static const _hubSeen = 'mm.tools.hub.seen.v1';

  Future<Map<String, dynamic>?> _read(String key) async {
    try {
      final raw = await _prefs.getString(key);
      if (raw == null) return null;
      final v = jsonDecode(raw);
      return v is Map ? v.cast<String, dynamic>() : null;
    } on Object {
      return null;
    }
  }

  Future<void> _write(String key, Map<String, Object?> value) async {
    try {
      await _prefs.setString(key, jsonEncode(value));
    } on Object {
      // Storage refused: the tool still works for this visit.
    }
  }

  Future<SavedCompass?> compass() async {
    final m = await _read(_compass);
    if (m == null || m['s'] is! String) return null;
    return SavedCompass(
      subjects: m['s'] as String,
      category: m['c'] is String ? m['c'] as String : 'UR',
      score: m['score'] is String ? m['score'] as String : '',
    );
  }

  Future<void> saveCompass(SavedCompass v) => _write(_compass, {'s': v.subjects, 'c': v.category, 'score': v.score});

  Future<SavedCombo?> combo() async {
    final m = await _read(_combo);
    if (m == null) return null;
    List<String> strings(Object? v) => v is List ? [for (final e in v) if (e is String) e] : const [];
    final max = m['maxPapers'];
    return SavedCombo(
      targets: strings(m['targets']),
      pool: strings(m['pool']),
      maxPapers: max is int && max >= 3 && max <= 5 ? max : 5,
    );
  }

  Future<void> saveCombo(SavedCombo v) =>
      _write(_combo, {'targets': v.targets, 'pool': v.pool, 'maxPapers': v.maxPapers});

  static String _shortlistKey(String userId) => 'mm.tools.compass.shortlist.v1.$userId';

  /// The student's DU shortlist, per account, on this phone.
  Future<List<ShortlistTarget>> shortlist(String userId) async {
    try {
      final raw = await _prefs.getString(_shortlistKey(userId));
      if (raw == null) return const [];
      final v = jsonDecode(raw);
      if (v is! List) return const [];
      return [
        for (final e in v)
          if (e is Map && e['g'] is String && e['c'] is String) ShortlistTarget(groupId: e['g'] as String, college: e['c'] as String),
      ];
    } on Object {
      return const [];
    }
  }

  Future<void> saveShortlist(String userId, List<ShortlistTarget> list) async {
    try {
      await _prefs.setString(_shortlistKey(userId), jsonEncode([for (final t in list) {'g': t.groupId, 'c': t.college}]));
    } on Object {
      // Storage refused: the list lasts this visit.
    }
  }

  /// Whether the tools hub has been opened on this phone before (Mobi hops the first time only).
  Future<bool> hubSeen() async => (await _read(_hubSeen)) != null;

  Future<void> markHubSeen() => _write(_hubSeen, {'seen': true});
}

final toolsPrefsProvider = Provider<PrefsStore>((ref) => SharedPrefsStore());

final toolsStoreProvider = Provider<ToolsStore>((ref) => ToolsStore(ref.watch(toolsPrefsProvider)));
