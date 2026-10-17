// Tonight's move (design spec 5.3, Night Sheet brief 12). The state comes from the core
// precedence table (`nextMoveState`); this file gathers its inputs from the record and turns
// the winning state into one number, one sentence and one action. Returning and late night
// change defaults and warmth only, never the state.
import 'dart:math' as math;

import '../../../core/auth/load_problem.dart';
import '../../../core/domain/mock_ordinal.dart';
import '../../../core/domain/next_move.dart';
import '../../../core/domain/repair_candidates.dart';
import '../../../core/domain/tonight_pick.dart';
import '../../../core/models/attempt.dart';
import '../../../core/models/subject.dart' show launchSubjectIds;
import '../../../core/repositories/dismissal_repository.dart';
import '../../../core/router/action_router.dart';
import '../../../core/router/routes.dart';
import '../../../core/widgets/art/mm_art.dart';
import '../../../core/widgets/bubbles/bubble_painter.dart';
import '../../practice/model/practice_selection.dart' show mockQuestionCount, practiceCounts;
import '../copy.dart';
import 'links.dart';
import 'subjects.dart';
import 'today_inputs.dart';
import 'today_model.dart';

/// A ready repair must come from a paper at least this long (a 10-question check counts).
const int minQuestionsForBasis = minQuestionsForRepairBasis;

/// Chips for practice moves: 5, 10 and 20 questions, the lengths Practice itself offers. Practice
/// runs a question a minute, so a chip's count is also its minutes.
final List<int> practiceChoices = [for (final c in const [5, 10, 20]) if (practiceCounts.contains(c)) c];

List<DurationChoice> _practiceOptions() => [for (final c in practiceChoices) DurationChoice(minutes: c, questions: c)];

/// The practice length for a move: the student's chip, else [preferred] (10 unless the mood or
/// the plan says otherwise).
int _practiceCount(TodayInputs i, List<DurationChoice> options, {int preferred = 10}) =>
    _pick(options, i.selectedMinutes, preferred: preferred).minutes;

/// "Mock 7" for a mock, "Quick 10" for practice.
String paperLabel(List<Attempt> all, Attempt a) {
  final n = mockOrdinal(all, a);
  return n == null ? TodayCopy.quickLabel(a.total) : 'Mock $n';
}

/// The facts the precedence table reads, plus what the copy needs.
class MoveFacts {
  MoveFacts(this.inputs) {
    final all = inputs.attempts ?? const <Attempt>[];
    final unopened = {for (final u in inputs.unopened) u.attemptId};
    final eligible = [for (final a in all) if (!unopened.contains(a.id)) a];
    attempts = all;
    // Review's pick: the newest paper that can carry a repair and still has an open mistake.
    // A newer paper that is mostly blank (blanks are never repairs) must not hide an older
    // paper's mistakes. When none has any, the newest basis stays, so "repaired" and "nothing
    // open" are still told from the newest paper.
    final newestBasis = _first(eligible, isRepairBasis);
    basis = _first(eligible, (a) => isRepairBasis(a) && repairCandidates(a, repairedIds: inputs.repaired[a.id] ?? const {}).isNotEmpty) ??
        newestBasis;
    latestMock = _first(eligible, (a) => a.isMock);
    final b = basis;
    if (b != null) {
      repairedHere = inputs.repaired[b.id] ?? const {};
      candidates = repairCandidates(b, repairedIds: repairedHere);
      tonight = pickTonightChapter(candidates, chapterOf: (c) => c.chapter, numberOf: (c) => c.number);
      dismissed = inputs.dismissed.contains(dismissalKeyFor(b));
    }
  }

  final TodayInputs inputs;
  late final List<Attempt> attempts;
  Attempt? basis;
  Attempt? latestMock;
  Set<String> repairedHere = const {};
  List<RepairCandidate> candidates = const [];

  /// Tonight's chapter of [basis] (the same pick Review and Start make).
  TonightChapter<RepairCandidate>? tonight;
  bool dismissed = false;

  static Attempt? _first(List<Attempt> list, bool Function(Attempt) test) {
    for (final a in list) {
      if (test(a)) return a;
    }
    return null;
  }

