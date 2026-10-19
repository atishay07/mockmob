// The Today screen as plain values. Built by `buildToday` (pure, unit tested) from the
// repositories, rendered by `TodayBody`. Goldens build these directly from fixtures.
import '../../../core/domain/next_move.dart';
import '../../../core/widgets/bubbles/bubble_painter.dart';
import '../../../core/widgets/art/mm_art.dart';
import '../../practice/model/open_paper.dart' show OpenPaper, OpenPaperKind;
import '../../rhythm/logic/plan_week.dart';
import 'glance_model.dart';
import 'road_board.dart' show RoadBoard;

export 'glance_model.dart';

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

/// Make [minutes] the daily goal (the smart layer's goal cards, SMART-LAYER-1019PM 2.4).
class SetDailyGoal extends TodayTarget {
  const SetDailyGoal(this.minutes);

  final int minutes;

  @override
  bool operator ==(Object other) => other is SetDailyGoal && other.minutes == minutes;

  @override
  int get hashCode => minutes.hashCode;
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

/// The mood changes the defaults and the warmth, never the state (spec 5.3). Late night only
/// shortens the default length: it no longer changes the art or the words (F11).
enum TodayMood { normal, dayOne, returning, lateNight }

/// Which move the card is (TODAY-1017 4.2, and the first-week path of FEATURE-ADOPTION 7): what
/// the tests and the card's Mobi read, never shown as words.
enum MoveKind { dayOne, repair, firstRepair, returning, warmUp, revise, done, firstMock, smart, practice, failure, other, weakest, mock, otherSubject }

/// The full mock's length in minutes: the last row of "How many questions?" carries it.
const int fullMockMinutes = 60;

/// One duration chip. [mistakes] is set for a repair (the task shrinks with the time).
class DurationChoice {
  const DurationChoice({required this.minutes, this.mistakes, this.questions, this.fullMock = false});

  /// The last row of "How many questions?": a full mock, 60 minutes. It is the one length that
  /// is not a question count, so it is told apart by this flag and never by its minutes.
  const DurationChoice.fullMock({required this.questions}) : minutes = fullMockMinutes, mistakes = null, fullMock = true;

  final int minutes;
  final int? mistakes;

  /// Set for practice: the chip is a question count (practice runs a question a minute). A full
  /// mock also sets it (50), though its minutes are 60.
  final int? questions;

  /// This chip is the full mock, not a practice length.
  final bool fullMock;

  /// What the chip says: "5 min" for a repair, the bare count for practice (the row above it
  /// asks "How many questions?"), "60 min" for the full mock.
  String get label => fullMock ? '$minutes min' : (questions == null ? '$minutes min' : '$questions');

  @override
  bool operator ==(Object other) =>
      other is DurationChoice &&
      other.minutes == minutes &&
      other.mistakes == mistakes &&
      other.questions == questions &&
      other.fullMock == fullMock;

  @override
  int get hashCode => Object.hash(minutes, mistakes, questions, fullMock);
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
    this.kind = MoveKind.other,
    this.whyLink,
    this.whyAction,
    this.alternate,
    this.title,
    this.valueLine,
    this.choiceKey,
  });

  final NextMoveState state;

  /// The move's own title over the number (TODAY-1018: "Repair your last paper"); the subject
  /// then moves into the overline ("Up next, Accountancy"). Null keeps [subjectLine] as the title.
  final String? title;

  /// The value line under the number: the record's arithmetic ("24 marks they cost you"), beside
  /// the length token. Null shows the token alone (or nothing).
  final String? valueLine;

  /// What kind of choice this move is ("repair", "revise", "weakest", "mock", "other"), so the
  /// card's two choices are always a different kind from the lead.
  final String? choiceKey;

  /// [dropSecondary] removes the second key (a Full mock key beside a card that already is one).
  MoveHero copyWith({
    String? overline,
    String? title,
    String? valueLine,
    String? choiceKey,
    String? meaning,
    String? number,
    String? numberLabel,
    String? summary,
    TodayAction? primary,
    int? selectedMinutes,
    MoveKind? kind,
    bool dropSecondary = false,
  }) => MoveHero(
        state: state,
        mood: mood,
        overline: overline ?? this.overline,
        art: art,
        meaning: meaning ?? this.meaning,
        primary: primary ?? this.primary,
        summary: summary ?? this.summary,
        subjectId: subjectId,
        subjectLine: subjectLine,
        headline: headline,
        number: number ?? this.number,
        numberLabel: numberLabel ?? this.numberLabel,
        evidenceId: evidenceId,
        evidence: evidence,
        durationPrompt: durationPrompt,
        durations: durations,
        selectedMinutes: selectedMinutes ?? this.selectedMinutes,
        secondary: dropSecondary ? null : secondary,
        caption: caption,
        mobiLine: mobiLine,
        basisLine: basisLine,
        dismissedLine: dismissedLine,
        kind: kind ?? this.kind,
        whyLink: whyLink,
        whyAction: whyAction,
        alternate: alternate,
        title: title ?? this.title,
        valueLine: valueLine ?? this.valueLine,
        choiceKey: choiceKey ?? this.choiceKey,
      );

  /// Which move this is (see [MoveKind]).
  final MoveKind kind;

  /// The why sentence's link words ("See why", "See all 6"); the default is "See why".
  final String? whyLink;

  /// Where the why's link goes when no paper on this phone backs the claim (a Revise round whose
  /// papers are not cached here): the link still shows, and opens this instead of the why sheet.
  final TodayAction? whyAction;

  /// A pill before [secondary] when the move has no length to change ("Open the repair").
  final TodayAction? alternate;

  /// The move can change size: the "Change length" pill shows.
  bool get canChangeLength => durations.length > 1;
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

