import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/storage/prefs_store.dart';
import '../../../core/repositories/local_scope.dart' show userIdProvider;
import 'reminder_store.dart' show reminderPrefsStoreProvider;

/// The history of the reminders invitation on You: how many times the student said Not now (or
/// Android said no), when the last one was, and the last day the invitation was on screen. The
/// last day is what keeps the post-result sheet away on the same day.
class InviteHistory {
  const InviteHistory({this.declinedAsks = 0, this.lastDeclinedAt, this.shownOn});

  final int declinedAsks;
  final DateTime? lastDeclinedAt;

  /// The last calendar day the invitation was shown, as a date at local midnight.
  final DateTime? shownOn;

  InviteHistory copyWith({int? declinedAsks, DateTime? lastDeclinedAt, DateTime? shownOn}) => InviteHistory(
    declinedAsks: declinedAsks ?? this.declinedAsks,
    lastDeclinedAt: lastDeclinedAt ?? this.lastDeclinedAt,
    shownOn: shownOn ?? this.shownOn,
  );

  String toJsonString() => jsonEncode({
    'asks': declinedAsks,
    'declinedAt': lastDeclinedAt?.millisecondsSinceEpoch,
    'shownOn': shownOn?.millisecondsSinceEpoch,
  });

  /// A text that cannot be read is an empty history: the invitation then starts again, which is
  /// the safe side (a student is invited, never silently skipped forever).
  static InviteHistory fromJsonString(String? raw) {
    if (raw == null || raw.isEmpty) return const InviteHistory();
    try {
      final j = jsonDecode(raw);
      if (j is! Map) return const InviteHistory();
      DateTime? at(Object? v) => v is int ? DateTime.fromMillisecondsSinceEpoch(v) : null;
      final asks = j['asks'];
      return InviteHistory(
        declinedAsks: asks is int && asks > 0 ? asks : 0,
        lastDeclinedAt: at(j['declinedAt']),
        shownOn: at(j['shownOn']),
      );
    } on Object {
      return const InviteHistory();
    }
  }
}

/// Keeps one student's [InviteHistory] on this phone. Writes are serialised.
class InviteStore {
  InviteStore(this._prefs, {required this.userId});

  final PrefsStore _prefs;
  final String? userId;
  Future<void> _queue = Future<void>.value();

  String get _key => 'notif_you_invite_${userId ?? 'none'}';

  Future<InviteHistory> load() async {
    if (userId == null) return const InviteHistory();
    return InviteHistory.fromJsonString(await _prefs.getString(_key));
  }

  Future<InviteHistory> _update(InviteHistory Function(InviteHistory) change) {
    final done = Future<InviteHistory>.sync(() async {
      await _queue;
      final next = change(await load());
      if (userId != null) await _prefs.setString(_key, next.toJsonString());
      return next;
    });
    _queue = done.then((_) {}, onError: (Object _) {});
    return done;
  }

  /// One Not now, or one refusal from Android: the count and the time.
  Future<InviteHistory> recordDeclined(DateTime now) =>
      _update((h) => h.copyWith(declinedAsks: h.declinedAsks + 1, lastDeclinedAt: now));

  /// The invitation was on screen on [now]'s day.
  Future<InviteHistory> markShown(DateTime now) =>
      _update((h) => h.copyWith(shownOn: DateTime(now.year, now.month, now.day)));
}

final inviteStoreProvider = Provider<InviteStore>(
  (ref) => InviteStore(ref.watch(reminderPrefsStoreProvider), userId: ref.watch(userIdProvider)),
);
