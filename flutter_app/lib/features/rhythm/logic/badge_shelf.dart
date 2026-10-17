// What the badge home on You, the badge sheet and the "Badge earned" row on the result say (BADGES-REFINE-1018,
// the owner's answer of 18 Oct: keep every badge, refine the UI and function around them). PURE: no I/O and no
// clock (callers pass `now`). It reads the board `milestoneTracks` builds from the server's list and the phone's
// own records, and words it exactly as the website does (`src/lib/badgeShelf.js` on web/badges-1018, which stays
// the source of truth for the 16 ids, names and conditions).
//
// Truth rules, held here so a test can hold them:
//   a badge is earned only when the board says so (a real date from data);
//   a count is shown only where the board holds an exact one, always with its denominator, and unknown is never zero;
//   a badge whose record could not be read is "unknown": never "not yet", never the next one, never counted;
//   nothing here ranks the student against anyone, and no word here is a lock or a flame.
import '../../../core/copy/copy.dart' show joinWithAnd;
import '../../../core/router/routes.dart';
import '../../insights/data/subject_names.dart' show subjectDisplayName;
import '../copy.dart';
import 'badge_record.dart';
import 'dates.dart';
import 'milestone_progress.dart';
import 'milestone_tracks.dart';

/// A badge on the board: its state and the path it sits on.
class BoardBadge {
  const BoardBadge(this.view, this.track);

  final StepView view;
  final TrackView track;

  MilestoneStep get step => view.step;
  String get id => view.step.id;
  StepStatus get status => view.status;
  bool get earned => view.status == StepStatus.earned;
  DateTime? get earnedAt => view.earnedAt;
}

/// Every badge, in shelf order (papers, repairs, weeks at your goal, your best work).
List<BoardBadge> boardOf(List<TrackView> tracks) => [for (final t in tracks) for (final s in t.steps) BoardBadge(s, t)];

/// The section's head: "Badges, 6 of 16".
String badgesHead(List<TrackView> tracks) {
  final all = boardOf(tracks);
  return RhythmCopy.badgesHead(all.where((b) => b.earned).length, all.length);
}

/// Earned badges, newest first. Equal times keep the shelf order.
List<BoardBadge> earnedShelf(List<TrackView> tracks) {
  final all = boardOf(tracks);
  final indexed = [for (var i = 0; i < all.length; i++) (i, all[i])].where((e) => e.$2.earned).toList()
    ..sort((a, b) {
      final byTime = b.$2.earnedAt!.compareTo(a.$2.earnedAt!);
      return byTime != 0 ? byTime : a.$1.compareTo(b.$1);
    });
  return [for (final e in indexed) e.$2];
}

// ---------------------------------------------------------------------------------------------
// Counts: the words of "how many more"

/// What each countable badge counts, singular and plural: "3 more repairs", "3 of 5 full mocks".
const Map<String, (String, String)> _nouns = {
  'sessions_10': ('scored set', 'scored sets'),
  'full_mocks_5': ('full mock', 'full mocks'),
  'repairs_5': ('repair', 'repairs'),
  'repairs_10': ('repair', 'repairs'),
  'repairs_25': ('repair', 'repairs'),
  'four_subjects': ('subject', 'subjects'),
  'weeks_met_4': ('week at your goal', 'weeks at your goal'),
  'run_weeks_3': ('week in a row', 'weeks in a row'),
};

/// The count toward a badge not earned, with its denominator.
class CountLeft {
  const CountLeft._(this.current, this.target, this._one, this._many);

  final int current;
  final int target;
  final String _one;
  final String _many;

  int get left => target - current;
  double get fraction => (current / target).clamp(0.0, 1.0);

  /// "3 of 5 full mocks".
  String get so => '$current of $target $_many';

  /// "3 of 5".
  String get short => '$current of $target';

  /// "2 more full mocks".
  String get more => '$left more ${left == 1 ? _one : _many}';
}

/// The exact count toward [stepId], or null (nothing is guessed and nothing is shown as "0 of" an unknown).
CountLeft? countLeft(String stepId, Map<String, int> progress) {
  final current = progress[stepId];
  final target = milestoneTargets[stepId];
  final noun = _nouns[stepId];
  if (current == null || target == null || noun == null || target <= 0 || current < 0 || current >= target) return null;
  return CountLeft._(current, target, noun.$1, noun.$2);
}

