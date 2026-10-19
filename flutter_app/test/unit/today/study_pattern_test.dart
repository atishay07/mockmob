// The smart layer's first slice (SMART-LAYER-1019PM 2.8): StudyPattern on fixture logs for a new, a
// regular, an irregular, a shifted and a motivated student; the backfill from papers; time away;
// midnight; every insight's truth condition; and the claim auditor, which recomputes every number a
// line prints from the raw log with a separate, naive implementation, over 500 random logs.
import 'dart:math' as math;

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/features/today/copy_pattern.dart';
import 'package:mockmob/features/today/logic/move_builder.dart';
import 'package:mockmob/features/today/logic/pattern_fixtures.dart';
import 'package:mockmob/features/today/logic/smart_cards.dart';
import 'package:mockmob/features/today/logic/study_log.dart';
import 'package:mockmob/features/today/logic/study_pattern.dart';
import 'package:mockmob/features/today/logic/suggested_deck.dart';
import 'package:mockmob/features/today/logic/today_builder.dart' show buildToday;
import 'package:mockmob/features/today/logic/today_model.dart';

import 'support/today_fixtures.dart';

/// Monday 19 October 2026, 10 pm IST.
final DateTime clock = DateTime.utc(2026, 10, 19, 16, 30);

/// The same Monday at 7 pm IST (not late night).
final DateTime evening = DateTime.utc(2026, 10, 19, 13, 30);

String? line(StudyPattern p, {int? chip}) {
  final advice = adviseLength(p);
  return lengthLine(p, advice, chip: chip ?? advice.pick(const [5, 10, 15, 20]) ?? 10, when: 'tonight')?.text;
}

Attempt paperWith({required String id, required DateTime end, int? startedMinutesBefore, String mode = 'quick', int total = 10, List<Map<String, Object>>? presence, bool mob = false, String subject = 'accountancy'}) {
  final start = startedMinutesBefore == null ? null : end.subtract(Duration(minutes: startedMinutesBefore)).millisecondsSinceEpoch;
  return Attempt.fromJson({
    'id': id,
    'subject': subject,
    'score': 0,
    'correct': 0,
    'wrong': 0,
    'unattempted': total,
    'total': total,
    'details': const [],
    'questionsSnapshot': const [],
    'selectionMeta': {
      'mode': mode,
      'sessionId': 'sess-$id',
      if (start != null) 'client': {'platform': 'android', 'startedAt': start},
      if (presence != null) 'recovery': {'presence': presence},
      if (mob) 'mobPaper': {'id': 'mob1'},
    },
    'completedAt': end.toIso8601String(),
  });
}

