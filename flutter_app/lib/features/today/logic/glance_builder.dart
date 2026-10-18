// Today 1018 as plain values: the lead card in its 1018 words (title over the number, the subject
// in the overline, the value line), its two choices, and the blocks under it (the week's day
// readouts, the three-layer Road to CUET, Weak chapters, the last paper in full, Repairs and
// Revise). Pure: the widgets render the result and the tests feed fixtures. Every count has its
// denominator; unknown is never zero; stake is the record's own arithmetic.
import 'dart:math' as math;

import '../../../core/domain/marks.dart' show markBreakdownOf, missedMarksDenominator;
import '../../../core/domain/next_move.dart';
import '../../../core/domain/repair_candidates.dart';
import '../../../core/domain/tonight_pick.dart' show chapterKey, isRepairBasis, otherChapter;
import '../../../core/models/attempt.dart';
import '../../../core/router/routes.dart';
import '../../review/data/mistake_index.dart' show buildReviewIndex;
import '../../review/model/review_chapters.dart' show ChapterRow, chapterRows;
import '../../review/model/review_record_adapter.dart' show reviewRecordOf;
import '../../result/model/next_move.dart' show ChapterCost, MoveAnalysis, MoveRow, RowVerdict, costliest;
import '../copy.dart';
import '../copy_glance.dart';
import '../../../core/copy/formatters.dart' show formatTime12;
import '../../onboarding/data/chapter_order.dart' show rankedChapters;
import 'links.dart';
import 'marks_trend.dart';
import 'move_builder.dart';
import 'road_board.dart';
import 'road_builder.dart' show expectedWindowStart;
import 'starter_cards.dart';
import 'subjects.dart';
import 'today_builder.dart' show buildLastPaper;
import 'today_inputs.dart';
import 'today_model.dart';
import 'weeks_ahead.dart';
import '../../../core/domain/cuet_dates.dart';

/// Marks a wrong answer cost: 5 not gained plus 1 taken (CUET marking).
const int marksPerWrong = 6;


/// More papers than this on one day and the week's readout says the count and the newest paper instead of every paper.
const int busyDay = 2;

/// The choice key of a move: the card's two choices are always a different kind from the lead.
String choiceKeyOf(MoveHero m) => switch (m.kind) {
      MoveKind.repair || MoveKind.firstRepair || MoveKind.returning => 'repair',
      MoveKind.revise => 'revise',
      MoveKind.weakest => 'weakest',
      MoveKind.firstMock || MoveKind.mock => 'mock',
      MoveKind.otherSubject => 'other',
      MoveKind.practice => m.choiceKey ?? 'quick',
      _ => 'lead',
    };

/// The move's title over the number (TODAY-1018 section 7).
String leadTitle(MoveHero m) => switch (m.kind) {
      MoveKind.repair || MoveKind.firstRepair || MoveKind.returning => GlanceCopy.titleRepair,
      MoveKind.revise => GlanceCopy.titleRevise,
      MoveKind.dayOne => GlanceCopy.titleStart,
      MoveKind.warmUp => GlanceCopy.titleFooting,
      MoveKind.firstMock => GlanceCopy.titleFirstMock,
      MoveKind.done => GlanceCopy.titleDone,
      MoveKind.smart => GlanceCopy.titleSmart,
      MoveKind.weakest => GlanceCopy.titleWeakest,
      MoveKind.mock => GlanceCopy.titleMock,
      MoveKind.otherSubject => GlanceCopy.titleOtherSubject,
      MoveKind.practice => m.title ?? m.summary,
      _ => switch (m.state) {
          NextMoveState.newUser || NextMoveState.subjectChanged => GlanceCopy.titleStart,
          NextMoveState.stale => GlanceCopy.titleRefresh,
          NextMoveState.thinHistory || NextMoveState.noEligibleContent => GlanceCopy.titleCheck,
          NextMoveState.repairedCheckNotDue => GlanceCopy.titleAnother,
          NextMoveState.noStrongWeakness => GlanceCopy.titleMixed,
          _ => m.summary,
        },
    };

