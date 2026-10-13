// Builds the whole Today screen from [TodayInputs]. Pure: the providers gather the inputs, the
// widgets render the result, and the tests check every state here.
//
// Hero precedence (brief 12, spec 5.3): a session still open, then a mock that ended while the
// student was away, then an unopened result as the sealed sheet, then tonight's move. Whatever
// does not win the hero becomes a compact slot under it, so nothing real is hidden.
import '../../../core/copy/formatters.dart';
import '../../../core/domain/next_move.dart' show isLateNight;
import '../../../core/domain/session_rules.dart';
import '../../../core/models/attempt.dart';
import '../../../core/router/routes.dart';
import '../../../core/widgets/bubbles/bubble_painter.dart';
import '../../rhythm/logic/plan_week.dart';
import '../../rhythm/logic/week_outlook.dart';
import '../copy.dart';
import 'move_builder.dart';
import 'road_builder.dart';
import 'subjects.dart';
import 'today_inputs.dart';
import 'today_model.dart';

export 'road_builder.dart' show buildRoad, expectedWindowStart;

/// Papers shown on "Your sheet".
const int sheetRowsShown = 4;

TodayView buildToday(TodayInputs i) {
  final plain = buildHeader(i);
  if (i.attempts == null && !i.attemptsFailed) {
    return TodayView(header: plain, offline: i.offline);
  }
  final move = buildMove(i);
  final heroes = <TodayHero>[
    ?_resumeOrEnded(i),
    ?_sealed(i),
  ];
  final hero = heroes.isEmpty ? move : heroes.first;
  final header = HeaderModel(
    dateLine: plain.dateLine,
    greeting: plain.greeting,
    week: plain.week,
    updatedLine: plain.updatedLine,
    mobi: _headerMobi(i, hero),
  );
  final also = <AlsoSlot>[
    for (final h in heroes.skip(1)) _slotFor(h),
    if (hero is! MoveHero) _moveSlot(move),
  ];
  return TodayView(
    header: header,
    hero: hero,
    also: also,
    sheet: buildSheet(i),
    road: buildRoad(i),
    offline: i.offline,
  );
}

/// Mobi beside the greeting: every day, unless the hero card already has him.
HeaderMobiCue? _headerMobi(TodayInputs i, TodayHero hero) {
  if (hero is MoveHero && hero.art.isMobi) return null;
  final clock = i.clock();
  if (isLateNight(clock)) return const HeaderMobiCue(HeaderMobiKind.sleepy, TodayCopy.mobiSleepy);
  final today = i.date();
  final recordedToday = (i.attempts ?? const <Attempt>[]).any((a) => i.date(a.completedAt) == today);
  if (recordedToday) return const HeaderMobiCue(HeaderMobiKind.cheer, TodayCopy.mobiCheer);
  if (hero is MoveHero && hero.number != null) return const HeaderMobiCue(HeaderMobiKind.point, TodayCopy.mobiPoint);
  return const HeaderMobiCue(HeaderMobiKind.idle, TodayCopy.mobiIdle);
}

HeaderModel buildHeader(TodayInputs i) {
  final clock = i.clock();
  final week = i.week;
  return HeaderModel(
    dateLine: formatWeekdayDate(clock),
    greeting: TodayCopy.greeting(clock.hour, i.firstName),
    week: week == null ? null : _week(i, week),
    updatedLine: _updatedLine(i),
  );
}

WeekModel _week(TodayInputs i, TodayWeek w) {
  // Without a plan saved in the rhythm module, the onboarding's rest days still draw the plan.
  final rest = i.profile?.restWeekdays ?? const <int>{};
  final planned = w.planned ?? (rest.isEmpty ? null : {for (var d = 0; d < 7; d++) if (!rest.contains(d + 1)) d});
  final outlook = w.goal == null
      ? null
      : weekOutlook(studied: w.studied, todayIndex: w.todayIndex, goal: w.goal!, paused: w.paused, planned: planned);
  return WeekModel(
    days: planWeek(studied: w.studied, todayIndex: w.todayIndex, planned: planned, dates: w.dates),
    count: w.goal == null || w.paused ? w.label : '${w.studied.where((d) => d).length} of ${plural(w.goal!, 'study day')}',
    outlook: outlook?.short,
    met: outlook?.kind == OutlookKind.met || w.met,
    paused: w.paused,
  );
}

