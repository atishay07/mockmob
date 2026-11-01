// The Explore feed's controller over the recorded Learn server (FixtureLearnApi): start and pick-up, the item states,
// Keep, Save, answers with the streak and the re-insert, the left-out and closed lines, the checkpoint, the stop rule,
// the end (read on arrival, never invented) and "Another 10 minutes", and the states without items.
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/learn2/data/learn_api.dart';
import 'package:mockmob/features/learn2/data/learn_models.dart';
import 'package:mockmob/features/learn2/data/learn_prefs.dart';
import 'package:mockmob/features/learn2/feed/feed_controller.dart';
import 'package:mockmob/features/learn2/feed/feed_model.dart';
import 'package:mockmob/features/learn2/learn2_links.dart';

import 'support/feed_harness.dart';

/// A short feed: the first 11 recorded items (a checkpoint after 8 needs 4 after it, so none yet), whose wrong answers
/// put a card back in three on, as the server does.
class ShortFeedApi extends FixtureLearnApi {
  ShortFeedApi() : super();

  late final Json _body = () {
    final b = LearnFixtures.json('run_start_feed_aop_pro');
    b['items'] = (b['items'] as List).take(11).toList();
    return b;
  }();
  final List<Json> _items = [];
  int _copies = 0;

  @override
  Future<LearnRun> startRun(RunStart start) async {
    starts.add(start);
    _items
      ..clear()
      ..addAll([for (final i in _body['items'] as List) Json.from(i as Map)]);
    return LearnRun.parse({..._body, 'items': _items});
  }

  @override
  Future<LearnAnswer> answer(String runId, String itemId, String choice) async {
    answers.add((runId: runId, itemId: itemId, choice: choice));
    final at = _items.indexWhere((i) => i['id'] == itemId);
    final copy = {..._items.first, 'id': '$itemId-r${++_copies}', 'stage': 'again', 'reason': 'line'};
    final place = (at + 3).clamp(0, _items.length);
    _items.insert(place, copy);
    return LearnAnswer.parse({'correct': false, 'key': 'A', 'choice': choice, 'reinsert': {'itemId': copy['id'], 'at': place, 'item': copy}});
  }
}

/// A feed with nothing to play.
class EmptyFeedApi extends FixtureLearnApi {
  @override
  Future<LearnRun> startRun(RunStart start) async {
    starts.add(start);
    return LearnRun.parse({...LearnFixtures.json('run_start_feed_aop_pro'), 'items': <Object>[]});
  }
}

typedef Json = Map<String, dynamic>;

LearnQuestionItem questionAt(FeedController c, int slot) => (c.slots[slot] as FeedItemSlot).item as LearnQuestionItem;
LearnCardItem cardAt(FeedController c, int slot) => (c.slots[slot] as FeedItemSlot).item as LearnCardItem;

