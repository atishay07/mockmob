// Today 1018's blocks as plain values (TODAY-1018 sections 3 and 5, and the owner's 3:30 am words:
// "the road to CUET can definitely be improved by respecting information like what's due today,
// what's due for the week, and showing the overall goal"). Built by `buildGlance` (pure, unit
// tested) and rendered by the glance widgets. Unknown is never zero: a block that could not be
// read says so instead of showing a count.
import 'marks_trend.dart';
import 'today_model.dart';
import 'weeks_ahead.dart';

/// One of the lead card's other moves: a tap swaps the card to [hero] in place, or runs [action]
/// when the choice only opens something (the done state's "See tonight's repairs").
class MoveChoice {
  const MoveChoice({required this.key, required this.title, required this.line, this.hero, this.action, this.suggested = false});

  /// The kind ("repair", "revise", "weakest", "mock", "other", "lead"): the card keeps the pick by
  /// this key across rebuilds.
  final String key;
  final String title;

  /// One value line with a number: "6 due, about 8 min".
  final String line;
  final MoveHero? hero;
  final TodayAction? action;

  /// The recommended move, shown among the choices once the student picked another.
  final bool suggested;

  MoveChoice asSuggested() => MoveChoice(key: key, title: title, line: line, hero: hero, action: action, suggested: true);
}

/// How the suggested deck leans for this student (SMART-LAYER-1019PM 2.4): kinds he picked on 3
/// days in a fortnight rise to just after the recommended card, kinds he kept passing on sink to
/// the back, and his most-picked mode's card goes first among the rest. Never adds or removes a card.
class DeckLean {
  const DeckLean({this.liked = const {}, this.ignored = const {}, this.preferredKind});

  final Set<String> liked;
  final Set<String> ignored;
  final String? preferredKind;

  bool get isEmpty => liked.isEmpty && ignored.isEmpty && preferredKind == null;
}

/// What one day of the week says when it is tapped (6.3).
class DayReadout {
  const DayReadout({required this.title, this.lines = const [], this.isToday = false});

  /// "Thursday 15 Oct", or "Today, Sunday 18 Oct, planned".
  final String title;

  /// The papers saved that day, or the one line for a day without one.
  final List<String> lines;

  /// Today: the widget adds "Up next: ..." from the card on screen (a swap updates it live).
  final bool isToday;
}

/// One thing due today or this week, with whether it is done. [target] opens it.
class DueItem {
  const DueItem({required this.label, required this.done, this.target, this.info = false});

  /// A fact, not a task (the exam date, study days left): no tick.
  final bool info;

  final String label;
  final bool done;
  final TodayTarget? target;
}

/// Road to CUET in three layers read at a glance: due today, due this week, and the overall goal.
class RoadLayers {
  const RoadLayers({
    required this.today,
    required this.weekItems,
    required this.weekDays,
    required this.weekGoal,
    required this.plannedDone,
    required this.planned,
    required this.weeks,
    required this.days,
    required this.examDate,
    required this.ownDate,
    required this.mocksTaken,
    required this.mockTarget,
    required this.targetSuggested,
    required this.pace,
    this.studyDaysLeft,
    this.perWeek,
    this.milestone,
    this.goalItems = const [],
    this.mocksKnown = true,
    this.weekMocksPlanned = 0,
    this.weekMocksDone = 0,
    this.nextMockOn,
    this.weekEnds,
    this.weekDaysOpen,
    this.weekKnown = true,
  });

  /// The week's study days were read (else the layer says so, never "0 study days").
  final bool weekKnown;

  /// Full mocks the pace asks for this week, and how many are on the record this week.
  final int weekMocksPlanned;
  final int weekMocksDone;

  /// When the next full mock is due, when it is not this week (or the record is unknown: null).
  final DateTime? nextMockOn;

  /// The last day of this week (Sunday): "a full mock by Sun".
  final DateTime? weekEnds;

  /// Days that can still count toward the week: today, while it is not counted, and the days after it. Null when the week is unknown.
  final int? weekDaysOpen;

  /// The record was read, so the full mocks taken are known (else the goal says so, never 0).
  final bool mocksKnown;

  /// Due today: the study day, tonight's repair and Revise, each done or not.
  final List<DueItem> today;
  int get todayDone => today.where((t) => t.done).length;
  int get todayTotal => today.length;

  /// This week: study days counted against the goal, and the planned items (study days plus the
  /// full mock the pace asks for this week) done over planned.
  final List<DueItem> weekItems;
  final int weekDays;
  final int? weekGoal;
  final int plannedDone;
  final int planned;

  /// The overall goal: weeks to the date, full mocks done over the target, the next milestone.
  final int weeks;
  final int days;
  final DateTime examDate;
  final bool ownDate;
  final int mocksTaken;
  final int mockTarget;

  /// The target is the arithmetic suggestion (one a fortnight), not one the student set.
  final bool targetSuggested;

  /// "one a fortnight".
  final String pace;
  final int? studyDaysLeft;
  final int? perWeek;

