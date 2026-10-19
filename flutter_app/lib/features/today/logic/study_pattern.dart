// StudyPattern (SMART-LAYER-1019PM 2.3): what the phone has learned about how this student
// studies, from his own log and nothing else. Rules only, no AI. Every fact has a minimum below
// which it is not formed (and nothing is said about it), and old sessions fade: a session's weight
// halves every 14 days and sessions older than 56 days are gone. Pure: a fixed clock in, facts out.
import 'dart:math' as math;

import 'study_log.dart';
import 'subjects.dart';

/// A part of the day, in IST: Early before noon, Afternoon to 5 pm, Evening to 9 pm, Late from
/// 9 pm (and the small hours before 4 am, which belong to the night that started them).
enum StudyWindow { early, afternoon, evening, late }

/// The thresholds, in one place so the tests and the copy read the same numbers.
abstract final class PatternRules {
  static const double halfLifeDays = 14;
  static const int maxDays = StudyLogLimits.maxDays;

  /// A session shorter than this is a peek, not a session.
  static const int minSessionMs = 3 * Duration.millisecondsPerMinute;

  /// Usual length and usual time: this many sessions on this many days in the last [recentDays].
  static const int minSessions = 5;
  static const int minDays = 3;
  static const int recentDays = 28;

  /// The middle half of the lengths within this share of the median, else a range is said.
  static const double spread = 0.5;

  /// A usual time needs the top window to hold this share of the weight.
  static const double windowShare = 0.6;

  /// Below this share the times are "irregular" (between the two: no strong pattern yet).
  static const double irregularShare = 0.45;

  /// Preferred mode: this many sessions he chose himself, one mode at [modeShare] or more.
  static const int minChosen = 4;
  static const double modeShare = 0.5;

  /// A subject he avoids: untouched for [avoidDays] while he did [avoidOthers] sessions in others.
  static const int avoidDays = 14;
  static const int avoidOthers = 6;

  /// Deck kinds: passed or picked on this many days in the last [kindDays].
  static const int kindDaysNeeded = 3;
  static const int kindDays = 14;

  /// Goal fit: this many days since the goal was set and this many study days.
  static const int goalAgeDays = 7;
  static const int goalStudyDays = 4;
  static const double raiseFactor = 1.25;
  static const int raiseDaysNeeded = 5;
  static const int lastStudyDays = 7;

  /// Longer when he can: chose longer than suggested on this many of his last [longerOf] Today sessions.
  static const int longerNeeded = 3;
  static const int longerOf = 5;

  /// A shift: this many sessions in the last [shiftDays].
  static const int shiftSessions = 4;
  static const int shiftDays = 7;

  /// A card the student passed on keeps quiet this long.
  static const int quietDays = 14;
}

/// Fact keys: what "Not quite right?" forgets.
abstract final class PatternFact {
  static const length = 'length';
  static const time = 'time';
  static const mode = 'mode';
  static const longer = 'longer';
  static String avoid(String subject) => 'avoid:$subject';
  static String kind(String kind) => 'kind:$kind';
}

/// Deck kinds for the three new cards.
abstract final class PatternCards {
  static const raise = 'goal_raise';
  static const fit = 'goal_fit';
  static String untouched(String subject) => 'untouched:$subject';
}

/// The IST day number of [ms] (the same days as `DeckMemory.dayOf`).
int istDay(int ms) {
  final ist = DateTime.fromMillisecondsSinceEpoch(ms, isUtc: true).add(const Duration(hours: 5, minutes: 30));
  return DateTime.utc(ist.year, ist.month, ist.day).millisecondsSinceEpoch ~/ Duration.millisecondsPerDay;
}

/// Minutes after IST midnight of [ms].
int istMinuteOfDay(int ms) {
  final ist = DateTime.fromMillisecondsSinceEpoch(ms, isUtc: true).add(const Duration(hours: 5, minutes: 30));
  return ist.hour * 60 + ist.minute;
}

