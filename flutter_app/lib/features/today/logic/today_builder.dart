// Builds the whole Today screen from [TodayInputs]. Pure: the providers gather the inputs, the
// widgets render the result, and the tests check every state here.
//
// Hero precedence (brief 12, spec 5.3): a session still open, then a mock that ended while the
// student was away, then an unopened result as the sealed sheet, then tonight's move. Whatever
// does not win the hero becomes a compact slot under it, so nothing real is hidden.
import '../../../core/copy/formatters.dart';
import '../../../core/domain/session_rules.dart';
import '../../../core/domain/study_day.dart';
import '../../../core/models/attempt.dart';
import '../../../core/router/routes.dart';
import '../../../core/widgets/bubbles/bubble_painter.dart';
import '../../practice/copy.dart' show PracticeCopy;
import '../../practice/model/open_paper.dart' show OpenPaperKind;
import '../../rhythm/logic/plan_week.dart';
import '../../rhythm/logic/week_outlook.dart';
import '../copy.dart';
import 'glance_builder.dart';
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
    // The road draws from the calendar at once (4.4, late data), so it never arrives under the week.
    return TodayView(header: plain, offline: i.offline, road: buildRoad(i));
  }
  // The move in its 1018 words (TODAY-1018): the title over the number, the subject in the
  // overline, the value line.
  final move = presentMove(buildMove(i), i);
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
    weekFailed: plain.weekFailed,
    updatedLine: plain.updatedLine,
    refreshable: plain.refreshable,
    offline: plain.offline,
  );
  // An ended mock that could not be recorded only offers a picker; tonight's move under it is
  // then the one volt key and the picker steps back to a text key.
  final moveLeads = hero is EndedHero && hero.action.target is OpenAlternatives && move.primary.target is GoTo;
  // The paper reel stands alone (D29): play or skip is one tap, then the Up next card returns,
  // so the move is not a second row under it (the v13 row that sat half under the bar, D28).
  final also = <AlsoSlot>[
    for (final h in heroes.skip(1)) _slotFor(h),
    if (hero is! MoveHero && hero is! SealedHero) _moveSlot(move, lead: moveLeads),
  ];
  final road = buildRoad(i);
  final glance = buildGlance(i, lead: move, road: road);
  return TodayView(
    header: header,
    hero: hero,
    also: also,
    sheet: buildSheet(i),
    papers: i.attempts?.length ?? 0,
    trend: buildTrend(i),
    road: road,
    offline: i.offline,
    lastPaper: buildLastPaper(i),
    glance: glance,
    choices: hero is MoveHero ? buildChoices(i, move, weakest: glance.weak.rows.isEmpty ? null : glance.weak.rows.first) : const [],
  );
}

HeaderModel buildHeader(TodayInputs i) {
  final clock = i.clock();
  final week = i.week;
  final name = i.firstName;
  // A name field that is really a handle ("app-e2e-student") is never read out (acceptance 11).
  final usable = name == null || name.isEmpty || TodayCopy.isHandleName(name, email: i.email) ? null : name;
  return HeaderModel(
    dateLine: formatWeekdayDate(clock),
    greeting: TodayCopy.greeting(clock.hour, usable, returning: i.attempts != null && i.attempts!.isNotEmpty && isAway(i)),
    week: week == null ? null : _week(i, week),
    weekLoading: week == null && i.weekLoading,
    weekFailed: week == null && !i.weekLoading && i.weekFailed,
    updatedLine: _updatedLine(i),
    refreshable: _refreshFailed(i),
    offline: i.offline || i.readOffline,
  );
}

/// The papers on screen are the phone's copy because a refresh failed while online (L01, S7): the
/// header says so and its line runs Try again.
bool _refreshFailed(TodayInputs i) => !i.offline && i.attemptsStale && i.attempts != null && i.attemptsFetchedAt != null;

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
  final done = w.studied.where((d) => d).length;
  final met = outlook?.kind == OutlookKind.met || w.met;
  // Days of this week before the account's first paper read as a short dash, never a miss.
  final clock = i.clock();
  final monday = i.date().subtract(Duration(days: clock.weekday - 1));
  final all = i.attempts;
  final first = all == null ? null : (all.isEmpty ? i.date() : i.date(all.last.completedAt));
  final before = <int>{
    if (first != null)
      for (var d = 0; d < 7; d++)
        if (monday.add(Duration(days: d)).isBefore(first) && !w.studied[d]) d,
  };
  final counted = [for (var d = 0; d < 7; d++) if (w.studied[d]) d];
  final (caption, key) = _weekCaption(i, w, today: today, planned: planned, done: done, met: met);
  final m = monday.month.toString().padLeft(2, '0'), dd = monday.day.toString().padLeft(2, '0');
  return WeekModel(
    days: planWeek(studied: w.studied, todayIndex: today, planned: planned, dates: w.dates),
    count: w.goal == null || w.paused ? w.label : '$done of ${plural(w.goal!, 'study day')}',
    outlook: outlook?.short,
    met: met,
    paused: w.paused,
    done: done,
    goal: w.paused ? null : w.goal,
    caption: caption,
    captionKey: key,
    beforeAccount: before,
    weekId: '${monday.year}-$m-$dd',
    counted: counted,
  );
}

