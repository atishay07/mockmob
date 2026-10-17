import 'session_syncer.dart';

/// The save pill of the runner (design spec 5.5, the save-state truth model).
enum SaveState {
  /// Every answer is acknowledged by the server. The only state that may say "Saved".
  saved,

  /// Answers are on their way ("Saving", with a spinner).
  saving,

  /// Some answers are on this phone and the network is not letting them through
  /// ("3 answers on this phone, waiting for network").
  waitingForNetwork,

  /// Ticket mode: the server holds nothing until submit, so the pill reads "On this phone".
  onThisPhone,

  /// The server refused the answers it was sent and will not be asked again by itself:
  /// "Not saved yet. Tap to retry." The answers are still on this phone.
  notSaved,
}

class SaveSnapshot {
  const SaveSnapshot({required this.state, this.unsyncedAnswers = 0, this.lastAckAt});

  final SaveState state;

  /// Questions with an answer change the server has not acknowledged (the hollow dots).
  final int unsyncedAnswers;

  /// When the server last acknowledged (device clock), for "Saved to your account at 10:03 PM".
  final DateTime? lastAckAt;

  static const initial = SaveSnapshot(state: SaveState.saved);

  @override
  bool operator ==(Object other) =>
      other is SaveSnapshot && other.state == state && other.unsyncedAnswers == unsyncedAnswers && other.lastAckAt == lastAckAt;

  @override
  int get hashCode => Object.hash(state, unsyncedAnswers, lastAckAt);
}

/// Derives the pill. "Saved" is never shown for local-only work: it needs every answer
/// acknowledged. In ticket mode it is always [SaveState.onThisPhone].
SaveSnapshot deriveSaveState({required bool ticketMode, required int unsyncedAnswers, required SyncStatus syncStatus, DateTime? lastAckAt}) {
  if (ticketMode) return SaveSnapshot(state: SaveState.onThisPhone, unsyncedAnswers: unsyncedAnswers, lastAckAt: lastAckAt);
  if (unsyncedAnswers == 0) return SaveSnapshot(state: SaveState.saved, lastAckAt: lastAckAt);
  if (syncStatus == SyncStatus.notSaved) {
    return SaveSnapshot(state: SaveState.notSaved, unsyncedAnswers: unsyncedAnswers, lastAckAt: lastAckAt);
  }
  final blocked = syncStatus == SyncStatus.failing || syncStatus == SyncStatus.stopped || syncStatus == SyncStatus.conflict;
  return SaveSnapshot(state: blocked ? SaveState.waitingForNetwork : SaveState.saving, unsyncedAnswers: unsyncedAnswers, lastAckAt: lastAckAt);
}