StudyWindow windowOfMinute(int minute) {
  if (minute < 4 * 60) return StudyWindow.late;
  if (minute < 12 * 60) return StudyWindow.early;
  if (minute < 17 * 60) return StudyWindow.afternoon;
  if (minute < 21 * 60) return StudyWindow.evening;
  return StudyWindow.late;
}

/// The IST day a session counts on: the day it started. A session started in the small hours
/// belongs to the night before only for its window, never for its day.
int dayOfEntry(StudyLogEntry e) => istDay(e.atMs);

/// Rounded to the nearest 5 minutes, never below 5.
int round5(num minutes) => math.max(5, (minutes / 5).round() * 5);

/// A weighted percentile: the smallest value whose running weight reaches [p] of the total.
double weightedPercentile(List<(double, double)> valueWeight, double p) {
  final sorted = [...valueWeight]..sort((a, b) => a.$1.compareTo(b.$1));
  final total = sorted.fold<double>(0, (s, e) => s + e.$2);
  if (sorted.isEmpty || total <= 0) return double.nan;
  var run = 0.0;
  for (final (v, w) in sorted) {
    run += w;
    if (run >= p * total - 1e-9) return v;
  }
  return sorted.last.$1;
}

/// The usual session length: one number, or a range when the lengths spread wide.
class LengthFact {
  const LengthFact({required this.minutes, this.low, this.high, this.lately = false, this.stated = false});

  /// The weighted median, rounded to 5.
  final int minutes;

  /// The middle half's ends, rounded to 5, when they are wider than the rule allows.
  final int? low;
  final int? high;

  /// From the last week only (the student's habits moved).
  final bool lately;

  /// What the student told us, not what we saw.
  final bool stated;

  bool get ranged => low != null && high != null;
}

enum TimeShape {
  /// One window holds most of the weight: a usual time can be said.
  known,

  /// No window is strong enough yet: say nothing about a time.
  mixed,

  /// The times are spread across the day: "irregular" is the fact.
  irregular,
}

class TimeFact {
  const TimeFact({required this.window, required this.afterMinute});

  final StudyWindow window;

  /// Most sessions in [window] start after this time (the weighted 25th percentile, down to 15).
  final int afterMinute;
}

class AvoidedSubject {
  const AvoidedSubject({required this.subject, required this.days});

  /// Public subject id.
  final String subject;

  /// Days since it was last practised (or since the log began, when never).
  final int days;
}

class GoalSuggestion {
  const GoalSuggestion({required this.minutes, required this.days, required this.outOf});

  /// The goal offered, rounded to 5.
  final int minutes;

  /// Raise: study days at 1.25 times the goal or more, of the last [outOf] study days (7 at most).
  final int days;
  final int outOf;
}

/// Everything learned, with the counts behind it.
class StudyPattern {
  const StudyPattern._({
    required this.now,
    required this.goalMinutes,
    required this.sessions28,
    required this.days28,
    required this.doneTodayMinutes,
    this.length,
    this.timeShape,
    this.time,
    this.shiftWindow,
    this.preferredMode,
    this.avoided,
    this.ignoredKinds = const {},
    this.likedKinds = const {},
    this.longerWhenCan = false,
    this.raise,
    this.fit,
    this.recentFullMock = false,
  });

  final DateTime now;

  /// The daily goal in minutes, or null when the student has not set one on this phone.
  final int? goalMinutes;

  /// Sessions (not peeks) and their distinct days in the last 28 days.
  final int sessions28;
  final int days28;

  /// Minutes on sessions started today (IST), from the log.
  final int doneTodayMinutes;

  final LengthFact? length;
  final TimeShape? timeShape;
  final TimeFact? time;

  /// The window of the last week, when it moved away from the older pattern.
  final StudyWindow? shiftWindow;
  final String? preferredMode;
  final AvoidedSubject? avoided;
  final Set<String> ignoredKinds;
  final Set<String> likedKinds;
  final bool longerWhenCan;
  final GoalSuggestion? raise;
  final GoalSuggestion? fit;

  /// A full or NTA-style mock in the last 14 days.
  final bool recentFullMock;