  /// Where the server's own repair or investigate action goes, when this app can open it.
  /// A web-only path, an external link or an action kind this build does not know has no native
  /// place to go, so it is not a ready action: the card falls back to what the record supports.
  String? get planLocation {
    final primary = inputs.plan?.primary;
    if (primary == null || (primary.kind != 'repair' && primary.kind != 'investigate')) return null;
    final target = ActionRouter.resolve(primary.href);
    return target is NativeTarget ? target.location : null;
  }

  bool get planReady => planLocation != null;

  int? get basisAgeDays {
    final b = latestMock ?? basis;
    return b == null ? null : inputs.daysSince(b.completedAt);
  }

  NextMoveInputs get table {
    final subjects = {for (final s in inputs.subjects) canonicalSubject(s)};
    return NextMoveInputs(
      // Only a total failure is an error card (L01): with the attempts in hand (live or cached),
      // a plan read that failed or said `recordUnavailable` falls back to the client candidates,
      // so the student never sees "did not load" over a record printed under it.
      historyUnavailable: inputs.attempts == null && inputs.attemptsFailed,
      hasAttempts: attempts.isNotEmpty,
      subjectsChangedWithoutAttempt:
          subjects.isNotEmpty && attempts.isNotEmpty && !attempts.any((a) => subjects.contains(canonicalSubject(a.subject))),
      basisAgeDays: basisAgeDays,
      thinEvidence: attempts.isNotEmpty && basis == null,
      hasReadyAction: (candidates.isNotEmpty && !dismissed) || planReady,
      repairedCheckNotDue: basis != null && repairedHere.isNotEmpty && candidates.isEmpty,
    );
  }
}

/// The dismissal key of a client-built repair (spec 5.3: kind, subject, chapter, source).
DismissalKey dismissalKeyFor(Attempt basis) => DismissalKey(kind: 'repair', subject: basis.subject, sourceAttemptId: basis.id);

/// Days away from the last paper that make the move a "pick up where you left off" (TODAY-1017 4.2).
const int returningAfterDays = 7;

/// Seven or more days since the newest paper: the returning move and Mobi's greet.
bool isAway(TodayInputs i) => (i.daysAway ?? 0) >= returningAfterDays;

TodayMood moodOf(TodayInputs i, MoveFacts f) {
  if (i.attempts != null && i.attempts!.isEmpty) return TodayMood.dayOne;
  if (i.returning || isAway(i)) return TodayMood.returning;
  // Late night only shortens the default length: the art and the words stay (F11).
  if (isLateNight(i.clock())) return TodayMood.lateNight;
  return TodayMood.normal;
}

/// The chosen chip, else [preferred] when offered, else the nearest chip below it.
DurationChoice _pick(List<DurationChoice> options, int? selected, {int preferred = 10}) {
  for (final o in options) {
    if (o.minutes == selected) return o;
  }
  var best = options.first;
  for (final o in options) {
    if (o.minutes <= preferred) best = o;
  }
  return best;
}

/// The repair length Today prefers when the student has not chosen one: 20 minutes on an
/// ordinary day, 10 when they are returning or it is late.
int _repairPreferred(TodayMood mood) => mood == TodayMood.normal ? 20 : 10;

/// The length chip tonight's repair uses, or null when it has no chips. The card and the
/// "Something else instead" sheet both read this, so they always highlight the same length.
int? repairMinutesSelected(TodayInputs i, MoveFacts f) {
  final tonight = f.tonight;
  if (tonight == null || f.dismissed) return null;
  final options = [for (final o in repairDurationOptions(tonight.items.length)) DurationChoice(minutes: o.minutes, mistakes: o.mistakes)];
  if (options.isEmpty) return null;
  return _pick(options, i.selectedMinutes, preferred: _repairPreferred(moodOf(i, f))).minutes;
}

/// The words beside the hero's repair number. One count per noun (owner recording, 15 Oct):
/// Review's tab badge counts tonight's chapter, every open mistake of that one chapter of that
/// one paper (`TonightChapter.items`, the same pick Review shows). The hero counts the run the
/// chosen chip starts, which is never more. So "to repair tonight" is said only when the two
/// are the same number; a shorter run names its length instead ("3 to repair in 10 min", with
/// "3 of the 4 in ..." under it), and the badge's 4 never contradicts the hero's 3.
String repairNumberLabel({required int n, required int chapterCount, required int minutes, required DateTime now}) =>
    n < chapterCount ? TodayCopy.mistakesInLabel(minutes) : TodayCopy.mistakesLabel(n, now);

