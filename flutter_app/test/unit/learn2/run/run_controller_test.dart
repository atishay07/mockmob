// The Learn run's state and actions over the recorded server (FixtureLearnApi) and a written one (ScriptedRunApi): the start and
// the pick-up, a card's turn and its three ratings (the card leaves only after the server took the rating, a tap during the
// flight is ignored, a failure keeps the card with its line), a question (one send, the re-insert, the streak, the 409 lines),
// a look past Free's ratings, the recap, a cards run's pause, a lesson, the stop rule, the end and every state without items.
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/learn2/data/learn_api.dart';
import 'package:mockmob/features/learn2/data/learn_models.dart';
import 'package:mockmob/features/learn2/data/learn_prefs.dart';
import 'package:mockmob/features/learn2/learn2_links.dart';
import 'package:mockmob/features/learn2/run/run_controller.dart';
import 'package:mockmob/features/learn2/run/run_copy.dart';
import 'package:mockmob/features/learn2/run/run_view.dart';

import 'support/run_harness.dart';

Future<RunController> started(
  LearnApi api, {
  RunLaunch launch = const RunLaunch(chapterKey: l2Pf),
  RunEvents? events,
  LearnPrefs? prefs,
  String? studentId,
}) async {
  final c = runController(api, launch: launch, events: events, prefs: prefs, studentId: studentId);
  addTearDown(c.dispose);
  await c.start();
  await settle();
  return c;
}

/// Moves to the question at [i] of the recorded mix.
void goTo(RunController c, int i) {
  while (c.at < i) {
    c.advance();
  }
}

/// The recorded mix: its items, and where its open mistakes and its plain questions sit.
final List<Object?> _mix = LearnFixtures.json('run_start_mix_pf_pro')['items'] as List<Object?>;
final int mixLength = _mix.length;
bool _isQuestion(Object? x, {required bool mistake}) => x is Map && x['type'] == 'question' && (x['origin'] == 'mistake') == mistake;

final List<int> mixMistakes = [
  for (final (i, x) in _mix.indexed)
    if (_isQuestion(x, mistake: true)) i,
];
final List<int> mixPlain = [
  for (final (i, x) in _mix.indexed)
    if (_isQuestion(x, mistake: false)) i,
];