/// The one badge to show as the ghost: the one closest to done where an exact count exists (a badge with
/// nothing counted yet is not "close"), else the first not earned in shelf order. A badge that could not be
/// read is never picked. Null when every readable badge is earned.
BoardBadge? pickNext(List<TrackView> tracks, Map<String, int> progress) {
  final all = boardOf(tracks);
  final candidates = [
    for (var i = 0; i < all.length; i++)
      if (all[i].status == StepStatus.next) (i, all[i]),
  ];
  if (candidates.isEmpty) return null;
  final counted = [
    for (final c in candidates)
      if (countLeft(c.$2.id, progress) case final n? when n.current > 0) (c.$1, c.$2, n),
  ]..sort((a, b) {
      final byFraction = b.$3.fraction.compareTo(a.$3.fraction);
      if (byFraction != 0) return byFraction;
      final byLeft = a.$3.left.compareTo(b.$3.left);
      return byLeft != 0 ? byLeft : a.$1.compareTo(b.$1);
    });
  return counted.isNotEmpty ? counted.first.$2 : candidates.first.$2;
}

/// The ghost's one line: "Repairs: 7 of 10. 3 more repairs." or, with no exact count, the path and what lands it.
String ghostLine(BoardBadge badge, Map<String, int> progress) {
  final c = countLeft(badge.id, progress);
  final path = badge.track.track.title;
  return c == null ? '$path. ${badge.step.condition}' : '$path: ${c.short}. ${c.more}.';
}

// ---------------------------------------------------------------------------------------------
// The badge sheet

/// The one key of a badge not earned: its label and where it goes.
typedef BadgeAction = ({String label, String location});

/// Where a badge is earned: its own key (null for an id with no place to go).
BadgeAction? badgeAction(MilestoneStep step) => switch (step.id) {
      'first_scored_session' || 'sessions_10' => (label: RhythmCopy.startSet, location: AppRoutes.practiceStart),
      'first_full_mock' || 'full_mocks_5' || 'new_best' => (label: RhythmCopy.stepActionFullMock, location: AppRoutes.practiceStart),
      'first_nta' => (label: RhythmCopy.stepActionNta, location: AppRoutes.examNta),
      'clean_set' || 'four_subjects' => (label: RhythmCopy.startSet, location: AppRoutes.practiceStart),
      'first_hold' => (label: RhythmCopy.stepActionRepair, location: AppRoutes.reviewMistakes),
      'run_weeks_3' => (label: RhythmCopy.stepActionRhythm, location: AppRoutes.youRhythm),
      'first_repair' || 'repairs_5' || 'repairs_10' || 'repairs_25' => (label: RhythmCopy.stepActionRepair, location: AppRoutes.reviewMistakes),
      'first_week_met' || 'weeks_met_4' => (label: RhythmCopy.stepActionRhythm, location: AppRoutes.youRhythm),
      _ => null,
    };

/// The next badge on the same path, after another one. "Your best work" is not a sequence, so there it is the
/// other badge still to earn ([also]). A badge that could not be read is never named as next.
class NextOnPath {
  const NextOnPath(this.badge, {required this.also});

  final BoardBadge badge;
  final bool also;
}

NextOnPath? nextOnPath(List<TrackView> tracks, String stepId) {
  for (final t in tracks) {
    final at = t.steps.indexWhere((s) => s.step.id == stepId);
    if (at < 0) continue;
    if (t.track == MilestoneTrack.best) {
      for (final s in t.steps) {
        if (s.step.id != stepId && s.status == StepStatus.next) return NextOnPath(BoardBadge(s, t), also: true);
      }
      return null;
    }
    for (final s in t.steps.skip(at + 1)) {
      if (s.status == StepStatus.next || s.status == StepStatus.later) return NextOnPath(BoardBadge(s, t), also: false);
    }
    return null;
  }
  return null;
}

/// The paper behind an earned badge, in two lines.
class PaperLine {
  const PaperLine({required this.attemptId, required this.from, required this.marks});

  final String attemptId;

  /// "From Accountancy full mock, Sat 17 Oct, 9:12 PM".
  final String from;

  /// "152 of 250 marks, 142 before" (empty when the paper has no marks to say).
  final String marks;
}

/// The paper's own time is not said twice: a badge dated by its paper already says that time on its "Earned" line.
PaperLine? paperLine(BadgeRecord? record, String zone, {DateTime? earnedAt}) {
  if (record == null || record.attemptId.isEmpty) return null;
  final same = earnedAt != null && record.at.millisecondsSinceEpoch == earnedAt.millisecondsSinceEpoch;
  final when = same ? '' : ', ${formatWhen(record.at, zone)}';
  final marks = record.max > 0 ? RhythmCopy.badgePaperMarks(record.marks, record.max, before: record.before) : '';
  return PaperLine(
    attemptId: record.attemptId,
    from: RhythmCopy.badgePaperFrom(subjectDisplayName(record.subject), RhythmCopy.paperKind(record.mode), when),
    marks: marks,
  );
}

/// Everything the badge sheet says about one badge.
class BadgeDetail {
  const BadgeDetail({
    required this.badge,
    this.earnedLine,
    this.paper,
    this.count,
    this.next,
    this.nextCount,
    this.action,
    this.pathDone = false,
    this.after,
    this.pathLine,
  });

  final BoardBadge badge;

