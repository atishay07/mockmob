import 'dart:async';
import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/storage/prefs_store.dart';
import 'mistake_index.dart';

/// How one chapter's open count changed since the student last looked at Review.
class ChapterChange {
  const ChapterChange({required this.from, required this.to});

  /// The open count at the last look, or null when the chapter was not on Review then.
  final int? from;
  final int to;

  bool get isNew => from == null;
  int get delta => to - (from ?? 0);

  @override
  bool operator ==(Object other) => other is ChapterChange && other.from == from && other.to == to;

  @override
  int get hashCode => Object.hash(from, to);

  @override
  String toString() => 'ChapterChange($from -> $to)';
}

/// The map key of a chapter: subject and chapter, as the map keys its rows.
String chapterSeenKey(ChapterGroup g) => '${g.subjectId}|${g.chapter}';

/// Each chapter's open count, as Review shows it now.
Map<String, int> openCountsOf(Iterable<ChapterGroup> groups) => {for (final g in groups) chapterSeenKey(g): g.openCount};

/// What changed between the last look ([previous]) and [now]. The first look ever (null) is the
/// baseline and marks nothing; a chapter whose count is the same marks nothing; a chapter new
/// since then is marked only when it has something open. Only what the two records say: nothing
/// is guessed.
Map<String, ChapterChange> compareReviewSeen(Map<String, int>? previous, Map<String, int> now) {
  if (previous == null) return const {};
  final out = <String, ChapterChange>{};
  now.forEach((key, to) {
    final from = previous[key];
    if (from == null) {
      if (to > 0) out[key] = ChapterChange(from: null, to: to);
    } else if (from != to) {
      out[key] = ChapterChange(from: from, to: to);
    }
  });
  return out;
}

/// The stored form: a small JSON map of chapter key to open count.
String encodeReviewSeen(Map<String, int> counts) => jsonEncode(counts);

/// Reads the stored form, or null when it is missing or unreadable.
Map<String, int>? decodeReviewSeen(String? raw) {
  if (raw == null || raw.isEmpty) return null;
  try {
    final parsed = jsonDecode(raw);
    if (parsed is! Map) return null;
    final out = <String, int>{};
    parsed.forEach((k, v) {
      if (k is String && v is int) out[k] = v;
    });
    return out;
  } on Object {
    return null;
  }
}

/// Where the last look is kept: this phone's preferences. Made on first use, so building the
/// provider never touches the platform (tests and goldens replace it, or get no marks).
final reviewSeenStoreProvider = Provider<PrefsStore?>((ref) => null);

/// What the student last saw on Review, per chapter, kept on this phone (the website keeps the
/// same in its browser storage). [look] compares Review now with the last look and records this
/// one, so a change is marked once and nothing moves when nothing changed.
class ReviewSeen extends Notifier<bool> {
  static const storageKey = 'review.seen.v1';

  Map<String, int>? _last;
  PrefsStore? _store;

  /// True once the last look has been read (or could not be).
  @override
  bool build() {
    unawaited(_load());
    return false;
  }

  PrefsStore? _storeOrNull() {
    try {
      return _store ??= ref.read(reviewSeenStoreProvider) ?? SharedPrefsStore();
    } on Object {
      return null;
    }
  }

  Future<void> _load() async {
    try {
      _last = decodeReviewSeen(await _storeOrNull()?.getString(storageKey));
    } on Object {
      _last = null;
    }
    if (ref.mounted) state = true;
  }

  /// Compares [now] with the last look and records [now] as the last look. Empty until the last
  /// look has been read (nothing is marked on a guess).
  Map<String, ChapterChange> look(Map<String, int> now) {
    if (!state) return const {};
    final changes = compareReviewSeen(_last, now);
    final same = _last != null && _last!.length == now.length && now.entries.every((e) => _last![e.key] == e.value);
    if (!same) {
      _last = Map.of(now);
      unawaited(_save(now));
    }
    return changes;
  }

  Future<void> _save(Map<String, int> now) async {
    try {
      await _storeOrNull()?.setString(storageKey, encodeReviewSeen(now));
    } on Object {
      // This look is not remembered; Review still works and the next look compares with the last.
    }
  }
}

final reviewSeenProvider = NotifierProvider<ReviewSeen, bool>(ReviewSeen.new);