MoveHero buildMove(TodayInputs i) {
  final f = MoveFacts(i);
  final state = nextMoveState(f.table);
  final mood = moodOf(i, f);
  final away = isAway(i) && f.attempts.isNotEmpty;
  final overline = switch (mood) {
    TodayMood.dayOne => TodayCopy.firstMoveOverline,
    _ when away => TodayCopy.returningOverline,
    _ => TodayCopy.moveOverline(i.clock()),
  };
  final b = f.basis;

  // Mobi stands in the art box only at a real moment (4.6): day one and coming back after a week.
  // Late at night the subject's object stays: the sleepy act retired (F11).
  HeroArt artFor(String? subject) => away
      ? const HeroArt.mobi(MmArt.mobiGreet)
      : HeroArt.object(subject: subject == null ? null : canonicalSubject(subject));
  // The overline and the why carry the words now: no warm line between the title and the number.
  String? headlineFor() => null;

  // The first week's path and the done state sit inside the one move (FEATURE-ADOPTION 7).
  if (state != NextMoveState.historyUnavailable && state != NextMoveState.newUser && state != NextMoveState.subjectChanged) {
    final done = _doneToday(i, f, state, overline);
    if (done != null) return done;
    final path = _firstWeek(i, f, state);
    if (path != null) return path;
    if (away && (state == NextMoveState.repairedCheckNotDue || state == NextMoveState.noStrongWeakness || state == NextMoveState.stale)) {
      return _warmUp(i, f, overline);
    }
  }

  switch (state) {
    case NextMoveState.historyUnavailable:
      final offline = i.offline || i.readProblem == LoadProblem.offline;
      final tried = i.lastTriedAt;
      return MoveHero(
        state: state,
        // The failure card has no mood line: its title says it, not a bubble.
        mood: TodayMood.normal,
        overline: '',
        art: const HeroArt.mobi(MmArt.mobiThink),
        subjectLine: offline ? TodayCopy.failOfflineTitle : TodayCopy.failTitle,
        // The named cause, never one sentence for everything.
        meaning: offline ? TodayCopy.unavailableOffline : TodayCopy.unavailableFor(i.readProblem),
        summary: offline ? TodayCopy.unavailableOffline : TodayCopy.unavailableFor(i.readProblem),
        // What the last Try again found, its time changing on every tap; offline, the card says
        // it is watching for the connection instead.
        basisLine: tried != null ? TodayCopy.failTried(i.clock(tried)) : (offline ? TodayCopy.failOfflineWatch : null),
        primary: const TodayAction(TodayCopy.tryAgain, RetryLoad()),
        secondary: offline ? null : const TodayAction(TodayCopy.practiseAnyway, GoTo(AppRoutes.practice)),
        kind: MoveKind.failure,
      );

    case NextMoveState.newUser:
    case NextMoveState.subjectChanged:
      // No subject anywhere yet: the first launch subject, the same order the catalogue uses.
      final subject = i.profile?.weakestSubject ?? (i.subjects.isEmpty ? launchSubjectIds.first : i.subjects.first);
      final name = subjectName(subject);
      final at = i.profile?.firstMoveAt;
      final scheduled = at != null && at.isAfter(i.now) && i.daysSince(at) == 0;
      return MoveHero(
        state: state,
        mood: mood,
        overline: overline,
        subjectId: canonicalSubject(subject),
        subjectLine: name,
        art: state == NextMoveState.newUser ? const HeroArt.mobi(MmArt.mobiGreet) : artFor(subject),
        kind: state == NextMoveState.newUser ? MoveKind.dayOne : MoveKind.other,
        headline: state == NextMoveState.subjectChanged ? TodayCopy.subjectChanged : (scheduled ? TodayCopy.checkSetFor(i.clock(at)) : null),
        number: '10',
        numberLabel: 'questions to your\nstarting point',
        meaning: i.profile?.firstMoveLine == null ? TodayCopy.startingPointLine(name) : TodayCopy.startingPointWith(name, i.profile!.firstMoveLine!),
        summary: '10 questions to your starting point in $name',
        primary: TodayAction(
          TodayCopy.startNow,
          GoTo(i.profile?.firstMoveRoute ?? TodayLinks.quick(subject: subject, purpose: 'baseline')),
          startsSession: true,
          actionType: 'practice',
        ),
        secondary: TodayAction(TodayCopy.fullMockInstead, GoTo(TodayLinks.fullMock(subject: subject)), startsSession: true, actionType: 'mock'),
      );

    case NextMoveState.stale:
      final basis = f.latestMock ?? b!;
      final days = f.basisAgeDays ?? 0;
      final options = _practiceOptions();
      final count = _practiceCount(i, options);
      return MoveHero(
        state: state,
        mood: mood,
        overline: overline,
        subjectId: canonicalSubject(basis.subject),
        subjectLine: subjectName(basis.subject),
        art: artFor(basis.subject),
        headline: headlineFor(),
        number: '$days',
        numberLabel: TodayCopy.staleLabel(days),
        meaning: TodayCopy.staleLine(i.date(basis.completedAt)),
        durationPrompt: TodayCopy.practiceLength,
        durations: options,
        selectedMinutes: count,
        summary: TodayCopy.practiseToRefresh,
        primary: TodayAction(
          TodayCopy.withCount(TodayCopy.practiseToRefresh, count),
          GoTo(TodayLinks.quick(subject: basis.subject, count: count)),
          startsSession: true,
          actionType: 'practice',
        ),
        secondary: const TodayAction(TodayCopy.somethingElse, OpenAlternatives()),
      );

    case NextMoveState.thinHistory:
    case NextMoveState.noEligibleContent:
      final latest = f.attempts.first;
      final answered = f.attempts.fold<int>(0, (n, a) => n + a.total);
      final options = _practiceOptions();
      final count = _practiceCount(i, options);
      return MoveHero(
        state: state,
        mood: mood,
        overline: overline,
        subjectId: canonicalSubject(latest.subject),
        subjectLine: subjectName(latest.subject),
        art: artFor(latest.subject),
        headline: headlineFor(),
        number: '$answered',
        numberLabel: TodayCopy.thinLabel(answered),
        meaning: TodayCopy.thinLine,
        durationPrompt: TodayCopy.practiceLength,
        durations: options,
        selectedMinutes: count,
        summary: TodayCopy.checkThisSkill,
        primary: TodayAction(
          TodayCopy.withCount(TodayCopy.checkThisSkill, count),
          GoTo(TodayLinks.quick(subject: latest.subject, count: count)),
          startsSession: true,
          actionType: 'practice',
        ),
        secondary: const TodayAction(TodayCopy.somethingElse, OpenAlternatives()),
      );

    case NextMoveState.ready:
      if (b == null || f.tonight == null || f.dismissed) return _planReady(i, f, mood, overline, artFor, headlineFor);
      return _repair(i, f, b, mood, overline, artFor(b.subject), headlineFor());

    case NextMoveState.repairedCheckNotDue:
      final basis = b!;
      final source = paperLabel(f.attempts, basis);
      final options = _practiceOptions();
      final count = _practiceCount(i, options);
      return MoveHero(
        state: state,
        mood: mood,
        overline: overline,
        subjectId: canonicalSubject(basis.subject),
        subjectLine: subjectName(basis.subject),
        art: artFor(basis.subject),
        headline: headlineFor(),
        number: '${f.repairedHere.length}',
        numberLabel: TodayCopy.repairedNumberLabel(source),
        meaning: TodayCopy.repairedLine,
        durationPrompt: TodayCopy.practiceLength,
        durations: options,
        selectedMinutes: count,
        summary: TodayCopy.practiseAnother,
        primary: TodayAction(
          TodayCopy.withCount(TodayCopy.practiseAnother, count),
          GoTo(TodayLinks.quick(subject: basis.subject, count: count)),
          startsSession: true,
          actionType: 'practice',
        ),
        secondary: const TodayAction(TodayCopy.somethingElse, OpenAlternatives()),
        dismissedLine: f.dismissed ? TodayCopy.hiddenUntilTomorrow : null,
      );

    case NextMoveState.noStrongWeakness:
      return _mixed(i, f, mood, overline, artFor, headlineFor);
  }
}

