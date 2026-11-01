import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/json_helpers.dart';
import 'package:mockmob/features/learn2/data/learn_api.dart';
import 'package:mockmob/features/learn2/data/learn_models.dart';

import '../support/fixture_learn_api.dart';

/// Every recording in test/fixtures/learn2/ parses, and nothing a screen needs is lost: each list keeps every entry the
/// server sent, and the fields the screens draw read exactly the recorded values.
void main() {
  /// Parses a recording with the model of the route it answered.
  Object parseRecorded(String name) {
    final status = LearnFixtures.status(name);
    final body = LearnFixtures.json(name);
    if (status >= 400) return LearnError.fromResponse(status, body);
    final route = LearnFixtures.route(name);
    final cardsOfSubject = name.startsWith('cards_subject_');
    return switch (route) {
      '/api/learn/subject' => LearnSubjectData.parse(body),
      '/api/learn/covers' => LearnCovers.parse(body),
      '/api/learn/shelves' => LearnShelves.parse(body),
      '/api/learn/search' => LearnSearch.parse(body),
      '/api/learn/cards' => cardsOfSubject ? LearnSubjectCards.parse(body) : LearnChapterCards.parse(body),
      '/api/learn/runs/preview' => LearnPreview.parse(body),
      '/api/learn/runs' => LearnRun.parse(body),
      _ when route.endsWith('/answer') => LearnAnswer.parse(body),
      _ when route.endsWith('/rate') => LearnRateResult.parse(body),
      _ when route.endsWith('/end') => LearnEnd.parse(body),
      _ when route.startsWith('/api/learn/runs/') => LearnRun.parse(body),
      _ => throw StateError('no model for $route'),
    };
  }

  test('every recording parses with its route model, and no list entry is dropped', () {
    final names = LearnFixtures.names();
    expect(names.length, greaterThanOrEqualTo(60));
    for (final name in names) {
      final raw = LearnFixtures.json(name);
      final parsed = parseRecorded(name);
      switch (parsed) {
        case LearnSubjectData d:
          expect(d.suggestions, hasLength(asJsonList(raw['suggestions']).length), reason: name);
          expect(d.parts, hasLength(asJsonList(raw['parts']).length), reason: name);
          final rows = [for (final p in asJsonList(raw['parts'])) for (final u in asJsonList(p['units'])) ...asJsonList(u['chapters'])];
          expect(d.chapters.length, rows.length, reason: name);
          expect(d.subjects, hasLength(asJsonList(raw['subjects']).length), reason: name);
        case LearnCovers c:
          expect(c.covers, hasLength(asJsonList(raw['covers']).length), reason: name);
          for (final cover in c.covers) {
            expect(cover.counts.keys, containsAll([5, 10, 20]), reason: '$name ${cover.key}');
          }
        case LearnPreview p:
          expect(p.piles, hasLength(asJsonList(raw['piles']).length), reason: name);
          expect(p.chapter.key, isNotEmpty, reason: name);
        case LearnRun r:
          expect(r.id, isNotEmpty, reason: name);
          expect(r.items, hasLength(asJsonList(raw['items']).length), reason: name);
        case LearnChapterCards c:
          expect(c.cards.length, [for (final s in asJsonList(raw['sections'])) ...asJsonList(s['cards'])].length, reason: name);
        case LearnSubjectCards c:
          expect(c.cards.length, [for (final ch in asJsonList(raw['chapters'])) ...asJsonList(ch['cards'])].length, reason: name);
        case LearnSearch s:
          expect(s.cards, hasLength(asJsonList(raw['cards']).length), reason: name);
          expect(s.chapters, hasLength(asJsonList(raw['chapters']).length), reason: name);
        case LearnEnd e:
          expect(e.title, isNotEmpty, reason: name);
          expect(e.options, hasLength(asJsonList(raw['options']).length), reason: name);
          expect(e.lines, hasLength(asJsonList(raw['lines']).length), reason: name);
        case LearnError e:
          expect(e.status, LearnFixtures.status(name), reason: name);
          expect(e.code, raw['error'], reason: name);
        default:
          break;
      }
    }
  });

  group('GET /api/learn/subject', () {
    test('Pro, returning: parts, units, rows, the part option and three suggestions', () {
      final d = LearnFixtures.subject('subject_accountancy_pro');
      expect(d.isPro, isTrue);
      expect(d.isNew, isFalse);
      expect(d.subjects.map((s) => s.id), ['accountancy', 'business_studies', 'economics', 'english']);
      expect((d.subject.id, d.subject.name, d.subject.cards, d.subject.chapters, d.subject.lessons), ('accountancy', 'Accountancy', 868, 15, 4));
      expect(d.freeNote, isNull);
      expect(d.free, isNull);
      expect(d.suggestions.map((s) => s.kind), ['pickup', 'due', 'fix']);
      final pickup = d.suggestions.first;
      expect(pickup.headline, 'Pick up');
      expect(pickup.chapterTitle, 'Admission of a Partner');
      expect(pickup.action.label, 'Pick up, 5 minutes');
      expect(pickup.action.run!.kind, LearnKinds.mix);
      expect(pickup.action.run!.resume, startsWith('lr_'));
      final due = d.suggestions[1].action.run!;
      expect(due.kind, LearnKinds.cards);
      expect(due.cardIds, hasLength(3));
      expect(due.leaveOut, ['questions', 'mistakes', 'lesson']);
      expect(d.parts.map((p) => p.title), ['Part 1, Partnership Accounts', 'Part 2, Company Accounts and Analysis of Financial Statements']);
      expect(d.parts.first.option, isNull);
      final option = d.parts[1].option!;
      expect(option.label, 'Your part');
      expect(option.choices.map((c) => c.id), ['AFS', 'CAS']);
      expect(option.chosen, isNull);
      expect(option.hint, 'Both parts show until you choose.');
      expect(d.parts[1].units.map((u) => u.optionId), [null, 'AFS', 'CAS']);
      final aop = d.chapter('accountancy.admission-of-partner')!;
      expect((aop.ref, aop.cards, aop.mustKnow, aop.mistakes, aop.questions), ('Ch 2', 53, 14, 2, 10));
      expect(aop.state.key, 'getting_there');
      expect(aop.state.label, 'Getting there');
      expect(aop.lesson!.title, 'Revaluation of assets and liabilities');
      expect(aop.meta, '6 of 16 done today, 2 open mistakes');
      expect(d.chapter('accountancy.computerized-accounting-system')!.ref, isNull);
    });

    test('Free: the free note; after the day is used, free with its 10 minutes', () {
      final free = LearnFixtures.subject('subject_accountancy_free');
      expect(free.isPro, isFalse);
      expect(free.freeNote, 'Free opens 5 cards in every chapter. Pro opens all 868.');
      expect(free.free, isNull);
      final used = LearnFixtures.subject('subject_accountancy_free_used');
      expect(used.free!.text, startsWith('Your free Learn session for today is done.'));
      expect(used.free!.maxMinutes, 10);
      expect(used.suggestions.first.evidence, 'Key cards only today.');
    });

    test('a new student: start, level and the first chapter as a feed', () {
      final d = LearnFixtures.subject('subject_accountancy_new_pro');
      expect(d.isNew, isTrue);
      expect(d.suggestions.map((s) => s.kind), ['start', 'level', 'feed']);
      expect(d.suggestions[1].action.run!.kind, LearnKinds.level);
      final feed = d.suggestions[2];
      expect(feed.action.run, isNull);
      expect(feed.action.href, '/explore/run?chapter=accountancy.partnership-fundamentals&min=10');
      expect(feed.action.go, 'feed');
      expect(feed.action.startsRun, isFalse);
    });

    test('English carries its note; Economics and Business Studies read', () {
      expect(LearnFixtures.subject('subject_english_pro').subject.note, 'English cards are written for MockMob, not taken from an NCERT book.');
      expect(LearnFixtures.subject('subject_economics_pro').subject.name, 'Economics');
      expect(LearnFixtures.subject('subject_business_studies_pro').parts, isNotEmpty);
    });
  });

  group('POST /api/learn/runs/preview', () {
    test('Pro at 10 minutes: piles, recap, the resume row and the shelf', () {
      final p = LearnFixtures.preview('preview_aop_10_pro');
      expect(p.chapter.title, 'Admission of a Partner');
      expect(p.chapter.partTitle, 'Part 1, Partnership Accounts');
      expect(p.chapter.unitTitle, 'Reconstitution of a Partnership firm');
      expect((p.minutes, p.asked, p.realMinutes, p.startLabel), (10, 10, 10, 'Start 10 minutes'));
      expect(p.piles.map((x) => (x.id, x.count, x.minutes)), [('cards', 16, 5), ('questions', 2, 3), ('mistakes', 2, 2)]);
      expect(p.pile('cards')!.minutesLabel, 'about 5 min');
      expect(p.pile('cards')!.held, isNull);
      expect(p.coach, 'Tap a pile to leave it out.');
      expect(p.recap!.label, 'Or a quick recap: the 14 Must-know lines, about 3 min');
      expect(p.resume!.runId, startsWith('lr_'));
      expect((p.resume!.done, p.resume!.of, p.resume!.minutesLeft, p.resume!.kind), (6, 16, 5, 'mix'));
      expect(p.firstVisit, isFalse);
      expect(p.freeSession, isNull);
      expect(p.shelf.cards.count, 53);
      expect(p.shelf.cards.mustKnow, 14);
      expect(p.shelf.questions.linked, 10);
      expect(p.shelf.mistakes.open, 2);
      expect(p.shelf.lesson!.minutes, 7);
      expect(p.shelf.print.locked, isFalse);
    });

    test('a pile left out, a short chapter and the next one added', () {
      final out = LearnFixtures.preview('preview_aop_10_out_questions_pro');
      expect(out.pile('questions')!.left, isTrue);
      expect(out.leaveOut, ['questions']);
      final short = LearnFixtures.preview('preview_cpsr_20_pro');
      expect(short.startLabel, 'Start 19 minutes');
      expect(short.shrink!.reason, 'pool');
      expect(short.shrink!.minutes, 19);
      expect(short.shrink!.text, 'This chapter has about 19 minutes of new things today.');
      expect(short.shrink!.addNext!.key, 'accountancy.goodwill-valuation');
      expect(short.shrink!.addNext!.label, 'Add the next chapter, Goodwill: Nature and Valuation');
      expect(short.shrink!.addNext!.ref, 'Ch 2');
      final added = LearnFixtures.preview('preview_cpsr_20_addnext_pro');
      expect(added.shrink, isNull);
      expect(added.added!.title, 'Goodwill: Nature and Valuation');
      expect(added.startLabel, 'Start 20 minutes');
    });

    test('Free: 20 minutes is composed at 10 with the capped line; after the day, cards only with the piles held', () {
      final capped = LearnFixtures.preview('preview_aop_20_free');
      expect((capped.minutes, capped.asked), (10, 20));
      expect(capped.capped!.asked, 20);
      expect(capped.capped!.text, 'Free sessions are up to 10 minutes. Pro has any length.');
      expect(capped.free!.text, "Free opens 5 of this chapter's 53 cards.");
      expect(capped.freeSession!.used, isFalse);
      expect(capped.shelf.print.locked, isTrue);
      final used = LearnFixtures.preview('preview_pf_10_free_used');
      expect(used.freeSession!.used, isTrue);
      expect(used.freeSession!.line, startsWith('Your free Learn session for today is done.'));
      expect(used.free!.text, startsWith('Your free Learn session today is used, so this one is Key cards only.'));
      expect(used.pile('questions')!.held, 'free');
      expect(used.pile('mistakes')!.held, 'free');
      expect(used.pile('cards')!.held, isNull);
    });

    test('a first visit', () {
      expect(LearnFixtures.preview('preview_aop_10_new_pro').firstVisit, isTrue);
      expect(LearnFixtures.preview('preview_aop_10_new_pro').resume, isNull);
    });
  });

  group('runs', () {
    test('a feed: the chapter, the sealed items with their cards, questions and mistakes', () {
      final run = LearnFixtures.run('run_start_feed_aop_pro');
      expect(run.isFeed, isTrue);
      expect((run.chapter.key, run.chapter.title, run.chapter.ref, run.chapter.partTitle, run.chapter.number), (
        'accountancy.admission-of-partner',
        'Admission of a Partner',
        'Ch 2',
        'Part 1, Partnership Accounts',
        2,
      ));
      expect((run.minutes, run.asked, run.revisePile), (10, 10, 0));
      expect(run.resumed, isNull);
      final card = run.items.first as LearnCardItem;
      expect(card.stage, 'new');
      expect(card.look, isFalse);
      expect(card.seconds, greaterThan(0));
      expect(card.card.front, isNotEmpty);
      expect(card.card.back, isNotEmpty);
      expect(card.card.source.page, isNotNull);
      final question = run.items.whereType<LearnQuestionItem>().first;
      expect(question.question.options.map((o) => o.key), ['A', 'B', 'C', 'D']);
      expect(question.question.body, isNotEmpty);
      expect(question.isMistake, isFalse);
      final mistake = run.items.whereType<LearnQuestionItem>().firstWhere((q) => q.isMistake);
      expect(mistake.mistake!.label, 'You missed this in Mock 4 on 24 Oct');
      expect(mistake.mistake!.where, 'Mock 4');
      expect(run.item(question.id), same(question));
      expect(run.indexOf('nope'), -1);
    });

    test('a pick-up: resumed over the whole run, only the items not done', () {
      final resumed = LearnFixtures.run('run_start_mix_aop_resume_pro');
      expect(resumed.resumed, (done: 6, of: 16));
      expect(resumed.items, hasLength(10));
      final read = LearnFixtures.run('run_get_feed_aop_pro');
      expect(read.resumed!.done, 3);
      expect(read.items.length, read.resumed!.of - read.resumed!.done);
      expect(read.items.whereType<LearnCardItem>().where((c) => c.reason == 'line'), hasLength(1));
    });

    test('recap, cards, level and a lesson item', () {
      final recap = LearnFixtures.run('run_start_recap_pf_pro');
      expect(recap.kind, LearnKinds.recap);
      expect(recap.items.whereType<LearnCardItem>().every((c) => c.look && c.recap), isTrue);
      expect(LearnFixtures.run('run_start_cards_due_pro').items.whereType<LearnCardItem>().every((c) => c.stage == 'due'), isTrue);
      final level = LearnFixtures.run('run_start_level_new_pro');
      expect(level.kind, LearnKinds.level);
      expect(level.items.every((i) => i is LearnQuestionItem), isTrue);
      final lesson = LearnFixtures.run('run_start_mix_aop_20_new_pro').items.first as LearnLessonItem;
      expect(lesson.lesson.title, 'Revaluation of assets and liabilities');
      expect(lesson.lesson.minutes, 7);
    });

    test('Free after the day: a mix of Key cards only, with its line and the shrink', () {
      final run = LearnFixtures.run('run_start_mix_pf_free_cards_only');
      expect(run.free!.text, startsWith('Your free Learn session today is used'));
      expect(run.shrink!.reason, 'pool');
      expect((run.minutes, run.asked), (1, 10));
      expect(run.items.every((i) => i is LearnCardItem), isTrue);
    });
  });

  group('answers, Keep and ratings', () {
    test('right, wrong with the line you needed, a fixed mistake, a locked line on Free', () {
      final right = LearnFixtures.answer('answer_right_pro');
      expect(right.correct, isTrue);
      expect(right.key, right.choice);
      expect(right.line, isNull);
      expect(right.reinsert, isNull);
      expect(right.retired, isNull);
      final wrong = LearnFixtures.answer('answer_wrong_pro');
      expect(wrong.correct, isFalse);
      expect(wrong.key, isNot(wrong.choice));
      expect(wrong.explanation, isNotEmpty);
      expect(wrong.line!.card!.kind, 'key_line');
      expect(wrong.line!.source, 'linked');
      expect(wrong.line!.collapsed, isFalse);
      expect(wrong.line!.locked, isFalse);
      final back = wrong.reinsert!;
      expect(back.itemId, endsWith('-r1'));
      expect(back.at, 15);
      expect(back.moved, isFalse);
      final item = back.item! as LearnCardItem;
      expect(item.reason, 'line');
      expect(item.stage, 'again');
      expect(item.card.id, wrong.line!.card!.id);
      final fixed = LearnFixtures.answer('answer_mistake_fixed_pro');
      expect(fixed.fixed, isTrue);
      expect(fixed.fixedText, 'Right this time. Back on Wed to check it held.');
      expect(fixed.retired, isFalse);
      expect(fixed.line!.collapsed, isTrue);
      final locked = LearnFixtures.answer('answer_free_claim');
      expect(locked.line!.locked, isTrue);
      expect(locked.line!.card, isNull);
      expect(locked.line!.lockedCard!.label, 'Key line');
      expect(locked.line!.text, 'The line for this is in a card that is part of Pro.');
    });

    test('Keep, Missed, Got it and Easy', () {
      final kept = LearnFixtures.rate('keep_pro');
      expect(kept.kept, isTrue);
      expect(kept.stamp, 'In Revise');
      expect(kept.line, 'In Revise');
      final missed = LearnFixtures.rate('rate_missed_pro');
      expect(missed.stamp, 'Back later in this run');
      expect((missed.reinsert!.item! as LearnCardItem).stage, 'again');
      final gotIt = LearnFixtures.rate('rate_got_it_pro');
      expect(gotIt.stamp, 'Back in 20 days');
      expect(gotIt.revisePile, 1);
      expect(LearnFixtures.rate('rate_easy_pro').revisePile, 2);
    });
  });

  group('GET /api/learn/runs/:id/end', () {
    test('a feed: done, the kept pile, lines, Another 10 minutes, the next chapter', () {
      final end = LearnFixtures.end('run_end_feed_aop_pro');
      final feed = end.feed!;
      expect(feed.title, '10 minutes on Admission of a Partner');
      expect((feed.done.reached, feed.done.of, feed.done.minutes), (end.done.reached, end.done.of, end.done.minutes));
      expect(feed.done.all, isFalse);
      expect(feed.kept.count, 1);
      expect(feed.kept.cards.single.front, isNotEmpty);
      expect(feed.kept.line, '1 kept. They are first in Revise.');
      expect(feed.kept.stamp, 'In Revise');
      expect(feed.lines.map((l) => l.label), ['Questions', 'Old mistakes']);
      expect(feed.lead!.label, 'Another 10 minutes');
      expect(feed.lead!.run!.fresh, isTrue);
      expect(feed.lead!.run!.kind, LearnKinds.feed);
      expect(feed.next!.label, 'Next chapter: Retirement and Death of a Partner');
      expect(feed.next!.run!.chapterKey, 'accountancy.retirement-and-death-of-partner');
      expect(feed.free, isNull);
      expect(end.lead!.kind, 'next');
      expect(end.lead!.title, 'Next: Retirement and Death of a Partner');
      expect(end.lead!.minutes, 10);
      expect(end.options.map((o) => o.kind), ['here', 'fix', 'mock']);
      expect(end.options.last.minutes, isNull);
      expect(end.options.last.href, startsWith('/test?'));
      expect(end.options.last.go, 'mock');
    });

    test('a mix: numbers with detail, the Revise pile by day and the cards sent to Revise', () {
      final end = LearnFixtures.end('run_end_mix_pf_pro');
      expect(end.feed, isNull);
      expect(end.numbers.cards, 3);
      expect(end.numbers.fixed, 1);
      expect(end.numbers.detail.cards, '1 got it, 1 easy, 1 missed');
      expect(end.numbers.detail.questions, isNull);
      expect(end.revisePile.map((g) => (g.label, g.count)), [('back tomorrow', 1), ('back in 20 days', 1), ('back in 35 days', 1)]);
      expect(end.reviseCards, hasLength(2));
      expect(end.reviseCards.first.mustKnow, isTrue);
      expect(end.reviseCards.first.front, 'What is a Partnership Deed?');
      expect(end.lines.first.text, '1 got it, 1 easy, 1 missed');
    });

    test('Free after the day: the session line leads with See Pro; no Another 10 minutes, no next run', () {
      final end = LearnFixtures.end('run_end_feed_aop_free');
      expect(end.lead!.label, 'See Pro');
      expect(end.lead!.href, '/pricing');
      expect(end.lead!.go, 'pro');
      expect(end.lead!.line, startsWith('Your free Learn session for today is done.'));
      expect(end.lead!.kind, isNull);
      expect(end.feed!.lead, isNull);
      expect(end.feed!.free!.text, startsWith('Your free Learn session for today is done.'));
      expect(end.feed!.next!.run, isNull);
      expect(end.options.map((o) => o.kind), ['recap', 'explore']);
    });
  });

  group('cards, shelves, search, covers', () {
    test('the Cards view and Find shelf, Pro and Free', () {
      final pro = LearnChapterCards.parse(LearnFixtures.json('cards_aop_all_pro'));
      expect(pro.isPro, isTrue);
      expect((pro.counts.total, pro.counts.all, pro.counts.must, pro.counts.missed), (53, 53, 14, 2));
      expect(pro.counts.of('must'), 14);
      expect(pro.sections.first.title, 'Introduction');
      expect(pro.cards.where((c) => c.missedLately), hasLength(2));
      expect(pro.cards.every((c) => !c.locked && c.card != null), isTrue);
      final free = LearnChapterCards.parse(LearnFixtures.json('cards_aop_all_free'));
      expect(free.isPro, isFalse);
      expect((free.counts.total, free.counts.all, free.lockedCount), (53, 5, 48));
      expect(free.lockedLine, '48 more cards in this chapter. Pro opens every card in every chapter and keeps them on a schedule.');
      final shelf = LearnSubjectCards.parse(LearnFixtures.json('cards_subject_due_free'));
      expect(shelf.filter, 'due');
      expect(shelf.lockedCount, 798);
      expect(shelf.chapters.first.counts.due, 3);
      expect(shelf.cards.every((c) => c.inRevise), isTrue);
    });

    test('shelves: the due total over every subject adds up', () {
      final pro = LearnShelves.parse(LearnFixtures.json('shelves_pro'));
      expect(pro.due.bySubject, {'accountancy': 9, 'business_studies': 6, 'economics': 6, 'english': 6});
      expect(pro.dueTotal, 27);
      expect(pro.due.count, 9);
      expect((pro.missed.count, pro.missed.days), (6, 7));
      expect((pro.revise.count, pro.must.count), (26, 229));
      expect(LearnShelves.parse({'due': {'all': 4}}).dueTotal, 4);
      expect(LearnShelves.parse(LearnFixtures.json('shelves_new_pro')).dueTotal, 0);
    });

    test('search: match spans per field, a locked card as its stub', () {
      final pro = LearnSearch.parse(LearnFixtures.json('search_goodwill_pro'));
      expect(pro.query, 'goodwill');
      expect(pro.tooShort, isFalse);
      expect(pro.chapters.single.match.spans('title'), [const LearnSpan(0, 8)]);
      expect(pro.cards.first.match.spans('front'), isNotEmpty);
      expect(pro.cards.first.card, isNotNull);
      expect((pro.total, pro.more), (70, 20));
      expect(pro.cardCounts['accountancy.goodwill-valuation'], 33);
      final free = LearnSearch.parse(LearnFixtures.json('search_goodwill_free'));
      final locked = free.cards.firstWhere((c) => c.locked);
      expect(locked.card, isNull);
      expect(locked.stub!.label, isNotNull);
      expect(locked.match.isEmpty, isTrue);
      expect(locked.id, locked.stub!.id);
    });

    test('covers: For you first, the three lengths with their hooks, Free capped, the open feed', () {
      final pro = LearnFixtures.covers('covers_accountancy_pro');
      expect(pro.lengths, [5, 10, 20]);
      expect(pro.history, isTrue);
      expect(pro.free, isNull);
      final first = pro.covers.first;
      expect(first.forYou, isTrue);
      expect(first.reason, '3 old mistakes to fix');
      expect(first.refLine, 'Part 1, Ch 1');
      expect(first.name, 'Partnership Fundamentals');
      expect(first.hook!.front, isNotEmpty);
      expect(first.hook!.id, first.count(10)!.hook!.id);
      expect((first.count(20)!.cards, first.count(20)!.questions, first.count(20)!.minutes), (23, 10, 20));
      expect(pro.covers.where((c) => c.forYou), hasLength(1));
      final shrunk = pro.covers.firstWhere((c) => c.key == 'accountancy.retirement-and-death-of-partner').count(20)!;
      expect(shrunk.shrinkReason, 'cap');
      expect(shrunk.shrunk, isTrue);
      final free = LearnFixtures.covers('covers_accountancy_free');
      expect(free.covers.first.count(20)!.capped, isTrue);
      expect(free.covers.first.count(10)!.capped, isFalse);
      final open = LearnFixtures.covers('covers_accountancy_pro_open').covers.first;
      expect(open.reason, 'Pick up where you stopped');
      expect(open.resume!.done, 3);
      expect(open.studentLine, 'You stopped at 3 of ${open.resume!.of}');
      expect(LearnFixtures.covers('covers_accountancy_free_used').free!.maxMinutes, 10);
      expect(LearnFixtures.covers('covers_accountancy_new_pro').history, isFalse);
    });
  });

  test('402 FREE_SESSION_USED: the line, the options that still work today and the run that holds the day', () {
    final e = LearnFixtures.error('error_402_free_session_used');
    expect(e.kind, LearnErrorKind.sessionUsed);
    final used = e.sessionUsed;
    expect(used.line, 'Your free Learn session for today is done. Explore questions stay free. Pro has as many as you like.');
    expect(used.options.map((o) => o.label), ['Revise 3 due cards', 'Quick recap of this chapter', 'Questions on this chapter in Explore']);
    expect(used.options.first.run!.kind, LearnKinds.cards);
    expect(used.options.last.go, 'explore');
    final holder = used.resume!;
    expect((holder.chapterKey, holder.title, holder.kind), ('accountancy.admission-of-partner', 'Admission of a Partner', 'feed'));
    expect(holder.done, lessThan(holder.of));
  });

  group('tolerance', () {
    test('null, empty and wrong types parse to empty models without throwing', () {
      for (final raw in <Object?>[null, <String, dynamic>{}, 'text', 7, <dynamic>[]]) {
        expect(LearnSubjectData.parse(raw).suggestions, isEmpty);
        expect(LearnPreview.parse(raw).piles, isEmpty);
        expect(LearnRun.parse(raw).items, isEmpty);
        expect(LearnAnswer.parse(raw).correct, isFalse);
        expect(LearnRateResult.parse(raw).ok, isFalse);
        expect(LearnEnd.parse(raw).options, isEmpty);
        expect(LearnChapterCards.parse(raw).cards, isEmpty);
        expect(LearnSubjectCards.parse(raw).chapters, isEmpty);
        expect(LearnShelves.parse(raw).dueTotal, 0);
        expect(LearnSearch.parse(raw).cards, isEmpty);
        expect(LearnCovers.parse(raw).lengths, [5, 10, 20]);
        expect(LearnSessionUsed.parse(raw).options, isEmpty);
      }
    });

    test('unknown items and broken entries are left out; numbers sent as strings are read', () {
      final run = LearnRun.parse({
        'id': 'lr_x',
        'minutes': '12',
        'items': [
          {'id': 'a', 'type': 'video'},
          {'id': 'b', 'type': 'card', 'card': {'id': 'c1'}},
          {'id': 'c', 'type': 'question', 'question': {'id': 'q1', 'body': 'Why?', 'options': [{'key': 'a', 'text': 'One'}, {'text': 'no key'}]}},
          {'type': 'card'},
        ],
        'resumed': 'yes',
        'extra': {'ignored': true},
      });
      expect(run.minutes, 12);
      expect(run.asked, 12);
      expect(run.items.single, isA<LearnQuestionItem>());
      expect((run.items.single as LearnQuestionItem).question.options.single.key, 'A');
      expect(run.resumed, isNull);
      expect(run.raw['extra'], {'ignored': true});
      final cover = LearnCover.tryParse({'key': 'k', 'counts': {'5': {'cards': 2}, 'ten': {}, '10': null}})!;
      expect(cover.counts.keys, [5, 10]);
      expect(cover.count(10)!.cards, 0);
      expect(LearnMatch.parse({'front': [{'start': 3, 'end': 1}, {'start': 0, 'end': 2}], 'x': 'no'}).fields, {'front': [const LearnSpan(0, 2)]});
    });
  });

  group('requests', () {
    test("RunStart sends the web's body: resume, fresh and addNext only when set; forYou and position only with a source", () {
      expect(const RunStart(kind: LearnKinds.feed, chapterKey: 'c', minutes: 10, requestKey: 'lk_1').toJson(), {
        'chapterKey': 'c',
        'minutes': 10,
        'leaveOut': <String>[],
        'kind': 'feed',
        'requestKey': 'lk_1',
      });
      expect(
        const RunStart(chapterKey: 'c', leaveOut: ['lesson'], resume: 'lr_1', fresh: true, addNext: true, source: 'explore_cover', forYou: true, position: 2).toJson(),
        {
          'chapterKey': 'c',
          'minutes': 10,
          'leaveOut': ['lesson'],
          'kind': 'mix',
          'resume': 'lr_1',
          'fresh': true,
          'addNext': true,
          'source': 'explore_cover',
          'forYou': true,
          'position': 2,
        },
      );
      expect(const RunStart(kind: LearnKinds.cards, cardIds: ['x', 'y'], forYou: true, position: 1).toJson(), {
        'cardIds': ['x', 'y'],
        'minutes': 10,
        'leaveOut': <String>[],
        'kind': 'cards',
      });
      expect(const RunStart(kind: LearnKinds.feed, chapterKey: 'c').scope, 'feed|c');
      expect(const RunStart(kind: LearnKinds.cards, cardIds: ['x', 'y']).scope, 'cards|x');
      final spec = LearnRunSpec.tryParse({'kind': 'feed', 'chapterKey': 'c', 'minutes': 20, 'fresh': true})!;
      final start = spec.toStart(source: 'explore_cover', forYou: false, position: 0);
      expect((start.kind, start.chapterKey, start.minutes, start.fresh, start.source, start.position), ('feed', 'c', 20, true, 'explore_cover', 0));
    });

    test('a preview key is equal by value and sends the web body', () {
      final a = LearnPreviewKey(chapterKey: 'c', minutes: 10, leaveOut: ['questions', 'cards', 'questions']);
      final b = LearnPreviewKey(chapterKey: 'c', minutes: 10, leaveOut: ['cards', 'questions']);
      expect(a, b);
      expect(a.hashCode, b.hashCode);
      expect(a.leaveOut, ['cards', 'questions']);
      expect(a.toJson(), {'chapterKey': 'c', 'minutes': 10, 'leaveOut': ['cards', 'questions']});
      expect(LearnPreviewKey(chapterKey: 'c', minutes: 10, addNext: true).toJson()['addNext'], isTrue);
      expect(a == LearnPreviewKey(chapterKey: 'c', minutes: 20, leaveOut: ['cards', 'questions']), isFalse);
    });
  });
}
