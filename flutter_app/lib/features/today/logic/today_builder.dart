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
import 'today_clock.dart' show endedNoticeWindow;
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
    weekLoading: plain.weekLoading,
    updatedLine: plain.updatedLine,
    mobi: _headerMobi(i, hero),
  );
  // An ended mock that could not be recorded only offers a picker; tonight's move under it is
  // then the one volt key and the picker steps back to a text key.
  final moveLeads = hero is EndedHero && hero.action.target is OpenAlternatives && move.primary.target is GoTo;
  final also = <AlsoSlot>[
    for (final h in heroes.skip(1)) _slotFor(h),
    if (hero is! MoveHero) _moveSlot(move, lead: moveLeads),
  ];
  return TodayView(
    header: header,
    hero: hero,
    also: also,
    sheet: buildSheet(i),
    papers: i.attempts?.length ?? 0,
    trend: buildTrend(i),
    road: buildRoad(i),
    offline: i.offline,
  );
}

/// Mobi beside the greeting: every day, unless the hero card already has him. He cheers only for
/// an opened result that improved or held; every other submission today gets a plain wave.
HeaderMobiCue? _headerMobi(TodayInputs i, TodayHero hero) {
  if (hero is MoveHero && hero.art.isMobi) return null;
  final clock = i.clock();
  if (isLateNight(clock)) return const HeaderMobiCue(HeaderMobiKind.sleepy, TodayCopy.mobiSleepy);
  final today = i.date();
  final all = i.attempts ?? const <Attempt>[];
  final unopened = {for (final u in i.unopened) u.attemptId};
  final recordedToday = [for (final a in all) if (i.date(a.completedAt) == today) a];
  if (recordedToday.isNotEmpty) {
    // A paper from today whose result is still sealed: wave, and say nothing about the marks.
    if (recordedToday.any((a) => unopened.contains(a.id))) return const HeaderMobiCue(HeaderMobiKind.idle, TodayCopy.mobiSealed);
    // Cheer only when the newest opened result improved on, or held against, the paper before
    // it. A lower result, or a first paper with nothing to compare, gets the neutral wave.
    final latest = recordedToday.first;
    final prev = _previousComparable(all, latest, unopened);
    if (prev != null && latest.marks >= prev.marks) return const HeaderMobiCue(HeaderMobiKind.cheer, TodayCopy.mobiCheer);
    return const HeaderMobiCue(HeaderMobiKind.idle, TodayCopy.mobiRecorded);
  }
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
    weekLoading: week == null && i.weekLoading,
    updatedLine: _updatedLine(i),
  );
}

/// Which column of the week is today, from the same clock as the date line. The rhythm module's
/// own flag is kept only when it agrees: a week read before midnight (or on another week's
/// dates) never marks yesterday as today under a header that says today's date. Without the
/// week's dates there is nothing to check against and the module's flag stands.
int? _todayIndex(TodayInputs i, TodayWeek w) {
  final dates = w.dates;
  if (dates == null || dates.length != 7) return w.todayIndex;
  final clock = i.clock();
  final column = clock.weekday - 1;
  return dates[column] == clock.day ? column : null;
}

WeekModel _week(TodayInputs i, TodayWeek w) {
  // Without a plan saved in the rhythm module, the onboarding's rest days still draw the plan.
  final rest = i.profile?.restWeekdays ?? const <int>{};
  final planned = w.planned ?? (rest.isEmpty ? null : {for (var d = 0; d < 7; d++) if (!rest.contains(d + 1)) d});
  final today = _todayIndex(i, w);
  final outlook = w.goal == null
      ? null
      : weekOutlook(studied: w.studied, todayIndex: today, goal: w.goal!, paused: w.paused, planned: planned);
  return WeekModel(
    days: planWeek(studied: w.studied, todayIndex: today, planned: planned, dates: w.dates),
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
  // The older read, as on the home widget: the papers are the list's last full read, served from
  // the phone while the plan is read again, so the newer time would call days-old papers fresh.
  final oldest = times.reduce((a, b) => a.isBefore(b) ? a : b);
  final at = i.clock(oldest);
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
      savedAt: d.lastAckAt,
      lead: TodayCopy.endsAt(i.clock(d.endsAt)),
      keyLabel: TodayCopy.resumeKey(d.isMock && d.mockNumber != null ? label : (d.isMock ? 'your mock' : 'your practice')),
      subjectId: canonicalSubject(d.subject),
    );
  }
  if (!ended || !d.isMock) return null;
  // The notice is for the evening it happened. Once a day has passed it stops being the hero
  // (the paper is in the sheet, or the window is long closed), so Today moves on to tonight's
  // move. The draft and its answers stay where they are.
  if (i.now.difference(d.endsAt) >= endedNoticeWindow) return null;
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

AlsoSlot _moveSlot(MoveHero m, {bool lead = false}) {
  // The slot's key is short: "Start repair, about 10 minutes" becomes "Start repair".
  final p = m.primary;
  final short = p.label.split(',').first;
  return AlsoSlot(
    title: m.overline,
    line: m.summary,
    action: TodayAction(short, p.target, startsSession: p.startsSession, actionType: p.actionType),
    lead: lead,
  );
}

List<SheetRow> buildSheet(TodayInputs i) {
  final all = i.attempts ?? const <Attempt>[];
  final unopened = {for (final u in i.unopened) u.attemptId};
  return [
    for (final a in all.take(sheetRowsShown)) _row(i, all, a, sealed: unopened.contains(a.id), unopened: unopened),
  ];
}

/// How many papers the trend strip draws, at most.
const int trendPapers = 6;

/// The marks of the newest paper's kind (same subject, mode and length) across up to
/// [trendPapers] papers, oldest first; null with fewer than three, or when any of them is sealed
/// (the strip would spoil a reveal).
PaperTrend? buildTrend(TodayInputs i) {
  final all = i.attempts ?? const <Attempt>[];
  if (all.isEmpty) return null;
  final unopened = {for (final u in i.unopened) u.attemptId};
  final latest = all.first;
  final ofKind = [
    for (final a in all)
      if (a.subject == latest.subject && a.mode == latest.mode && a.total == latest.total) a,
  ];
  final same = ofKind.take(trendPapers).toList();
  if (same.length < 3 || same.any((a) => unopened.contains(a.id))) return null;
  final subject = subjectName(latest.subject);
  return PaperTrend(
    mock: latest.isMock,
    subject: subject,
    // The caption's denominator: every paper of this kind, so "newest 6 of 7" is the real count.
    ofKind: ofKind.length,
    kind: TodayCopy.trendKind(subject: subject, mock: latest.isMock, nta: latest.mode == 'nta', questions: latest.total),
    points: [
      for (final a in same.reversed)
        TrendPoint(
          attemptId: a.id,
          label: paperLabel(all, a),
          date: formatDayMonthShort(i.date(a.completedAt)),
          marks: a.marks,
          outOf: a.maxMarks,
          target: GoTo(a.isMock ? AppRoutes.result(a.id) : AppRoutes.practiceResult(a.id)),
        ),
    ],
  );
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