MoveHero _repair(TodayInputs i, MoveFacts f, Attempt b, TodayMood mood, String overline, HeroArt art, String? headline) {
  // A repair run covers one chapter, so tonight's count is that chapter's open mistakes.
  final tonight = f.tonight!;
  final chapterCount = tonight.items.length;
  final away = isAway(i);
  final options = [for (final o in repairDurationOptions(chapterCount)) DurationChoice(minutes: o.minutes, mistakes: o.mistakes)];
  final choice = options.isEmpty
      ? DurationChoice(minutes: repairMinutes(chapterCount) ?? 5, mistakes: chapterCount)
      : _pick(options, i.selectedMinutes, preferred: _repairPreferred(mood));
  // Back after a week: the few that cost the most first (tonight's pick is ordered that way),
  // three at most until the student picks a length of their own.
  final full = choice.mistakes ?? chapterCount;
  final n = away && i.selectedMinutes == null && full > _returningFirst ? _returningFirst : full;
  final source = paperLabel(f.attempts, b);
  final date = i.date(b.completedAt);
  final now = i.clock();
  final chapterLine = tonight.hasNamedChapter
      ? TodayCopy.tonightLine(n, chapterCount, source, tonight.chapter, date)
      : TodayCopy.questionNumbers([for (final c in tonight.items.take(n)) c.number]);
  // The sparse clause (AGENT_RULES overlay: say when the data is thin): one paper replaces the
  // source sentence, two add a clause.
  final papers = f.attempts.length;
  final String meaning;
  final MoveKind kind;
  String? whyLink;
  if (away) {
    meaning = TodayCopy.returningWhy(source, date, tonight.paperOpen, n);
    kind = MoveKind.returning;
    if (tonight.paperOpen > n) whyLink = TodayCopy.seeAll(tonight.paperOpen);
  } else {
    final firstRepair = i.firstWeekDay != null && i.repaired.values.every((s) => s.isEmpty);
    final base = papers == 1
        ? TodayCopy.sparseOne(source, date)
        : papers == 2
            ? '$chapterLine ${TodayCopy.sparseFew(papers)}'
            : chapterLine;
    // The first Repair of the first week says what Repair does, at the moment it is the move (F18).
    meaning = firstRepair ? '$base ${TodayCopy.firstRepairTeach}' : base;
    kind = firstRepair ? MoveKind.firstRepair : MoveKind.repair;
  }
  final oneOnly = papers == 1;
  return MoveHero(
    state: NextMoveState.ready,
    mood: mood,
    kind: kind,
    overline: kind == MoveKind.firstRepair ? TodayCopy.firstWeekOverline(i.firstWeekDay!) : overline,
    subjectId: canonicalSubject(b.subject),
    subjectLine: subjectName(b.subject),
    art: art,
    headline: headline,
    number: '$n',
    numberLabel: away ? TodayCopy.mistakesFirstLabel(n) : repairNumberLabel(n: n, chapterCount: chapterCount, minutes: choice.minutes, now: now),
    meaning: meaning,
    whyLink: whyLink,
    evidenceId: b.id,
    evidence: List.filled(n.clamp(1, 3), BubbleState.wrong),
    durations: options,
    selectedMinutes: choice.minutes,
    summary: 'Repair ${n == 1 ? '1 mistake' : '$n mistakes'} from $source',
    primary: TodayAction(
      TodayCopy.startRepair(choice.minutes),
      GoTo(TodayLinks.repair(b.id, tonight.items.first.questionId, n)),
      startsSession: true,
      actionType: 'repair',
    ),
    // With one paper on record the fuller picture is a full mock (4.2, sparse row).
    secondary: oneOnly
        ? TodayAction(TodayCopy.fullMockInstead, GoTo(TodayLinks.fullMock(subject: b.subject)), startsSession: true, actionType: 'mock')
        : const TodayAction(TodayCopy.somethingElse, OpenAlternatives()),
  );
}

