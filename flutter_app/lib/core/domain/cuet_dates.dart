/// The CUET UG 2027 calendar the app states, in one place, so Today's road, the 2027 guide and
/// onboarding never disagree. NTA has not published the 2027 bulletin: every date here follows
/// the 2026 cycle and is said as "expected". Any string that names these dates is built from
/// the constants below, never typed again elsewhere.
abstract final class CuetDates {
  /// Registration, expected from the 2026 cycle.
  static final DateTime registrationStart = DateTime.utc(2027, 2, 1);
  static final DateTime registrationEnd = DateTime.utc(2027, 3, 31);
  static const String registrationMonths = 'February to March 2027';
  static const String registrationWhen = 'Expected $registrationMonths';

  /// The exam window (May 1st is the earliest it could open).
  static final DateTime windowStart = DateTime.utc(2027, 5, 1);
  static final DateTime windowEnd = DateTime.utc(2027, 5, 31);
  static const String windowMonth = 'May 2027';
  static const String windowWhen = 'Expected $windowMonth';

  /// Class 12 boards, mid-February to early April.
  static final DateTime boardsStart = DateTime.utc(2027, 2, 15);
  static final DateTime boardsEnd = DateTime.utc(2027, 4, 5);
  static const String boardsWhen = 'Mid-February to early April 2027';
}