  /// Still below the minimum for any length or time claim.
  bool get learning => sessions28 < PatternRules.minSessions || days28 < PatternRules.minDays;

  /// Sessions still needed before the length and time can be said (0 once enough).
  int get sessionsNeeded => math.max(0, PatternRules.minSessions - sessions28);

  /// Study days still needed (after the sessions are there).
  int get daysNeeded => math.max(0, PatternRules.minDays - days28);

  bool get goalMet => goalMinutes != null && goalMinutes! > 0 && doneTodayMinutes >= goalMinutes!;

  int? get remainingMinutes => goalMinutes == null ? null : math.max(0, goalMinutes! - doneTodayMinutes);

  static StudyPattern from({
    required List<StudyLogEntry> log,
    required DateTime now,
    int? goalMinutes,
    List<String> chosenSubjects = const [],
    DeckReactions? reactions,
    PatternNotes notes = const PatternNotes(),
    int? accountStartMs,
  }) {
    final nowMs = now.millisecondsSinceEpoch;
    final today = istDay(nowMs);
    final deck = reactions ?? DeckReactions();
    double ageDays(StudyLogEntry e) => math.max(0, nowMs - e.atMs) / Duration.millisecondsPerDay;
    double weight(StudyLogEntry e) => math.pow(0.5, ageDays(e) / PatternRules.halfLifeDays).toDouble();
    final live = [
      for (final e in log)
        if (e.atMs <= nowMs && today - dayOfEntry(e) < PatternRules.maxDays && (!e.timed || e.activeMs! >= PatternRules.minSessionMs)) e,
    ];
    bool after(StudyLogEntry e, String fact) {
      final f = notes.forgotten[fact];
      return f == null || e.atMs >= f;
    }

    bool within(StudyLogEntry e, int days) => today - dayOfEntry(e) < days;

    // Learning counts: every session (a paper without a start still says the student sat down).
    final recent = [for (final e in live) if (within(e, PatternRules.recentDays)) e];
    final sessions28 = recent.length;
    final days28 = {for (final e in recent) dayOfEntry(e)}.length;

    // Minutes done today.
    final doneMs = live.where((e) => e.timed && dayOfEntry(e) == today).fold<int>(0, (s, e) => s + e.activeMs!);
    final doneToday = doneMs ~/ Duration.millisecondsPerMinute;

    // Shift: the last week against what came before it.
    final lastWeek = [for (final e in live) if (within(e, PatternRules.shiftDays) && after(e, PatternFact.time)) e];
    final before = [for (final e in live) if (!within(e, PatternRules.shiftDays) && after(e, PatternFact.time)) e];
    StudyWindow? shift;
    if (lastWeek.length >= PatternRules.shiftSessions && before.length >= PatternRules.minSessions) {
      final recentTop = _topWindow(lastWeek, (_) => 1);
      final olderTop = _topWindow(before, weight);
      if (recentTop != null && olderTop != null && recentTop.$2 >= PatternRules.windowShare && olderTop.$2 >= PatternRules.windowShare && recentTop.$1 != olderTop.$1) {
        shift = recentTop.$1;
      }
    }

    // Usual length.
    LengthFact? length;
    final lengthPool = [for (final e in live) if (e.timed && e.finished && after(e, PatternFact.length)) e];
    final lengthRecent = [for (final e in lengthPool) if (within(e, PatternRules.recentDays)) e];
    if (lengthRecent.length >= PatternRules.minSessions && {for (final e in lengthRecent) dayOfEntry(e)}.length >= PatternRules.minDays) {
      final shiftedPool = [for (final e in lengthPool) if (within(e, PatternRules.shiftDays)) e];
      final useRecent = shift != null && shiftedPool.length >= PatternRules.shiftSessions;
      final pool = useRecent ? shiftedPool : lengthPool;
      final vw = [for (final e in pool) (e.activeMs! / Duration.millisecondsPerMinute, useRecent ? 1.0 : weight(e))];
      final median = weightedPercentile(vw, 0.5);
      final p25 = weightedPercentile(vw, 0.25);
      final p75 = weightedPercentile(vw, 0.75);
      final m = round5(median);
      final tight = p25 >= median * (1 - PatternRules.spread) && p75 <= median * (1 + PatternRules.spread);
      final lo = round5(p25), hi = round5(p75);
      length = tight || lo >= hi ? LengthFact(minutes: m, lately: useRecent) : LengthFact(minutes: m, low: lo, high: hi, lately: useRecent);
    } else if (notes.statedLength != null) {
      length = LengthFact(minutes: notes.statedLength!, stated: true);
    }

    // Usual time.
    TimeShape? shape;
    TimeFact? time;
    final timePool = [for (final e in live) if (after(e, PatternFact.time)) e];
    final timeRecent = [for (final e in timePool) if (within(e, PatternRules.recentDays)) e];
    if (timeRecent.length >= PatternRules.minSessions && {for (final e in timeRecent) dayOfEntry(e)}.length >= PatternRules.minDays) {
      final top = _topWindow(timePool, weight);
      if (top == null || top.$2 < PatternRules.irregularShare) {
        shape = TimeShape.irregular;
      } else if (top.$2 < PatternRules.windowShare) {
        shape = TimeShape.mixed;
      } else {
        shape = TimeShape.known;
        final inWindow = [for (final e in timePool) if (windowOfMinute(istMinuteOfDay(e.atMs)) == top.$1) (_lateOrdered(istMinuteOfDay(e.atMs)).toDouble(), weight(e))];
        final p25 = weightedPercentile(inWindow, 0.25);
        time = TimeFact(window: top.$1, afterMinute: ((p25 ~/ 15) * 15) % (24 * 60));
      }
    }

    // Preferred mode, among sessions he chose himself.
    String? mode;
    final chosen = [for (final e in live) if (StudySource.selfChosen(e.source) && after(e, PatternFact.mode)) e];
    if (chosen.length >= PatternRules.minChosen) {
      final share = <String, double>{};
      var total = 0.0;
      for (final e in chosen) {
        final w = weight(e);
        share[e.mode] = (share[e.mode] ?? 0) + w;
        total += w;
      }
      final best = share.entries.reduce((a, b) => b.value > a.value ? b : a);
      if (total > 0 && best.value / total >= PatternRules.modeShare) mode = best.key;
    }

    // A subject he chose and has left alone.
    AvoidedSubject? avoided;
    final firstMs = accountStartMs ?? (live.isEmpty ? null : live.map((e) => e.atMs).reduce(math.min));
    final accountDays = firstMs == null ? 0 : today - istDay(firstMs);
    if (accountDays >= PatternRules.avoidDays) {
      final last14 = [for (final e in live) if (within(e, PatternRules.avoidDays) && e.mode != StudyMode.mob) e];
      for (final s in {for (final c in chosenSubjects) canonicalSubject(c)}) {
        if (deckQuiet(deck, PatternCards.untouched(s), today) || notes.forgotten.containsKey(PatternFact.avoid(s))) continue;
        final mine = [for (final e in live) if (canonicalSubject(e.subject) == s && after(e, PatternFact.avoid(s))) e];
        if (mine.any((e) => within(e, PatternRules.avoidDays))) continue;
        final others = last14.where((e) => canonicalSubject(e.subject) != s).length;
        if (others < PatternRules.avoidOthers) continue;
        final lastDay = mine.isEmpty ? istDay(firstMs!) : mine.map(dayOfEntry).reduce(math.max);
        final days = today - lastDay;
        if (days < PatternRules.avoidDays) continue;
        if (avoided == null || days > avoided.days) avoided = AvoidedSubject(subject: s, days: days);
      }
    }

    // Deck kinds he passes on, and those he picks.
    final ignored = <String>{};
    final liked = <String>{};
    for (final k in deck.kinds) {
      if (notes.forgotten.containsKey(PatternFact.kind(k))) continue;
      final passes = deck.daysWith(k, {DeckReaction.passed, DeckReaction.dismissed}, today: today, days: PatternRules.kindDays);
      final picks14 = deck.daysWith(k, {DeckReaction.picked}, today: today, days: PatternRules.kindDays);
      final picksAll = deck.daysWith(k, {DeckReaction.picked}, today: today, days: DeckReactions.window);
      if (passes >= PatternRules.kindDaysNeeded && picksAll == 0) ignored.add(k);
      if (picks14 >= PatternRules.kindDaysNeeded) liked.add(k);
    }

    // Longer when he can: his last five sessions started from Today's lead.
    final fromToday = [
      for (final e in live)
        if (e.source == StudySource.todayLead && e.suggestedMinutes != null && e.chosenMinutes != null && after(e, PatternFact.longer)) e,
    ]..sort((a, b) => a.atMs.compareTo(b.atMs));
    final lastFive = fromToday.length > PatternRules.longerOf ? fromToday.sublist(fromToday.length - PatternRules.longerOf) : fromToday;
    final longer = lastFive.where((e) => e.chosenMinutes! > e.suggestedMinutes!).length >= PatternRules.longerNeeded;

    // Goal fit.
    GoalSuggestion? raise;
    GoalSuggestion? fit;
    final goal = goalMinutes;
    final setAt = notes.goalSetAtMs;
    if (goal != null && goal > 0 && setAt != null) {
      final goalAge = today - istDay(setAt);
      final perDay = <int, int>{};
      for (final e in live) {
        if (!e.timed || e.atMs < setAt) continue;
        perDay[dayOfEntry(e)] = (perDay[dayOfEntry(e)] ?? 0) + e.activeMs!;
      }
      final minutesByDay = {for (final d in perDay.entries) d.key: d.value / Duration.millisecondsPerMinute};
      if (goalAge >= PatternRules.goalAgeDays && minutesByDay.length >= PatternRules.goalStudyDays) {
        final days = minutesByDay.keys.toList()..sort();
        final last7 = days.length > PatternRules.lastStudyDays ? days.sublist(days.length - PatternRules.lastStudyDays) : days;
        final big = [for (final d in last7) if (minutesByDay[d]! >= goal * PatternRules.raiseFactor) minutesByDay[d]!];
        if (big.length >= PatternRules.raiseDaysNeeded && !deckQuiet(deck, PatternCards.raise, today, onePass: true)) {
          final m = round5(weightedPercentile([for (final v in big) (v, 1.0)], 0.5));
          if (m > goal) raise = GoalSuggestion(minutes: m, days: big.length, outOf: last7.length);
        }
        if (raise == null && goalAge >= 2 * PatternRules.goalAgeDays && !deckQuiet(deck, PatternCards.fit, today, onePass: true)) {
          bool hardWeek(int from, int to) {
            final inWeek = [for (final d in days) if (d > today - to && d <= today - from) d];
            return inWeek.length >= 2 && inWeek.where((d) => minutesByDay[d]! >= goal).length <= 1;
          }

          if (hardWeek(0, 7) && hardWeek(7, 14)) {
            final fortnight = [for (final d in days) if (d > today - 14) (minutesByDay[d]!, 1.0)];
            final m = round5(weightedPercentile(fortnight, 0.5));
            if (m < goal) fit = GoalSuggestion(minutes: m, days: fortnight.length, outOf: fortnight.length);
          }
        }
      }
    }

    final recentMock = live.any((e) => (e.mode == StudyMode.full || e.mode == StudyMode.nta) && within(e, 14));

    return StudyPattern._(
      now: now,
      goalMinutes: goalMinutes,
      sessions28: sessions28,
      days28: days28,
      doneTodayMinutes: doneToday,
      length: length,
      timeShape: shape,
      time: shift == null ? time : null,
      shiftWindow: shift,
      preferredMode: mode,
      avoided: avoided,
      ignoredKinds: ignored,
      likedKinds: liked,
      longerWhenCan: longer,
      raise: raise,
      fit: fit,
      recentFullMock: recentMock,
    );
  }