void main() {
  group('the fixtures', () {
    test('new: says it is still learning and follows the goal, and claims nothing else', () {
      final p = PatternFixtures.fresh().pattern(clock);
      expect(p.learning, isTrue);
      expect(line(p), "I'm still learning how you study. For now, tonight's plan follows your 20-minute goal.");
      expect(p.length, isNull);
      expect(p.time, isNull);
      expect(p.timeShape, isNull);
      expect(p.preferredMode, isNull);
      expect(p.avoided, isNull);
      expect(p.raise, isNull);
      expect(p.fit, isNull);
      expect(goalLine(p), isNull, reason: 'nothing done today, so no progress line');
    });

    test('new_three: asks for two more sessions and says no usual length or time', () {
      final p = PatternFixtures.newThree(clock).pattern(clock);
      expect(p.sessions28, 3);
      expect(line(p), "I'm still learning how you study. After 2 more sessions, I'll plan around your real times.");
      expect(p.length, isNull);
      expect(p.time, isNull);
    });

    test('regular: about 40 minutes after 9:30 PM, the raise card at 40, Economics waiting 16 days, no fit card', () {
      final p = PatternFixtures.regular(clock).pattern(clock);
      expect(p.learning, isFalse);
      expect(p.length!.minutes, 40);
      expect(p.length!.ranged, isFalse);
      expect(p.timeShape, TimeShape.known);
      expect(p.time!.window, StudyWindow.late);
      expect(PatternCopy.time(p.time!.afterMinute), '9:30 PM');
      // Practice offers 5 to 20 questions: the plan cannot be 40, so the line says what it is.
      expect(line(p), 'You usually practise about 40 minutes after 9:30 PM, so tonight\'s plan starts with 20 minutes and you can keep going.');
      expect(p.raise, isNotNull);
      expect(p.raise!.minutes, 40);
      expect(p.raise!.days, 5);
      expect(p.raise!.outOf, 7);
      expect(PatternCopy.raiseTitle(40), 'Make 40 minutes your daily goal?');
      expect(PatternCopy.raiseLine(40, 5, 7), 'You have done about 40 minutes on 5 of your last 7 study days.');
      expect(p.fit, isNull);
      expect(p.avoided!.subject, 'economics');
      expect(p.avoided!.days, 16);
      expect(PatternCopy.untouchedTitle('Economics', 16), 'Economics has been waiting 16 days.');
      expect(p.preferredMode, StudyMode.chapter);
    });

    test('regular: the Economics card enters the deck at position 2 and the goal card after it', () {
      final p = PatternFixtures.regular(clock).pattern(clock);
      final i = ashaInputs(now: clock, attempts: [accountancyMock('a1', daysBefore(clock, 1))], pattern: p);
      final lead = buildMove(i);
      final smart = smartChoices(i, lead);
      expect([for (final c in smart) c.key], ['untouched:economics', PatternCards.raise]);
      final deck = withSmartChoices(const [
        MoveChoice(key: 'repair', title: 'r', line: 'r'),
        MoveChoice(key: 'mock', title: 'm', line: 'm'),
      ], smart);
      expect([for (final c in deck) c.key], ['repair', 'untouched:economics', PatternCards.raise, 'mock']);
      final untouched = smart.first;
      expect(untouched.line, startsWith('You chose Economics for CUET but have not practised it for 16 days.'));
      expect(untouched.hero!.subjectId, 'economics');
      final raise = smart[1];
      expect(raise.action!.target, const SetDailyGoal(40));
    });

    test('irregular: no single usual time, and no single length', () {
      final p = PatternFixtures.irregular(clock).pattern(clock);
      expect(p.learning, isFalse);
      expect(p.time, isNull);
      expect(p.timeShape, isNot(TimeShape.known));
      expect(p.length == null || p.length!.ranged, isTrue);
      final said = line(p)!;
      expect(said, anyOf(PatternCopy.irregular, startsWith('Your sessions run between ')));
      expect(said, isNot(contains(' after ')));
    });

    test('shifted: says lately in the mornings and never the old 9:30 PM', () {
      final p = PatternFixtures.shifted(clock).pattern(clock);
      expect(p.shiftWindow, StudyWindow.early);
      expect(p.length!.lately, isTrue);
      expect(p.length!.minutes, 25);
      final said = line(p)!;
      expect(said, 'Lately you practise in the mornings, so the plan now fits around that.');
      expect(said, isNot(contains('9:30')));
    });

    test('motivated: a 2-hour goal leads with a full mock; after both, "Goal met. Keep going?" with a real move', () {
      final p = PatternFixtures.motivated(evening).pattern(evening);
      expect(p.recentFullMock, isTrue);
      expect(adviseLength(p).fullMockLead, isTrue);
      final i = ashaInputs(now: evening, attempts: [accountancyMock('clean', daysBefore(evening, 1))], pattern: p);
      final m = buildMove(i);
      expect(m.kind, MoveKind.mock);
      expect(m.primary.label, 'Start full mock, 60 min');
      // Two mocks done today: the goal is met, and the card still holds a real move.
      final today = PatternFixture(
        goal: 120,
        notes: PatternFixtures.motivated(evening).notes,
        log: [
          ...PatternFixtures.motivated(evening).log,
          session('t1', istAt(evening, 0, 15, 0), 60, mode: StudyMode.full),
          session('t2', istAt(evening, 0, 17, 0), 60, mode: StudyMode.full),
        ],
      ).pattern(evening);
      expect(today.goalMet, isTrue);
      expect(today.doneTodayMinutes, 120);
      final after = buildMove(ashaInputs(now: evening, attempts: [accountancyMock('clean', daysBefore(evening, 1))], pattern: today));
      expect(after.overline, PatternCopy.goalMetOverline);
      // The card Today shows (its 1018 words) keeps the moment too.
      final shown = buildToday(ashaInputs(now: evening, attempts: [accountancyMock('clean', daysBefore(evening, 1))], pattern: today)).hero! as MoveHero;
      expect(shown.overline, PatternCopy.goalMetOverline);
      expect(after.primary.startsSession, isTrue, reason: 'never a stop: a real next move is one tap away');
      expect(goalLine(today)!.text, 'You have done 120 minutes today. Every extra paper still counts.');
    });
  });

  group('the log from papers', () {
    test('heavy backfill: length and time from the papers with a start, time of day only from the rest', () {
      final attempts = <Attempt>[
        for (var k = 0; k < 60; k++)
          paperWith(id: 'p$k', end: istAt(clock, 1 + k % 50, 21, 40), startedMinutesBefore: k < 25 ? 30 : null, total: 20),
      ];
      final log = mergeAttempts(const [], attempts, now: clock);
      expect(log.where((e) => e.timed).length, lessThanOrEqualTo(25));
      expect(log.where((e) => !e.timed).every((e) => e.activeMs == null && e.startedAtMs == null), isTrue);
      final p = StudyPattern.from(log: log, now: clock);
      expect(p.length!.minutes, 30, reason: 'only papers with a start give a length');
      expect(p.time!.window, StudyWindow.late);
      // A paper already in the log keeps its entry.
      expect(mergeAttempts(log, attempts, now: clock).length, log.length);
    });

    test('away time: a 50-minute paper with 20 minutes away counts 30', () {
      final end = istAt(clock, 1, 21, 50);
      final start = end.subtract(const Duration(minutes: 50)).millisecondsSinceEpoch;
      final a = paperWith(id: 'away', end: end, startedMinutesBefore: 50, mode: 'full', total: 50, presence: [
        {'type': 'away', 'at': start + 10 * 60000, 'qid': 'q1'},
        {'type': 'back', 'at': start + 30 * 60000, 'qid': 'q1'},
      ]);
      final e = entryFromAttempt(a);
      expect(e.activeMs, 30 * 60000);
      expect(e.activeMs, isNot(50 * 60000));
    });

    test('a paper is capped at its limit, a Mob paper is a Mob session, and a context joins its paper', () {
      final long = entryFromAttempt(paperWith(id: 'cap', end: istAt(clock, 1, 23, 0), startedMinutesBefore: 300, total: 10));
      expect(long.activeMs, 20 * 60000, reason: 'a ten-question practice is capped at 20 minutes');
      final mob = entryFromAttempt(paperWith(id: 'mob', end: istAt(clock, 1, 21, 0), startedMinutesBefore: 40, mob: true));
      expect(mob.mode, StudyMode.mob);
      expect(mob.source, StudySource.mob);
      final a = paperWith(id: 'ch', end: istAt(clock, 1, 21, 30), startedMinutesBefore: 15);
      final ctx = StudyContext(atMs: istAt(clock, 1, 21, 14).millisecondsSinceEpoch, source: StudySource.todayLead, mode: StudyMode.chapter, suggestedMinutes: 10, chosenMinutes: 15);
      final e = entryFromAttempt(a, context: contextFor(a, [ctx]));
      expect(e.mode, StudyMode.chapter);
      expect(e.source, StudySource.todayLead);
      expect(e.chosenMinutes, 15);
    });

    test('midnight: a session at 11:50 PM IST counts on the day it started, in the late window', () {
      final start = istAt(clock, 3, 23, 50);
      final e = session('mid', start, 30);
      expect(dayOfEntry(e), istDay(clock.millisecondsSinceEpoch) - 3);
      expect(windowOfMinute(istMinuteOfDay(e.atMs)), StudyWindow.late);
      expect(windowOfMinute(istMinuteOfDay(istAt(clock, 3, 0, 30).millisecondsSinceEpoch)), StudyWindow.late);
    });

    test('the log keeps 300 entries and 56 days at most, one per id', () {
      final many = [for (var k = 0; k < 400; k++) session('x$k', clock.subtract(Duration(hours: k)), 10)];
      final kept = pruneLog([...many, session('old', clock.subtract(const Duration(days: 60)), 10)], clock);
      expect(kept.length, StudyLogLimits.maxEntries);
      expect(kept.any((e) => e.id == 'old'), isFalse);
      expect(pruneLog([session('a', clock, 5), session('a', clock, 9)], clock).single.activeMs, 9 * 60000);
    });

    test('entries, contexts, reactions and notes survive a round trip', () {
      final e = session('rt', clock, 25, source: StudySource.todayLead, suggested: 10, chosen: 20);
      expect(StudyLogEntry.fromJson(e.toJson())!.toJson(), e.toJson());
      final d = DeckReactions()..record('weakest', DeckReaction.passed, 100)..record('weakest', DeckReaction.picked, 101);
      expect(DeckReactions.fromJson(d.toJson()).of('weakest'), {100: DeckReaction.passed, 101: DeckReaction.picked});
      const n = PatternNotes(forgotten: {'time': 5}, statedLength: 45, goalSetAtMs: 9);
      expect(PatternNotes.fromJson(n.toJson()).toJson(), n.toJson());
    });
  });

  group('every insight says only what is true', () {
    test('usual length needs 5 sessions on 3 days in 28; a wide spread is said as a range', () {
      final four = [for (var k = 0; k < 4; k++) session('a$k', istAt(clock, 1 + k, 20, 0), 30)];
      expect(StudyPattern.from(log: four, now: clock).length, isNull);
      final twoDays = [for (var k = 0; k < 6; k++) session('b$k', istAt(clock, 1 + k % 2, 20, k), 30)];
      expect(StudyPattern.from(log: twoDays, now: clock).length, isNull);
      final wide = [for (var k = 0; k < 8; k++) session('c$k', istAt(clock, 1 + k, 20, 0), k.isEven ? 10 : 60)];
      final p = StudyPattern.from(log: wide, now: clock);
      expect(p.length!.ranged, isTrue);
      expect(line(p), startsWith('Your sessions run between ${p.length!.low} and ${p.length!.high} minutes'));
    });

    test('a usual time needs 60% of the weight in one window; under 45% is irregular', () {
      final split = [for (var k = 0; k < 10; k++) session('s$k', istAt(clock, 1 + k, k.isEven ? 9 : 20, 0), 20)];
      final p = StudyPattern.from(log: split, now: clock);
      expect(p.timeShape, TimeShape.mixed);
      expect(p.time, isNull);
    });

    test('preferred mode needs 4 sessions he chose and one mode at half or more; Today-lead sessions do not count', () {
      final lead = [for (var k = 0; k < 6; k++) session('l$k', istAt(clock, 1 + k, 20, 0), 20, mode: StudyMode.full, source: StudySource.todayLead)];
      expect(StudyPattern.from(log: lead, now: clock).preferredMode, isNull);
      final mine = [for (var k = 0; k < 4; k++) session('m$k', istAt(clock, 1 + k, 20, 0), 20, mode: k < 3 ? StudyMode.revise : StudyMode.quick)];
      final p = StudyPattern.from(log: mine, now: clock);
      expect(p.preferredMode, StudyMode.revise);
      expect(whyLines(p).single.text, 'You pick Revise most often, so it comes first when nothing else is more urgent.');
      expect(StudyPattern.from(log: mine.take(3).toList(), now: clock).preferredMode, isNull);
    });

    test('a subject he avoids is never said in the first 14 days of an account', () {
      final busy = [for (var k = 0; k < 8; k++) session('a$k', istAt(clock, 1 + k, 20, 0), 20)];
      expect(StudyPattern.from(log: busy, now: clock, chosenSubjects: const ['accountancy', 'economics']).avoided, isNull);
      final old = [...busy, session('first', istAt(clock, 20, 20, 0), 20)];
      final p = StudyPattern.from(log: old, now: clock, chosenSubjects: const ['accountancy', 'economics']);
      expect(p.avoided!.subject, 'economics');
      expect(p.avoided!.days, 20);
      // Passed on three days: quiet for 14 days.
      final deck = DeckReactions();
      final today = istDay(clock.millisecondsSinceEpoch);
      for (final d in [today, today - 1, today - 2]) {
        deck.record(PatternCards.untouched('economics'), DeckReaction.passed, d);
      }
      expect(StudyPattern.from(log: old, now: clock, chosenSubjects: const ['accountancy', 'economics'], reactions: deck).avoided, isNull);
    });

    test('cards he ignores sink, cards he likes rise, and his mode wins a tie', () {
      final today = istDay(clock.millisecondsSinceEpoch);
      final deck = DeckReactions();
      for (final d in [today, today - 3, today - 6]) {
        deck
          ..record('revise', DeckReaction.passed, d)
          ..record('mock', DeckReaction.picked, d);
      }
      deck.record('repair', DeckReaction.passed, today);
      final p = StudyPattern.from(log: const [], now: clock, reactions: deck);
      expect(p.ignoredKinds, {'revise'});
      expect(p.likedKinds, {'mock'});
      expect(whyLines(p).single.text, "You have passed on Revise a few times this fortnight, so I've moved it to the back.");
      const choices = [
        MoveChoice(key: 'revise', title: 'Revise', line: 'r'),
        MoveChoice(key: 'weakest', title: 'Weakest', line: 'w'),
        MoveChoice(key: 'other', title: 'Other', line: 'o'),
        MoveChoice(key: 'mock', title: 'Mock', line: 'm'),
      ];
      final order = [for (final c in buildSuggestedDeck(choices, lean: deckLeanOf(p))) c.key];
      expect(order, ['mock', 'weakest', 'other', 'revise']);
      expect(order.length, choices.length, reason: 'nothing is added or removed');
      final lean = const DeckLean(preferredKind: 'mock');
      expect([for (final c in buildSuggestedDeck(const [MoveChoice(key: 'other', title: 'o', line: 'o'), MoveChoice(key: 'mock', title: 'm', line: 'm')], lean: lean)) c.key], ['mock', 'other']);
    });

    test('longer when he can: chose longer on 3 of his last 5 Today sessions, and the plan goes one chip longer', () {
      final picks = [
        for (var k = 0; k < 5; k++) session('t$k', istAt(clock, 1 + k, 20, 0), 20, source: StudySource.todayLead, suggested: 10, chosen: k < 3 ? 15 : 10),
      ];
      final p = StudyPattern.from(log: picks, now: clock, goalMinutes: 20);
      expect(p.longerWhenCan, isTrue);
      final advice = adviseLength(p);
      expect(advice.longer, isTrue);
      final chip = advice.pick(const [5, 10, 15, 20])!;
      expect(lengthLine(p, advice, chip: chip, when: 'tonight')!.text, "You often choose a longer session than I suggest, so tonight's plan is $chip minutes.");
      final two = [for (var k = 0; k < 5; k++) session('u$k', istAt(clock, 1 + k, 20, 0), 20, source: StudySource.todayLead, suggested: 10, chosen: k < 2 ? 15 : 10)];
      expect(StudyPattern.from(log: two, now: clock).longerWhenCan, isFalse);
    });

    test('goal progress and goal met come from today\'s own minutes', () {
      final p = StudyPattern.from(log: [session('d', istAt(clock, 0, 19, 0), 15)], now: clock, goalMinutes: 40);
      expect(p.doneTodayMinutes, 15);
      expect(goalLine(p)!.text, '15 of 40 minutes done today. 25 to go.');
      expect(goalLine(p)!.correctable, isFalse);
      final met = StudyPattern.from(log: [session('d', istAt(clock, 0, 19, 0), 45)], now: clock, goalMinutes: 40);
      expect(met.goalMet, isTrue);
      expect(goalLine(met)!.text, 'You have done 45 minutes today. Every extra paper still counts.');
      expect(StudyPattern.from(log: [session('d', istAt(clock, 0, 19, 0), 45)], now: clock).goalMet, isFalse, reason: 'no goal, no goal claims');
    });

    test('raise needs 7 days since the goal was set and 5 of the last 7 study days at 1.25 times it', () {
      final log = [for (var k = 0; k < 6; k++) session('g$k', istAt(clock, 1 + k, 20, 0), 40)];
      expect(StudyPattern.from(log: log, now: clock, goalMinutes: 30).raise, isNull, reason: 'the goal was never set on this phone');
      final young = PatternNotes(goalSetAtMs: istAt(clock, 6, 9, 0).millisecondsSinceEpoch);
      expect(StudyPattern.from(log: log, now: clock, goalMinutes: 30, notes: young).raise, isNull, reason: 'six days old');
      final set = PatternNotes(goalSetAtMs: istAt(clock, 8, 9, 0).millisecondsSinceEpoch);
      expect(StudyPattern.from(log: log, now: clock, goalMinutes: 30, notes: set).raise!.minutes, 40);
      expect(StudyPattern.from(log: log, now: clock, goalMinutes: 35, notes: set).raise, isNull, reason: '40 is under 1.25 times 35');
      final deck = DeckReactions()..record(PatternCards.raise, DeckReaction.passed, istDay(clock.millisecondsSinceEpoch) - 3);
      expect(StudyPattern.from(log: log, now: clock, goalMinutes: 30, notes: set, reactions: deck).raise, isNull, reason: 'Not now is respected for 14 days');
    });

    test('fit needs two hard weeks, never fires in the first 14 days, and never lowers anything by itself', () {
      final log = [
        for (var k = 0; k < 14; k += 3) session('h$k', istAt(clock, k, 18, 0), 15),
        session('h-met', istAt(clock, 4, 18, 30), 60),
      ];
      final old = PatternNotes(goalSetAtMs: istAt(clock, 20, 9, 0).millisecondsSinceEpoch);
      final p = StudyPattern.from(log: log, now: clock, goalMinutes: 60, notes: old);
      expect(p.fit, isNotNull);
      expect(p.fit!.minutes, lessThan(60));
      expect(p.goalMinutes, 60, reason: 'the goal itself is untouched until he taps');
      final fresh = PatternNotes(goalSetAtMs: istAt(clock, 10, 9, 0).millisecondsSinceEpoch);
      expect(StudyPattern.from(log: log, now: clock, goalMinutes: 60, notes: fresh).fit, isNull);
      expect(PatternCopy.fitLine(60), 'Your 60-minute goal has been hard to reach lately. A smaller goal you meet beats a big one you miss. You can raise it again any time.');
    });

    test('Not quite right forgets a fact: the entries before it stop counting', () {
      final log = PatternFixtures.regular(clock).log;
      final p = StudyPattern.from(log: log, now: clock, notes: PatternNotes(forgotten: {PatternFact.time: clock.millisecondsSinceEpoch}));
      expect(p.time, isNull);
      expect(p.length, isNotNull, reason: 'only the time was forgotten');
      final stated = StudyPattern.from(log: log, now: clock, notes: PatternNotes(forgotten: {PatternFact.length: clock.millisecondsSinceEpoch}, statedLength: 45));
      expect(stated.length!.stated, isTrue);
      expect(stated.length!.minutes, 45);
      expect(line(stated, chip: 20), "You told me your sittings run about 45 minutes, so tonight's plan starts with 20 minutes and you can keep going.");
    });

    test('Today\'s default length follows the remaining goal, and day one keeps its ten', () {
      final p = StudyPattern.from(log: [session('d', istAt(evening, 0, 17, 0), 25)], now: evening, goalMinutes: 30);
      expect(p.remainingMinutes, 5);
      final i = ashaInputs(now: evening, attempts: [accountancyMock('clean', daysBefore(evening, 1))], pattern: p);
      expect(buildMove(i).selectedMinutes, 5);
      final fresh = ashaInputs(now: evening, attempts: const [], pattern: PatternFixtures.fresh().pattern(evening));
      expect(buildMove(fresh).selectedMinutes, 10, reason: 'the first check keeps the ten minutes onboarding promised');
      final noPattern = ashaInputs(now: evening, attempts: [accountancyMock('clean', daysBefore(evening, 1))]);
      expect(buildMove(noPattern).selectedMinutes, isNotNull);
    });
  });

  group('the claim auditor', () {
    test('500 random logs: no insight below its minimum, every printed number is the computed one', () {
      final rnd = math.Random(1019);
      for (var run = 0; run < 500; run++) {
        final n = rnd.nextInt(40);
        final log = <StudyLogEntry>[
          for (var k = 0; k < n; k++)
            StudyLogEntry(
              id: 'e$run-$k',
              startedAtMs: rnd.nextInt(5) == 0 ? null : istAt(clock, rnd.nextInt(60), rnd.nextInt(24), rnd.nextInt(60)).millisecondsSinceEpoch,
              endedAtMs: istAt(clock, rnd.nextInt(60), rnd.nextInt(24), rnd.nextInt(60)).millisecondsSinceEpoch,
              activeMs: (1 + rnd.nextInt(90)) * 60000,
              mode: StudyMode.all[rnd.nextInt(StudyMode.all.length)],
              subject: const ['accountancy', 'economics', 'english'][rnd.nextInt(3)],
              source: const [StudySource.practice, StudySource.todayLead, StudySource.todayDeck, StudySource.record][rnd.nextInt(4)],
              suggestedMinutes: rnd.nextBool() ? 10 : null,
              chosenMinutes: rnd.nextBool() ? 15 : null,
              finished: rnd.nextInt(6) != 0,
            ),
        ].map((e) => e.startedAtMs == null ? StudyLogEntry(id: e.id, endedAtMs: e.endedAtMs, mode: e.mode, subject: e.subject, source: e.source) : e).toList();
        final goal = rnd.nextBool() ? [10, 20, 30, 60, 90, 120][rnd.nextInt(6)] : null;
        final p = StudyPattern.from(log: log, now: clock, goalMinutes: goal);
        final naive = _Naive(log, clock);

        expect(p.learning, naive.sessions28 < 5 || naive.days28 < 3, reason: 'run $run');
        expect(p.doneTodayMinutes, naive.doneToday, reason: 'run $run');
        final length = p.length;
        if (length != null) {
          expect(naive.timedRecent, greaterThanOrEqualTo(5), reason: 'run $run: a length below its minimum');
          expect(naive.timedRecentDays, greaterThanOrEqualTo(3), reason: 'run $run');
          if (!length.lately) expect(length.minutes, naive.medianLengthRounded, reason: 'run $run: the printed length');
        } else {
          expect(naive.timedRecent >= 5 && naive.timedRecentDays >= 3, isFalse, reason: 'run $run: a length was due');
        }
        if (p.timeShape == TimeShape.known) {
          expect(naive.topShare, greaterThanOrEqualTo(0.6 - 1e-9), reason: 'run $run: a usual time below 60%');
        }
        if (p.timeShape == TimeShape.irregular) expect(naive.topShare, lessThan(0.45 + 1e-9), reason: 'run $run');
        final advice = adviseLength(p);
        final chip = advice.pick(const [5, 10, 15, 20]) ?? 10;
        final said = lengthLine(p, advice, chip: chip, when: 'tonight');
        if (said == null) continue;
        if (p.learning) expect(said.text, anyOf(startsWith("I'm still learning"), startsWith('You told me')), reason: 'run $run');
        // Every number in the line is one the pattern computed.
        final allowed = <int>{
          chip,
          ?goal,
          ?length?.minutes,
          ?length?.low,
          ?length?.high,
          p.sessionsNeeded,
          p.daysNeeded,
          if (p.time != null) ...[for (final m in RegExp(r'\d+').allMatches(PatternCopy.time(p.time!.afterMinute))) int.parse(m.group(0)!)],
        };
        for (final m in RegExp(r'\d+').allMatches(said.text)) {
          expect(allowed, contains(int.parse(m.group(0)!)), reason: 'run $run: "${said.text}"');
        }
      }
    });
  });
}