/// [m] in its 1018 words: the subject moves into the overline ("Up next, Accountancy"), the
/// move's title stands over the number, and a repair or Revise says what the mistakes cost. A
/// failed read keeps its own card.
MoveHero presentMove(MoveHero m, TodayInputs i) {
  // A failed read keeps its own card, its title set like every other move's (not the display
  // face), so the error never looks like a different screen.
  if (m.kind == MoveKind.failure || m.state == NextMoveState.historyUnavailable) return m.copyWith(title: m.subjectLine);
  final day = i.firstWeekDay;
  final firstWeek = day != null && m.overline == TodayCopy.firstWeekOverline(day);
  final overline = m.kind == MoveKind.done ? GlanceCopy.doneOverline : (firstWeek ? m.overline : GlanceCopy.upNext(m.subjectLine));
  final n = int.tryParse(m.number ?? '');
  String? value;
  if (n != null) {
    value = switch (m.kind) {
      MoveKind.repair || MoveKind.firstRepair || MoveKind.returning => GlanceCopy.stake(n * marksPerWrong),
      MoveKind.revise => GlanceCopy.stakeThen(n * marksPerWrong),
      _ => null,
    };
  }
  return m.copyWith(overline: overline, title: leadTitle(m), valueLine: value ?? m.valueLine, choiceKey: choiceKeyOf(m));
}

/// "Saturday" within the week, else "3 Oct".
String _fromDay(TodayInputs i, DateTime date) {
  final days = i.date().difference(date).inDays;
  if (days <= 6) return days == 0 ? 'today' : GlanceCopy.weekdayLong(date.weekday);
  return formatDayMonthShortLocal(date);
}

String formatDayMonthShortLocal(DateTime d) => '${d.day} ${const ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.month - 1]}';

/// The lead card's other moves (6.1; D51's Suggested stack shows up to [limit]): the highest-value
/// moves of a different kind from [lead], in the order Repair, Revise, the weakest chapter, a full
/// mock (none in 14 days), another subject. Done for tonight keeps them too, for a student who
/// wants more (its key shows the repairs).
///
/// 19 Oct, G12 (R1): every one of those but the mock and another subject needs a paper, so a fresh
/// account got one card. With no paper yet the deck is the starter cards ([starterChoices], up to
/// [starterDeckSize]), built from the subjects alone; a light record that leaves fewer than
/// [deckMinimum] is topped up from them.
List<MoveChoice> buildChoices(TodayInputs i, MoveHero lead, {WeakChapter? weakest, int limit = 4}) {
  if (lead.kind == MoveKind.failure || lead.state == NextMoveState.historyUnavailable) return const [];
  if ((i.attempts ?? const <Attempt>[]).isEmpty) return starterChoices(i, lead);
  final leadKey = choiceKeyOf(lead);
  final out = <MoveChoice>[];
  void add(String key, MoveChoice? Function() build) {
    if (out.length >= limit || key == leadKey || out.any((c) => c.key == key)) return;
    final c = build();
    if (c != null) out.add(c);
  }

  final all = i.attempts ?? const <Attempt>[];
  add('repair', () {
    final m = repairMoveFor(i);
    final date = basisDate(i);
    if (m == null || date == null) return null;
    return MoveChoice(key: 'repair', title: GlanceCopy.choiceRepair, line: GlanceCopy.choiceRepairLine(openOnBasis(i), _fromDay(i, date)), hero: presentMove(m, i));
  });
  add('revise', () {
    final m = reviseMoveFor(i);
    if (m == null) return null;
    final minutes = int.tryParse((TodayCopy.keyLength(m.primary.label) ?? '').split(' ').first) ?? 5;
    return MoveChoice(key: 'revise', title: GlanceCopy.choiceRevise, line: GlanceCopy.choiceReviseLine(reviseRoundOf(i).size, minutes), hero: presentMove(m, i));
  });
  add('weakest', () {
    final w = weakest;
    if (w == null) return null;
    final m = weakestMoveFor(i, chapter: w);
    return MoveChoice(key: 'weakest', title: GlanceCopy.choiceWeakest, line: w.chapter, hero: presentMove(m, i).copyWith(valueLine: GlanceCopy.stakeLost(w.marks, w.papers)));
  });
  final subject = lead.subjectId ?? (all.isNotEmpty ? canonicalSubject(all.first.subject) : (i.subjects.isEmpty ? null : canonicalSubject(i.subjects.first)));
  add('mock', () {
    if (subject == null) return null;
    final recent = all.where((a) => a.isMock && i.daysSince(a.completedAt) < 14).isNotEmpty;
    if (recent) return null;
    return MoveChoice(key: 'mock', title: GlanceCopy.choiceMock, line: GlanceCopy.choiceMockLine, hero: presentMove(mockMoveFor(i, subject: subject), i));
  });
  add('other', () {
    final other = otherSubjectFor(i, except: subject);
    if (other == null) return null;
    return MoveChoice(key: 'other', title: GlanceCopy.titleOtherSubject, line: GlanceCopy.choiceOtherLine(subjectName(other)), hero: presentMove(otherSubjectMoveFor(i, subject: other), i));
  });
  if (out.length < math.min(limit, deckMinimum)) out.addAll(starterChoices(i, lead, existing: out, limit: math.min(limit, deckMinimum) - out.length));
  return out;
}

