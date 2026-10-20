// The ways in to Ask Mobi from other screens (ASK-MOBI-1018 section 3): the quiet text entry, the
// Practice row, the contexts the result and Today hand over, and the W-060 promise end to end (the
// price shows before a written reply is sent, and the balance and the sheet agree after it).
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/api/api_providers.dart';
import 'package:mockmob/core/domain/chapter_breakdown.dart';
import 'package:mockmob/core/models/ai_credits.dart';
import 'package:mockmob/core/models/models.dart' show QuestionOption, SnapshotQuestion;
import 'package:mockmob/core/repositories/credits_repository.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/router/routes.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/insights/ask_mobi.dart';
import 'package:mockmob/features/insights/data/ai_reply_report.dart' show insightsPrefsStoreProvider;
import 'package:mockmob/features/insights/data/ask_question.dart';
import 'package:mockmob/features/insights/data/ask_sheet_controller.dart';
import 'package:mockmob/features/insights/data/ask_suggestions.dart';
import 'package:mockmob/features/insights/widgets/ask_sheet.dart';
import 'package:mockmob/features/insights/widgets/mobi_mark.dart';
import 'package:mockmob/features/result/full/answer_row.dart';
import 'package:mockmob/features/result/model/answer_items.dart';
import 'package:mockmob/features/result/model/ask_context.dart';
import 'package:mockmob/features/today/logic/why_ask.dart';
import 'package:mockmob/features/today/logic/why_model.dart';

import '../../golden/insights/insights_golden_support.dart';
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import '../core_data/support/fakes.dart';
import 'support/insights_fixtures.dart';

class _NoQuestion extends AskQuestionController {
  @override
  AskQuestionHand? build() => null;

  @override
  Future<void> open(String? raw) async {}
}

class _Credits extends CreditsRepository {
  @override
  RemoteState<AiCredits> build() => RemoteState(value: _wallet(9));

  @override
  Future<void> refresh({bool force = false}) async {}
}

AiCredits _wallet(int total) => AiCredits.fromJson({
      'state': 'available',
      'wallet': {'state': 'available', 'known': true, 'total': total, 'includedMonthlyCredits': 10, 'bonusCredits': 0},
    });

ChapterStat _stat(String chapter, {int questions = 8, int wrong = 0, int blank = 0}) => ChapterStat(
      chapter: chapter,
      questions: questions,
      correct: questions - wrong - blank,
      wrong: wrong,
      unattempted: blank,
      wrongNumbers: const [],
      blankNumbers: const [],
    );

SnapshotQuestion _question({String text = 'X and Y share profits 3:2.', List<String>? options}) => SnapshotQuestion(
      id: 'q7',
      chapter: 'Partnership',
      question: text,
      options: [
        for (final (i, t) in (options ?? const ['5:3:2', '9:6:5', '19:11:10', '1:1:1']).indexed) QuestionOption(key: String.fromCharCode(65 + i), text: t),
      ],
    );