/// A fresh submission not yet played back: the paper reel takes over the hero once (D29, "Play
/// your paper back, 20 s"), and the Up next card returns after a play or a skip. No marking wait
/// and no receipt time: the paper is already marked.
class SealedHero extends TodayHero {
  const SealedHero({required this.attemptId, required this.title, required this.line, this.subjectId, this.moreLine, this.subject, this.questions});

  final String attemptId;

  /// "Mock 7, Accountancy".
  final String title;
  final String line;
  @override
  final String? subjectId;
  final String? moreLine;

  /// The subject's display name ("Accountancy"), when the paper is on the phone.
  final String? subject;

  /// The paper's question count, when known: the card's sheet has one bubble per question.
  final int? questions;
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
    this.savedAt,
    this.lead,
    this.subjectId,
  });

  final String sessionId;
  final String title;

  /// "Resume Mock 8".
  final String keyLabel;
  final int answered;
  final int total;
  final String line;

  /// When the server last acknowledged the answers (the device clock), for "Saved a minute ago".
  final DateTime? savedAt;

  /// "Ends at 9:10 PM." alone, for the card that says the save time in its own words.
  final String? lead;
  @override
  final String? subjectId;
}

/// A paper that is open and that this phone is not running: a start whose answer never came (the app was
/// killed after the server may have taken the credits), or a paper the server holds. It leads like a paper
/// still running does, because the credits are already spent: one key continues it, and nothing is charged
/// twice (v15 walk, credits).
class OpenPaperHero extends TodayHero {
  const OpenPaperHero({
    required this.paper,
    required this.overline,
    required this.title,
    required this.line,
    required this.keyLabel,
    this.subjectId,
  });

  final OpenPaper paper;
  final String overline;

  /// "Mock 7, Accountancy", or "Your full mock, Accountancy".
  final String title;
  final String line;

  /// "Continue your full mock".
  final String keyLabel;
  @override
  final String? subjectId;

  /// A start nobody ever read can be let go ("Not now"); a paper the server holds cannot, it is really open.
  bool get canLetGo => paper.kind == OpenPaperKind.pending;
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
  const AlsoSlot({required this.title, required this.line, required this.action, this.lead = false});

  final String title;
  final String line;
  final TodayAction action;

  /// This row holds the screen's one volt key: the hero above it only offers a way out (an
  /// ended mock that could not be recorded), so the real next move leads.
  final bool lead;
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
  const LadderRung({required this.college, required this.course, required this.score, this.outOf, this.dream = false, this.programmeId});

  final String college;

  /// The DU programme behind the row, so a tap opens it in Compass; null for an older setup.
  final String? programmeId;
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
    this.board,
    this.plannedDays,
    this.ladderSaved = 0,
    this.colleges = const [],
    this.onAccount = false,
  });

  /// The road is kept on the account (else on this phone only): the save receipts say which.
  final bool onAccount;

  /// How many colleges are on My colleges in all ("Your top 3 of 5").
  final int ladderSaved;

  /// Every college on My colleges, the hardest to get into first (D104): [ladder] is its first
  /// three, and "See all" lists every one of these.
  final List<LadderRung> colleges;

  /// The weekdays the student plans to study (0 = Monday), when the plan matches the goal: the
  /// pace strip keeps these picks when the count changes.
  final Set<int>? plannedDays;

  /// The student's own board under the road: their exam date, mocks, study days left and this
  /// week, each tappable (road_board.dart).
  final RoadBoard? board;

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

  /// The three hardest to get into of [colleges] (all of them when there are three or fewer).
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
  const WeekModel({
    required this.days,
    required this.count,
    this.outlook,
    this.met = false,
    this.paused = false,
    this.done = 0,
    this.goal,
    this.caption = '',
    this.captionKey,
    this.beforeAccount = const {},
    this.weekId,
    this.counted = const [],
  });

  final List<PlanDay> days;

  /// The weekdays the server counted (0 = Monday).
  final List<int> counted;

  /// Study days counted this week, and the goal ("3 of 4"); the goal is null when none is set.
  final int done;
  final int? goal;

  /// The one line under the marks (4.3's table), and the clause in it set in ink 600 ("Tonight
  /// makes 4."), when there is one.
  final String caption;
  final String? captionKey;

  /// Days before the account had any paper (0 = Monday): a short dash, never a miss.
  final Set<int> beforeAccount;

  /// The week's Monday as `YYYY-MM-DD` (the goal-met cheer plays once per week).
  final String? weekId;

  /// "1 of 4 study days".
  final String count;

  /// "2 more by Sunday", "Goal met", "Paused".
  final String? outlook;
  final bool met;
  final bool paused;
}