/// How many of the last paper's open mistakes the returning move offers first.
const int _returningFirst = 3;

/// Tonight is done: repairs the server acknowledged today, and nothing left open on the paper the
/// move is built from (TODAY-1017 4.2, "Tonight done"). The key offers more practice.
MoveHero? _doneToday(TodayInputs i, MoveFacts f, NextMoveState state, String overline) {
  final n = i.repairedToday;
  final b = f.basis;
  if (n <= 0 || b == null) return null;
  final nothingOpen = state == NextMoveState.repairedCheckNotDue || (state == NextMoveState.ready && f.tonight == null && !f.planReady);
  if (!nothingOpen) return null;
  final count = _practiceCount(i, _practiceOptions());
  return MoveHero(
    state: state,
    mood: TodayMood.normal,
    kind: MoveKind.done,
    overline: overline,
    subjectId: canonicalSubject(b.subject),
    subjectLine: subjectName(b.subject),
    art: HeroArt.object(subject: canonicalSubject(b.subject)),
    number: '$n',
    numberLabel: TodayCopy.doneRepairLabel(n),
    meaning: TodayCopy.doneRepairWhy(null),
    // No length to change: the second pill opens the repairs instead (4.2, Tonight done).
    selectedMinutes: count,
    summary: TodayCopy.practiseMore,
    primary: TodayAction(
      TodayCopy.withCount(TodayCopy.practiseMore, count),
      GoTo(TodayLinks.quick(subject: b.subject, count: count)),
      startsSession: true,
      actionType: 'practice',
    ),
    alternate: const TodayAction(TodayCopy.openTheRepair, GoTo(TodayLinks.repairRecord)),
    secondary: const TodayAction(TodayCopy.somethingElse, OpenAlternatives()),
  );
}

