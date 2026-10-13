// Tonight's move (design spec 5.3, Night Sheet brief 12). The state comes from the core
// precedence table (`nextMoveState`); this file gathers its inputs from the record and turns
// the winning state into one number, one sentence and one action. Returning and late night
// change defaults and warmth only, never the state.
import '../../../core/domain/mock_ordinal.dart';
import '../../../core/domain/next_move.dart';
import '../../../core/domain/repair_candidates.dart';
import '../../../core/domain/tonight_pick.dart';
import '../../../core/models/attempt.dart';
import '../../../core/repositories/dismissal_repository.dart';
import '../../../core/router/action_router.dart';
import '../../../core/router/routes.dart';
import '../../../core/widgets/art/mm_art.dart';
import '../copy.dart';
import 'links.dart';
import 'subjects.dart';
import 'today_inputs.dart';
import 'today_model.dart';

/// A ready repair must come from a paper at least this long (a 10-question check counts).
const int minQuestionsForBasis = minQuestionsForRepairBasis;

/// Chips for practice moves. Practice runs one question a minute, so 30 minutes is not offered.
const List<int> practiceMinutes = [10, 20];

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
    basis = _first(eligible, isRepairBasis);
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

  bool get planReady {
    final kind = inputs.plan?.primary.kind;
    return kind == 'repair' || kind == 'investigate';
  }

  int? get basisAgeDays {
    final b = latestMock ?? basis;
    return b == null ? null : inputs.daysSince(b.completedAt);
  }

  NextMoveInputs get table {
    final subjects = {for (final s in inputs.subjects) canonicalSubject(s)};
    return NextMoveInputs(
      historyUnavailable: (inputs.plan?.recordUnavailable ?? false) || (inputs.attempts == null && inputs.attemptsFailed),
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

TodayMood moodOf(TodayInputs i, MoveFacts f) {
  if (i.attempts != null && i.attempts!.isEmpty) return TodayMood.dayOne;
  if (i.returning) return TodayMood.returning;
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

MoveHero buildMove(TodayInputs i) {
  final f = MoveFacts(i);
  final state = nextMoveState(f.table);
  final mood = moodOf(i, f);
  final overline = mood == TodayMood.dayOne ? TodayCopy.firstMoveOverline : TodayCopy.moveOverline(i.clock());
  final b = f.basis;

  HeroArt artFor(String? subject) => switch (mood) {
        TodayMood.returning => const HeroArt.mobi(MmArt.mobiGreet),
        TodayMood.lateNight => const HeroArt.mobi(MmArt.mobiSleepy),
        _ => HeroArt.object(MmArt.subjectObject(subject == null ? null : canonicalSubject(subject)) ?? MmArt.objAccountancy),
      };
  String? headlineFor() => switch (mood) {
        TodayMood.returning => TodayCopy.returningHeadline(f.attempts.isEmpty ? null : i.daysSince(f.attempts.first.completedAt)),
        TodayMood.lateNight => TodayCopy.lateNight,
        _ => null,
      };

  switch (state) {
    case NextMoveState.historyUnavailable:
      return MoveHero(
        state: state,
        mood: mood,
        overline: overline,
        art: const HeroArt.mobi(MmArt.mobiThink),
        headline: TodayCopy.unavailableTitle,
        meaning: TodayCopy.unavailableLine,
        summary: TodayCopy.unavailableLine,
        primary: const TodayAction(TodayCopy.tryAgain, RetryLoad()),
        secondary: const TodayAction(TodayCopy.choosePractice, GoTo(AppRoutes.practice)),
      );

    case NextMoveState.newUser:
    case NextMoveState.subjectChanged:
      final subject = i.profile?.weakestSubject ?? (i.subjects.isEmpty ? 'accountancy' : i.subjects.first);
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
        mobiLine: state == NextMoveState.newUser ? TodayCopy.mobiDayOne : null,
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
        summary: TodayCopy.practiseToRefresh,
        primary: TodayAction(TodayCopy.practiseToRefresh, GoTo(TodayLinks.quick(subject: basis.subject)), startsSession: true, actionType: 'practice'),
        secondary: const TodayAction(TodayCopy.chooseSomethingElse, OpenAlternatives()),
      );

    case NextMoveState.thinHistory:
    case NextMoveState.noEligibleContent:
      final latest = f.attempts.first;
      final answered = f.attempts.fold<int>(0, (n, a) => n + a.total);
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
        summary: TodayCopy.checkThisSkill,
        primary: TodayAction(TodayCopy.checkThisSkill, GoTo(TodayLinks.quick(subject: latest.subject)), startsSession: true, actionType: 'practice'),
        secondary: const TodayAction(TodayCopy.chooseSomethingElse, OpenAlternatives()),
      );

    case NextMoveState.ready:
      if (b == null || f.tonight == null || f.dismissed) return _planReady(i, f, mood, overline, artFor, headlineFor);
      return _repair(i, f, b, mood, overline, artFor(b.subject), headlineFor());

    case NextMoveState.repairedCheckNotDue:
      final basis = b!;
      final source = paperLabel(f.attempts, basis);
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
        summary: TodayCopy.practiseAnother,
        primary: TodayAction(TodayCopy.practiseAnother, GoTo(TodayLinks.quick(subject: basis.subject)), startsSession: true, actionType: 'practice'),
        secondary: const TodayAction(TodayCopy.chooseSomethingElse, OpenAlternatives()),
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
  final options = [for (final o in repairDurationOptions(chapterCount)) DurationChoice(minutes: o.minutes, mistakes: o.mistakes)];
  final choice = options.isEmpty
      ? DurationChoice(minutes: repairMinutes(chapterCount) ?? 5, mistakes: chapterCount)
      : _pick(options, i.selectedMinutes, preferred: mood == TodayMood.normal ? 20 : 10);
  final n = choice.mistakes ?? chapterCount;
  final source = paperLabel(f.attempts, b);
  final date = i.date(b.completedAt);
  final now = i.clock();
  final chapterLine = tonight.hasNamedChapter
      ? TodayCopy.tonightLine(n, tonight.paperOpen, source, tonight.chapter)
      : TodayCopy.questionNumbers([for (final c in tonight.items.take(n)) c.number]);
  final mocksInSubject = f.attempts.where((a) => a.isMock && a.subject == b.subject).length;
  final meaning = mood == TodayMood.returning ? TodayCopy.lastMockStillHere(source, date, tonight.paperOpen) : chapterLine;
  return MoveHero(
    state: NextMoveState.ready,
    mood: mood,
    overline: overline,
    subjectId: canonicalSubject(b.subject),
    subjectLine: subjectName(b.subject),
    art: art,
    headline: headline,
    number: '$n',
    numberLabel: TodayCopy.mistakesLabel(n, now),
    meaning: meaning,
    evidenceId: b.id,
    durationPrompt: mood == TodayMood.returning && options.isNotEmpty ? TodayCopy.howLong(now) : null,
    durations: options,
    selectedMinutes: choice.minutes,
    summary: 'Repair ${n == 1 ? '1 mistake' : '$n mistakes'} from $source',
    primary: TodayAction(
      TodayCopy.startRepair(choice.minutes),
      GoTo(TodayLinks.repair(b.id, tonight.items.first.questionId, n)),
      startsSession: true,
      actionType: 'repair',
    ),
    secondary: const TodayAction(TodayCopy.chooseSomethingElse, OpenAlternatives()),
    caption: mood == TodayMood.normal && tonight.hasNamedChapter && tonight.chapter.length <= 18
        ? TodayCopy.aajKaRepair(choice.minutes, tonight.chapter)
        : null,
    basisLine: mood == TodayMood.returning
        ? null
        : mocksInSubject <= 1 && b.isMock
        ? '${TodayCopy.basedOn(date)} ${TodayCopy.earlySignal}'
        : TodayCopy.basedOn(date),
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
  final target = ActionRouter.resolve(action.href);
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
      target is NativeTarget ? GoTo(target.location) : const OpenAlternatives(),
      startsSession: true,
      actionType: action.kind,
    ),
    secondary: const TodayAction(TodayCopy.chooseSomethingElse, OpenAlternatives()),
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
  final options = [for (final m in practiceMinutes) DurationChoice(minutes: m)];
  final fallback = mood == TodayMood.normal ? (i.plan?.minutes ?? 10) : 10;
  final minutes = _pick(options, i.selectedMinutes ?? (practiceMinutes.contains(fallback) ? fallback : 10)).minutes;
  return MoveHero(
    state: NextMoveState.noStrongWeakness,
    mood: mood,
    overline: overline,
    subjectId: subject == null ? null : canonicalSubject(subject),
    subjectLine: subject == null ? null : subjectName(subject),
    art: artFor(subject),
    headline: headlineFor(),
    number: '$minutes',
    numberLabel: TodayCopy.minutesUnit,
    meaning: TodayCopy.noStrongWeakness,
    durationPrompt: mood == TodayMood.returning ? TodayCopy.howLong(i.clock()) : null,
    durations: options,
    selectedMinutes: minutes,
    summary: TodayCopy.startMixed(minutes),
    primary: TodayAction(TodayCopy.startMixed(minutes), GoTo(TodayLinks.quick(subject: subject, count: minutes)), startsSession: true, actionType: 'practice'),
    secondary: const TodayAction(TodayCopy.chooseSomethingElse, OpenAlternatives()),
    dismissedLine: f.dismissed ? TodayCopy.hiddenUntilTomorrow : null,
  );
}