List<Attempt> _opened(TodayInputs i) {
  final unopened = {for (final u in i.unopened) u.attemptId};
  return [for (final a in i.attempts ?? const <Attempt>[]) if (!unopened.contains(a.id)) a];
}

String? _chapterOf(String? raw) {
  final c = raw?.trim();
  return c == null || c.isEmpty ? null : c;
}

/// Everything under the move. [lead] is the recommended move (for the day readout and due
/// today); [road] is the built road (its board holds the plan).
TodayGlance buildGlance(TodayInputs i, {MoveHero? lead, RoadModel? road}) {
  final weak = buildWeakChapters(i);
  return TodayGlance(
    readouts: buildReadouts(i),
    road: road?.board == null ? null : buildRoadLayers(i, board: road!.board!, lead: lead),
    weak: weak,
    paper: buildPaperDetail(i),
    queue: buildQueue(i),
    ahead: road?.board == null ? null : buildWeeksAhead(i, board: road!.board!),
    marks: buildMarksTrend(i, subject: lead?.subjectId),
  );
}

Set<int>? _planned(TodayInputs i) {
  final w = i.week;
  if (w == null) return null;
  final rest = i.profile?.restWeekdays ?? const <int>{};
  return w.planned ?? (rest.isEmpty ? null : {for (var d = 0; d < 7; d++) if (!rest.contains(d + 1)) d});
}

DateTime _monday(TodayInputs i) => i.date().subtract(Duration(days: i.clock().weekday - 1));

/// What each day of this week says when tapped (6.3): the papers saved that day, or one line.
List<DayReadout>? buildReadouts(TodayInputs i) {
  final w = i.week;
  if (w == null) return null;
  final all = i.attempts ?? const <Attempt>[];
  final unopened = {for (final u in i.unopened) u.attemptId};
  final monday = _monday(i);
  final today = i.clock().weekday - 1;
  final planned = _planned(i);
  final first = all.isEmpty ? null : i.date(all.last.completedAt);
  final goal = w.paused ? null : w.goal;
  return [
    for (var d = 0; d < 7; d++)
      () {
        final date = monday.add(Duration(days: d));
        final papers = [for (final a in all.reversed) if (i.date(a.completedAt) == date) a];
        String lineOf(Attempt a) => unopened.contains(a.id)
            ? GlanceCopy.paperLineWaiting(paperLabel(all, a), subjectName(a.subject), a.total, formatTime12(i.clock(a.completedAt)))
            : GlanceCopy.paperLine(paperLabel(all, a), subjectName(a.subject), a.total, a.marks, a.maxMarks, formatTime12(i.clock(a.completedAt)));
        // A busy day reads as a count and the newest paper, never a raw log of every paper (final walk, H4):
        // "3 full mocks and 6 quick sets saved." then "Latest: Mock 13, Accountancy, ...". [papers] is oldest first.
        if (papers.length > busyDay) {
          final mocks = papers.where((a) => a.isMock).length;
          final lines = [GlanceCopy.daySummary(mocks, papers.length - mocks), GlanceCopy.latestPaper(lineOf(papers.last))];
          if (d == today) return DayReadout(title: GlanceCopy.todayTitle(date, planned: planned != null && planned.contains(d)), lines: lines, isToday: true);
          return DayReadout(title: GlanceCopy.dayTitle(date), lines: lines);
        }
        final lines = [for (final a in papers) lineOf(a)];
        final isPlanned = planned == null || planned.contains(d);
        if (d == today) return DayReadout(title: GlanceCopy.todayTitle(date, planned: planned != null && planned.contains(d)), lines: lines, isToday: true);
        if (lines.isEmpty) {
          final String line;
          if (d > today) {
            line = isPlanned ? GlanceCopy.plannedAhead : GlanceCopy.restDay;
          } else if (first == null || date.isBefore(first)) {
            line = w.studied[d] ? 'Counted as a study day.' : GlanceCopy.beforeFirst;
          } else if (w.studied[d]) {
            line = 'Counted as a study day.';
          } else if (!isPlanned) {
            line = GlanceCopy.restDay;
          } else {
            line = goal == null ? GlanceCopy.noSessionNoGoal : GlanceCopy.noSession(goal);
          }
          lines.add(line);
        }
        return DayReadout(title: GlanceCopy.dayTitle(date), lines: lines);
      }(),
  ];
}