/// The first week as a chained path inside the move (FEATURE-ADOPTION 7): day 2 on, Revise when
/// it has questions due; days 3 and 4 smart practice (Pro); days 5 to 7 the first full mock while
/// none is on record. Day 1 is the check and its first Repair, which the ladder already makes. A
/// mistake still open stays the move (the path never jumps over one), except Revise, which is due
/// today only. Null hands the move back to the ladder.
MoveHero? _firstWeek(TodayInputs i, MoveFacts f, NextMoveState state) {
  final day = i.firstWeekDay;
  if (day == null || day < 2 || f.attempts.isEmpty) return null;
  final latest = f.attempts.first;
  final subject = latest.subject;
  final name = subjectName(subject);
  final overline = TodayCopy.firstWeekOverline(day);
  final art = HeroArt.object(subject: canonicalSubject(subject));
  final due = i.reviseDue ?? 0;
  if (due > 0) return _revise(i, f, state, overline, fallbackSubject: subject);
  if (state == NextMoveState.ready && f.tonight != null && !f.dismissed) return null;
  final hasMock = f.attempts.any((a) => a.isMock);
  if (day >= 5 && !hasMock) {
    const minutes = 60;
    return MoveHero(
      state: state,
      mood: TodayMood.normal,
      kind: MoveKind.firstMock,
      overline: overline,
      subjectId: canonicalSubject(subject),
      subjectLine: name,
      art: art,
      number: '$mockQuestionCount',
      numberLabel: TodayCopy.firstMockLabel(minutes),
      meaning: TodayCopy.firstMockWhy,
      summary: TodayCopy.startTimedMock(minutes),
      primary: TodayAction(TodayCopy.startTimedMock(minutes), GoTo(TodayLinks.fullMock(subject: subject)), startsSession: true, actionType: 'mock'),
      secondary: const TodayAction(TodayCopy.somethingElse, OpenAlternatives()),
    );
  }
  if ((day == 3 || day == 4) && i.isPro) {
    final options = _practiceOptions();
    final count = _practiceCount(i, options);
    return MoveHero(
      state: state,
      mood: TodayMood.normal,
      kind: MoveKind.smart,
      overline: overline,
      subjectId: canonicalSubject(subject),
      subjectLine: name,
      art: art,
      number: '$count',
      numberLabel: TodayCopy.smartLabel,
      meaning: TodayCopy.smartWhy(name, f.attempts.length),
      durations: options,
      selectedMinutes: count,
      summary: TodayCopy.startSmart(count),
      primary: TodayAction(TodayCopy.startSmartFor(count), GoTo(TodayLinks.smart(subject: subject, count: count)), startsSession: true, actionType: 'smart'),
      secondary: const TodayAction(TodayCopy.somethingElse, OpenAlternatives()),
    );
  }
  return null;
}