/// The one line under the week's marks (TODAY-1017 4.3): the first case that matches wins.
(String, String?) _weekCaption(TodayInputs i, TodayWeek w, {required int? today, required Set<int>? planned, required int done, required bool met}) {
  final counted = [for (var d = 0; d < 7; d++) if (w.studied[d]) d];
  final goal = w.goal;
  if (w.paused) return (TodayCopy.weekPaused, null);
  if (goal == null) return (TodayCopy.weekNoGoal, null);
  if (met) {
    final line = TodayCopy.weekGoalMet(goal);
    return (line, line.substring(0, line.indexOf('.') + 1));
  }
  final all = i.attempts;
  if (all != null && all.isEmpty) return (TodayCopy.weekDayOne(goal), TodayCopy.weekDayOneKey);
  if (done == 0 && all != null && all.isNotEmpty && isAway(i)) return (TodayCopy.weekNew(goal), TodayCopy.weekNewKey(goal));
  final todayCounted = today != null && w.studied[today];
  final todayPlanned = today != null && (planned == null || planned.contains(today));
  // A paper finished today that did not count says why (under 5 answers; fresh-account walk, 19 Oct).
  final short = today == null || todayCounted || all == null ? null : shortPaperToday(all, i.now);
  if (short != null) {
    final line = TodayCopy.shortPaperToday(short);
    return (TodayCopy.weekLine(counted, line), line);
  }
  if (todayPlanned && !todayCounted) {
    if (done + 1 >= goal) {
      final key = TodayCopy.tonightMakes(done + 1);
      return (TodayCopy.weekLine(counted, key), key);
    }
    return (TodayCopy.weekLine(counted, TodayCopy.tonightCounts), TodayCopy.tonightCounts);
  }
  // Today already counted, or a rest day: never "2 more by Sunday" (a retired line that reads as
  // a debt; TODAY-1017 4.3). A counted day names the next planned one, when the week has one.
  if (todayCounted) {
    int? next;
    for (var d = today + 1; d < 7; d++) {
      if (planned == null || planned.contains(d)) {
        next = d;
        break;
      }
    }
    if (next == null) return (TodayCopy.weekCounted(counted), null);
    final tail = TodayCopy.nextStudyDay(TodayCopy.weekdayShort[next]);
    return (TodayCopy.weekLine(counted, tail), null);
  }
  return (TodayCopy.weekLine(counted, TodayCopy.restToday), null);
}

/// Today's "Last paper" row: the newest paper whose result has been opened, with its change on the
/// paper before it of the same kind (4.5). Null with no opened paper.
LastPaper? buildLastPaper(TodayInputs i) {
  final all = i.attempts ?? const <Attempt>[];
  final unopened = {for (final u in i.unopened) u.attemptId};
  Attempt? a;
  for (final x in all) {
    if (!unopened.contains(x.id)) {
      a = x;
      break;
    }
  }
  if (a == null) return null;
  final change = _change(all, a, unopened);
  final prev = _previousComparable(all, a, unopened);
  final date = formatDayMonthShort(i.date(a.completedAt));
  return LastPaper(
    title: TodayCopy.lastPaperName(paperLabel(all, a), subjectName(a.subject)),
    sub: TodayCopy.lastPaperSub(date, change),
    marks: a.marks,
    outOf: a.maxMarks,
    target: GoTo(a.isMock ? AppRoutes.result(a.id) : AppRoutes.practiceResult(a.id)),
    change: change,
    up: prev == null ? null : a.marks > prev.marks,
  );
}

/// When the papers Today shows were last known: the list's last full read, or, when a paper was
/// added after it (a submit the server acknowledged), that paper's own time. Null when the read time
/// is unknown (an unknown time is never invented from a paper).
DateTime? papersDataAt(TodayInputs i) {
  final read = i.attemptsFetchedAt;
  if (read == null) return null;
  final newest = i.attempts?.fold<DateTime?>(null, (best, a) => best == null || a.completedAt.isAfter(best) ? a.completedAt : best);
  return newest != null && newest.isAfter(read) ? newest : read;
}