  /// "Next, in 15 weeks: registration expected to open, Mon 1 Feb."
  final String? milestone;
  final List<DueItem> goalItems;

  double get todayFraction => todayTotal == 0 ? 0 : todayDone / todayTotal;
  double get weekFraction => planned == 0 ? 0 : (plannedDone / planned).clamp(0.0, 1.0);
  double get goalFraction => mockTarget == 0 ? 0 : (mocksTaken / mockTarget).clamp(0.0, 1.0);
}

/// One wrong answer under a weak chapter: its stem in full (questions are never truncated).
class WeakMistake {
  const WeakMistake({
    required this.attemptId,
    required this.questionId,
    required this.number,
    required this.head,
    required this.stem,
    required this.repaired,
    required this.target,
  });

  final String attemptId;
  final String questionId;
  final int number;

  /// "Q14, Mock 7, Sat 17 Oct, 9:12 PM".
  final String head;
  final String stem;
  final bool repaired;

  /// Repair it (open), or see its repair (repaired).
  final TodayTarget target;
}

class WeakChapter {
  const WeakChapter({
    required this.chapter,
    required this.subject,
    required this.subjectId,
    required this.missed,
    required this.asked,
    required this.marks,
    required this.wrong,
    required this.mistakes,
    required this.practise,
    required this.review,
    this.blank = 0,
    this.offer,
    this.papers = 1,
  });

  final String chapter;

  /// "Accountancy".
  final String subject;
  final String subjectId;

  /// Questions missed (wrong or blank, [wrong] + [blank]) over [asked] in this chapter.
  final int missed;
  final int asked;

  /// Marks lost there, Review's own figure for the chapter: 6 a wrong answer (5 not earned and 1 taken off) and 5 a blank.
  final int marks;

  /// Marks on offer (5 a question asked), or null when not known. [marks] can pass it (6 lost a wrong answer).
  final int? offer;

  /// Wrong answers in all (the "All 9 in Review" count).
  final int wrong;

  /// Questions left blank.
  final int blank;

  /// Papers the chapter lost marks in.
  final int papers;
  final List<WeakMistake> mistakes;
  final TodayTarget practise;
  final TodayTarget review;
}

class WeakChapters {
  const WeakChapters({this.rows = const [], this.papers = 0, this.failed = false, this.dayOne = false, this.startChapters = const [], this.startPractise});

  final List<WeakChapter> rows;

  /// Papers the ranking reads: every opened paper, as Review reads them ("across your 25 papers").
  final int papers;
  final bool failed;
  final bool dayOne;

  /// Day one only: the chapters MockMob ranks first for the student's subject (two), named in the
  /// line until a first paper shows their own. Empty when the subject has no ranking.
  final List<String> startChapters;

  /// Day one only: ten questions on the first of [startChapters] (19 Oct, the fresh "Weak chapters"
  /// block named where to start and had no key to start there). Null when there is no ranking.
  final TodayTarget? startPractise;
}

/// The last paper in full: the bar's counts in words, the biggest leak and its repair.
class PaperDetail {
  const PaperDetail({
    required this.paper,
    required this.right,
    required this.wrong,
    required this.blank,
    required this.total,
    this.leak,
    this.leakChapter,
    this.leakTarget,
  });

  final LastPaper paper;
  final int right;
  final int wrong;
  final int blank;
  final int total;

  /// "Biggest leak: Admission of a partner, 6 of your 23 misses (4 wrong, 2 blank)."
  final String? leak;
  final String? leakChapter;

  /// The leak's first open mistake, or null when none is open (then only Open the result shows).
  final TodayTarget? leakTarget;
}

/// The two tiles: open repairs, and Revise due today.
class QueueTiles {
  const QueueTiles({this.repairsOpen, this.repairedToCheck = 0, this.reviseDue, this.reviseRound, this.reviseMinutes = 5, this.dayOne = false});

  /// Every mistake still open on the account (the one count Review and the lead repeat); null when the record is unknown.
  final int? repairsOpen;
  final int repairedToCheck;

  /// Null when Revise could not be read: never shown as zero.
  final int? reviseDue;

  /// How many of the [reviseDue] today's round asks (the lead card's own number: 10 of 92). Null when unknown.
  final int? reviseRound;
  final int reviseMinutes;
  final bool dayOne;
}

class TodayGlance {
  const TodayGlance({this.readouts, this.road, this.weak = const WeakChapters(), this.paper, this.queue = const QueueTiles(), this.ahead, this.marks});

  /// The weeks ahead after Road to CUET (D52), or null without the road.
  final WeeksAhead? ahead;

  /// The marks of the last full mocks in the move's subject (D52), or null with fewer than two.
  final MarksTrend? marks;

  /// One readout per weekday (Monday first), or null without the week.
  final List<DayReadout>? readouts;
  final RoadLayers? road;
  final WeakChapters weak;
  final PaperDetail? paper;
  final QueueTiles queue;
}