  /// A card kind the student passed on keeps quiet: after one pass for 14 days ([onePass], the
  /// goal cards), else after passes on 3 days, for 14 days from the last.
  static bool deckQuiet(DeckReactions deck, String kind, int today, {bool onePass = false}) {
    final last = deck.lastPass(kind);
    if (last == null || today - last >= PatternRules.quietDays) return false;
    if (onePass) return true;
    return deck.daysWith(kind, {DeckReaction.passed, DeckReaction.dismissed}, today: today, days: DeckReactions.window) >= PatternRules.kindDaysNeeded;
  }
}

/// The window holding the most weight, with its share.
(StudyWindow, double)? _topWindow(List<StudyLogEntry> entries, double Function(StudyLogEntry) weight) {
  final share = <StudyWindow, double>{};
  var total = 0.0;
  for (final e in entries) {
    final w = weight(e);
    final win = windowOfMinute(istMinuteOfDay(e.atMs));
    share[win] = (share[win] ?? 0) + w;
    total += w;
  }
  if (total <= 0 || share.isEmpty) return null;
  final best = share.entries.reduce((a, b) => b.value > a.value ? b : a);
  return (best.key, best.value / total);
}

/// Small hours sort after the evening they belong to.
int _lateOrdered(int minute) => minute < 4 * 60 ? minute + 24 * 60 : minute;