String? _updatedLine(TodayInputs i) {
  final cached = i.offline || i.planStale || i.attemptsStale;
  if (!cached) return null;
  final times = [?i.planFetchedAt, ?i.attemptsFetchedAt];
  if (times.isEmpty) return i.offline ? TodayCopy.offlineSuffix : null;
  final latest = times.reduce((a, b) => a.isAfter(b) ? a : b);
  final at = i.clock(latest);
  return i.offline ? TodayCopy.updatedOffline(at) : TodayCopy.updatedAt(at);
}

String _draftLabel(TodayDraft d) => d.isMock ? (d.mockNumber == null ? 'Your mock' : 'Mock ${d.mockNumber}') : 'Your practice';

TodayHero? _resumeOrEnded(TodayInputs i) {
  final d = i.draft;
  if (d == null) return null;
  final label = _draftLabel(d);
  final subject = subjectName(d.subject);
  final title = TodayCopy.resumeTitle(label, subject);
  final ended = !d.endsAt.isAfter(i.now);
  if (!ended && d.resumable) {
    final saved = d.lastAckAt == null ? TodayCopy.answersOnPhone : TodayCopy.savedAt(i.clock(d.lastAckAt));
    return ResumeHero(
      sessionId: d.sessionId,
      title: title,
      answered: d.answered,
      total: d.total,
      line: '${TodayCopy.endsAt(i.clock(d.endsAt))} $saved',
      keyLabel: TodayCopy.resumeKey(d.isMock && d.mockNumber != null ? label : (d.isMock ? 'your mock' : 'your practice')),
      subjectId: canonicalSubject(d.subject),
    );
  }
  if (!ended || !d.isMock) return null;
  final outcome = endedMockOutcome(
    attemptExistsOnServer: d.attemptExists,
    endsAtMs: d.endsAt.millisecondsSinceEpoch,
    nowMs: i.now.millisecondsSinceEpoch,
  );
  final at = i.clock(d.endsAt);
  // A recorded mock that is waiting to be opened is the sealed sheet's job.
  if (outcome == EndedMockOutcome.recorded && i.unopened.any((u) => u.attemptId == d.sessionId)) return null;
  final (line, action) = switch (outcome) {
    EndedMockOutcome.recorded => (
        TodayCopy.endedRecorded(label, at, d.acknowledgedAnswered),
        TodayAction(TodayCopy.openResult, GoTo(AppRoutes.result(d.sessionId))),
      ),
    EndedMockOutcome.beingSent => (
        TodayCopy.endedSending(label, at),
        TodayAction(TodayCopy.tryAgain, GoTo(AppRoutes.runSubmit(d.sessionId))),
      ),
    EndedMockOutcome.windowClosed => (
        TodayCopy.endedClosed(label, at, d.acknowledgedAnswered),
        const TodayAction(TodayCopy.chooseSomethingElse, OpenAlternatives()),
      ),
    EndedMockOutcome.needsCheck => (TodayCopy.endedChecking(label, at), const TodayAction(TodayCopy.tryAgain, RetryLoad())),
  };
  return EndedHero(title: title, line: line, action: action, subjectId: canonicalSubject(d.subject));
}

Attempt? _attempt(TodayInputs i, String id) {
  for (final a in i.attempts ?? const <Attempt>[]) {
    if (a.id == id) return a;
  }
  return null;
}