/// Today's Revise round as the move (TODAY-1017 4.2 applied to Revise; device walk 17 Oct). The
/// number is the round's own size at the student's cap (5 or 10), over "of 92 due today" when
/// fewer than all are asked, so the key's minutes never seem to cover all of them. The title names
/// the subjects the round's questions are from, not the newest paper's; the why names the papers
/// they were missed on (matched on this phone's record) with their dates, and See why opens the
/// newest of them. Change length switches between 5 and 10 questions.
MoveHero _revise(TodayInputs i, MoveFacts f, NextMoveState state, String overline, {required String fallbackSubject}) {
  final due = i.reviseDue ?? 0;
  final remaining = math.max(1, math.min(i.reviseShown ?? due, due));
  final cap = i.reviseCap == 5 ? 5 : 10;
  final size = math.min(cap, remaining);
  final minutes = size <= 5 ? 5 : 10;
  final cards = i.reviseCards.take(size).toList();

  // Subjects, most questions first (ties keep the server's order).
  final counts = <String, int>{};
  for (final c in cards) {
    final s = c.subject;
    if (s != null && s.trim().isNotEmpty) counts[canonicalSubject(s)] = (counts[canonicalSubject(s)] ?? 0) + 1;
  }
  final ranked = counts.keys.toList()..sort((a, b) => counts[b]!.compareTo(counts[a]!));
  final lead = ranked.isEmpty ? canonicalSubject(fallbackSubject) : ranked.first;
  final title = ranked.isEmpty ? subjectName(fallbackSubject) : TodayCopy.reviseSubjects([for (final s in ranked) subjectName(s)]);

  // The papers the round's questions were missed on, newest first.
  final ids = {for (final c in cards) c.questionId};
  final papers = <Attempt>[
    for (final a in f.attempts)
      if (a.details.any((d) => ids.contains(d.qid) && d.isCorrect != true)) a,
  ];
  String meaning;
  if (papers.isNotEmpty) {
    final mocks = [for (final a in papers) if (a.isMock) a];
    final quick = [for (final a in papers) if (!a.isMock) a];
    final parts = <String>[
      for (final a in mocks.take(2)) TodayCopy.revisePaper(paperLabel(f.attempts, a), i.date(a.completedAt)),
      if (mocks.length > 2) TodayCopy.reviseMoreMocks(mocks.length - 2),
      if (quick.length == 1) TodayCopy.revisePaper(paperLabel(f.attempts, quick.first), i.date(quick.first.completedAt)),
      if (quick.length > 1) TodayCopy.reviseQuickMany(quick.length),
    ];
    meaning = TodayCopy.reviseFrom(parts);
  } else {
    final chapters = <String>[];
    for (final c in cards) {
      final ch = c.chapter?.trim();
      if (ch != null && ch.isNotEmpty && !chapters.contains(ch)) chapters.add(ch);
    }
    meaning = chapters.isEmpty ? TodayCopy.reviseWhy(size) : TodayCopy.reviseFromChapters(chapters.first, chapters.length - 1);
  }
  final options = remaining > 5 ? const [DurationChoice(minutes: 5, questions: 5), DurationChoice(minutes: 10, questions: 10)] : const <DurationChoice>[];
  return MoveHero(
    state: state,
    mood: TodayMood.normal,
    kind: MoveKind.revise,
    overline: overline,
    subjectId: lead,
    subjectLine: title,
    art: HeroArt.object(subject: lead),
    number: '$size',
    numberLabel: size < due ? TodayCopy.reviseOfDue(due) : TodayCopy.reviseLabel(size),
    meaning: meaning,
    whyLink: papers.isEmpty ? null : TodayCopy.seeWhy,
    evidenceId: papers.isEmpty ? null : papers.first.id,
    evidence: papers.isEmpty ? null : List.filled(size.clamp(1, 3), BubbleState.wrong),
    durationPrompt: options.isEmpty ? null : TodayCopy.reviseLength,
    durations: options,
    selectedMinutes: options.isEmpty ? null : size,
    summary: TodayCopy.startRevise(minutes),
    primary: TodayAction(TodayCopy.startRevise(minutes), const GoTo(TodayLinks.revise), startsSession: true, actionType: 'revise'),
    secondary: const TodayAction(TodayCopy.somethingElse, OpenAlternatives()),
  );
}