// ---------------------------------------------------------------------------------------------
// Today's default length (SMART-LAYER-1019PM 2.4).

/// What the pattern asks of Today's length: a target in minutes (the chip nearest it is the
/// default), one chip longer, or a full mock as the lead. Null target keeps Today's old default.
class LengthAdvice {
  const LengthAdvice({this.target, this.longer = false, this.fullMockLead = false, this.twoBlocks = false, this.short = false});

  static const LengthAdvice none = LengthAdvice();

  final int? target;
  final bool longer;
  final bool fullMockLead;

  /// The remaining goal is more than 1.5 times the usual length.
  final bool twoBlocks;

  /// The times are irregular: the plan is kept short.
  final bool short;

  /// The longest a short plan runs.
  static const int shortCap = 10;

  /// The default among [chips] (minutes, ascending): the chip nearest [target] (the lower on a
  /// tie), one chip longer when [longer]. Null without a target.
  int? pick(List<int> chips) {
    final t = target;
    if (t == null || chips.isEmpty) return null;
    final sorted = [...chips]..sort();
    var best = sorted.first;
    for (final c in sorted) {
      if ((c - t).abs() < (best - t).abs()) best = c;
    }
    if (longer) {
      final at = sorted.indexOf(best);
      if (at + 1 < sorted.length) best = sorted[at + 1];
    }
    return best;
  }
}

