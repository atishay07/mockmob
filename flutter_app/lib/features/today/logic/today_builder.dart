// Builds the whole Today screen from [TodayInputs]. Pure: the providers gather the inputs, the
// widgets render the result, and the tests check every state here.
//
// Hero precedence (brief 12, spec 5.3): a session still open, then a mock that ended while the
// student was away, then an unopened result as the sealed sheet, then tonight's move. Whatever
// does not win the hero becomes a compact slot under it, so nothing real is hidden.
import '../../../core/copy/formatters.dart';
import '../../../core/domain/session_rules.dart';
import '../../../core/models/attempt.dart';
import '../../../core/router/routes.dart';
import '../../../core/widgets/bubbles/bubble_painter.dart';
import '../../../core/widgets/bubbles/week_bubbles.dart';
import '../copy.dart';
import 'move_builder.dart';
import 'subjects.dart';
import 'today_inputs.dart';
import 'today_model.dart';

/// Papers shown on "Your sheet".
const int sheetRowsShown = 4;

/// The start of the expected CUET UG window. NTA has not published 2027 dates, so the copy
/// always says "expected".
final DateTime expectedWindowStart = DateTime.utc(2027, 5, 1);

TodayView buildToday(TodayInputs i) {
  final header = buildHeader(i);
  if (i.attempts == null && !i.attemptsFailed) {
    return TodayView(header: header, offline: i.offline);
  }
  final move = buildMove(i);
  final heroes = <TodayHero>[
    ?_resumeOrEnded(i),
    ?_sealed(i),
  ];
  final hero = heroes.isEmpty ? move : heroes.first;
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

HeaderModel buildHeader(TodayInputs i) {
  final clock = i.clock();
  final week = i.week;
  final rest = i.profile?.restWeekdays ?? const <int>{};
  return HeaderModel(
    dateLine: formatWeekdayDate(clock),
    greeting: TodayCopy.greeting(clock.hour, i.firstName),
    week: week == null
        ? null
        : [
            for (var d = 0; d < 7; d++)
              WeekBubbleDay(
                mark: week.studied[d] ? WeekDayMark.done : (rest.contains(d + 1) ? WeekDayMark.rest : WeekDayMark.open),
                isToday: week.todayIndex == d,
              ),
          ],
    weekLabel: week?.label,
    updatedLine: _updatedLine(i),
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
    for (final a in all.take(sheetRowsShown)) _row(i, all, a, sealed: unopened.contains(a.id)),
  ];
}

SheetRow _row(TodayInputs i, List<Attempt> all, Attempt a, {required bool sealed}) {
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
  );
}

RoadModel? buildRoad(TodayInputs i) {
  final days = expectedWindowStart.difference(i.date()).inDays;
  if (days <= 0) return null;
  final profile = i.profile;
  final picks = profile?.ladder.take(3).toList() ?? const [];
  return RoadModel(
    weeks: days ~/ 7,
    category: profile?.category ?? 'UR',
    ladder: [
      for (var k = 0; k < picks.length; k++)
        LadderRung(
          college: picks[k].college,
          course: picks[k].course,
          score: _score(picks[k].closingScore),
          outOf: picks[k].outOf,
          dream: k == 0,
        ),
    ],
  );
}

String _score(num score) => score == score.roundToDouble() ? '${score.round()}' : score.toStringAsFixed(1);
