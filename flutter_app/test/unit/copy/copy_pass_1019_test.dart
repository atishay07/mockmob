// The app's copy pass of 19 Oct (D114, R6; tmp/feedback-1019/COPY-APP-1019.md). The owner: "The English part: the
// marketing copy is all that really matters." Every line here is a new contract: whole sentences, the place is
// "Your papers" (D105, D106), a full mock's price is true now that the first one in each subject is free (C-dec 1),
// and the app says what the website says in the same words (the web pass, COPY-WEB-1019.md).
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/credits/credits_copy.dart';
import 'package:mockmob/features/insights/copy.dart';
import 'package:mockmob/features/insights/data/ask_doors.dart';
import 'package:mockmob/features/learn/copy.dart';
import 'package:mockmob/features/notifications/copy.dart';
import 'package:mockmob/features/onboarding/choices_copy.dart';
import 'package:mockmob/features/onboarding/copy.dart';
import 'package:mockmob/features/practice/copy.dart';
import 'package:mockmob/features/practice/result_copy.dart' as practice_result;
import 'package:mockmob/features/practice/widgets/finish_stage.dart' show FinishCopy;
import 'package:mockmob/features/result/copy.dart';
import 'package:mockmob/features/result/layers_copy.dart';
import 'package:mockmob/features/review/again/review_again_copy.dart';
import 'package:mockmob/features/review/copy.dart';
import 'package:mockmob/features/review/revise/revise_copy.dart';
import 'package:mockmob/features/today/copy.dart';
import 'package:mockmob/features/today/copy_glance.dart';
import 'package:mockmob/features/today/copy_suggested.dart';
import 'package:mockmob/features/tools/my_colleges/my_colleges_copy.dart';
import 'package:mockmob/features/wallet/data/wallet_data.dart' show WalletRead;
import 'package:mockmob/features/wallet/wallet_copy.dart';
import 'package:mockmob/features/you/edit_copy.dart';
import 'package:mockmob/features/you/help/faq.dart';

