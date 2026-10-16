import 'dart:async';
import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_state.dart';
import '../storage/prefs_store.dart';

/// The features the app introduces at the moment they are useful (F18), each as one inline note in
/// the place the student already is: never a tour, never a popup, never a checklist.
enum FeatureNote {
  /// After the first repair: Revise brings the mistake back.
  revise('revise'),

  /// After the first mock: the Mistake Lab on its result.
  lab('lab'),

  /// Inside a question review: Ask Mobi about that question.
  askMobi('ask_mobi'),

  /// After the first full mock, once there is a score: Colleges and Compass.
  colleges('colleges');

  const FeatureNote(this.id);

  final String id;
}

/// What the phone remembers about the notes, for one student: the ones they dealt with (used the
/// feature, or said "Got it") and how many times each has been on screen.
class FeatureNotesState {
  const FeatureNotesState({this.loaded = false, this.done = const {}, this.shown = const {}});

  /// True once the stored state has been read (or could not be). Nothing shows before: a note that
  /// was already dealt with never flashes up and goes.
  final bool loaded;
  final Set<String> done;
  final Map<String, int> shown;

  /// A note shows until the student deals with it, and never more than [maxShows] times: a note
  /// that was ignored three times has said what it had to say.
  static const int maxShows = 3;

  bool visible(FeatureNote note) => loaded && !done.contains(note.id) && (shown[note.id] ?? 0) < maxShows;

  FeatureNotesState copyWith({bool? loaded, Set<String>? done, Map<String, int>? shown}) =>
      FeatureNotesState(loaded: loaded ?? this.loaded, done: done ?? this.done, shown: shown ?? this.shown);
}

/// Where the notes are kept: this phone's preferences. Made on first use, so building the provider
/// never touches the platform (tests replace it).
final featureNotesStoreProvider = Provider<PrefsStore?>((ref) => null);

/// The notes' memory. [impression] counts one showing, [done] closes a note for good.
class FeatureNotes extends Notifier<FeatureNotesState> {
  static String storageKey(String? userId) => 'notes.v1.${userId ?? 'guest'}';

  PrefsStore? _store;
  String _key = storageKey(null);

  /// Notes closed before the memory was read (the student opened the feature at once): applied
  /// the moment it has been.
  final Set<String> _early = {};

  @override
  FeatureNotesState build() {
    // Another student on this phone has their own notes.
    final userId = ref.watch(authSnapshotProvider.select((s) => s.userId));
    _key = storageKey(userId);
    unawaited(_load(_key));
    return const FeatureNotesState();
  }

  PrefsStore? _storeOrNull() {
    try {
      return _store ??= ref.read(featureNotesStoreProvider) ?? SharedPrefsStore();
    } on Object {
      return null;
    }
  }

  Future<void> _load(String key) async {
    var done = <String>{};
    var shown = <String, int>{};
    try {
      final raw = await _storeOrNull()?.getString(key);
      if (raw != null && raw.isNotEmpty) {
        final parsed = jsonDecode(raw);
        if (parsed is Map) {
          final d = parsed['done'];
          if (d is List) done = {for (final v in d) if (v is String) v};
          final s = parsed['shown'];
          if (s is Map) {
            s.forEach((k, v) {
              if (k is String && v is int) shown[k] = v;
            });
          }
        }
      }
    } on Object {
      // Unreadable: the notes start over, which is only a note shown again.
    }
    if (!ref.mounted || key != _key) return;
    final hadEarly = _early.isNotEmpty;
    done = {...done, ..._early};
    _early.clear();
    state = FeatureNotesState(loaded: true, done: done, shown: shown);
    if (hadEarly) unawaited(_save());
  }

  /// One showing of [note] (the first time its widget is on screen).
  void impression(FeatureNote note) {
    if (!state.loaded) return;
    final shown = {...state.shown, note.id: (state.shown[note.id] ?? 0) + 1};
    state = state.copyWith(shown: shown);
    unawaited(_save());
  }

  /// The student dealt with [note]: they used the feature, or dismissed the note.
  void done(FeatureNote note) {
    if (!state.loaded) {
      _early.add(note.id);
      return;
    }
    if (state.done.contains(note.id)) return;
    state = state.copyWith(done: {...state.done, note.id});
    unawaited(_save());
  }

  Future<void> _save() async {
    try {
      await _storeOrNull()?.setString(_key, jsonEncode({'done': state.done.toList()..sort(), 'shown': state.shown}));
    } on Object {
      // Not remembered: the note may show once more, nothing else.
    }
  }
}

final featureNotesProvider = NotifierProvider<FeatureNotes, FeatureNotesState>(FeatureNotes.new);
