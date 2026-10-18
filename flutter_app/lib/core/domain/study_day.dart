import '../models/attempt.dart';

/// What makes a study day, as the server counts it (src/lib/server/rhythm.js): a calendar day in
/// India (IST, from midnight) with a scored practice or mock of at least [studyDayMinAnswered]
/// answers, or a finished repair. The app never counts days itself; it only explains a day the
/// server did not count, so the student is never told "0" right after a paper with no reason
/// (fresh-account walk, 19 Oct: 3 answers at 2:46 AM, then "0 of 4 study days").
const int studyDayMinAnswered = 5;

/// The IST calendar date of [instant], as the server's study days use it.
DateTime _istDate(DateTime instant) {
  final ist = instant.toUtc().add(const Duration(hours: 5, minutes: 30));
  return DateTime.utc(ist.year, ist.month, ist.day);
}

/// The answers on today's (IST) papers when papers were finished today and none of them reached
/// [studyDayMinAnswered]: the most answered on one paper, which can be 0. Null when no paper was
/// finished today, or one of them already counts.
int? shortPaperToday(Iterable<Attempt> attempts, DateTime now) {
  final today = _istDate(now);
  int? most;
  for (final a in attempts) {
    if (_istDate(a.completedAt) != today) continue;
    final answered = a.correct + a.wrong;
    if (answered >= studyDayMinAnswered) return null;
    if (most == null || answered > most) most = answered;
  }
  return most;
}