class HeaderModel {
  const HeaderModel({required this.dateLine, required this.greeting, this.week, this.weekLoading = false, this.weekFailed = false, this.updatedLine, this.refreshable = false, this.offline = false, this.mobi});

  final String dateLine;
  final String greeting;
  final WeekModel? week;

  /// The rhythm is still loading for the first time: the header holds the strip's height with a
  /// skeleton so nothing below it jumps when the week lands.
  final bool weekLoading;

  /// The rhythm's first read failed: the strip's slot is held with a line saying so (L03).
  final bool weekFailed;

  /// "Updated 9:40 PM" when Today shows cached data.
  final String? updatedLine;

  /// The updated line names a refresh that failed online: a tap on it reads again (S7).
  final bool refreshable;

  /// The phone is offline: the only state that may show the cloud-off mark. A stale read that is
  /// merely being read again is not "offline" (v13 walk, finding 3).
  final bool offline;

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


/// One paper on the trend strip: its real marks, from an opened result.
class TrendPoint {
  const TrendPoint({required this.attemptId, required this.label, required this.date, required this.marks, required this.outOf, required this.target});

  final String attemptId;

  /// "Mock 7".
  final String label;

  /// "3 Oct".
  final String date;
  final int marks;
  final int outOf;
  final TodayTarget target;
}

/// The marks of the last up to six opened papers of the same kind and length, oldest first. Built
/// only from at least three papers, none of them sealed (a sealed paper is never spoiled).
class PaperTrend {
  const PaperTrend({required this.points, required this.mock, required this.subject, required this.ofKind, required this.kind});

  final List<TrendPoint> points;

  /// The papers are mocks (otherwise practice papers).
  final bool mock;
  final String subject;

  /// Every paper of this kind on record, the strip's denominator (never less than [points]).
  final int ofKind;

  /// The kind, as the caption says it: "Accountancy mocks".
  final String kind;
}

/// Today's "Last paper" row: the newest opened paper, which opens its result.
class LastPaper {
  const LastPaper({required this.title, required this.sub, required this.marks, required this.outOf, required this.target, this.change, this.up});

  /// "Mock 7, Accountancy".
  final String title;

  /// "11 Oct, +33 on Mock 6".
  final String sub;
  final int marks;
  final int outOf;
  final TodayTarget target;

  /// "+33 on Mock 6", set in the accent when it went up.
  final String? change;
  final bool? up;
}

class TodayView {
  const TodayView({
    required this.header,
    this.hero,
    this.also = const [],
    this.sheet = const [],
    this.papers = 0,
    this.trend,
    this.road,
    this.offline = false,
    this.lastPaper,
    this.choices = const [],
    this.glance,
    this.lean = const DeckLean(),
  });

  /// How the suggested deck leans for this student (the smart layer).
  final DeckLean lean;

  /// The lead card's other moves (TODAY-1018 6.1): the best alternatives of a different kind, each
  /// one a whole move the card swaps to in place (or an action for a choice that only opens).
  final List<MoveChoice> choices;

  /// Today 1018's blocks under the move: the week's day readouts, the three-layer road, weak
  /// chapters, the last paper in full, and the Repairs and Revise tiles. Null while loading.
  final TodayGlance? glance;

  /// The newest opened paper, or null when there is none (the row is then not there).
  final LastPaper? lastPaper;

  final HeaderModel header;

  /// Null while the first load is still running (the skeleton shows).
  final TodayHero? hero;
  final List<AlsoSlot> also;

  /// The newest papers, at most four of them (`sheetRowsShown`).
  final List<SheetRow> sheet;

  /// Every paper on record, the rows' denominator ("Newest 4 of 8"). Never less than the rows.
  final int papers;

  /// The marks across the last papers of the same kind, or null when there are fewer than three
  /// or one of them is sealed.
  final PaperTrend? trend;
  final RoadModel? road;
  final bool offline;

  bool get loading => hero == null;
}