/// The auditor's own, deliberately plain implementation of the counts and the weighted median.
class _Naive {
  _Naive(List<StudyLogEntry> log, DateTime now) {
    final nowMs = now.millisecondsSinceEpoch;
    final today = istDay(nowMs);
    bool live(StudyLogEntry e) {
      if (e.atMs > nowMs) return false;
      if (today - istDay(e.atMs) >= 56) return false;
      if (e.activeMs != null && e.activeMs! < 3 * 60000) return false;
      return true;
    }

    final entries = log.where(live).toList();
    final recent = entries.where((e) => today - istDay(e.atMs) < 28).toList();
    sessions28 = recent.length;
    days28 = recent.map((e) => istDay(e.atMs)).toSet().length;
    doneToday = entries.where((e) => e.activeMs != null && istDay(e.atMs) == today).fold<int>(0, (s, e) => s + e.activeMs!) ~/ 60000;
    final timed = entries.where((e) => e.activeMs != null && e.finished).toList();
    final timedR = timed.where((e) => today - istDay(e.atMs) < 28).toList();
    timedRecent = timedR.length;
    timedRecentDays = timedR.map((e) => istDay(e.atMs)).toSet().length;
    double w(StudyLogEntry e) => math.pow(0.5, ((nowMs - e.atMs) / 86400000) / 14).toDouble();
    if (timed.isNotEmpty) {
      final pairs = [for (final e in timed) [e.activeMs! / 60000, w(e)]]..sort((a, b) => a[0].compareTo(b[0]));
      final total = pairs.fold<double>(0, (s, p) => s + p[1]);
      var run = 0.0;
      var median = pairs.last[0];
      for (final p in pairs) {
        run += p[1];
        if (run * 2 >= total - 1e-9) {
          median = p[0];
          break;
        }
      }
      medianLengthRounded = math.max(5, (median / 5).round() * 5);
    }
    final share = <StudyWindow, double>{};
    var all = 0.0;
    for (final e in entries) {
      final m = istMinuteOfDay(e.atMs);
      final win = m < 240 ? StudyWindow.late : (m < 720 ? StudyWindow.early : (m < 1020 ? StudyWindow.afternoon : (m < 1260 ? StudyWindow.evening : StudyWindow.late)));
      share[win] = (share[win] ?? 0) + w(e);
      all += w(e);
    }
    topShare = all == 0 ? 0 : share.values.fold<double>(0, math.max) / all;
  }

  late final int sessions28;
  late final int days28;
  late final int doneToday;
  late final int timedRecent;
  late final int timedRecentDays;
  int medianLengthRounded = 0;
  late final double topShare;
}