  /// "Earned Sat 17 Oct, 9:12 PM" (only for an earned badge, which always has a real date).
  final String? earnedLine;
  final PaperLine? paper;

  /// The count so far toward a badge not earned, only where it is exact.
  final CountLeft? count;
  final NextOnPath? next;
  final CountLeft? nextCount;

  /// The one key: what earns this badge when it is not earned, what earns the next one when it is.
  final BadgeAction? action;

  /// Every badge on the path is earned.
  final bool pathDone;

  /// For a badge that comes later on its path: the one before it ("5 repairs").
  final String? after;

  /// Where it sits on its path: "Papers, step 3 of 5." (best work: "Your best work. Any of these can come first.").
  final String? pathLine;

  bool get earned => badge.earned;
  bool get unknown => badge.status == StepStatus.unknown;
}

/// The detail of [stepId] from the board, or null for an id that is not on it. [records] is the paper behind each
/// badge the phone worked out, [zone] the student's time zone.
BadgeDetail? detailOf(
  List<TrackView> tracks,
  String stepId, {
  Map<String, int> progress = const {},
  Map<String, BadgeRecord> records = const {},
  String zone = 'Asia/Kolkata',
}) {
  final badge = boardOf(tracks).where((b) => b.id == stepId).firstOrNull;
  if (badge == null) return null;
  final earned = badge.earned;
  final unknown = badge.status == StepStatus.unknown;
  final next = nextOnPath(tracks, stepId);
  final steps = badge.track.steps;
  final at = steps.indexWhere((s) => s.step.id == stepId);
  final sequence = badge.track.track != MilestoneTrack.best;
  return BadgeDetail(
    badge: badge,
    earnedLine: earned ? RhythmCopy.badgeEarnedWhen(formatWhen(badge.earnedAt!, zone)) : null,
    paper: earned ? paperLine(records[stepId], zone, earnedAt: badge.earnedAt) : null,
    count: earned || unknown ? null : countLeft(stepId, progress),
    next: next,
    nextCount: next == null ? null : countLeft(next.badge.id, progress),
    action: unknown ? null : badgeAction(earned ? (next?.badge.step ?? badge.step) : badge.step),
    pathDone: next == null && badge.track.complete,
    after: badge.status == StepStatus.later && sequence && at > 0 ? steps[at - 1].step.name : null,
    pathLine: sequence ? RhythmCopy.badgePathStep(badge.track.track.title, at + 1, steps.length) : RhythmCopy.badgeNoSequence(badge.track.track.title),
  );
}

// ---------------------------------------------------------------------------------------------
// The earned moment on the result

/// A badge earned by a scored set counts for that result when its date is this close to the set's own.
const Duration matchWindow = Duration(minutes: 2);

/// After this long a result no longer announces a badge: the moment has passed.
const Duration recentWindow = Duration(days: 3);

/// The badges this scored set earned: a record that names this paper, or (for the papers, weeks and best-work
/// paths, which a set can land) a date within two minutes of the set's own. Repairs are dated by the repair, not by
/// the set, so only a record can tie one to a paper. Earned only with a real date, recent only.
List<BoardBadge> earnedByAttempt(
  List<TrackView> tracks,
  Map<String, BadgeRecord> records, {
  required String attemptId,
  required DateTime completedAt,
  required DateTime now,
}) {
  if (attemptId.isEmpty) return const [];
  return [
    for (final b in boardOf(tracks))
      if (b.earned && now.difference(b.earnedAt!) <= recentWindow && _belongsTo(b, records, attemptId, completedAt)) b,
  ];
}

bool _belongsTo(BoardBadge b, Map<String, BadgeRecord> records, String attemptId, DateTime completedAt) {
  if (records[b.id]?.attemptId == attemptId) return true;
  if (b.track.track == MilestoneTrack.repairs) return false;
  // The server dates a set's badges by the set; a phone-made one carries its paper in `records`.
  if (completedAt.millisecondsSinceEpoch <= 0) return false;
  return b.earnedAt!.difference(completedAt).abs() <= matchWindow;
}

/// The key remembering that this badge, with this date, has been shown on a result (a re-dated badge shows again).
String badgeSeenKey(String id, DateTime earnedAt) => 'badge-seen:$id:${earnedAt.millisecondsSinceEpoch}';

/// The row's words: "Badge earned" and its name, or "2 badges earned" and both names.
class MomentWords {
  const MomentWords({required this.title, required this.detail, required this.count});

  final String title;
  final String detail;
  final int count;
}

MomentWords? momentWords(List<BoardBadge> badges) {
  if (badges.isEmpty) return null;
  final names = [for (final b in badges) b.step.name];
  return MomentWords(
    title: badges.length == 1 ? RhythmCopy.badgeEarnedOne : RhythmCopy.badgesEarnedMany(badges.length),
    detail: joinWithAnd(names),
    count: badges.length,
  );
}
