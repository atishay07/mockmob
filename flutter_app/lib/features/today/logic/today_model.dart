// The Today screen as plain values. Built by `buildToday` (pure, unit tested) from the
// repositories, rendered by `TodayBody`. Goldens build these directly from fixtures.
import '../../../core/domain/next_move.dart';
import '../../../core/widgets/bubbles/bubble_painter.dart';
import '../../../core/widgets/bubbles/week_bubbles.dart';
import '../../../core/widgets/art/mm_art.dart';

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
  const TodayAction(this.label, this.target, {this.startsSession = false, this.actionType});

  final String label;
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
  const DurationChoice({required this.minutes, this.mistakes});

  final int minutes;
  final int? mistakes;

  @override
  bool operator ==(Object other) => other is DurationChoice && other.minutes == minutes && other.mistakes == mistakes;

  @override
  int get hashCode => Object.hash(minutes, mistakes);
}

/// What sits in the hero's art corner.
class HeroArt {
  const HeroArt.object(this.art) : isMobi = false;
  const HeroArt.mobi(this.art) : isMobi = true;

  final MmArt art;
  final bool isMobi;
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

/// One paper on "Your sheet": a row of bubbles, one per question, in paper order.
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
  });

  final String attemptId;
  final String label;
  final String subject;
  final String date;
  final List<BubbleState> states;
  final TodayTarget target;

  /// Marks as `correct * 5 - wrong`, null while sealed.
  final int? marks;
  final int? outOf;
  final bool sealed;
}

class LadderRung {
  const LadderRung({required this.college, required this.course, required this.score, this.outOf, this.dream = false});

  final String college;
  final String course;
  final String score;
  final int? outOf;
  final bool dream;
}

class RoadModel {
  const RoadModel({required this.weeks, this.ladder = const [], this.category = 'UR'});

  final int weeks;
  final List<LadderRung> ladder;
  final String category;
}

class HeaderModel {
  const HeaderModel({required this.dateLine, required this.greeting, this.week, this.weekLabel, this.updatedLine});

  final String dateLine;
  final String greeting;
  final List<WeekBubbleDay>? week;
  final String? weekLabel;

  /// "Updated 9:40 PM" when Today shows cached data.
  final String? updatedLine;
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
