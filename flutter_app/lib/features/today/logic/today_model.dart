// The Today screen as plain values. Built by `buildToday` (pure, unit tested) from the
// repositories, rendered by `TodayBody`. Goldens build these directly from fixtures.
import '../../../core/domain/next_move.dart';
import '../../../core/widgets/bubbles/bubble_painter.dart';
import '../../../core/widgets/art/mm_art.dart';
import '../../rhythm/logic/plan_week.dart';

/// Where a tap goes. The screen turns each into navigation or a refresh.
sealed class TodayTarget {
  const TodayTarget();
}

/// Push this in-app location.
class GoTo extends TodayTarget {
  const GoTo(this.location);

  final String location;

  @override
  bool operator ==(Object other) => other is GoTo && other.location == location;

  @override
  int get hashCode => location.hashCode;
}

/// Read the plan and attempts again.
class RetryLoad extends TodayTarget {
  const RetryLoad();
}

/// Open the alternatives sheet.
class OpenAlternatives extends TodayTarget {
  const OpenAlternatives();
}

class TodayAction {
  const TodayAction(this.label, this.target, {this.startsSession = false, this.actionType, this.shortLabel});

  final String label;

  /// Says the same in fewer words, for a key where [label] would break onto a second line
  /// (large text on a small phone). Never a different promise: same verb, same length.
  final String? shortLabel;
  final TodayTarget target;

  /// Needs the network: disabled with "Connect to start." while offline.
  final bool startsSession;

  /// For `next_move_started` (`repair`, `practice`, `mock`, `resume`).
  final String? actionType;
}

/// The mood changes the defaults and the warmth, never the state (spec 5.3).
enum TodayMood { normal, dayOne, returning, lateNight }

/// One duration chip. [mistakes] is set for a repair (the task shrinks with the time).
class DurationChoice {
  const DurationChoice({required this.minutes, this.mistakes, this.questions});

  final int minutes;
  final int? mistakes;

  /// Set for practice: the chip is a question count (practice runs a question a minute).
  final int? questions;

  /// What the chip says: "5 min" for a repair, the bare count for practice (the row above it
  /// asks "How many questions?").
  String get label => questions == null ? '$minutes min' : '$questions';

  @override
  bool operator ==(Object other) =>
      other is DurationChoice && other.minutes == minutes && other.mistakes == mistakes && other.questions == questions;

  @override
  int get hashCode => Object.hash(minutes, mistakes, questions);
}

/// What sits in the hero's art corner.
class HeroArt {
  const HeroArt.object({this.subject}) : art = null, isMobi = false;
  const HeroArt.mobi(this.art) : isMobi = true, subject = null;

  /// The Mobi pose; null for a subject object, which is always drawn as a [SubjectEmblem].
  final MmArt? art;
  final bool isMobi;

  /// The subject whose code-drawn emblem stands in the corner. Null draws the generic emblem.
  final String? subject;
}

sealed class TodayHero {
  const TodayHero();

  /// The subject whose light fills the hero, or null for the plain lamp.
  String? get subjectId;
}

/// Tonight's move: one monumental number and what it means, then one volt pill.
class MoveHero extends TodayHero {
  const MoveHero({
    required this.state,
    required this.mood,
    required this.overline,
    required this.art,
    required this.meaning,
    required this.primary,
    required this.summary,
    this.subjectId,
    this.subjectLine,
    this.headline,
    this.number,
    this.numberLabel,
    this.evidenceId,
    this.evidence,
    this.durationPrompt,
    this.durations = const [],
    this.selectedMinutes,
    this.secondary,
    this.caption,
    this.mobiLine,
    this.basisLine,
    this.dismissedLine,
  });

  final NextMoveState state;
  final TodayMood mood;
  final String overline;

  /// One plain sentence for the compact slot when something else holds the hero
  /// ("Repair 3 mistakes from Mock 7").
  final String summary;
  @override
  final String? subjectId;

  /// "Accountancy", under the overline.
  final String? subjectLine;
  final HeroArt art;

  /// A warm line above the number (returning, late night, a scheduled first check).
  final String? headline;
  final String? number;

  /// Two short lines beside the number ("mistakes\nfrom Mock 7").
  final String? numberLabel;
  final String meaning;

  /// The attempt behind the claim; "Show me" opens the why sheet for it.
  final String? evidenceId;

  /// What the evidence holds, drawn in the "Show me" pill (three wrong answers for a repair of
  /// three), so its bubbles say something true. Null draws a plain pill.
  final List<BubbleState>? evidence;
  final String? durationPrompt;
  final List<DurationChoice> durations;
  final int? selectedMinutes;
  final TodayAction primary;
  final TodayAction? secondary;

  /// The one Hinglish caption on the screen.
  final String? caption;

  /// Mobi's one line, in a glass bubble.
  final String? mobiLine;
  final String? basisLine;
  final String? dismissedLine;
}

/// An unopened result: the sealed sheet takes over the hero.
class SealedHero extends TodayHero {
  const SealedHero({required this.attemptId, required this.title, required this.line, this.subjectId, this.moreLine});

  final String attemptId;
  final String title;
  final String line;
  @override
  final String? subjectId;
  final String? moreLine;
}

/// A session still running: resume it.
class ResumeHero extends TodayHero {
  const ResumeHero({
    required this.sessionId,
    required this.title,
    required this.answered,
    required this.total,
    required this.line,
    this.keyLabel = 'Resume',
    this.subjectId,
  });

  final String sessionId;
  final String title;