void main() {
  group('starting', () {
    test('a mix starts with its items, the pile at 0 and the minutes left', () async {
      final api = FixtureLearnApi();
      final c = await started(api);
      expect(c.status, RunStatus.ready);
      expect(c.phase, RunPhase.play);
      expect(c.items.length, mixLength);
      expect(c.total, mixLength);
      expect(mixLength, greaterThan(10));
      expect(c.position, 1);
      expect(c.pile, 0);
      expect(c.title, 'Accounting for Partnership: Basic Concepts');
      expect(c.left, matches(RegExp(r'^about \d+ min left$')));
      expect(c.kind, LearnKinds.mix);
      expect(c.item, isA<LearnCardItem>());
      expect(api.starts.single.chapterKey, l2Pf);
      expect(api.starts.single.minutes, 10);
      expect(api.starts.single.kind, 'mix');
    });

    test('the launch sends its own fields: kind, minutes, left-out piles, cards, fresh and the next chapter', () async {
      final api = FixtureLearnApi();
      await started(
        api,
        launch: const RunLaunch(chapterKey: l2Pf, minutes: 20, kind: 'cards', leaveOut: ['lesson'], cardIds: ['kc.a', 'kc.b'], fresh: true, addNext: true),
      );
      final s = api.starts.single;
      expect(
        [s.kind, s.minutes, s.leaveOut, s.cardIds, s.fresh, s.addNext],
        [
          'cards',
          20,
          ['lesson'],
          ['kc.a', 'kc.b'],
          true,
          true,
        ],
      );
    });

    test('a picked-up run starts at its place: the ticks, the counter and the pile carry on', () async {
      final api = FixtureLearnApi(startFixtures: {'mix': 'run_start_mix_aop_resume_pro'});
      final c = await started(api, launch: const RunLaunch(chapterKey: l2Aop));
      expect(c.offset, 6);
      expect(c.items.length, 10);
      expect(c.total, 16);
      expect(c.position, 7);
      expect(c.doneCount, 6);
    });

    test('a run id picks the run up through getRun: only what was left, from where it stopped', () async {
      final api = FixtureLearnApi();
      final first = await api.startRun(const RunStart(chapterKey: l2Pf));
      await api.rate(first.id, first.items[0].id, 3);
      await api.rate(first.id, first.items[1].id, 3);
      final c = await started(
        api,
        launch: RunLaunch(chapterKey: l2Pf, runId: first.id),
      );
      expect(api.calls, contains('getRun ${first.id}'));
      expect(c.run?.id, first.id);
      expect(c.offset, 2);
      expect(c.items.length, mixLength - 2);
      expect(c.position, 3);
      expect(c.pile, 2);
    });

    test('a run that is over goes to its end (409 RUN_ENDED), and one that is gone does too', () async {
      final api = FixtureLearnApi();
      final first = await api.startRun(const RunStart(chapterKey: l2Pf));
      await api.end(first.id);
      final c = await started(
        api,
        launch: RunLaunch(chapterKey: l2Pf, runId: first.id),
      );
      expect(c.phase, RunPhase.end);
      expect(c.endStatus, RunEndStatus.ready);
      expect(c.endData?.title, isNotEmpty);
      final gone = await started(
        api,
        launch: const RunLaunch(chapterKey: l2Pf, runId: 'lr_gone'),
      );
      expect(gone.phase, RunPhase.end);
      expect(gone.endStatus, RunEndStatus.error);
    });

    test('a link that asks for the end opens on it without starting a run', () async {
      final api = FixtureLearnApi();
      final first = await api.startRun(const RunStart(chapterKey: l2Pf));
      api.calls.clear();
      final c = await started(
        api,
        launch: RunLaunch(chapterKey: l2Pf, runId: first.id, end: true),
      );
      expect(c.phase, RunPhase.end);
      expect(c.endStatus, RunEndStatus.ready);
      expect(api.calls.where((x) => x.startsWith('startRun') || x.startsWith('getRun')), isEmpty);
      expect(api.ended.single, first.id);
    });

    test('the screen reader hears where the student is on each move: "Card 1 of 18", "Card 2 of 18", "Question 5 of 18"', () async {
      final events = RunEvents();
      final c = await started(FixtureLearnApi(), events: events);
      expect(events.said, ['Card 1 of $mixLength']);
      c.advance();
      expect(events.said.last, 'Card 2 of $mixLength');
      goTo(c, mixMistakes.first);
      expect(events.said.last, startsWith('Question ${mixMistakes.first + 1} of $mixLength'));
    });

    test('a resumed run with nothing left is already done: its end', () async {
      final api = ScriptedRunApi(scriptedRun([], resumed: {'done': 5, 'of': 5}, kind: 'mix'));
      final c = await started(api);
      expect(c.phase, RunPhase.end);
      expect(c.endStatus, RunEndStatus.ready);
    });

    test('a chapter that is not in the book list is its own state, and Try again after an error reads it again', () async {
      final missing = await started(FixtureLearnApi(), launch: const RunLaunch(chapterKey: l2Missing));
      expect(missing.status, RunStatus.notFound);
      final api = FixtureLearnApi(error: true);
      final c = await started(api);
      expect(c.status, RunStatus.error);
      api.error = false;
      await c.begin();
      expect(c.status, RunStatus.ready);
      expect(c.items, isNotEmpty);
    });

    test('Free after its day: a feed start is 402, with the server\'s line, options and the run that holds the day', () async {
      final c = await started(
        FixtureLearnApi(pro: false, freeUsed: true),
        launch: const RunLaunch(chapterKey: l2Pf, kind: 'feed'),
      );
      expect(c.status, RunStatus.free);
      expect(c.free?.line, startsWith("That was today's free session."));
      expect(c.free?.options, isNotEmpty);
      expect(c.free?.resume?.done, 2);
    });

    test('a run with nothing in it says so', () async {
      final c = await started(ScriptedRunApi(scriptedRun([])));
      expect(c.status, RunStatus.empty);
    });
  });

  group('a card', () {
    test('Show answer, then Got it: the server takes the rating, the stamp says its day, the pile counts it, the next card comes', () async {
      final api = FixtureLearnApi();
      final events = RunEvents();
      final c = await started(api, events: events);
      final first = c.item! as LearnCardItem;
      expect(c.isTurned(first), isFalse);
      expect(c.statusLine?.text, RunCopy.coachFront);
      c.turn(first);
      expect(c.isTurned(first), isTrue);
      expect(c.statusLine?.text, RunCopy.coachRate);
      final done = c.rate(3);
      expect(c.busy, 3);
      expect(c.at, 0, reason: 'the card stays until the server has the rating');
      await done;
      expect(api.ratings.single.rating, 3);
      expect(api.ratings.single.itemId, first.id);
      expect(c.tally.got, 1);
      expect(c.stamp?.text, LearnFixtures.json('rate_got_it_pro')['stamp'], reason: 'the server\'s real day, as recorded');
      expect(c.statusLine?.stamp, isTrue);
      expect(events.rated.single.kind, 'got');
      expect(events.rated.single.flies, isTrue);
      expect(events.rated.single.viaRating, isTrue);
      expect(c.pile, 1);
      expect(c.at, 1);
      expect(c.busy, isNull);
      expect(c.leaving, isFalse);
      expect(c.changed, isTrue);
    });

    test('Easy flies too and says its day; Missed drops away, says "Back later in this run" and the card comes back 3 on', () async {
      final api = FixtureLearnApi();
      final events = RunEvents();
      final c = await started(api, events: events);
      await c.rate(4);
      expect(c.stamp?.text, LearnFixtures.json('rate_easy_pro')['stamp']);
      expect(events.rated.last.kind, 'easy');
      expect(c.tally.easy, 1);
      expect(c.pile, 1);
      await c.rate(1);
      expect(c.stamp?.text, 'Back later in this run');
      expect(events.rated.last.kind, 'missed');
      expect(events.rated.last.flies, isFalse);
      expect(c.tally.missed, 1);
      expect(c.pile, 1, reason: 'a missed card does not go to Revise');
      expect(c.items.length, mixLength + 1);
      expect(c.total, mixLength + 1);
      final back = c.items[4];
      expect(back.id, endsWith('-r1'));
      expect(RunView.stageTag(back), 'Back from earlier');
    });

    test('a tap while the card leaves, or while a rating is on its way, is ignored', () async {
      final api = FixtureLearnApi();
      final c = await started(api);
      final a = c.rate(3);
      final b = c.rate(1);
      c.turn(c.item! as LearnCardItem);
      await Future.wait([a, b]);
      expect(api.ratings.length, 1);
      final next = c.rate(3);
      expect(c.busy, 3);
      await next;
      expect(api.ratings.length, 2);
    });

    test('a failed rating keeps the card with its line, and it can be tried again', () async {
      final api = FixtureLearnApi(failOn: {'rate': FixtureLearnApi.offlineError});
      final c = await started(api);
      await c.rate(3);
      expect(c.error, 'That rating was not saved. Try again.');
      expect(c.statusLine?.bad, isTrue);
      expect(c.at, 0);
      expect(c.busy, isNull);
      expect(c.leaving, isFalse);
      expect(c.tally.got, 0);
      api.failOn.clear();
      await c.rate(3);
      expect(c.error, isNull);
      expect(c.at, 1);
    });

    test('a rating on a run that has closed goes to its end', () async {
      final api = FixtureLearnApi(
        failOn: {
          'rate': LearnError.fromResponse(409, {'error': 'RUN_ENDED'}),
        },
      );
      final c = await started(api);
      await c.rate(3);
      await settle();
      expect(c.phase, RunPhase.end);
      expect(c.endStatus, RunEndStatus.ready);
    });

    test('a Back from earlier card and a card that is the line you needed carry their tags', () async {
      final api = FixtureLearnApi();
      final c = await started(api);
      goTo(c, mixPlain.first);
      final q = c.item! as LearnQuestionItem;
      await c.pick(wrongKey(q));
      // The recorded wrong answer's re-insert is a card from earlier in the chapter.
      expect(RunView.stageTag(c.items.firstWhere((i) => i.id.endsWith('-r1'))), 'Back from earlier');
      // A card the server tags as the line the student needed.
      final line = scriptedRun([scriptedCard(1, reason: 'line')]).items.single;
      expect(RunView.stageTag(line), 'The line you needed');
    });
  });

  group('looks past Free\'s ratings', () {
    const lookLine = "You've used today's 10 free card ratings. The rest show their answers but won't be added to Revise.";

    test('a look is shown with one Next and the server\'s line after its turn; Next logs a rating of 3 and moves on', () async {
      final api = ScriptedRunApi(
        scriptedRun([scriptedCard(1, look: true), scriptedCard(2, look: true), scriptedCard(3)], looks: {'text': lookLine}, kind: 'mix'),
      );
      final events = RunEvents();
      final c = await started(api, events: events);
      final first = c.item! as LearnCardItem;
      expect(c.isLook(first), isTrue);
      expect(c.statusLine?.text, isNot(lookLine), reason: 'the line comes with the first turn');
      c.turn(first);
      expect(c.lookSaid, isTrue);
      expect(c.statusLine?.text, lookLine);
      await c.lookNext();
      expect(api.ratings.single, (itemId: first.id, rating: 3));
      expect(events.rated.single.look, isTrue);
      expect(events.rated.single.viaRating, isFalse);
      expect(c.at, 1);
      expect(c.tally.got, 0, reason: 'a look is no rating');
    });

    test('Free\'s 11th rating (402 with its line) turns the card into a look', () async {
      final api = FixtureLearnApi(
        failOn: {
          'rate': LearnError.fromResponse(402, {
            'error': 'FREE_RATING_LIMIT',
            'limit': {'text': lookLine},
          }),
        },
      );
      final c = await started(api);
      c.turn(c.item! as LearnCardItem);
      await c.rate(3);
      expect(c.lookLine, lookLine);
      expect(c.isLook(c.item!), isTrue);
      expect(c.at, 0);
      expect(c.error, isNull);
    });

    test('a rating the server could not count (look: true) drops the card away and keeps the rest as looks', () async {
      final api = ScriptedRunApi(
        scriptedRun([scriptedCard(1), scriptedCard(2), scriptedCard(3)], kind: 'mix'),
        rates: (id, rating) => LearnRateResult(
          ok: true,
          look: true,
          saved: false,
          limit: const LearnNote(text: lookLine),
          raw: const {'ok': true},
        ),
      );
      final events = RunEvents();
      final c = await started(api, events: events);
      await c.rate(3);
      expect(events.rated.single.kind, 'missed');
      expect(events.rated.single.look, isTrue);
      expect(c.pile, 0);
      expect(c.lookSaid, isTrue);
      expect(c.isLook(c.item!), isTrue, reason: 'the cards after it are looks too');
    });
  });

  group('a question', () {
    test('a wrong answer is graded by the server, the line comes back 3 on, the streak is 0 and the screen says so', () async {
      final api = FixtureLearnApi();
      final events = RunEvents();
      final c = await started(api, events: events);
      goTo(c, mixPlain.first);
      final q = c.item! as LearnQuestionItem;
      expect(c.questionHint, isNull, reason: 'a run that serves an open mistake is not a student\'s first question');
      final wrong = wrongKey(q);
      await c.pick(wrong);
      final st = c.stateOf(q.id);
      expect(st.answer?.res?.correct, isFalse);
      expect(st.answer?.choice, wrong);
      expect(c.isAnswered(q), isTrue);
      expect(c.tally.wrong, 1);
      expect(c.answers.streak, 0);
      expect(c.items.length, mixLength + 1);
      expect(events.said.last, startsWith('Not quite. The answer is ${rightKey(q)}.'));
      expect(events.said.last, endsWith('The line you needed is shown below.'));
      expect(c.finished, mixPlain.first + 1, reason: 'an answered question counts as done');
    });

    test('three right answers in a row make a streak, and every one is sent once', () async {
      final api = FixtureLearnApi();
      final c = await started(api);
      // Two open mistakes and a plain question, answered right one after the other.
      for (final i in [mixMistakes[0], mixMistakes[1], mixPlain.first]) {
        goTo(c, i);
        final q = c.item! as LearnQuestionItem;
        final a = c.pick(rightKey(q));
        final b = c.pick(wrongKey(q));
        await Future.wait([a, b]);
        expect(c.stateOf(q.id).answer?.res?.correct, isTrue);
      }
      expect(api.answers.length, 3);
      expect(c.answers.streak, 3);
      expect(c.answers.right, 1, reason: 'the first two are old mistakes, counted on their own');
      expect(c.answers.fixed, 2);
      expect(c.tally.right, 3);
      expect(RunView.rightLine(c.answers.streak), 'Right. 3 in a row.');
    });

    test('Skip never sends, is never a mistake and moves on', () async {
      final api = FixtureLearnApi();
      final c = await started(api);
      goTo(c, 4);
      final q = c.item! as LearnQuestionItem;
      c.skip();
      expect(api.answers, isEmpty);
      expect(c.stateOf(q.id).byStudent, isTrue);
      expect(c.at, 5);
      expect(c.tally.wrong, 0);
      expect(c.answers.answered + c.answers.tried, 0);
    });

    test('a question the server left out is skipped with the web\'s line, and the line stays in the status', () async {
      final api = FixtureLearnApi(failOn: {'answer': FixtureLearnApi.questionChanged});
      final c = await started(api);
      goTo(c, 4);
      final q = c.item! as LearnQuestionItem;
      await c.pick('A');
      expect(c.stateOf(q.id).skipped, 'This question was updated, so it was skipped.');
      expect(c.isAnswered(q), isTrue);
      expect(c.statusLine?.text, 'This question was updated, so it was skipped.');
      final held = FixtureLearnApi(
        failOn: {
          'answer': LearnError.fromResponse(409, {'error': 'QUESTION_HELD'}),
        },
      );
      final h = await started(held);
      goTo(h, 4);
      await h.pick('A');
      expect(h.stateOf(h.item!.id).skipped, 'This question is in a paper that is still open, so it was skipped.');
    });

    test('a failed answer says so and the options answer again', () async {
      final api = FixtureLearnApi(failOn: {'answer': FixtureLearnApi.offlineError});
      final c = await started(api);
      goTo(c, 4);
      final q = c.item! as LearnQuestionItem;
      await c.pick('A');
      expect(c.stateOf(q.id).error, 'That answer was not saved. Try again.');
      expect(c.stateOf(q.id).answer, isNull);
      expect(c.isAnswered(q), isFalse);
      api.failOn.clear();
      await c.pick('A');
      expect(c.stateOf(q.id).answer?.res, isNotNull);
      expect(c.stateOf(q.id).error, isNull);
    });

    test('a closed run, or Free\'s day claimed by another run, ends this one calmly', () async {
      final closed = FixtureLearnApi(
        failOn: {
          'answer': LearnError.fromResponse(409, {'error': 'RUN_ENDED'}),
        },
      );
      final a = await started(closed);
      goTo(a, 4);
      await a.pick('A');
      await settle();
      expect(a.phase, RunPhase.end);
      final used = FixtureLearnApi(
        failOn: {
          'answer': LearnError.fromResponse(402, {'error': 'FREE_SESSION_USED', 'line': 'Your free Learn session for today is done.'}),
        },
      );
      final b = await started(used);
      goTo(b, 4);
      await b.pick('A');
      await settle();
      expect(b.phase, RunPhase.end);
      expect(b.stoppedAt, 4);
    });

    test('Save: saved, a second tap is nothing, Free\'s limit turns it into Pro and Pro asks for Pro', () async {
      final api = FixtureLearnApi();
      final events = RunEvents();
      final c = await started(api, events: events);
      goTo(c, 4);
      final q = c.item! as LearnQuestionItem;
      await c.save(q);
      expect(c.saveOf(q.question.id), RunSave.saved);
      expect(events.saved, 1);
      await c.save(q);
      expect(api.saved.length, 1);
      final free = FixtureLearnApi(
        failOn: {
          'saveQuestion': LearnError.fromResponse(402, {'error': 'Free bookmark limit reached', 'limit': 25}),
        },
      );
      final fe = RunEvents();
      final f = await started(free, events: fe);
      goTo(f, 4);
      final fq = f.item! as LearnQuestionItem;
      await f.save(fq);
      expect(f.saveOf(fq.question.id), RunSave.pro);
      await f.save(fq);
      expect(fe.seePro, ['saved']);
      final broken = FixtureLearnApi(failOn: {'saveQuestion': FixtureLearnApi.offlineError});
      final b = await started(broken);
      goTo(b, 4);
      await b.save(b.item! as LearnQuestionItem);
      expect(b.saveOf((b.items[4] as LearnQuestionItem).question.id), isNull);
      expect(b.note, 'That question was not saved. Try again.');
    });
  });

  group('the recap, a cards run and a lesson', () {
    test('a recap shows every answer, goes on with Next (a look each) and ends with Study these', () async {
      final api = FixtureLearnApi();
      final c = await started(
        api,
        launch: const RunLaunch(chapterKey: l2Pf, kind: 'recap', minutes: 5),
      );
      expect(c.isRecap, isTrue);
      expect(c.items.length, 12);
      expect(c.isTurned(c.item!), isTrue);
      expect(c.statusLine?.text, RunCopy.coachRecap);
      final first = c.item!;
      c.goRecap(1);
      await settle();
      expect(api.ratings.single, (runId: api.ratings.single.runId, itemId: first.id, rating: 3));
      expect(c.at, 1);
      c.goRecap(-1);
      expect(c.at, 0);
      c.goRecap(-1);
      expect(c.at, 0);
      while (c.phase == RunPhase.play) {
        c.goRecap(1);
      }
      expect(c.phase, RunPhase.recapEnd);
      final next = c.studyThese()!;
      expect(next.kind, 'cards');
      expect(next.cardIds.length, 12);
      expect(next.minutes, 5);
      expect(next.chapterKey, l2Pf);
      c.recapAgain();
      expect(c.phase, RunPhase.play);
      expect(c.at, 0);
    });

    test('a cards run pauses after every 20 rated: Next round goes on, Finish here ends where it got to', () async {
      final api = ScriptedRunApi(scriptedRun([for (var i = 1; i <= 25; i++) scriptedCard(i)], kind: 'cards'));
      final c = await started(
        api,
        launch: const RunLaunch(chapterKey: l2Pf, kind: 'cards', minutes: 8),
      );
      for (var i = 0; i < 20; i++) {
        c.turn(c.item! as LearnCardItem);
        await c.rate(3);
      }
      expect(c.phase, RunPhase.round);
      expect(c.round, 1);
      expect(c.at, 20);
      expect(c.asksToStop, isFalse, reason: 'between rounds Close leaves');
      c.nextRound();
      expect(c.phase, RunPhase.play);
      expect(c.item?.id, 'lr_script-i21');
      for (var i = 0; i < 5; i++) {
        await c.rate(3);
      }
      expect(c.phase, RunPhase.end, reason: 'the last rating ends the run, with no pause after it');
      final api2 = ScriptedRunApi(scriptedRun([for (var i = 1; i <= 25; i++) scriptedCard(i)], kind: 'cards'));
      final d = await started(
        api2,
        launch: const RunLaunch(chapterKey: l2Pf, kind: 'cards', minutes: 8),
      );
      for (var i = 0; i < 20; i++) {
        await d.rate(3);
      }
      d.finishRound();
      await settle();
      expect(d.phase, RunPhase.end);
      expect(d.stoppedAt, 20);
    });

    test('a lesson opens its page, counts as read when the student comes back, and the run goes on; Skip it logs a look', () async {
      final api = FixtureLearnApi(startFixtures: {'mix': 'run_start_mix_aop_20_new_pro'});
      final events = RunEvents();
      final c = await started(
        api,
        launch: const RunLaunch(chapterKey: l2Aop, minutes: 20),
        events: events,
      );
      final lesson = c.item! as LearnLessonItem;
      expect(c.total, 25);
      await c.readLesson();
      await settle();
      expect(events.lessons, [lesson.lesson.id]);
      expect(api.ratings.single.itemId, lesson.id);
      expect(api.ratings.single.rating, 3);
      expect(c.at, 1);
      final api2 = FixtureLearnApi(startFixtures: {'mix': 'run_start_mix_aop_20_new_pro'});
      final d = await started(api2, launch: const RunLaunch(chapterKey: l2Aop, minutes: 20));
      d.skipLesson();
      await settle();
      expect(api2.ratings.single.itemId, d.items[0].id);
      expect(d.at, 1);
    });
  });

  group('stopping and the end', () {
    test('before any item is done Close leaves; after one it asks, with what was done', () async {
      final api = FixtureLearnApi();
      final c = await started(api);
      expect(c.asksToStop, isFalse);
      await c.rate(3);
      expect(c.asksToStop, isTrue);
      expect(c.doneCount, 1);
      goTo(c, 4);
      await c.pick(rightKey(c.item! as LearnQuestionItem));
      expect(c.doneCount, 5);
      expect(RunView.stopLine(c.doneCount, c.total), '5 of $mixLength done. It’s all saved.');
    });

    test('Stop here reads the end with the stop flag (the server keeps the run open); a run that ran to its end reads it without', () async {
      final api = FixtureLearnApi();
      final c = await started(api);
      await c.rate(3);
      c.finish(c.doneCount);
      await settle();
      expect(api.stops, [true]);
      expect(c.stoppedAt, 1);
      expect(c.endStatus, RunEndStatus.ready);

      final api2 = FixtureLearnApi();
      final d = await started(api2);
      await d.rate(3);
      d.finish();
      await settle();
      expect(api2.stops, [false]);
      expect(d.stoppedAt, isNull);
    });

    test('the end\'s Try again reads it again with the same flag', () async {
      final api = FixtureLearnApi(failOn: {'end': FixtureLearnApi.offlineError});
      final c = await started(api);
      await c.rate(3);
      c.finish(c.doneCount);
      await settle();
      expect(c.endStatus, RunEndStatus.error);
      api.failOn.clear();
      c.retryEnd();
      await settle();
      expect(api.stops, [true, true]);
      expect(c.endStatus, RunEndStatus.ready);
    });

    test('the end is read from the server and read again on Try again, never invented', () async {
      final api = FixtureLearnApi(failOn: {'end': FixtureLearnApi.offlineError});
      final c = await started(api);
      await c.rate(3);
      c.finish(c.doneCount);
      expect(c.endStatus, RunEndStatus.loading);
      expect(c.endData, isNull);
      await settle();
      expect(c.endStatus, RunEndStatus.error);
      expect(c.endData, isNull);
      api.failOn.clear();
      c.retryEnd();
      await settle();
      expect(c.endStatus, RunEndStatus.ready);
      expect(c.stoppedAt, 1);
      expect(c.endData!.lead!.label, startsWith('Continue \u00B7 '), reason: 'a stop part way is offered its own run back, in the server\'s words');
      expect(c.asksToStop, isFalse);
    });

    test('Mobi reacts once by what the run counted', () async {
      final api = FixtureLearnApi();
      final c = await started(api);
      await c.rate(3);
      await c.rate(3);
      await c.rate(3);
      expect(c.endAct, 'nod');
      await c.rate(1);
      c.skip();
      await c.rate(1);
      await c.rate(1);
      expect(c.endAct, 'think');
    });
  });

  group('the first-run coach lines show once, each, and are kept', () {
    test('the front\'s, the rating\'s and the first question\'s lines, then never again for that student', () async {
      final store = MemoryPrefsStore();
      final prefs = LearnPrefs(store);
      final api = FixtureLearnApi();
      final c = await started(api, prefs: prefs, studentId: 'ana');
      expect(c.statusLine?.text, RunCopy.coachFront);
      expect(c.statusLine?.cue, isTrue, reason: 'the turn cue is ink and semibold so a first-time student sees how a flashcard works');
      c.turn(c.item! as LearnCardItem);
      expect(c.statusLine?.text, RunCopy.coachRate);
      await settle();
      expect(await prefs.coachSeen('run.coach.v2:ana:front2'), isTrue);
      expect(await prefs.coachSeen('run.coach.v2:ana:rate2'), isTrue);
      final again = await started(FixtureLearnApi(), prefs: LearnPrefs(store), studentId: 'ana');
      expect(again.statusLine, isNull, reason: 'seen already');
      again.turn(again.item! as LearnCardItem);
      expect(again.statusLine, isNull);
      // Another student on the same phone sees them (they are once per student, not once per phone).
      final other = await started(FixtureLearnApi(), prefs: LearnPrefs(store), studentId: 'ben');
      expect(other.statusLine?.text, RunCopy.coachFront);
    });

    test('the hint is for a student\'s first question: it reads above the options until the question is answered, then never again for that student', () async {
      final store = MemoryPrefsStore();
      final prefs = LearnPrefs(store);
      // A new student's run has no open mistakes, so its first question is a first.
      FixtureLearnApi api() => FixtureLearnApi(startFixtures: {'mix': 'run_start_mix_aop_20_new_pro'});
      const launch = RunLaunch(chapterKey: l2Aop, minutes: 20);
      final c = await started(api(), launch: launch, prefs: prefs, studentId: 'ana');
      final first = c.items.indexWhere((i) => i is LearnQuestionItem);
      goTo(c, first);
      expect(c.questionHint, RunCopy.coachPick);
      expect(c.statusLine, isNull, reason: 'it is above the options, not in the line under the keys');
      await settle();
      expect(await prefs.coachSeen('run.coach.v2:ana:pick'), isTrue, reason: 'kept the first time it shows');
      await c.pick(rightKey(c.item! as LearnQuestionItem));
      expect(c.questionHint, isNull);
      final again = await started(api(), launch: launch, prefs: LearnPrefs(store), studentId: 'ana');
      goTo(again, again.items.indexWhere((i) => i is LearnQuestionItem));
      expect(again.questionHint, isNull, reason: 'seen already');
      final other = await started(api(), launch: launch, prefs: LearnPrefs(store), studentId: 'ben');
      goTo(other, other.items.indexWhere((i) => i is LearnQuestionItem));
      expect(other.questionHint, RunCopy.coachPick, reason: 'once per student, not once per phone');
    });

    test('a run that serves an open mistake is not a first question: no hint', () async {
      final c = await started(FixtureLearnApi(), prefs: LearnPrefs(MemoryPrefsStore()), studentId: 'ana');
      goTo(c, mixMistakes.first);
      expect(c.questionHint, isNull);
    });
  });
}
