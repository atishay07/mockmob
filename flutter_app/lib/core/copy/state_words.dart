import 'formatters.dart';

/// The three save-state words used everywhere (spec 10, binding rule 6). "Saved" always means
/// the server acknowledged it; pending local work is "On this phone".
abstract final class StateWords {
  static const String onThisPhone = 'On this phone';
  static const String sending = 'Sending';
  static const String savedOnServer = 'Saved to your account';
}

/// One plain line stating what was recorded and when (spec 7). Only the `recorded` family may
/// be shown after server acknowledgment.
abstract final class Receipts {
  /// "Mock 7 saved to your account at 11:42 PM."
  static String mockSaved(String mockLabel, DateTime at) => '$mockLabel saved to your account at ${formatTime12(at)}.';

  /// "Repair finished. Recorded at 11:51 PM."
  static String repairFinished(DateTime at) => 'Repair finished. Recorded at ${formatTime12(at)}.';

  /// Before acknowledgment.
  static const String notRecordedYet = 'On this phone. Not recorded yet.';
}

/// What a screen says over the copy kept on the phone, in one set of words so Today and Review (and every tab that
/// shows a saved copy) never describe the same condition two ways (v15 walk, M2). The time is always the last GOOD
/// read of the data on screen: a failed try never replaces it.
abstract final class SavedCopy {
  /// The phone cannot reach the server: "Offline. Last loaded 7:26 AM." With no known time the copy is simply what is on
  /// the phone.
  static String offline(DateTime? lastGoodRead) =>
      lastGoodRead == null ? 'Offline. Showing what is saved on this phone.' : 'Offline. Last loaded ${formatTime12(lastGoodRead)}.';

  /// The server answered badly or not at all while the phone is online: "Not refreshed. Last loaded 7:26 AM." Short enough
  /// to hold one line beside the Ask pill on a 360 dp phone at 1.0 text, as the offline line does (v15.1 walk: "Could not
  /// refresh. Last loaded" wrapped to two lines there and pushed Review's summary and hero down 26 px).
  static String refreshFailed(DateTime? lastGoodRead) =>
      lastGoodRead == null ? 'Not refreshed. Showing your saved record.' : 'Not refreshed. Last loaded ${formatTime12(lastGoodRead)}.';

  /// After a Try again that changed nothing: it still says the last good read, and fits one line (the old "Tried 10:18 AM, still
  /// not loading. Last loaded 10:14 AM." ran off a phone's width and cut the time that mattered, v15 walk).
  static String triedAgain(DateTime lastGoodRead) => 'Still not loading. Last loaded ${formatTime12(lastGoodRead)}.';
}
