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
import 'package:mockmob/features/tools/estimate/estimate_copy.dart';
import 'package:mockmob/features/tools/my_colleges/my_colleges_copy.dart';
import 'package:mockmob/features/wallet/wallet_copy.dart';
import 'package:mockmob/features/you/edit_copy.dart';
import 'package:mockmob/features/you/help/faq.dart';

/// The website's ONE_CREDIT_LINE (src/lib/creditCopy.mjs, web release 11), word for word.
const _webOneCreditLine = '1 credit buys 1 practice question or 1 chat reply. A full mock costs 50, and your first one in '
    'each subject is free. Deeper analysis costs 3. The cost shows before you start.';

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

  group('a full mock is priced truthfully (C-dec 1: the first one in each subject is free)', () {
    test('the Wallet says the website\'s line until the server\'s own loads, so it never changes on load', () {
      expect(WalletCopy.creditsFor, _webOneCreditLine);
    });

    test('Help says the first full mock is free and that free credits refill', () {
      final answer = FaqCopy.credits.answer.join(' ');
      expect(answer, contains('A full mock costs 50, and your first one in each subject is free.'));
      expect(answer, contains('They refill to 50 at the start of every month'));
      expect(answer, isNot(contains('renews')));
    });

    test('a free quote says free in the website\'s words; the range card says the plan line', () {
      expect(PracticeCopy.freeFirstFullMock, 'Free: your first full mock in this subject is on us.');
      expect(EstimateCopy.firstMockFree, 'Your first full mock in every subject is free.');
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
      expect(ReviewCopy.mistakesCaption(0, 0, null), 'You have nothing left to repair. The chapters below still show where your marks went.');
      expect(ReviewCopy.mistakesCaption(7, 3, 'Economics'),
          'You have 7 mistakes to repair in Economics, across 3 chapters. Start with the chapter that costs you the most marks.');
      expect(PracticeCopy.papersNote(papers: 0, open: 3), 'You have 3 mistakes to repair, with the papers they came from.');
    });

    test('the result moment and the proof', () {
      expect(FinishCopy.paperSaved, 'Your paper is saved.');
      expect(LayersCopy.proveTeaser('Partnership'), 'You went wrong on Partnership. Five new questions on it show whether your fix held.');
      expect(practice_result.ResultCopy.proveBlankNote, 'A blank answer costs you marks too. This set shows where you really stand on the chapter.');
    });

    test('Ask Mobi', () {
      expect(AskDoorCopy.greetFresh('Riya'), "Hi Riya. Ask me any CUET doubt, any time you're stuck.");
      expect(InsightsCopy.askGreeting(null, 0), "Hi. Ask me any CUET doubt, any time you're stuck.");
      expect(AskDoorCopy.emptySay, 'Your record starts with your first paper.');
      expect(AskDoorCopy.creditsNone, 'You have no credits left.');
      expect(AskDoorCopy.cardLineHeavy(34, 'Partnership'), 'Stuck on a doubt? Ask now, or ask your record why you lost 34 marks in Partnership.');
    });

    test('Today, the deck and the colleges', () {
      expect(TodayCopy.collegesTop(5), 'These are your top 3 of 5, the colleges that need the most marks.');
      expect(GlanceCopy.weakDayOneKey('Partnership'), 'Practise 10 questions on Partnership');
      expect(StarterCopy.quickWhy('Economics', 10), '10 quick questions in Economics show where you stand right now.');
      expect(StarterCopy.mobLine, 'You and up to four friends sit the same 10 questions each week, and it costs no credits.');
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