/// Road to CUET in three layers (the owner's 3:30 am words): due today, due this week, the goal.
RoadLayers buildRoadLayers(TodayInputs i, {required RoadBoard board, MoveHero? lead}) {
  final all = i.attempts ?? const <Attempt>[];
  final w = i.week;
  final todayIdx = i.clock().weekday - 1;
  final planned = _planned(i);
  final goal = w == null || w.paused ? null : w.goal;

  // Due today: the things to do first (the study day counts itself once any of them is done).
  // The lead card's own move comes first when it is not one of tonight's repair or Revise, so the
  // road and the card never name different next things.
  final today = <DueItem>[];
  if (i.repairedToday > 0) today.add(DueItem(label: GlanceCopy.itemRepaired(i.repairedToday), done: true));
  final leadOwn = lead != null &&
      lead.kind != MoveKind.failure &&
      lead.kind != MoveKind.done &&
      lead.state != NextMoveState.historyUnavailable &&
      choiceKeyOf(lead) != 'repair' &&
      lead.kind != MoveKind.revise;
  if (leadOwn) today.add(DueItem(label: lead.title ?? leadTitle(lead), done: false, target: lead.primary.target));
  final f = MoveFacts(i);
  final tonight = f.tonight;
  final b = f.basis;
  if (tonight != null && b != null && !f.dismissed && tonight.items.isNotEmpty) {
    final n = tonight.items.length;
    today.add(DueItem(
      label: GlanceCopy.itemRepair(n, paperLabel(all, b)),
      done: false,
      target: GoTo(TodayLinks.repair(b.id, tonight.items.first.questionId, n)),
    ));
  }
  final due = i.reviseDue;
  if (due != null && due > 0) {
    final size = math.min(i.reviseCap == 5 ? 5 : 10, math.max(1, math.min(i.reviseShown ?? due, due)));
    today.add(DueItem(label: GlanceCopy.itemRevise(size), done: false, target: const GoTo(TodayLinks.revise)));
  }
  if (today.where((t) => !t.done).isEmpty && lead != null && lead.kind != MoveKind.failure && lead.kind != MoveKind.done) {
    today.add(DueItem(label: lead.title ?? leadTitle(lead), done: false, target: lead.primary.target));
  }
  if (w != null && goal != null && (planned == null || planned.contains(todayIdx))) {
    final counted = w.studied[todayIdx];
    today.add(DueItem(label: counted ? GlanceCopy.itemStudyDayDone : GlanceCopy.itemStudyDay, done: counted));
  }

  // This week.
  final monday = _monday(i);
  final sunday = monday.add(const Duration(days: 6));
  final studyDone = w?.studied.where((s) => s).length ?? 0;
  final mocksKnown = i.attempts != null;
  final taken = board.mocksTaken ?? 0;
  final weeks = board.weeksToExam;
  final suggested = board.mockTarget == null;
  final target = board.mockTarget ?? fortnightTarget(weeks: weeks, taken: taken);
  final paced = RoadBoard(today: board.today, examDate: board.examDate, ownDate: board.ownDate, daysToExam: board.daysToExam, mocksTaken: taken, mockTarget: target);
  final every = paced.daysPerMock;
  final mocksThisWeek = all.where((a) => a.isMock && !i.date(a.completedAt).isBefore(monday)).length;
  final last = board.lastMockAt;
  final nextDue = every == null ? null : (last == null ? i.date() : last.add(Duration(days: every)));
  final dueThisWeek = mocksKnown && all.isNotEmpty && mocksThisWeek == 0 && nextDue != null && !nextDue.isAfter(sunday);
  // What the pace asks of this week (one mock every [every] days), never every mock already taken:
  // 13 extra mocks are not 13 things that were due (final walk, H5).
  final weeklyDue = every == null || every <= 0 ? 1 : math.max(1, 7 ~/ every);
  final plannedMocks = mocksThisWeek > 0 || dueThisWeek ? weeklyDue : 0;
  // The next mock's day, on a day the plan studies (the weeks ahead names the same day).
  final nextOn = nextDue == null ? null : snapToPlan(nextDue.isBefore(i.date()) ? i.date() : nextDue, plannedWeekdays(i));
  final weekItems = <DueItem>[
    if (goal != null) DueItem(label: GlanceCopy.itemStudyWeek(studyDone, goal), done: studyDone >= goal),
    if (plannedMocks > 0)
      DueItem(label: GlanceCopy.itemMockWeek(mocksThisWeek, plannedMocks), done: mocksThisWeek >= plannedMocks, target: dueThisWeek && i.attempts != null ? GoTo(TodayLinks.fullMock(subject: all.isEmpty ? null : all.first.subject)) : null)
    else if (nextDue != null && mocksKnown && all.isNotEmpty)
      DueItem(label: GlanceCopy.itemMockWeekNone(GlanceCopy.dayShort(nextOn!)), done: false, info: true),
  ];
  final int plannedDone = math.min<int>(studyDone, goal ?? 0) + math.min<int>(mocksThisWeek, plannedMocks);
  final plannedAll = (goal ?? 0) + plannedMocks;

  // The overall goal.
  final now = i.date();
  final stops = <(DateTime, String)>[
    (CuetDates.registrationStart, GlanceCopy.milestoneRegistration),
    (CuetDates.boardsStart, GlanceCopy.milestoneBoards),
    (board.ownDate ? board.examDate : expectedWindowStart, GlanceCopy.milestoneExam),
  ];
  String? milestone;
  for (final (at, what) in stops) {
    if (at.isAfter(now)) {
      milestone = GlanceCopy.milestone(at.difference(now).inDays, what, at);
      break;
    }
  }
  return RoadLayers(
    today: today,
    weekItems: weekItems,
    weekDays: studyDone,
    weekGoal: goal,
    plannedDone: plannedDone,
    planned: plannedAll,
    weeks: weeks,
    days: board.daysToExam,
    examDate: board.examDate,
    ownDate: board.ownDate,
    mocksTaken: taken,
    mockTarget: target,
    targetSuggested: suggested,
    pace: GlanceCopy.paceWords(every),
    studyDaysLeft: board.studyDaysLeft,
    perWeek: board.goal,
    milestone: milestone,
    mocksKnown: mocksKnown,
    weekKnown: w != null,
    weekMocksPlanned: plannedMocks,
    weekMocksDone: math.min(mocksThisWeek, plannedMocks),
    nextMockOn: plannedMocks == 0 && nextOn != null && mocksKnown && all.isNotEmpty ? nextOn : null,
    weekEnds: sunday,
    weekDaysOpen: w == null || w.studied.length != 7 ? null : [for (var d = todayIdx; d < 7; d++) if (!w.studied[d]) d].length,
    goalItems: [
      DueItem(label: GlanceCopy.itemExamOn(board.examDate, own: board.ownDate), done: false, info: true),
      if (mocksKnown) DueItem(label: GlanceCopy.itemMocksTaken(taken, target, suggested: suggested), done: taken >= target),
      if (board.studyDaysLeft != null && board.goal != null) DueItem(label: GlanceCopy.itemStudyLeft(board.studyDaysLeft!, board.goal!), done: false, info: true),
    ],
  );
}

