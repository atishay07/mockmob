// The English pass on Learn v2, Explore and Key cards (docs/brain/learn-1031/r7/E-ENGLISH.md, applied to the app by E-APPLIED-APP.md):
// the app-only rows and the lines the website shares, pinned once so a later edit cannot bring the old wording back. The words
// the website shares are also held by the parity tests (words.json, feed_model.json, stage_text.json and the others).
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/keycards/keycards_copy.dart';
import 'package:mockmob/features/learn2/cards/cards_copy.dart';
import 'package:mockmob/features/learn2/chapter/chapter_copy.dart';
import 'package:mockmob/features/learn2/chapter/chapter_model.dart';
import 'package:mockmob/features/learn2/data/learn_words.dart';
import 'package:mockmob/features/learn2/explore/explore_copy.dart';
import 'package:mockmob/features/learn2/feed/feed_copy.dart';
import 'package:mockmob/features/learn2/feed/feed_model.dart';
import 'package:mockmob/features/learn2/home/home_copy.dart';
import 'package:mockmob/features/learn2/home/home_model.dart';
import 'package:mockmob/features/learn2/run/run_copy.dart';
import 'package:mockmob/features/learn2/stage/stage_end_model.dart';

void main() {
  group('one word for one thing: a session, never a run', () {
    test('the run, the chapter page and the ends', () {
      expect(RunCopy.loadingLabel, 'Getting your session ready');
      expect(RunCopy.errorTitle, "This session didn't start");
      expect(RunCopy.emptyTitle, 'Nothing here yet');
      expect(RunCopy.emptyLine, 'This chapter has no cards or questions for this session.');
      expect(RunCopy.endErrorTitle, 'Your session is saved');
      expect(RunCopy.endErrorLine, "The summary didn't load, but every rating and answer is saved.");
      expect(RunCopy.lessonLine, 'Read this first. Its cards come next.');
      expect(RunCopy.stageLabel('Admission of a Partner'), 'Admission of a Partner session');
      expect(RunCopy.roundLine(5), '5 more to go.');
      expect(ChapterCopy.listLabel, "What's in this session");
      expect(ChapterCopy.failed, "We couldn't set up this session.");
      expect(ChapterCopy.loading, 'Getting this chapter ready');
      expect(ChapterModel.ratingsUsedLine, "You've used today's 10 free card ratings. In this session, cards show their answers but won't go into Revise.");
      expect(LearnWords.missedWords('tomorrow', true), 'in this session, then tomorrow');
    });

    test('no student-facing line of these screens says run or lined up', () {
      final lines = <String>[
        RunCopy.loadingLabel, RunCopy.errorTitle, RunCopy.errorLine, RunCopy.emptyTitle, RunCopy.emptyLine, RunCopy.endErrorTitle, RunCopy.endErrorLine,
        RunCopy.lessonLine, RunCopy.roundLine(3), RunCopy.coachRecap, RunCopy.questionChanged, RunCopy.questionHeld, RunCopy.stageLabel('Chapter'),
        ChapterCopy.listLabel, ChapterCopy.stale, ChapterCopy.failed, ChapterCopy.offline, ChapterCopy.loading, ChapterModel.ratingsUsedLine,
        HomeCopy.offerLoading, for (final e in HomeCopy.setEmpty.values) e.line, for (final e in CardsCopy.empty.values) e.line,
        FeedCopy.emptyTitle, FeedCopy.questionChanged, FeedCopy.questionHeld, FeedCopy.endErrorLine,
      ];
      for (final l in lines) {
        expect(RegExp(r'\brun\b|lined up|lined-up|lining up|line up', caseSensitive: false).hasMatch(l), isFalse, reason: l);
      }
    });
  });

  group('the rating keys say the same thing on Learn and on Key cards', () {
    test('the question, the three keys and the coach line', () {
      expect(RunCopy.ratingGroup, 'How well did you know it?');
      expect(KeyCardsCopy.howDidItGo, 'How well did you know it?');
      expect(RunCopy.missed, 'Missed it');
      expect(KeyCardsCopy.missed, 'Missed it');
      expect(KeyCardsCopy.tapToReveal, LearnWords.turnOver);
      expect(KeyCardsCopy.studyAgain, 'Study again');
      expect(KeyCardsCopy.lookAgain, 'Look again');
      expect(LearnWords.coachRatings, 'How well did you know it? Each key shows when this card comes back: Missed it soonest, Easy latest.');
    });

    test('the daily limit is "card ratings" everywhere', () {
      expect(KeyCardsCopy.reviewCapTitle, "You've used today's 10 card ratings on Free");
      expect(KeyCardsCopy.reviewsLeft(1), '1 card rating left today on Free');
      expect(KeyCardsCopy.reviewsLeft(4), '4 card ratings left today on Free');
      expect(KeyCardsCopy.reviewCapTitle.toLowerCase().contains('review'), isFalse);
    });
  });

  group('what a recap does to the schedule is said in plain words', () {
    test('the recap and the last look', () {
      expect(RunCopy.coachRecap, "Answers are shown. This won't change when your cards come back.");
      expect(KeyCardsCopy.lastLookNote, "Must-know cards only. This won't change when your cards come back.");
    });
  });

  group('Pro and the schedule', () {
    test('the Pro line, the locked matches and the empty Revise note', () {
      expect(KeyCardsCopy.proLine, 'Pro opens every card in every chapter and brings each one back when it’s due.');
      expect(KeyCardsCopy.nothingDueNote, "Add a chapter to Revise and its cards come back when they're due.");
      expect(CardsCopy.lockedMatches(1), startsWith('1 more matching card is part of Pro. '));
      expect(CardsCopy.lockedMatches(40), '40 more matching cards are part of Pro. ${KeyCardsCopy.proLine}');
      expect(FeedCopy.keepProStamp, 'This card is part of Pro.');
      expect(FeedCopy.saveOnPro, 'Saving more questions is part of Pro.');
    });
  });

  group('the middle dot is for a length and nothing else', () {
    test('a count, a verdict, a stage label and the free line', () {
      expect(LearnWords.reviseQuestions(5), 'Revise 5 questions');
      expect(LearnWords.reviseQuestions(1), 'Revise 1 question');
      expect(StageEndModel.progressLabel(seen: 5, of: 45, open: 5), '5 of 45 cards seen. The rest open with Pro.');
      expect(StageEndModel.progressLabel(seen: 20, of: 45), '20 of 45 cards seen');
      expect(LearnWords.withMinutes('Start', 10), 'Start · 10 min');
      expect(LearnFreeWords.capped, 'On Free, a session is up to 10 minutes. With Pro, pick any length.');
      expect(ExploreCopy.freeCapped, LearnFreeWords.capped);
      expect(ExploreCopy.showing(10), 'Showing 10-minute feeds.');
    });
  });

  group('app-only rows', () {
    test('Explore, the feed and the feed ends', () {
      expect(ExploreCopy.none('Physics'), 'No chapter feeds for Physics yet. You can still answer the questions below.');
      expect(ExploreCopy.loadFailed, "Chapter feeds didn't load.");
      expect(FeedCopy.freeDoneShort, "That was today's free session.");
      expect(FeedCopy.pickedUp(5, 21), 'Carrying on from 5 of 21');
      expect(FeedCopy.emptyTitle, 'Nothing here yet');
      expect(FeedCopy.closedLine, "This feed has ended, so this answer wasn't counted.");
      expect(FeedCopy.endErrorLine, "The summary didn't load, but everything you did is saved.");
      expect(FeedModel.checkpointLine, 'Keep going, or stop here. The cards you kept are already in Revise.');
      expect(FeedModel.keptLine(1), "1 card kept. They'll come first in Revise.");
      expect(FeedModel.keptLine(3), "3 cards kept. They'll come first in Revise.");
      expect(FeedModel.keptLine(0), isNull);
    });

    test('Key cards: offline, saved on the phone, added, reported', () {
      expect(KeyCardsCopy.questionsWaitServer, "Your questions didn't load just now, but your Key cards are here.");
      expect(KeyCardsCopy.questionsWaitOffline, "You're offline. Your questions will show here when you're back online.");
      expect(KeyCardsCopy.offlineCached, "You're offline. Showing what's saved on this phone.");
      expect(KeyCardsCopy.savedOnPhone, "Saved on this phone. It'll be sent when you're back online.");
      expect(KeyCardsCopy.reportWaiting, "Saved on this phone. It'll be sent when you're back online.");
      expect(KeyCardsCopy.added(12), '12 cards added to Revise.');
      expect(KeyCardsCopy.added(1), '1 card added to Revise.');
      expect(KeyCardsCopy.reportTitle, "What's wrong with this card?");
      expect(KeyCardsCopy.reportSent, "Thanks. We'll check this card against the book before it comes back.");
      expect(KeyCardsCopy.reportFailed, "The report didn't go through. Try again.");
      expect(KeyCardsCopy.lineMatched, 'Matched by the question’s words');
    });

    test('Learn home, the chapter page and the cards view', () {
      expect(HomeCopy.offerLoading, "Getting today's plan");
      expect(HomeCopy.setEmpty['due']!.line, "Cards you rate come back here on the day they're due.");
      expect(HomeCopy.setEmpty['missed']!.line, 'A card you miss shows here until you get it right.');
      expect(HomeCopy.setEmpty['revise']!.line, 'Rate a card and it goes into Revise.');
      expect(CardsCopy.empty['must']!.line, "None of this chapter's cards is marked Must-know yet.");
      expect(CardsCopy.empty['revise']!.line, 'Rate a card and it goes into Revise.');
      expect(CardsCopy.over(45, 30), '45 cards match. Pick up to 30 to study, or type another word to narrow it.');
      expect(CardsCopy.more(3), '3 more cards match. Type another word to narrow it.');
      expect(ChapterCopy.offline, "You're offline. Connect to the internet to start this chapter.");
      expect(ChapterCopy.stale, "We couldn't update the plan. You're seeing the last one.");
      expect(RunCopy.reviseLabel(4), '4 cards in Revise');
      expect(RunCopy.reviseLabel(1), '1 card in Revise');
      expect(RunCopy.levelSub(3, 6), 'Your weakest part: 3 of 6 right');
    });

    test('the roadmap: "Most marks left", and a figure with a word', () {
      expect(HomeModel.sorts.map((s) => s.label), contains('Most marks left'));
      expect(HomeModel.sorts.map((s) => s.label), isNot(contains('Marks open')));
    });
  });

  group('contractions in the lines that say something did not load or was not saved', () {
    test('Learn, Key cards, the feed and Revise', () {
      expect(HomeCopy.errorTitle, "Learn didn't load");
      expect(HomeCopy.partFailed, "Your choice wasn't saved. Try again.");
      expect(KeyCardsCopy.loadFailed, "Key cards didn't load");
      expect(KeyCardsCopy.notSaved, "That card wasn't saved. Try again.");
      expect(KeyCardsCopy.addFailed, "The chapter wasn't added. Try again.");
      expect(CardsCopy.loadFailedTitle, "The cards didn't load");
      expect(CardsCopy.findFailedTitle, "Search didn't load");
      expect(RunCopy.ratingNotSaved, "That rating wasn't saved. Try again.");
      expect(RunCopy.answerNotSaved, "That answer wasn't saved. Try again.");
      expect(FeedCopy.notSaved, "That answer wasn't saved. Try again.");
      expect(FeedCopy.errorTitle, "The feed didn't start");
      expect(FeedCopy.couldNotAdd, "Couldn't add that card to Revise. Try again.");
    });
  });
}