/// The advice for [p] on a day of [mood]: returning and late night keep their short default.
LengthAdvice adviseLength(StudyPattern p, {bool shortDay = false}) {
  final goal = p.goalMinutes;
  final remaining = p.remainingMinutes;
  final usual = p.length;
  final irregular = p.timeShape == TimeShape.irregular && usual == null;
  int? target;
  var twoBlocks = false;
  if (usual != null && !usual.ranged) {
    final u = usual.minutes;
    target = remaining == null || remaining <= 0 ? u : math.min(remaining, u);
    twoBlocks = remaining != null && remaining > 1.5 * u;
  } else if (usual != null && usual.ranged) {
    target = remaining == null || remaining <= 0 ? usual.low : math.min(remaining, usual.low!);
  } else if (goal != null) {
    target = remaining == null || remaining <= 0 ? goal : math.min(goal, remaining);
  }
  if (irregular && target != null) target = math.min(target, LengthAdvice.shortCap);
  if (irregular && target == null) target = LengthAdvice.shortCap;
  if (shortDay && target != null) target = math.min(target, 10);
  final fullMock = !shortDay &&
      goal != null &&
      goal >= 60 &&
      (remaining ?? 0) >= 60 &&
      (p.recentFullMock || goal % 60 == 0);
  return LengthAdvice(
    target: target,
    longer: p.longerWhenCan && !shortDay && target != null,
    fullMockLead: fullMock,
    twoBlocks: twoBlocks && !shortDay,
    short: irregular,
  );
}