/// Weak chapters: Review's own chapter record (`chapterRows`), the top three, each with its newest wrong answers (open first).
/// One computation for both screens (final walk, H6): every opened paper, marks lost at 6 a wrong answer and 5 a blank, against
/// 5 a question on offer, ranked most marks lost first. Review's rows come in [TodayInputs.reviewChapters]; until its index is
/// built the same function runs on the papers here. Unmapped questions are left out (no chapter to practise).
WeakChapters buildWeakChapters(TodayInputs i) {
  if (i.attempts == null) return WeakChapters(failed: i.attemptsFailed);
  final all = i.attempts!;
  if (all.isEmpty) return WeakChapters(dayOne: true, startChapters: rankedChapters(canonicalSubject(dayOneSubject(i))) ?? const []);
  final opened = _opened(i);
  final ranked = weakRowsOf(i);
  final rows = <WeakChapter>[];
  for (final r in ranked) {
    if (rows.length >= 3) break;
    if (r.name == otherChapter || r.lost <= 0) continue;
    final subject = canonicalSubject(r.subject ?? '');
    // This chapter's wrong answers, newest paper first, by question number: its open ones lead.
    final list = <(Attempt, int, String)>[
      for (final a in opened)
        for (var k = 0; k < a.questions.length; k++)
          if ('${a.subject}|${chapterKey(a.questions[k].chapter)}' == r.id && a.detailFor(a.questions[k].id)?.isCorrect == false) (a, k + 1, a.questions[k].id),
    ];
    bool isRepaired((Attempt, int, String) m) => i.repaired[m.$1.id]?.contains(m.$3) ?? false;
    final shown = [...list.where((m) => !isRepaired(m)), ...list.where(isRepaired)].take(3);
    rows.add(WeakChapter(
      chapter: r.name,
      subject: subjectName(r.subject ?? subject),
      subjectId: subject,
      missed: r.wrong + r.blank,
      asked: r.questions ?? (r.wrong + r.blank),
      marks: r.lost,
      offer: r.offer,
      wrong: r.wrong,
      blank: r.blank,
      papers: math.max(1, r.papers.length),
      practise: GoTo(TodayLinks.quick(subject: subject, chapter: r.name)),
      review: const GoTo(AppRoutes.reviewMistakes),
      mistakes: [
        for (final (a, number, qid) in shown)
          () {
            final repaired = i.repaired[a.id]?.contains(qid) ?? false;
            final stem = a.questions.firstWhere((q) => q.id == qid).question;
            return WeakMistake(
              attemptId: a.id,
              questionId: qid,
              number: number,
              head: GlanceCopy.mistakeHead(number, paperLabel(all, a), GlanceCopy.paperWhen(i.clock(a.completedAt))),
              stem: stem,
              repaired: repaired,
              // A repaired mistake opens its saved repair, never a new (paid) repair (F17, W-038):
              // the repair route without a count is the saved one, as the result's "See repair".
              target: GoTo(repaired ? AppRoutes.reviewRepair(a.id, qid) : TodayLinks.repair(a.id, qid, 1)),
            );
          }(),
      ],
    ));
  }
  return WeakChapters(rows: rows, papers: opened.length);
}