String? _updatedLine(TodayInputs i) {
  final cached = i.offline || i.readOffline || i.planStale || i.attemptsStale;
  if (!cached) return null;
  final papersAt = papersDataAt(i);
  // Online, the line names the newest data Today shows, the papers' (the card, the week and the sheet
  // are all built from them; the plan only adds the server's own repair hint): never the plan's older
  // read (final walk: "Updated 9:53 PM" over a paper recorded at 10:11 PM). A phone that is offline holds
  // a saved copy of both, so the older of the two stands.
  final papersOnly = !i.offline && !i.readOffline && papersAt != null;
  final times = papersOnly ? [papersAt] : [?i.planFetchedAt, ?papersAt];
  if (times.isEmpty) return i.offline ? TodayCopy.offlineSuffix : null;
  // The older read, as on the home widget: the papers are the list's last full read, served from
  // the phone while the plan is read again, so the newer time would call days-old papers fresh.
  // Both are the time of the last GOOD read (a failed try leaves them alone, see RemoteNotifier), never
  // of the failed try: that one has its own words below ("Still not loading") and is never the "Last loaded".
  final oldest = times.reduce((a, b) => a.isBefore(b) ? a : b);
  final at = i.clock(oldest);
  // The monitor says offline, or the read itself could not reach the server: one condition, the words Review
  // uses over its own saved copy (v15 walk, M2).
  if (i.offline || i.readOffline) return TodayCopy.updatedOffline(at);
  if (_refreshFailed(i)) {
    final tried = i.lastTriedAt;
    return tried == null ? TodayCopy.updatedNotRefreshed(at) : TodayCopy.updatedTried(at);
  }
  return TodayCopy.updatedAt(at);
}

String _draftLabel(TodayDraft d) => d.isMock ? (d.mockNumber == null ? 'Your mock' : 'Mock ${d.mockNumber}') : 'Your practice';

TodayHero? _resumeOrEnded(TodayInputs i) {
  final d = i.draft;
  final ended = d != null && !d.endsAt.isAfter(i.now);
  if (d != null && !ended && d.resumable) {
    final label = _draftLabel(d);
    final subject = subjectName(d.subject);
    final title = TodayCopy.resumeTitle(label, subject);
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
  // A paper that is open and that this phone is not running holds the hero the way a running one does: its
  // credits are spent, so it is continued before anything else is offered (v15 walk, credits).
  final open = _openPaper(i);
  if (open != null) return open;
  if (d == null || !ended || !d.isMock) return null;
  final label = _draftLabel(d);
  final subject = subjectName(d.subject);
  final title = TodayCopy.resumeTitle(label, subject);
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

/// The card for a paper that is open and not on this phone: what it is, when it ends if the server said, and
/// the one key that continues it. A start nobody read has no clock to give, so its line says what happened.
OpenPaperHero? _openPaper(TodayInputs i) {
  final paper = i.openPaper;
  if (paper == null) return null;
  final endsAt = paper.endsAt;
  return OpenPaperHero(
    paper: paper,
    overline: paper.kind == OpenPaperKind.pending ? PracticeCopy.pendingOverline : TodayCopy.resumeOverline,
    title: PracticeCopy.openTitle(apiMode: paper.apiMode, subject: subjectName(paper.subjectId), mockNumber: paper.mockNumber),
    line: endsAt == null ? PracticeCopy.openPendingReason : TodayCopy.endsAt(i.clock(endsAt)),
    keyLabel: PracticeCopy.openKey(apiMode: paper.apiMode),
    subjectId: canonicalSubject(paper.subjectId),
  );
}

Attempt? _attempt(TodayInputs i, String id) {
  for (final a in i.attempts ?? const <Attempt>[]) {
    if (a.id == id) return a;
  }
  return null;
}

TodayHero? _sealed(TodayInputs i) {
  final due = i.reelDue;
  if (due.isEmpty) return null;
  final first = due.first;
  final a = _attempt(i, first.attemptId);
  final label = a == null ? 'Your mock' : paperLabel(i.attempts!, a);
  final subject = a?.subject;
  final name = subject == null ? null : subjectName(subject);
  return SealedHero(
    attemptId: first.attemptId,
    title: name == null ? label : TodayCopy.sealedTitle(label, name),
    // What the reel shows, in one line (D29): no "received at", no marking wait.
    line: TodayCopy.reelLine(name),
    subjectId: subject == null ? null : canonicalSubject(subject),
    moreLine: due.length > 1 ? TodayCopy.moreResults(due.length - 1) : null,
    subject: name,
    questions: a == null || a.total <= 0 ? null : a.total,
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
      OpenPaperHero() => AlsoSlot(title: h.title, line: h.line, action: TodayAction(h.keyLabel, GoTo(AppRoutes.practice))),
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