void main() {
  group('where a mock lost its marks', () {
    test('one line per chapter, most marks first, at most three', () {
      final b = ChapterBreakdown(
        stats: [_stat('Partnership', wrong: 6, blank: 1), _stat('Cash flow', wrong: 3), _stat('Banking', blank: 2), _stat('Ratios', wrong: 1)],
        wrongNumbers: const [],
      );
      final lines = mockLostLines(b, lost: 78);
      expect(lines, [
        'Partnership: 41 of the 78 marks slipped, 6 wrong and 1 left blank',
        'Cash flow: 18 of the 78 marks slipped, 3 wrong',
        'Banking: 10 of the 78 marks slipped, 2 left blank',
      ]);
    });

    test('a chapter that cost every lost mark says all of them', () {
      final b = ChapterBreakdown(stats: [_stat('Business environment', blank: 6)], wrongNumbers: const []);
      expect(mockLostLines(b, lost: 30), ['Business environment: all 30 marks slipped, 6 left blank']);
    });

    test('a paper that lost nothing, or a chapter with no name, gives no line', () {
      expect(mockLostLines(ChapterBreakdown(stats: [_stat('Partnership', wrong: 1)], wrongNumbers: const []), lost: 0), isEmpty);
      expect(mockLostLines(ChapterBreakdown(stats: [_stat('', wrong: 2)], wrongNumbers: const []), lost: 12), isEmpty);
    });
  });

  group('contexts handed over', () {
    test("an answer hands over its paper's reference, its pick and, only when allowed, its key", () {
      final item = AnswerItem(number: 7, question: _question(), verdict: Verdict.wrong, given: 1, keyIndex: 2);
      final c = askContextOfAnswer(item, attemptId: 'm3');
      expect(c.kind, AskMobiKind.question);
      expect(c.question!.ref, 'm3:q7');
      expect(c.chipLabel, 'Q7');
      expect(c.chipDetail, 'Partnership');
      expect((c.question!.pickLetter, c.question!.pickText), ('B', '9:6:5'));
      expect((c.question!.keyLetter, c.question!.keyText), ('C', '19:11:10'));
      // The key the rule holds back is never handed over.
      final held = askContextOfAnswer(AnswerItem(number: 7, question: _question(), verdict: Verdict.wrong, given: 1), attemptId: 'm3');
      expect(held.question!.keyLetter, isNull);
    });

    test('a long option is quoted by its letter alone, never cut in the middle', () {
      final long = 'The amount of goodwill is shared between the old partners in the ratio of their sacrifice';
      final c = askContextOfAnswer(
        AnswerItem(number: 2, question: _question(options: [long, long, long, long]), verdict: Verdict.wrong, given: 0, keyIndex: 1),
        attemptId: 'm3',
      );
      expect(c.question!.pickText, isNull);
      expect(suggestionsFor(c, rich()).first.text, 'Why is B right and A wrong?');
    });

    test("Today's why hands over the reason and the real counts, with their denominators", () {
      final c = askContextOfWhy(
        WhyModel(
          attemptId: 'm3',
          source: 'Mock 3',
          subject: 'Accountancy',
          date: DateTime(2026, 10, 12),
          wrong: 13,
          correct: 31,
          blank: 6,
          chapters: const [WhyChapter(chapter: 'Partnership', wrong: 6, blank: 1, questions: 8)],
          early: false,
          isMock: true,
        ),
      );
      expect(c.kind, AskMobiKind.today);
      expect(c.reason, 'From Mock 3, Accountancy, on 12 October.');
      expect(c.lines, ['13 wrong, 31 right, 6 not attempted.', 'Partnership: 6 wrong, 1 not attempted in 8 questions']);
      expect(openingFor(c, rich())!.title, c.reason);
    });

    test("Practice's line is the weakest chapter's own figure, and nothing without a record", () {
      expect(practicePreview(rich()), 'Partnership: admission of a partner, 4 wrong of 13 answered');
      expect(practicePreview(empty()), isNull);
      expect(practicePreview(null), isNull);
    });
  });

  group('the entries', () {
    setUpAll(loadAppFonts);

    Future<void> pump(WidgetTester tester, Widget child, {List<Override> more = const []}) => pumpMockmob(
          tester,
          child,
          size: const Size(412, 915),
          disableAnimations: true,
          overrides: [...insightsOverrides(realAsk: true, credits: _wallet(9)), askSheetQuestionProvider.overrideWith(_NoQuestion.new), ...more],
        );

    testWidgets('the quiet entry is one label at least 48 dp tall, and opens the sheet it is about', (tester) async {
      await pump(
        tester,
        Builder(builder: (context) => AskMobiLink(label: askMobiAboutLabel(7), onTap: () => openAskMobi(context, AskMobiContext.question(number: 7, chapter: 'Partnership')))),
      );
      expect(find.text('Ask Mobi about Q7'), findsOneWidget);
      expect(tester.getSize(find.byType(AskMobiLink)).height, greaterThanOrEqualTo(48));
      await tester.tap(find.text('Ask Mobi about Q7'));
      await tester.pumpAndSettle();
      expect(find.byType(AskMobiSheet), findsOneWidget);
      expect(find.textContaining('Q7'), findsWidgets);
      await tester.pump(const Duration(seconds: 13));
    });

    testWidgets("Practice's row shows the record's line and its price, and opens Mobi on Practice", (tester) async {
      await pump(tester, const AskMobiPracticeRow());
      expect(find.text('Ask Mobi what to practise'), findsOneWidget);
      expect(find.text('Partnership: admission of a partner, 4 wrong of 13 answered'), findsOneWidget);
      expect(find.text('Free'), findsOneWidget);
      expect(tester.getSize(find.byType(AskMobiPracticeRow)).height, greaterThanOrEqualTo(48));
      await tester.tap(find.text('Ask Mobi what to practise'));
      await tester.pumpAndSettle();
      final container = ProviderScope.containerOf(tester.element(find.byType(AskMobiSheet)));
      expect(container.read(askSheetScopeProvider).context.kind, AskMobiKind.practice);
      // The record's answer is already there, free.
      expect(find.textContaining('From your record'), findsWidgets);
      await tester.pump(const Duration(seconds: 13));
    });

    testWidgets('an opened mistake carries the quiet line under its repair; a closed row and a right answer carry none', (tester) async {
      final item = AnswerItem(number: 7, question: _question(), verdict: Verdict.wrong, given: 1, keyIndex: 2, repairable: true);
      var asked = 0;
      Widget row({required bool expanded, bool withAsk = true}) => SingleChildScrollView(
            child: AnswerRow(item: item, expanded: expanded, onToggle: () {}, keysOff: false, onRepair: () {}, onAsk: withAsk ? () => asked++ : null),
          );
      await pump(tester, row(expanded: false));
      expect(find.text('Ask Mobi about Q7'), findsNothing);
      await pump(tester, row(expanded: true, withAsk: false));
      expect(find.text('Ask Mobi about Q7'), findsNothing);
      await pump(tester, row(expanded: true));
      expect(find.text('Repair this mistake'), findsWidgets);
      await tester.tap(find.text('Ask Mobi about Q7'));
      expect(asked, 1);
    });
  });

  group('the price before, the balance after (W-060)', () {
    setUpAll(loadAppFonts);

    testWidgets('a written reply shows its price first, then the same balance in the line and in its source', (tester) async {
      final http = FakeHttpAdapter()
        ..handler = (o) => FakeReply(200, {
              'ok': true,
              'sessionId': 's-1',
              'reply': 'Each partner gives up 1/8.',
              'origin': 'model',
              'charge': {'amount': 1, 'reference': 'prepos:u1:x'},
              'usageSnapshot': {
                'aiWallet': {'state': 'available', 'known': true, 'total': 8, 'includedMonthlyCredits': 10, 'bonusCredits': 0},
              },
            });
      final now = DateTime.utc(2026, 10, 13, 15);
      await pumpMockmob(
        tester,
        Builder(
          builder: (context) => Center(
            child: TextButton(
              onPressed: () => openAskMobi(context, AskMobiContext.question(number: 7, chapter: 'Partnership', pickLetter: 'B', pickText: '9:6:5', keyLetter: 'C', keyText: '19:11:10')),
              child: const Text('open'),
            ),
          ),
        ),
        size: const Size(412, 915),
        disableAnimations: true,
        overrides: [
          // The wallet is read through a fixed repository that never reads the server again.
          ...insightsOverrides(realAsk: true, credits: _wallet(9)).where((o) => !identical(o.origin, creditsRepositoryProvider)),
          creditsRepositoryProvider.overrideWith(_Credits.new),
          askSheetQuestionProvider.overrideWith(_NoQuestion.new),
          apiClientProvider.overrideWithValue(newApiClient(http, now: () => now)),
          insightsPrefsStoreProvider.overrideWithValue(MemoryPrefsStore()),
        ],
      );
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();

      // Before: the row names its price, and the line says what the balance is.
      expect(find.text(AskSheetCopy.oneCredit), findsNWidgets(2));
      expect(find.textContaining('9 of 10 credits left'), findsOneWidget);

      await tester.tap(find.text('What did I misread?'));
      await tester.pumpAndSettle();
      // No sheet in the way: the ask went straight to the answer.
      expect(find.text('This question goes to an AI service'), findsNothing);

      // After: the reply, its source naming what it used, and the balance the server reported.
      expect(find.text('Each partner gives up 1/8.'), findsOneWidget);
      expect(find.textContaining('Written reply on Q7 · 1 credit used, 8 left'), findsOneWidget);
      expect(find.textContaining('8 of 10 credits left'), findsOneWidget);
      expect(find.textContaining('9 of 10 credits left'), findsNothing);
      final sent = http.requests.where((r) => r.path.contains('/mentor/chat')).single;
      final body = sent.body is String ? jsonDecode(sent.body! as String) as Map<String, dynamic> : Map<String, dynamic>.from(sent.body! as Map);
      expect(body['mode'], 'revision');
      expect(body['message'], 'What did I misread?');
      await tester.pump(const Duration(seconds: 13));
    });

    testWidgets('the credits line opens the credits page', (tester) async {
      final opened = <String>[];
      final router = GoRouter(
        routes: [
          GoRoute(
            path: '/',
            builder: (context, state) => Scaffold(body: Center(child: TextButton(onPressed: () => openAskMobi(context, const AskMobiContext.page()), child: const Text('open')))),
          ),
          GoRoute(
            path: AppRoutes.youCredits,
            builder: (context, state) {
              opened.add(state.uri.toString());
              return const Scaffold(body: Text('CREDITS PAGE'));
            },
          ),
        ],
      );
      addTearDown(router.dispose);
      tester.view.physicalSize = const Size(412, 915) * 2;
      tester.view.devicePixelRatio = 2;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            ...insightsOverrides(realAsk: true, credits: _wallet(9)),
            askSheetQuestionProvider.overrideWith(_NoQuestion.new),
          ],
          child: MaterialApp.router(theme: buildTheme(Brightness.dark), routerConfig: router),
        ),
      );
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      final line = find.bySemanticsLabel(RegExp('9 of 10 credits left'));
      expect(line, findsOneWidget);
      await tester.tap(find.textContaining('9 of 10 credits left'));
      await tester.pumpAndSettle();
      expect(opened, [AppRoutes.youCredits]);
      expect(find.byType(AskMobiSheet), findsNothing);
    });
  });

  group("Mobi's mark", () {
    testWidgets('blinks while a reply is on its way, and holds still under reduced motion', (tester) async {
      Future<void> pumpMark({required bool reduced}) => pumpMockmob(
            tester,
            const Center(child: MobiMark(size: 20, blinking: true)),
            disableAnimations: reduced,
          );
      await pumpMark(reduced: false);
      expect(tester.binding.transientCallbackCount, greaterThan(0));
      await pumpMark(reduced: true);
      await tester.pump();
      expect(tester.binding.transientCallbackCount, 0);
    });

    test('the eyes close once in each 1.6 s: shut briefly near the start, open the rest', () {
      expect(MobiMark.blinkAt(0), 0);
      expect(MobiMark.blinkAt(0.06), 1);
      expect(MobiMark.blinkAt(0.14), 0);
      expect(MobiMark.blinkAt(0.7), 0);
    });
  });
}