/// Back after a week with nothing open: ten questions to find the footing again.
MoveHero _warmUp(TodayInputs i, MoveFacts f, String overline) {
  final latest = f.attempts.first;
  final options = _practiceOptions();
  final count = _practiceCount(i, options);
  return MoveHero(
    state: NextMoveState.stale,
    mood: TodayMood.returning,
    kind: MoveKind.warmUp,
    overline: overline,
    subjectId: canonicalSubject(latest.subject),
    subjectLine: subjectName(latest.subject),
    art: const HeroArt.mobi(MmArt.mobiGreet),
    number: '$count',
    numberLabel: TodayCopy.warmUpLabel(count),
    meaning: TodayCopy.warmUpWhy(i.daysAway ?? returningAfterDays),
    durations: options,
    selectedMinutes: count,
    summary: TodayCopy.startQuestions(count),
    primary: TodayAction(TodayCopy.warmUpKey(count), GoTo(TodayLinks.quick(subject: latest.subject, count: count)), startsSession: true, actionType: 'practice'),
    secondary: const TodayAction(TodayCopy.somethingElse, OpenAlternatives()),
  );
}

/// The server's own `repair` or `investigate` action (once B10 ships it wins over the client card).
MoveHero _planReady(
  TodayInputs i,
  MoveFacts f,
  TodayMood mood,
  String overline,
  HeroArt Function(String?) artFor,
  String? Function() headlineFor,
) {
  final action = i.plan!.primary;
  final subject = f.attempts.isEmpty ? null : f.attempts.first.subject;
  return MoveHero(
    state: NextMoveState.ready,
    mood: mood,
    overline: overline,
    subjectId: subject == null ? null : canonicalSubject(subject),
    subjectLine: subject == null ? null : subjectName(subject),
    art: artFor(subject),
    headline: headlineFor(),
    meaning: [action.title, if (action.reason != null) action.reason!].join(' '),
    summary: action.title,
    primary: TodayAction(
      action.duration == null ? 'Start' : 'Start, ${action.duration}',
      // `planReady` held, so the location exists; the practice tab is only a safe default.
      GoTo(f.planLocation ?? AppRoutes.practice),
      startsSession: true,
      actionType: action.kind,
    ),
    secondary: const TodayAction(TodayCopy.somethingElse, OpenAlternatives()),
    dismissedLine: f.dismissed ? TodayCopy.hiddenUntilTomorrow : null,
  );
}

MoveHero _mixed(
  TodayInputs i,
  MoveFacts f,
  TodayMood mood,
  String overline,
  HeroArt Function(String?) artFor,
  String? Function() headlineFor,
) {
  final subject = f.attempts.isNotEmpty ? f.attempts.first.subject : (i.subjects.isEmpty ? null : i.subjects.first);
  final options = _practiceOptions();
  final fallback = mood == TodayMood.normal ? (i.plan?.minutes ?? 10) : 10;
  final minutes = _practiceCount(i, options, preferred: practiceChoices.contains(fallback) ? fallback : 10);
  return MoveHero(
    state: NextMoveState.noStrongWeakness,
    mood: mood,
    overline: overline,
    subjectId: subject == null ? null : canonicalSubject(subject),
    subjectLine: subject == null ? null : subjectName(subject),
    art: artFor(subject),
    headline: headlineFor(),
    number: '$minutes',
    numberLabel: TodayCopy.questionsOfMixed,
    meaning: f.dismissed ? TodayCopy.noStrongWeakness : TodayCopy.noOpenMistakes,
    durationPrompt: TodayCopy.practiceLength,
    durations: options,
    selectedMinutes: minutes,
    summary: TodayCopy.startMixed(minutes),
    primary: TodayAction(TodayCopy.startMixed(minutes), GoTo(TodayLinks.quick(subject: subject, count: minutes)), startsSession: true, actionType: 'practice'),
    secondary: const TodayAction(TodayCopy.somethingElse, OpenAlternatives()),
    dismissedLine: f.dismissed ? TodayCopy.hiddenUntilTomorrow : null,
  );
}
