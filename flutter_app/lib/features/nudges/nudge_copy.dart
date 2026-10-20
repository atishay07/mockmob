import 'nudge_rules.dart';

/// The words of each nudge (owner D191): one short title, one line, one key. Plain and warm; no
/// exclamation marks, emoji or arrows; never "lost", "behind" or "last"; numbers carry their units;
/// 12-hour times. The reward figure is the server's (100 today), never a guess.
abstract final class NudgeCopy {
  static const String dismiss = 'Not now';
  static const String dismissLabel = 'Dismiss this note';

  /// The card's quiet source line.
  static const String from = 'A note from Mobi';

  static String _time12(DateTime at) {
    final h = at.hour % 12 == 0 ? 12 : at.hour % 12;
    final m = at.minute.toString().padLeft(2, '0');
    return '$h:$m ${at.hour < 12 ? 'AM' : 'PM'}';
  }

  static String mobGameTitle(MobGameWaiting g) => '${g.starterFirstName} opened a ${g.kindLabel}.';
  static String mobGameLine(MobGameWaiting g) => 'Race it before ${_time12(g.closesAt)}.';
  static const String mobGameKey = 'Open the Mob';

  static String chainRiskTitle(int days) => 'Your $days-day chain ends at midnight.';
  static const String chainRiskLine = 'One set keeps it.';
  static const String chainRiskKey = 'Keep it';

  static String friendPaidTitle(int reward) => '$reward credits landed.';
  static const String friendPaidLine = 'Your friend finished a practice, so you were both paid.';
  static const String friendPaidKey = 'Nice';
  static const String friendPaidSecondary = 'See invites';

  static String repairOpenTitle(int open) => '$open ${open == 1 ? 'mistake is' : 'mistakes are'} waiting to be fixed.';
  static const String repairOpenLine = 'Fix one before it slips again.';
  static const String repairOpenKey = 'Fix one now';

  static const String practiceTodayTitle = 'Ten minutes keeps today on your chain.';
  static const String practiceTodayLine = 'A short set counts.';
  static const String practiceTodayKey = 'Practise 10';

  static String creditsLowTitle(int credits) => '$credits ${credits == 1 ? 'credit' : 'credits'} left.';
  static String creditsLowLine(int reward) => 'A friend brings $reward more. Pro removes the limit.';
  static const String creditsLowKey = 'Invite a friend';
  static const String creditsLowSecondary = 'Get Pro';

  static String friendJoinedTitle(int n) => n == 1 ? 'A friend joined with your link.' : '$n friends joined with your link.';
  static String friendJoinedLine(int reward) => 'Their first practice pays you both $reward credits.';
  static const String friendJoinedKey = 'See invites';

  static const String goodResultTitle = 'Good run.';
  static String goodResultLine(int reward) => 'Race a friend next: you both get $reward credits.';
  static const String goodResultKey = 'Invite a friend';
}
