import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/learn2/data/learn_api.dart';
import 'package:mockmob/features/learn2/data/learn_models.dart';

import '../support/fixture_learn_api.dart';

/// The fixture server the screen packets test on: recorded bodies, the state a feed or a run needs, and the switches.
void main() {
  const feed = RunStart(kind: LearnKinds.feed, chapterKey: l2Aop);
  const mix = RunStart(chapterKey: l2Pf);

  test('a start returns the recorded run; a second start picks it up; fresh is a new run', () async {
    final api = FixtureLearnApi();
    final run = await api.startRun(feed);
    expect(run.isFeed, isTrue);
    expect(run.items, hasLength(LearnFixtures.run('run_start_feed_aop_pro').items.length));
    final card = run.items.whereType<LearnCardItem>().first;
    await api.keep(run.id, card.id);
    final again = await api.startRun(feed);
    expect(again.id, run.id);
    expect(again.resumed!.done, 1);
    expect(again.items.any((i) => i.id == card.id), isFalse);
    final fresh = await api.startRun(const RunStart(kind: LearnKinds.feed, chapterKey: l2Aop, fresh: true));
    expect(fresh.id, isNot(run.id));
    expect(fresh.resumed, isNull);
    expect(api.starts, hasLength(3));
  });

  test('answers are graded with the recorded keys: right, wrong with the line put back in, an old mistake fixed', () async {
    final api = FixtureLearnApi();
    final run = await api.startRun(feed);
    final questions = run.items.whereType<LearnQuestionItem>().toList();
    final linked = questions.firstWhere((q) => !q.isMistake);
    final key = LearnFixtures.key(linked.question.id)!;
    final right = await api.answer(run.id, linked.id, key.toLowerCase());
    expect(right.correct, isTrue);
    expect(right.key, key);
    expect(right.choice, key);
    expect(right.line, isNull);
    expect(right.explanation, LearnFixtures.explanation(linked.question.id));
    expect(await api.answer(run.id, linked.id, 'B'), isA<LearnAnswer>().having((a) => a.correct, 'replay', isTrue));

    final mistake = questions.firstWhere((q) => q.isMistake);
    final mistakeKey = LearnFixtures.key(mistake.question.id)!;
    final wrong = await api.answer(run.id, mistake.id, mistakeKey == 'A' ? 'B' : 'A');
    expect(wrong.correct, isFalse);
    expect(wrong.line!.card, isNotNull);
    final back = wrong.reinsert!;
    final now = await api.getRun(run.id);
    final at = now.items.indexWhere((i) => i.id == back.itemId);
    expect(at, isNot(-1));
    expect((back.item! as LearnCardItem).reason, 'line');
    expect(now.resumed!.of, run.items.length + 1);

    final second = await api.startRun(const RunStart(chapterKey: l2Pf, fresh: true));
    final open = second.items.whereType<LearnQuestionItem>().firstWhere((q) => q.isMistake);
    final fixed = await api.answer(second.id, open.id, LearnFixtures.key(open.question.id)!);
    expect(fixed.fixed, isTrue);
    expect(fixed.fixedText, isNotNull);
    expect(fixed.line!.collapsed, isTrue);
    await expectLater(api.answer(second.id, second.items.whereType<LearnCardItem>().first.id, 'A'), throwsA(isA<LearnError>()));
  });

  test('ratings: Missed puts the card back in, Got it and Easy fill the Revise pile, a replay answers the first', () async {
    final api = FixtureLearnApi();
    final run = await api.startRun(mix);
    final cards = run.items.whereType<LearnCardItem>().toList();
    final missed = await api.rate(run.id, cards[0].id, 1);
    expect(missed.stamp, 'Back later in this run');
    expect((missed.reinsert!.item! as LearnCardItem).stage, 'again');
    final got = await api.rate(run.id, cards[1].id, 3);
    expect(got.revisePile, 1);
    final easy = await api.rate(run.id, cards[2].id, 4);
    expect(easy.revisePile, 2);
    expect((await api.rate(run.id, cards[1].id, 4)).replay, isTrue);
    await expectLater(api.rate(run.id, cards[3].id, 2), throwsA(isA<LearnError>()));
    expect(api.ratings, hasLength(5));
  });

  test('the end answers the recorded end, once and again; then the run is closed', () async {
    final api = FixtureLearnApi();
    final run = await api.startRun(feed);
    final end = await api.end(run.id);
    expect(end.feed!.kept.count, 1);
    expect((await api.end(run.id)).title, end.title);
    final closed = await _error(() => api.getRun(run.id));
    expect(closed.kind, LearnErrorKind.runEnded);
    expect(closed.endHref, '/explore/run?run=${run.id}&end=1');
    expect((await _error(() => api.keep(run.id, run.items.first.id))).kind, LearnErrorKind.runEnded);
    expect((await api.startRun(feed)).id, isNot(run.id));
    final mixEnd = await api.end((await api.startRun(mix)).id);
    expect(mixEnd.feed, isNull);
    expect((await _error(() => api.getRun('lr_nope'))).code, 'RUN_NOT_FOUND');
  });

  test('Free: the first answered question claims the day; then a feed is refused and a mix is Key cards only', () async {
    final api = FixtureLearnApi(pro: false);
    expect((await api.subject('accountancy')).freeNote, isNotNull);
    final run = await api.startRun(feed);
    expect(run.items.whereType<LearnCardItem>().length, LearnFixtures.run('run_start_feed_aop_free').items.whereType<LearnCardItem>().length);
    final q = run.items.whereType<LearnQuestionItem>().first;
    await api.answer(run.id, q.id, 'A');
    expect(api.freeUsed, isTrue);
    final refused = await _error(() => api.startRun(const RunStart(kind: LearnKinds.feed, chapterKey: l2Pf)));
    expect(refused.kind, LearnErrorKind.sessionUsed);
    expect(refused.sessionUsed.resume, isNotNull);
    expect((await api.startRun(mix)).free, isNotNull);
    expect((await api.subject('accountancy')).free, isNotNull);
    expect((await api.covers('accountancy')).free, isNotNull);
    expect((await api.preview(chapterKey: l2Pf, minutes: 10)).freeSession!.used, isTrue);
    expect((await api.end(run.id)).lead!.label, 'See Pro');
  });

  test('the switches: error, offline, not found, off, slow, a new student, one failing method', () async {
    expect((await _error(() => FixtureLearnApi(error: true).covers('accountancy'))).code, 'LEARN_UNAVAILABLE');
    final offline = await _error(() => FixtureLearnApi(offline: true).subject('accountancy'));
    expect(offline.offline, isTrue);
    final missing = FixtureLearnApi(notFound: true);
    expect((await _error(() => missing.startRun(feed))).kind, LearnErrorKind.chapterNotFound);
    expect((await _error(() => missing.preview(chapterKey: l2Aop, minutes: 10))).kind, LearnErrorKind.chapterNotFound);
    expect((await _error(() => FixtureLearnApi().preview(chapterKey: l2Missing, minutes: 10))).kind, LearnErrorKind.chapterNotFound);
    expect((await _error(() => FixtureLearnApi(off: true).shelves())).kind, LearnErrorKind.off);
    final slow = FixtureLearnApi(slow: const Duration(milliseconds: 30));
    final watch = Stopwatch()..start();
    await slow.shelves('accountancy');
    expect(watch.elapsedMilliseconds, greaterThanOrEqualTo(25));
    final fresh = FixtureLearnApi(newStudent: true);
    expect((await fresh.subject('accountancy')).isNew, isTrue);
    expect((await fresh.covers('accountancy')).history, isFalse);
    expect((await fresh.preview(chapterKey: l2Aop, minutes: 10)).firstVisit, isTrue);
    expect((await fresh.startRun(feed)).chapter.key, l2Pf);
    final keepFails = FixtureLearnApi(failOn: {'keep': FixtureLearnApi.proRequired});
    final run = await keepFails.startRun(feed);
    expect((await _error(() => keepFails.keep(run.id, run.items.first.id))).kind, LearnErrorKind.proRequired);
    final picked = FixtureLearnApi(startFixtures: {'mix': 'run_start_mix_aop_resume_pro'});
    expect((await picked.startRun(mix)).resumed!.done, 6);
  });

  test('reads by plan and student, and the Cards view filtered as the server filters', () async {
    final pro = FixtureLearnApi();
    expect((await pro.subject('economics')).subject.id, 'economics');
    expect((await pro.chapterCards(l2Aop, filter: 'missed')).cards.every((c) => c.missedLately), isTrue);
    expect((await pro.chapterCards(l2Aop, filter: 'missed')).cards, hasLength(2));
    expect((await pro.chapterCards(l2Aop, filter: 'due')).sections, isEmpty);
    expect((await pro.search('accountancy', 'GoodWill')).cards, isNotEmpty);
    expect((await pro.search('accountancy', 'debenture')).cards, isEmpty);
    expect((await pro.preview(chapterKey: l2Cpsr, minutes: 20, addNext: true)).added, isNotNull);
    final free = FixtureLearnApi(pro: false);
    expect((await free.chapterCards(l2Aop)).lockedCount, 48);
    expect((await free.preview(chapterKey: l2Aop, minutes: 20)).capped, isNotNull);
    expect((await free.saveQuestion('q1')).limit, 25);
  });
}

Future<LearnError> _error(Future<Object?> Function() call) async {
  try {
    await call();
  } on LearnError catch (e) {
    return e;
  }
  fail('no LearnError');
}