/// The chapter record Weak chapters reads: Review's rows when its index is built, else Review's own functions run on the
/// papers here (`buildReviewIndex`, `reviewRecordOf`, `chapterRows`), so the figures are the same arithmetic either way.
List<ChapterRow> weakRowsOf(TodayInputs i) {
  final given = i.reviewChapters;
  if (given != null) return given;
  final all = i.attempts ?? const <Attempt>[];
  final unopened = {for (final u in i.unopened) u.attemptId};
  final index = buildReviewIndex(all, const [], unopened: unopened);
  return chapterRows(reviewRecordOf(index, now: i.now, unopened: unopened));
}

/// The chapter that cost [a] the most marks, by the result's own rule ([costliest]): rows are the paper's questions with
/// a recorded answer row, chapters the questions' own. Null when nothing with a chapter was missed.
ChapterCost? costliestChapterOf(Attempt a) {
  final rows = <MoveRow>[];
  for (var k = 0; k < a.questions.length; k++) {
    final q = a.questions[k];
    final d = a.detailFor(q.id);
    if (d == null) continue;
    rows.add(MoveRow(
      qid: q.id,
      number: k + 1,
      chapter: _chapterOf(q.chapter),
      verdict: d.isCorrect == true ? RowVerdict.correct : (d.isCorrect == false ? RowVerdict.wrong : RowVerdict.skipped),
      givenIndex: d.givenIndex,
    ));
  }
  return costliest(MoveAnalysis(rows));
}