void main() {
  group('start', () {
    test('a feed starts with the lesson left out and the cover it came from; the first card is seen', () async {
      final api = FixtureLearnApi();
      final c = feedController(api, launch: const FeedLaunch(chapterKey: l2Aop, minutes: 10, source: 'explore_cover', forYou: true, position: 2));
      await c.start();
      expect(c.status, FeedStatus.ready);
      final s = api.starts.single;
      expect(s.kind, LearnKinds.feed);
      expect(s.leaveOut, [LearnPiles.lesson]);
      expect(s.toJson(), containsPair('source', 'explore_cover'));
      expect(s.toJson(), containsPair('forYou', true));
      expect(s.toJson(), containsPair('position', 2));
      expect(c.title, 'Admission of a Partner');
      expect(c.items, hasLength(16));
      expect(c.of, 16);
      expect(c.position, 1);
      expect(c.stateOf(c.items.first.id).seen, isTrue);
      expect(c.note, isNull);
      expect(c.mode, FeedMode.items);
      c.dispose();
    });

    test('a checkpoint comes after 8 items when 4 or more follow', () async {
      final c = feedController(FixtureLearnApi());
      await c.start();
      expect(c.slots, hasLength(17));
      expect(c.slots[8], isA<FeedCheckpointSlot>().having((s) => s.after, 'after', 8));
      expect([for (final s in c.slots) s is FeedCheckpointSlot], [for (var i = 0; i < 17; i++) i == 8]);
      // Free's 12 items: 4 follow the eighth, so it has one too.
      final free = feedController(FixtureLearnApi(pro: false));
      await free.start();
      expect(free.slots.whereType<FeedCheckpointSlot>().single.after, 8);
      c.dispose();
      free.dispose();
    });

    test('a pick-up adopts the server\'s place: "Picked up at 4 of 16" and the reinsert three on', () async {
      final api = FixtureLearnApi();
      final first = feedController(api);
      await first.start();
      final runId = first.run!.id;
      first.turn(cardAt(first, 0));
      await first.keep(cardAt(first, 1));
      first.go(4);
      await first.choose(questionAt(first, 4), rightKey(questionAt(first, 4)));
      first.dispose();

      final c = feedController(api, launch: FeedLaunch(chapterKey: l2Aop, runId: runId));
      await c.start();
      expect(api.calls.where((x) => x.startsWith('getRun')), hasLength(1));
      expect(c.base, 2);
      expect(c.note, 'Picked up at 3 of 16');
      expect(c.of, 16);
      expect(c.position, 3);
      // The note goes with the first move.
      c.go(1);
      expect(c.note, isNull);
      c.dispose();
    });

    test('a run with nothing left opens on its end; end=1 reads only the end', () async {
      final api = FixtureLearnApi();
      final first = feedController(api);
      await first.start();
      final runId = first.run!.id;
      first.dispose();
      final c = feedController(api, launch: FeedLaunch(chapterKey: l2Aop, runId: runId, end: true));
      await c.start();
      await settle();
      expect(c.onlyEnd, isTrue);
      expect(c.mode, FeedMode.end);
      expect(api.ended, [runId]);
      expect(c.endStatus, FeedEndStatus.ready);
      expect(c.closed, isTrue);
      c.dispose();
    });

    test('Free\'s day used is its own state with the server\'s line, options and pick-up', () async {
      final c = feedController(FixtureLearnApi(pro: false, freeUsed: true));
      await c.start();
      expect(c.status, FeedStatus.free);
      expect(c.free!.line, startsWith('Your free Learn session for today is done.'));
      expect(c.free!.options.map((o) => o.label), ['Revise 3 due cards', 'Quick recap of this chapter', 'Questions on this chapter in Explore']);
      expect(c.free!.resume!.kind, LearnKinds.feed);
      expect(c.asksToStop, isFalse);
      c.dispose();
    });

    test('error, not found and empty', () async {
      final error = feedController(FixtureLearnApi(error: true));
      await error.start();
      expect(error.status, FeedStatus.error);
      final missing = feedController(FixtureLearnApi(), launch: const FeedLaunch(chapterKey: l2Missing));
      await missing.start();
      expect(missing.status, FeedStatus.notFound);
      final empty = feedController(EmptyFeedApi());
      await empty.start();
      expect(empty.status, FeedStatus.empty);
      expect(empty.title, 'Admission of a Partner');
      // Try again starts once more.
      final api = FixtureLearnApi(error: true);
      final again = feedController(api);
      await again.start();
      api.error = false;
      await again.begin();
      expect(again.status, FeedStatus.ready);
      for (final c in [error, missing, empty, again]) {
        c.dispose();
      }
    });
  });

  group('cards', () {
    test('a turn then Next: the back counts once read, the next card is seen', () async {
      final events = FeedEvents();
      final c = feedController(FixtureLearnApi(), events: events);
      await c.start();
      expect(c.itemsDone, 0);
      expect(c.asksToStop, isFalse);
      c.turn(cardAt(c, 0));
      expect(c.stateOf(c.items[0].id).turned, isTrue);
      expect(c.stateOf(c.items[0].id).seenBack, isTrue);
      expect(events.said.last, startsWith("NCERT's line. "));
      expect(c.itemsDone, 1);
      expect(c.asksToStop, isTrue);
      c.go(1);
      expect(c.active, 1);
      expect(c.stateOf(c.items[1].id).seen, isTrue);
      expect(c.position, 2);
      expect(c.doneCount, 1);
      expect(c.current, 1);
      c.turn(cardAt(c, 0));
      expect(events.said.last, 'The card side.');
      c.dispose();
    });

    test('Keep: the server\'s line as the stamp, the kept count, the flight', () async {
      final api = FixtureLearnApi();
      final events = FeedEvents();
      final c = feedController(api, events: events);
      await c.start();
      final card = cardAt(c, 0);
      await c.keep(card);
      final st = c.stateOf(card.id);
      expect(st.kept, isTrue);
      expect(st.stamp, const FeedStamp('In Revise'));
      expect(c.numbers.kept, 1);
      expect(events.kept, [card.id]);
      expect(events.said.last, 'Kept. In Revise.');
      expect(api.keeps.single.itemId, card.id);
      expect(c.dirty, 1);
      expect(c.changed, isTrue);
      // Once kept, a second tap sends nothing.
      await c.keep(card);
      expect(api.keeps, hasLength(1));
      c.dispose();
    });

    test('Keep on a locked card (402): "This card is on Pro." and the key opens Pro', () async {
      final api = FixtureLearnApi(failOn: {'keep': FixtureLearnApi.proRequired});
      final events = FeedEvents();
      final c = feedController(api, events: events);
      await c.start();
      final card = cardAt(c, 0);
      await c.keep(card);
      expect(c.stateOf(card.id).keepPro, isTrue);
      expect(c.stateOf(card.id).stamp, const FeedStamp('This card is on Pro.'));
      expect(events.said.last, 'This card is on Pro.');
      await c.keep(card);
      expect(events.seePro, ['keycards']);
      expect(api.keeps, hasLength(1));
      c.dispose();
    });

    test('Keep that fails: "Not kept. Try again." in the bad colour', () async {
      final c = feedController(FixtureLearnApi(failOn: {'keep': FixtureLearnApi.offlineError}));
      await c.start();
      await c.keep(cardAt(c, 0));
      expect(c.stateOf(c.items[0].id).stamp, const FeedStamp('Not kept. Try again.', bad: true));
      expect(c.numbers.kept, 0);
      c.dispose();
    });

    test('the first feed\'s nudge comes once, after the first turn, and is remembered', () async {
      final store = MemoryPrefsStore();
      final prefs = LearnPrefs(store);
      final events = FeedEvents();
      final c = feedController(FixtureLearnApi(), events: events, prefs: prefs, reduced: false);
      await c.start();
      await settle();
      c.turn(cardAt(c, 0));
      await Future<void>.delayed(FeedController.nudgeAfter + const Duration(milliseconds: 50));
      expect(events.nudges, 1);
      expect(await prefs.feedNudgeSeen(), isTrue);
      c.turn(cardAt(c, 0));
      c.turn(cardAt(c, 0));
      await Future<void>.delayed(FeedController.nudgeAfter + const Duration(milliseconds: 50));
      expect(events.nudges, 1);
      c.dispose();
      // A later feed: none.
      final later = feedController(FixtureLearnApi(), events: events, prefs: prefs, reduced: false);
      await later.start();
      await settle();
      later.turn(cardAt(later, 0));
      await Future<void>.delayed(FeedController.nudgeAfter + const Duration(milliseconds: 50));
      expect(events.nudges, 1);
      later.dispose();
    });
  });

  group('questions', () {
    test('Save: the question is in Saved; Free\'s limit (402) says so and opens Pro', () async {
      final api = FixtureLearnApi();
      final events = FeedEvents();
      final c = feedController(api, events: events);
      await c.start();
      final q = questionAt(c, 4);
      await c.save(q);
      expect(c.stateOf(q.id).saved, isTrue);
      expect(api.saved, [q.question.id]);
      expect(events.saved, 1);
      expect(events.said.last, 'Saved.');

      final full = FixtureLearnApi(failOn: {'saveQuestion': LearnError.fromResponse(402, {'error': 'Free bookmark limit reached'})});
      final e2 = FeedEvents();
      final f = feedController(full, events: e2);
      await f.start();
      await f.save(questionAt(f, 4));
      expect(f.stateOf(questionAt(f, 4).id).savePro, isTrue);
      expect(e2.said.last, 'Saving more questions is on Pro.');
      await f.save(questionAt(f, 4));
      expect(e2.seePro, ['saved']);
      c.dispose();
      f.dispose();
    });

    test('right answers keep a streak: "Right. 3 in a row." from 3', () async {
      final api = FixtureLearnApi();
      final events = FeedEvents();
      final c = feedController(api, events: events);
      await c.start();
      c.go(4);
      await c.choose(questionAt(c, 4), rightKey(questionAt(c, 4)));
      expect(c.streak, 1);
      expect(events.said.last, 'Right.');
      c.go(7);
      await c.choose(questionAt(c, 7), rightKey(questionAt(c, 7)));
      expect(c.streak, 2);
      // An old mistake answered right says the server's fixed line.
      expect(events.said.last, 'Right this time. Back on Wed to check it held.');
      c.go(10);
      await c.choose(questionAt(c, 10), rightKey(questionAt(c, 10)));
      expect(c.streak, 3);
      expect(events.said.last, 'Right. 3 in a row.');
      expect(c.numbers.answered, 2);
      expect(c.numbers.right, 2);
      expect(c.numbers.mistakes, 1);
      expect(c.numbers.fixed, 1);
      c.dispose();
    });

    test('a wrong answer: the line you needed is said, the card comes back three on, the streak ends', () async {
      final api = FixtureLearnApi();
      final events = FeedEvents();
      final c = feedController(api, events: events);
      await c.start();
      c.go(4);
      final q = questionAt(c, 4);
      await c.choose(q, rightKey(q));
      expect(c.streak, 1);
      c.go(7);
      final m = questionAt(c, 7);
      await c.choose(m, wrongKey(m));
      expect(c.streak, 0);
      final res = c.stateOf(m.id).res!;
      expect(res.correct, isFalse);
      expect(res.line?.card, isNotNull);
      expect(events.said.last, startsWith('Not quite. The answer is '));
      expect(events.said.last, contains(' The line you needed: Goodwill appearing in the books'));
      // The copy is in the list three on, once; the student stays on the question.
      expect(c.items, hasLength(17));
      final copy = c.items[res.reinsert!.at];
      expect(copy.id, res.reinsert!.itemId);
      expect(c.items.where((i) => i.id == copy.id), hasLength(1));
      expect((c.slots[c.active] as FeedItemSlot).item.id, m.id);
      // One send per item.
      await c.choose(m, rightKey(m));
      expect(api.answers.where((a) => a.itemId == m.id), hasLength(1));
      c.dispose();
    });

    test('a checkpoint that a longer list earns before the student never moves them off their question', () async {
      final api = ShortFeedApi();
      final c = feedController(api);
      await c.start();
      expect(c.slots.whereType<FeedCheckpointSlot>(), isEmpty);
      // Item 10 is a question; a wrong answer makes 12 items, and the eighth now has 4 after it.
      final q = c.items[9] as LearnQuestionItem;
      c.go(9);
      await c.choose(q, 'B');
      expect(c.items, hasLength(12));
      expect(c.slots.whereType<FeedCheckpointSlot>().single.after, 8);
      expect((c.slots[c.active] as FeedItemSlot).item.id, q.id);
      expect(c.active, 10);
      c.dispose();
    });

    test('Skip moves on and sends nothing; a skip is not a mistake', () async {
      final api = FixtureLearnApi();
      final c = feedController(api);
      await c.start();
      c.go(4);
      c.go(5);
      expect(api.answers, isEmpty);
      expect(c.numbers.answered, 0);
      expect(c.itemsDone, 0);
      c.dispose();
    });

    test('a left-out question (409) says why in place of its options and counts for nothing', () async {
      final api = FixtureLearnApi(failOn: {'answer': FixtureLearnApi.questionChanged});
      final events = FeedEvents();
      final c = feedController(api, events: events);
      await c.start();
      c.go(4);
      final q = questionAt(c, 4);
      await c.choose(q, 'A');
      expect(c.stateOf(q.id).skipped, 'This question changed a moment ago, so it is left out.');
      expect(c.stateOf(q.id).answer, isNull);
      expect(events.said.last, 'This question changed a moment ago, so it is left out.');
      expect(c.itemsDone, 0);
      final held = FixtureLearnApi(failOn: {'answer': LearnError.fromResponse(409, {'error': 'QUESTION_HELD'})});
      final h = feedController(held);
      await h.start();
      await h.choose(questionAt(h, 4), 'A');
      expect(h.stateOf(questionAt(h, 4).id).skipped, 'This question is in an open Mob paper, so it is left out for now.');
      c.dispose();
      h.dispose();
    });

    test('an answer that was not saved frees the options again', () async {
      final api = FixtureLearnApi(failOn: {'answer': FixtureLearnApi.offlineError});
      final c = feedController(api);
      await c.start();
      final q = questionAt(c, 4);
      await c.choose(q, 'A');
      expect(c.stateOf(q.id).error, 'That answer was not saved. Try again.');
      expect(c.stateOf(q.id).answer, isNull);
      api.failOn.clear();
      await c.choose(q, rightKey(q));
      expect(c.stateOf(q.id).res?.correct, isTrue);
      expect(c.stateOf(q.id).error, isNull);
      c.dispose();
    });

    test('a closed run (409 RUN_ENDED) goes to the end; Free\'s day claimed elsewhere ends calmly', () async {
      final api = FixtureLearnApi(failOn: {'answer': LearnError.fromResponse(409, {'error': 'RUN_ENDED'})});
      final c = feedController(api);
      await c.start();
      await c.choose(questionAt(c, 4), 'A');
      await settle();
      expect(c.closed, isTrue);
      expect(c.mode, FeedMode.end);

      final used = FixtureLearnApi(failOn: {'answer': LearnFixtures.error('error_402_free_session_used')});
      final events = FeedEvents();
      final f = feedController(used, events: events);
      await f.start();
      final q = questionAt(f, 4);
      await f.choose(q, 'A');
      expect(f.closed, isTrue);
      expect(f.stateOf(q.id).skipped, startsWith('Your free Learn session for today is done.'));
      expect(f.mode, FeedMode.items);
      // Nothing more is sent once closed.
      await f.choose(questionAt(f, 10), 'A');
      expect(used.answers, hasLength(1));
      c.dispose();
      f.dispose();
    });
  });

  group('the stop rule and the end', () {
    test('Close asks only after an item is done, and never on the end', () async {
      final c = feedController(FixtureLearnApi());
      await c.start();
      expect(c.asksToStop, isFalse);
      await c.keep(cardAt(c, 0));
      expect(c.asksToStop, isTrue);
      expect(c.stopDetail, '1 kept in Revise.');
      c.go(4);
      await c.choose(questionAt(c, 4), rightKey(questionAt(c, 4)));
      expect(c.stopDetail, '1 of 1 question right. 1 kept in Revise.');
      c.go(c.endAt);
      expect(c.mode, FeedMode.end);
      expect(c.asksToStop, isFalse);
      c.dispose();
    });

    test('the end is the server\'s: read on arrival, not again unless something changed', () async {
      final api = FixtureLearnApi();
      final c = feedController(api);
      await c.start();
      await c.keep(cardAt(c, 0));
      c.go(c.endAt);
      expect(c.endStatus, FeedEndStatus.loading);
      await settle();
      expect(c.endStatus, FeedEndStatus.ready);
      final f = c.endData!.feed!;
      expect(f.lead!.label, 'Another 10 minutes');
      expect(f.next!.label, 'Next chapter: Retirement and Death of a Partner');
      expect(c.position, 16);
      expect(c.furthest, 16);
      final lines = FeedModel.endLines([for (final l in f.lines) (label: l.label, text: l.text)], seen: c.numbers.seen, kept: f.kept.count, hasCards: c.hasCards);
      expect(lines.first, (label: 'Cards', text: '1 seen, 1 kept'));
      expect(lines.map((l) => l.label), ['Cards', 'Questions', 'Old mistakes']);
      // Back to the last item and to the end again: the same version, no second read.
      c.go(c.endAt - 1);
      c.go(c.endAt);
      await settle();
      expect(api.ended, hasLength(1));
      expect(c.closed, isTrue);
      c.dispose();
    });

    test('an end that did not load is read again when it is opened again', () async {
      final api = FixtureLearnApi(failOn: {'end': FixtureLearnApi.offlineError});
      final c = feedController(api);
      await c.start();
      c.go(c.endAt);
      await settle();
      expect(c.endStatus, FeedEndStatus.error);
      api.failOn.clear();
      c.go(c.endAt - 1);
      c.go(c.endAt);
      await settle();
      expect(c.endStatus, FeedEndStatus.ready);
      expect(api.ended, hasLength(2));
      c.dispose();
    });

    test('"Another 10 minutes" starts a fresh feed of the chapter', () async {
      final api = FixtureLearnApi();
      final c = feedController(api);
      await c.start();
      final first = c.run!.id;
      c.go(c.endAt);
      await settle();
      final again = c.againFeed();
      expect(c.again, isTrue);
      await again;
      expect(c.again, isFalse);
      expect(api.starts.last.fresh, isTrue);
      expect(api.starts.last.chapterKey, l2Aop);
      expect(api.starts.last.minutes, 10);
      expect(c.run!.id, isNot(first));
      expect(c.active, 0);
      expect(c.mode, FeedMode.items);
      expect(c.closed, isFalse);
      expect(c.endStatus, FeedEndStatus.idle);
      c.dispose();
    });

    test('"Another 10 minutes" after Free\'s claim turns into the day-used state', () async {
      final api = FixtureLearnApi(pro: false);
      final c = feedController(api);
      await c.start();
      c.go(1);
      await c.choose(questionAt(c, 1), rightKey(questionAt(c, 1)));
      expect(api.freeUsed, isTrue);
      await c.againFeed();
      expect(c.status, FeedStatus.free);
      c.dispose();
    });

    test('"This feed" rows carry each item\'s mark and place', () async {
      final c = feedController(FixtureLearnApi());
      await c.start();
      await c.keep(cardAt(c, 0));
      c.go(4);
      await c.choose(questionAt(c, 4), wrongKey(questionAt(c, 4)));
      final rows = c.sheetRows();
      expect(rows.first.mark, FeedRowMark.kept);
      expect(rows.first.kind, 'Key card');
      expect(rows[4].mark, FeedRowMark.wrong);
      // The wrong answer's card came back three on, before the old mistake.
      expect(rows[7].kind, 'Key card');
      expect(rows[8].kind, 'Old mistake');
      expect(c.slotIndexOf(rows[8].id), 9);
      c.dispose();
    });
  });
}