TodayHero? _sealed(TodayInputs i) {
  if (i.unopened.isEmpty) return null;
  final first = i.unopened.first;
  final a = _attempt(i, first.attemptId);
  final label = a == null ? 'Your mock' : paperLabel(i.attempts!, a);
  final subject = a?.subject;
  return SealedHero(
    attemptId: first.attemptId,
    title: subject == null ? label : TodayCopy.sealedTitle(label, subjectName(subject)),
    line: TodayCopy.receivedAt(i.clock(first.receivedAt)),
    subjectId: subject == null ? null : canonicalSubject(subject),
    moreLine: i.unopened.length > 1 ? TodayCopy.moreResults(i.unopened.length - 1) : null,
  );
}

AlsoSlot _slotFor(TodayHero h) => switch (h) {
      SealedHero() => AlsoSlot(
          title: h.title,
          line: h.line,
          action: TodayAction(TodayCopy.openSheet, GoTo(AppRoutes.resultSealed(h.attemptId))),
        ),
      ResumeHero() => AlsoSlot(
          title: h.title,
          line: h.line,
          action: TodayAction(h.keyLabel, GoTo(AppRoutes.run(h.sessionId)), actionType: 'resume'),
        ),
      EndedHero() => AlsoSlot(title: h.title, line: h.line, action: h.action),
      MoveHero() => _moveSlot(h),
    };

AlsoSlot _moveSlot(MoveHero m) {
  // The slot's key is short: "Start repair, about 10 minutes" becomes "Start repair".
  final p = m.primary;
  final short = p.label.split(',').first;
  return AlsoSlot(
    title: m.overline,
    line: m.summary,
    action: TodayAction(short, p.target, startsSession: p.startsSession, actionType: p.actionType),
  );
}

List<SheetRow> buildSheet(TodayInputs i) {
  final all = i.attempts ?? const <Attempt>[];
  final unopened = {for (final u in i.unopened) u.attemptId};
  return [
    for (final a in all.take(sheetRowsShown)) _row(i, all, a, sealed: unopened.contains(a.id), unopened: unopened),
  ];
}

/// The previous paper of the same subject, kind and length, older than [a]. Never one whose
/// result is still sealed: the change line must not spoil a reveal.
Attempt? _previousComparable(List<Attempt> all, Attempt a, Set<String> unopened) {
  final at = all.indexOf(a);
  for (final b in all.skip(at + 1)) {
    if (b.subject == a.subject && b.mode == a.mode && b.total == a.total) return unopened.contains(b.id) ? null : b;
  }
  return null;
}

String? _change(List<Attempt> all, Attempt a, Set<String> unopened) {
  final prev = _previousComparable(all, a, unopened);
  if (prev == null) return null;
  final label = paperLabel(all, prev);
  final by = a.marks - prev.marks;
  if (by == 0) return TodayCopy.changeLevel(label);
  return by > 0 ? TodayCopy.changeUp(by, label) : TodayCopy.changeDown(-by, label);
}

SheetRow _row(TodayInputs i, List<Attempt> all, Attempt a, {required bool sealed, required Set<String> unopened}) {
  final states = <BubbleState>[
    for (final q in a.questions)
      if (sealed)
        BubbleState.hollow
      else
        switch (a.detailFor(q.id)?.isCorrect) {
          true => BubbleState.filled,
          false => BubbleState.wrong,
          null => BubbleState.blank,
        },
  ];
  final String location;
  if (sealed) {
    location = AppRoutes.resultSealed(a.id);
  } else if (a.isMock) {
    location = AppRoutes.result(a.id);
  } else {
    location = AppRoutes.practiceResult(a.id);
  }
  return SheetRow(
    attemptId: a.id,
    label: paperLabel(all, a),
    subject: subjectName(a.subject),
    date: formatDayMonth(i.date(a.completedAt)),
    states: states,
    target: GoTo(location),
    marks: sealed ? null : a.marks,
    outOf: sealed ? null : a.maxMarks,
    sealed: sealed,
    change: sealed ? null : _change(all, a, unopened),
  );
}