/// The last paper in full: right, wrong and blank in words, and its biggest leak.
PaperDetail? buildPaperDetail(TodayInputs i) {
  final paper = buildLastPaper(i);
  if (paper == null) return null;
  final opened = _opened(i);
  if (opened.isEmpty) return null;
  final a = opened.first;
  // The biggest leak is the chapter the result names as the one that cost the most marks: the same function
  // (`costliest`, 6 marks a wrong and 5 a blank), not the chapter with the most misses, so one paper never has two
  // "biggest" chapters on two screens (v15 walk, M6). Its figure is shown against what the whole paper missed.
  String? leak, leakChapter;
  TodayTarget? leakTarget;
  final cost = costliestChapterOf(a);
  if (cost != null) {
    leakChapter = cost.chapter;
    final breakdown = markBreakdownOf(a);
    final against = missedMarksDenominator(chapterMissed: cost.marks, paperMissed: breakdown.lost, paperMax: breakdown.max);
    leak = GlanceCopy.leak(cost.chapter, cost.marks, against, cost.wrong, cost.blank);
    final open = [for (final c in repairCandidates(a, repairedIds: i.repaired[a.id] ?? const {})) if (_chapterOf(c.chapter) == cost.chapter) c];
    if (open.isNotEmpty) leakTarget = GoTo(TodayLinks.repair(a.id, open.first.questionId, open.length));
  }
  // When it was taken, to the minute (TODAY-1018 row 6: "Sat 17 Oct, 9:12 PM, +12 on the one before").
  final when = GlanceCopy.paperWhen(i.clock(a.completedAt));
  return PaperDetail(
    paper: LastPaper(
      title: paper.title,
      sub: paper.change == null ? when : '$when, ${paper.change}',
      marks: paper.marks,
      outOf: paper.outOf,
      target: paper.target,
      change: paper.change,
      up: paper.up,
    ),
    right: a.correct,
    wrong: a.wrong,
    blank: a.unattempted,
    total: a.total,
    leak: leak,
    leakChapter: leakChapter,
    leakTarget: leakTarget,
  );
}

/// The Repairs and Revise tiles.
QueueTiles buildQueue(TodayInputs i) {
  final all = i.attempts;
  final due = i.reviseDue;
  // The round is the lead card's own number (10 of 92), from the same function, so the tile and the card agree.
  final round = due == null || due <= 0 ? null : reviseRoundOf(i).size;
  final size = round ?? (due == null ? 5 : math.min(i.reviseCap == 5 ? 5 : 10, due));
  final minutes = size;
  if (all == null) return QueueTiles(reviseDue: due, reviseRound: round, reviseMinutes: minutes);
  if (all.isEmpty) return QueueTiles(repairsOpen: 0, reviseDue: due, reviseRound: round, reviseMinutes: minutes, dayOne: true);
  // Open repairs: the account's one count (Review's index, which Review's header prints too). Only when that index is
  // not built yet does the tile count the papers on hand, as it did before.
  var open = 0;
  if (i.openRepairs == null) {
    for (final a in _opened(i)) {
      if (!isRepairBasis(a)) continue;
      open += repairCandidates(a, repairedIds: i.repaired[a.id] ?? const {}).length;
    }
  }
  final repaired = i.repaired.values.fold<int>(0, (n, s) => n + s.length);
  return QueueTiles(repairsOpen: i.openRepairs ?? open, repairedToCheck: repaired, reviseDue: due, reviseRound: round, reviseMinutes: minutes);
}
