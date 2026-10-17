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