  /// "Resume Mock 8".
  final String keyLabel;
  final int answered;
  final int total;
  final String line;
  @override
  final String? subjectId;
}

/// A mock whose time ran out while the student was away (three copies from real state).
class EndedHero extends TodayHero {
  const EndedHero({required this.title, required this.line, required this.action, this.subjectId});

  final String title;
  final String line;
  final TodayAction action;
  @override
  final String? subjectId;
}

/// A compact row under the hero for anything that did not win the hero.
class AlsoSlot {
  const AlsoSlot({required this.title, required this.line, required this.action});

  final String title;
  final String line;
  final TodayAction action;
}

/// One recent paper: its marks, where they went (right, wrong, blank as one bar) and the change
/// from the last comparable paper. Tapping it opens the result.
class SheetRow {
  const SheetRow({
    required this.attemptId,
    required this.label,
    required this.subject,
    required this.date,
    required this.states,
    required this.target,
    this.marks,
    this.outOf,
    this.sealed = false,
    this.change,
  });

  final String attemptId;
  final String label;
  final String subject;
  final String date;

  /// One verdict per question, in paper order (hollow while sealed). Read for the counts.
  final List<BubbleState> states;
  final TodayTarget target;

  /// Marks as `correct * 5 - wrong`, null while sealed.
  final int? marks;
  final int? outOf;
  final bool sealed;

  /// "+33 since Mock 6": the change from the previous paper of the same kind and length.
  final String? change;

  int get right => states.where((s) => s == BubbleState.filled).length;
  int get wrong => states.where((s) => s == BubbleState.wrong).length;
  int get blank => states.where((s) => s == BubbleState.blank).length;
}

class LadderRung {
  const LadderRung({required this.college, required this.course, required this.score, this.outOf, this.dream = false});

  final String college;
  final String course;
  final String score;
  final int? outOf;
  final bool dream;
}

/// One stop on the road to May, from the published calendar (brief section 8). [expected] stops
/// are not announced yet and always say so.
class RoadStop {
  const RoadStop({required this.kind, required this.title, required this.when, required this.start, this.end, this.note, this.expected = false});

  final RoadStopKind kind;
  final String title;

  /// "January to March 2027".
  final String when;
  final DateTime start;
  final DateTime? end;
  final String? note;
  final bool expected;
}

enum RoadStopKind { registration, boards, exam }

/// Where the calendar is: counting down to the window, or inside it.
enum RoadPhase { countdown, window }

class RoadModel {
  const RoadModel({
    required this.weeks,
    required this.today,
    required this.end,
    this.phase = RoadPhase.countdown,
    this.daysToWindow,
    this.daysLeft,
    this.stops = const [],
    this.ladder = const [],
    this.category,
    this.weeksToBoards,
    this.studyDays,
    this.goal,
    this.weekNeeds,
  });

  /// Whole weeks to the start of the expected window (countdown only; 0 after it).
  final int weeks;
  final DateTime today;

  /// The right edge of the road: the month after the last stop.
  final DateTime end;
  final RoadPhase phase;

  /// Whole days to the start of the expected window (countdown only). The card counts days
  /// instead of weeks once fewer than seven remain, so it never says "0 weeks".
  final int? daysToWindow;

  /// Days left in the expected window (window phase only).
  final int? daysLeft;
  final List<RoadStop> stops;
  final List<LadderRung> ladder;

  /// The student's CSAS category, or null when never chosen (the ladder then says it shows
  /// unreserved scores until they choose).
  final String? category;

  /// Whole weeks before boards take the evenings (mid-February), null once they have begun.
  final int? weeksToBoards;

  /// Study sessions left before the window at the student's own goal, board weeks counted at
  /// two (the onboarding plan's own arithmetic).
  final int? studyDays;

  /// The weekly goal behind [studyDays].
  final int? goal;

  /// What this week still asks for, from the rhythm ("2 more study days by Sunday.").
  final String? weekNeeds;
}

/// Today's week row: seven days as planned, the count and what the rest of the week asks.
class WeekModel {
  const WeekModel({required this.days, required this.count, this.outlook, this.met = false, this.paused = false});

  final List<PlanDay> days;

  /// "1 of 4 study days".
  final String count;

  /// "2 more by Sunday", "Goal met", "Paused".
  final String? outlook;
  final bool met;
  final bool paused;
}

class HeaderModel {
  const HeaderModel({required this.dateLine, required this.greeting, this.week, this.updatedLine, this.mobi});

  final String dateLine;
  final String greeting;
  final WeekModel? week;

  /// "Updated 9:40 PM" when Today shows cached data.
  final String? updatedLine;

  /// Mobi beside the greeting, or null when the hero already has him.
  final HeaderMobiCue? mobi;
}

/// What Mobi does in Today's header.
enum HeaderMobiKind { idle, cheer, sleepy, point }

class HeaderMobiCue {
  const HeaderMobiCue(this.kind, this.lines);

  final HeaderMobiKind kind;

  /// What a tap makes him say, in turn.
  final List<String> lines;
}

class TodayView {
  const TodayView({
    required this.header,
    this.hero,
    this.also = const [],
    this.sheet = const [],
    this.road,
    this.offline = false,
  });

  final HeaderModel header;

  /// Null while the first load is still running (the skeleton shows).
  final TodayHero? hero;
  final List<AlsoSlot> also;
  final List<SheetRow> sheet;
  final RoadModel? road;
  final bool offline;

  bool get loading => hero == null;
}