void main() {
  group('the place is Your papers (D105, D106): the old tab name is gone from every line that names it', () {
    final placeLines = <String>[
      ReviewCopy.title,
      ReviewCopy.backToReview,
      ReviewCopy.reviewedNote,
      ReviewCopy.repairKeyNote('Partnership', 2),
      ReviewCopy.nothingRepaired(0, 0),
      ReviewCopy.nothingRepaired(1, 1),
      ReviewAgainCopy.backToReview,
      ReviseCopy.back,
      ReviseCopy.backToReview,
      ResultCopy.backToReview,
      ResultCopy.slowBody,
      ResultCopy.blanksInReview(2),
      ResultCopy.walletShort(3, 0),
      ResultCopy.walletShort(3, 1),
      ResultCopy.finishLine('Mock 7', 15),
      TodayCopy.hiddenUntilTomorrow,
      TodayCopy.doneRepairWhy(null),
      TodayCopy.doneRepairWhy('Partnership'),
      TodayCopy.safeLine,
      GlanceCopy.allInReview(5),
      LearnCopy.disabledMessage,
      NotificationsCopy.ackNotTonightBody,
    ];

    test('each says "Your papers", never "Review" as a place', () {
      for (final line in placeLines) {
        expect(line, contains('Your papers'), reason: line);
        expect(line, isNot(matches(RegExp(r'\b(in|to|Go to|Back to) Review\b'))), reason: line);
      }
    });

    test('the act of reviewing keeps its verb', () {
      expect(ReviewAgainCopy.title, 'Review again');
      expect(LearnCopy.startReview, 'Review due cards');
    });
  });

  group('a full mock is priced truthfully (D175: no free first full mock; every full mock is 50 credits on Free)', () {
    test('the Wallet\'s own line says a full mock costs 50 credits and makes no free-mock claim', () {
      expect(WalletCopy.creditsFor, contains('A full mock costs 50 credits.'));
      expect(WalletCopy.creditsFor, contains('2 new CUET-style questions'));
      for (final banned in ['real CUET', 'Mobi job', 'Deeper analysis', 'chat reply', 'first one', 'each subject']) {
        expect(WalletCopy.creditsFor, isNot(contains(banned)), reason: banned);
      }
      // The server may still send a `buys` line (with or without an old first-free clause): it parses, and is not shown.
      expect(WalletRead.fromJson({'credits': {'buys': '1 credit buys 1 practice question, and your first one in each subject is free.'}}).buys, isNotNull);
      expect(WalletRead.fromJson(const {}).buys, isNull);
    });

    test('Help says every full mock costs 50 credits on Free, Pro includes them, and free credits refill', () {
      final answer = FaqCopy.credits.answer.join(' ');
      expect(answer, contains('On Free, every full mock costs 50 credits'));
      expect(answer, contains('On Pro, practice and full mocks are unlimited'));
      expect(answer, contains('They refill to 50 at the start of every month'));
      expect(answer, isNot(contains('renews')));
      expect(answer, isNot(contains('first one')));
      expect(answer, isNot(contains('each subject')));
    });
  });

  group('free credits refill (the website\'s word); renew stays for a paid plan', () {
    test('every line about the monthly free credits says refill', () {
      expect(AskDoorCopy.renews('1 November'), 'Your free credits refill on 1 November.');
      expect(AskDoorCopy.creditsOfMonthly(38, 50, '1 Nov'), contains('free credits left'));
      expect(CreditsCopy.freeRenews(DateTime(2026, 11, 1)), 'Free credits refill on 1 November');
      expect(CreditsCopy.renews(DateTime(2026, 11, 1)), 'Refills 1 November');
      expect(WalletCopy.resets(DateTime(2026, 11, 1)), 'Free credits refill on 1 November at 12:00 AM');
      expect(InsightsCopy.outBody('1 November'), startsWith('They refill on 1 November.'));
      expect(ReviewCopy.creditsUsedLine('1 November'), 'Your credits are used up. They refill on 1 November.');
    });
  });

  group('whole sentences where the lines were fragments (R6)', () {
    test('Your papers', () {
      expect(ReviewCopy.yourPapersHeading, 'Recent papers');
      expect(ReviewCopy.papersCaption(1, null), 'This is your first paper. Tap it to see your marks and every answer explained.');
      expect(ReviewCopy.papersCaption(7, 'Accountancy'), 'You have sat 7 Accountancy papers. Tap one to see your marks and every answer explained.');
      expect(ReviewCopy.mistakesCaption(0, 0, null, rows: 3), 'You have nothing left to repair. The chapters below still show where your marks went.');
      expect(ReviewCopy.mistakesCaption(7, 3, 'Economics', rows: 3), '7 Economics mistakes are waiting in 3 chapters. Start with the one that costs you the most marks.');
      expect(ReviewCopy.mistakesCaption(0, 0, 'Economics', rows: 0), 'You have nothing left to repair in Economics.', reason: 'no chapter rows, so none are said to be below');
      expect(ReviewCopy.mistakesCaption(1, 1, null, rows: 1), '1 mistake is waiting. Fix it before it costs you marks again.');
      expect(PracticeCopy.papersNote(papers: 0, open: 3), 'You have 3 mistakes to repair, with the papers they came from.');
    });

    test('the result moment and the proof', () {
      expect(FinishCopy.paperSaved, 'Your paper is saved.');
      expect(LayersCopy.proveTeaser('Partnership'), 'You went wrong on Partnership. Five new questions on it show whether your fix held.');
      expect(practice_result.ResultCopy.proveBlankNote, 'A blank answer costs you marks too. This set shows where you really stand on the chapter.');
    });

    test('Ask Mobi', () {
      expect(AskDoorCopy.greetFresh('Riya'), 'Hi Riya. Stuck on a CUET doubt? Ask me.');
      expect(InsightsCopy.askGreeting(null, 0), 'Hi. Stuck on a CUET doubt? Ask me.');
      expect(AskDoorCopy.creditsNone, 'You have no credits left.');
      expect(AskDoorCopy.cardLineHeavy(34, 'Partnership'), 'Stuck on a doubt? Ask now, or ask where 34 marks slipped in Partnership.');
    });

    test('Today, the deck and the colleges', () {
      expect(TodayCopy.collegesTop(5), 'Your top 3 of 5 need the most marks to get in.');
      expect(GlanceCopy.weakDayOneKey('Partnership'), 'Practise 10 questions on Partnership');
      expect(StarterCopy.quickWhy('Economics', 10), '10 quick questions show where you stand right now.');
      expect(StarterCopy.mobLine, 'You and up to four friends sit one free paper every week.');
      expect(MyCollegesCopy.lede, startsWith('This is the same list you see on the website.'));
      expect(EditCopy.collegesCap, 'You can pick eight at most. Remove one to add another.');
    });

    test('the year is named, never "last year" (in October 2026 that reads as 2025)', () {
      expect(ChoicesCopy.closingLast('907.5'), '2026 cutoff: 907.5 of 1000');
      expect(ChoicesCopy.closingLast(null), 'No 2026 cutoff for your category');
      expect(OnboardingCopy.ladderSupport, isNot(contains('last year')));
      expect(OnboardingCopy.pickedTail, 'Today shows your top 3.');
    });
  });
}
