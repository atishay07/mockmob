// The Ask Mobi sheet (ASK-MOBI-1018): what each context opens with, the priced asks, the reply
// mode each context sends, the free answers that never leave the phone, and the retry that reuses
// the request id so a reply is never charged twice. Every network path runs against a fake API.
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_providers.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/models/ai_credits.dart';
import 'package:mockmob/core/repositories/credits_repository.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/insights/ask_mobi.dart';
import 'package:mockmob/features/insights/copy.dart';
import 'package:mockmob/features/insights/data/ask_controller.dart';
import 'package:mockmob/features/insights/data/ask_question.dart';
import 'package:mockmob/features/insights/data/ask_sheet_controller.dart';
import 'package:mockmob/features/insights/data/ask_suggestions.dart';
import 'package:mockmob/features/insights/data/insights_models.dart';
import 'package:mockmob/features/insights/data/insights_repository.dart';
import 'package:mockmob/features/insights/widgets/ask_sheet.dart';
import 'package:mockmob/features/insights/widgets/mobi_mark.dart';

import '../../golden/insights/insights_golden_support.dart';
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import '../core_data/support/fakes.dart';
import 'support/insights_fixtures.dart';

class _FakeAuth extends AuthController {
  @override
  AuthSnapshot build() => const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1');
}

class _FixedInsights extends InsightsRepository {
  @override
  RemoteState<PrepInsights> build() => RemoteState(value: rich());
}

class _Credits extends CreditsRepository {
  @override
  RemoteState<AiCredits> build() => RemoteState(value: AiCredits.fromJson({
        'state': 'available',
        'wallet': {'state': 'available', 'known': true, 'total': 9, 'includedMonthlyCredits': 10, 'bonusCredits': 0},
      }));

  @override
  Future<void> refresh({bool force = false}) async {}
}

final _q7 = AskMobiContext.question(number: 7, ref: 'm3:m3-q7', chapter: 'Partnership', pickLetter: 'B', pickText: '9:6:5', keyLetter: 'C', keyText: '19:11:10');

Map<String, Object?> _modelReply() => {
      'ok': true,
      'sessionId': 's-1',
      'reply': 'Each partner gives up 1/8.',
      'origin': 'model',
      'charge': {'amount': 1, 'reference': 'prepos:u1:x'},
      'usageSnapshot': {
        'aiWallet': {'state': 'available', 'known': true, 'total': 8, 'includedMonthlyCredits': 10, 'bonusCredits': 0},
      },
    };

const _askContext = {
  'ok': true,
  'context': {'question': 'X and Y share profits 3:2.', 'chapter': 'Partnership', 'pick': {'letter': 'B'}, 'hasKey': true},
};

Map<String, dynamic> _body(RecordedRequest r) => r.body is String ? jsonDecode(r.body! as String) as Map<String, dynamic> : Map<String, dynamic>.from(r.body! as Map);

void main() {
  group('context', () {
    test('each kind sends its own reply mode and names its chip', () {
      expect(_q7.mode, 'revision');
      expect(_q7.chipLabel, 'Q7');
      expect(_q7.chipDetail, 'Partnership');
      expect(const AskMobiContext.mock(label: 'Mock 3').mode, 'autopsy');
      expect(const AskMobiContext.mock(label: 'Mock 3').chipLabel, 'Mock 3');
      expect(const AskMobiContext.today().mode, 'mentor');
      expect(const AskMobiContext.practice().chipLabel, 'Practice');
      expect(const AskMobiContext.page().chipLabel, isNull);
    });

    test('a reference the server would not accept is dropped, never sent', () {
      expect(AskMobiContext.question(ref: 'not a ref').question!.ref, isNull);
      expect(AskMobiContext.question(ref: 'a1:q-2').question!.ref, 'a1:q-2');
    });

    test('the same thing has the same identity; something else does not', () {
      expect(AskMobiContext.question(number: 7, ref: 'a:b').identity, AskMobiContext.question(number: 7, ref: 'a:b').identity);
      expect(AskMobiContext.question(number: 7, ref: 'a:b').identity, isNot(AskMobiContext.question(number: 8, ref: 'a:c').identity));
    });
  });

  group('suggestions', () {
    test('a question offers two written replies and the free record ask, each priced', () {
      final s = suggestionsFor(_q7, rich());
      expect(s.map((e) => e.text), ['Why is 19:11:10 right and 9:6:5 wrong?', 'What did I misread?', 'Have I missed Partnership before?']);
      expect(s.map((e) => e.price), [AskPrice.credit, AskPrice.credit, AskPrice.free]);
      // The preview is the record's own line for that chapter.
      expect(s[2].preview, '4 wrong of 13 answered, in 3 sessions');
      expect(s[2].answer!.reply, contains('4 wrong of 13 answered'));
    });

    test('every free ask carries its answer; no written reply does', () {
      for (final c in [_q7, const AskMobiContext.mock(label: 'Mock 3'), const AskMobiContext.today(), const AskMobiContext.practice(), const AskMobiContext.page()]) {
        for (final s in suggestionsFor(c, rich())) {
          expect(s.answer != null, s.free, reason: '${c.kind} ${s.text}');
        }
        expect(suggestionsFor(c, rich()).length, inInclusiveRange(2, 3));
      }
    });

    test('a chapter the record has never seen gets no figure', () {
      final s = suggestionsFor(AskMobiContext.question(number: 2, chapter: 'Goodwill valuation'), rich());
      final history = s.last;
      expect(history.free, isTrue);
      expect(history.preview, isNull);
      expect(history.answer!.reply, contains('no answers in Goodwill valuation'));
    });

    test('without the pick and the key the first ask does not pretend to know them', () {
      final s = suggestionsFor(AskMobiContext.question(number: 2), rich());
      expect(s.first.text, AskSheetCopy.whyWrong);
    });

    test('a student with no sessions is offered free product asks', () {
      final s = suggestionsFor(const AskMobiContext.page(), empty());
      expect(s.every((e) => e.free && e.preview == null), isTrue);
      expect(s.map((e) => e.text), [askCreditsQuestion, askScopeQuestion]);
    });

    test('the words follow the copy rules: sentence case, no exclamation marks, no arrows', () {
      final texts = <String>[
        for (final c in [_q7, const AskMobiContext.mock(label: 'Mock 3'), const AskMobiContext.practice(), const AskMobiContext.page()])
          for (final s in suggestionsFor(c, rich())) ...[s.text, ?s.preview, ?s.answer?.reply],
        AskSheetCopy.newStudent,
        AskSheetCopy.noCredits('1 Nov'),
        AskSheetCopy.paused,
        AskSheetCopy.questionFailed,
        AskSheetCopy.thisCosts,
        AskSheetCopy.reading('Q7'),
      ];
      for (final t in texts) {
        expect(t.contains('!'), isFalse, reason: t);
        expect(RegExp('[←-⇿]').hasMatch(t), isFalse, reason: t);
        expect(t, isNot(equals(t.toUpperCase())), reason: t);
      }
    });
  });

  group('opening', () {
    test('a mock opens on where its marks went, free', () {
      final o = openingFor(const AskMobiContext.mock(label: 'Mock 3', lines: ['Partnership: 36 marks', 'Cash flow statement: 18 marks']), rich())!;
      expect(o.title, AskSheetCopy.mockOpeningTitle);
      expect(o.reply, 'Partnership: 36 marks\nCash flow statement: 18 marks');
    });

    test('Practice opens on the record answer for the weakest chapter', () {
      expect(openingFor(const AskMobiContext.practice(), rich())!.reply, startsWith('You lose the most marks in Partnership'));
    });

    test("Today opens on the lead's reason and the plan's facts", () {
      final o = openingFor(const AskMobiContext.today(reason: 'Partnership costs you most', facts: ['4 wrong of 13 answered']), rich())!;
      expect(o.title, 'Partnership costs you most');
      expect(o.reply, '4 wrong of 13 answered');
    });

    test('a question and the page open on their asks', () {
      expect(openingFor(_q7, rich()), isNull);
      expect(openingFor(const AskMobiContext.page(), rich()), isNull);
    });
  });

  group('lines', () {
    test('the credits line reads like the mock', () {
      expect(walletLine(total: 9, includedMonthly: 10, bonus: 0, resetsOn: '1 Nov'), '9 of 10 credits left · refills 1 Nov');
      expect(walletLine(total: 12, includedMonthly: 10, bonus: 4, resetsOn: '1 Nov'), '12 credits left · refills 1 Nov');
      expect(walletLine(total: null), AskSheetCopy.walletUnknown);
      expect(walletLine(total: 3, paused: true), AskSheetCopy.walletPaused);
    });

    test('the record summary has the ledger, the leak and (on Pro) pace', () {
      final free = recordSummary(rich());
      expect(free.length, 2);
      expect(free[0], contains('Net 324 marks'));
      expect(free[1], contains('Partnership'));
      expect(recordSummary(rich(), pro: true).length, 3);
      expect(recordSummary(empty()), isEmpty);
    });
  });

  group('controller', () {
    late FakeHttpAdapter http;
    late ProviderContainer c;
    final now = DateTime.utc(2026, 10, 13, 15);

    setUp(() {
      http = FakeHttpAdapter();
      c = ProviderContainer(overrides: [
        authSnapshotProvider.overrideWith(_FakeAuth.new),
        apiClientProvider.overrideWithValue(newApiClient(http, now: () => now)),
        nowProvider.overrideWithValue(() => now),
        insightsRepositoryProvider.overrideWith(_FixedInsights.new),
        creditsRepositoryProvider.overrideWith(_Credits.new),
      ]);
      http.handler = (o) => o.path.contains('ask-context') ? const FakeReply(200, _askContext) : FakeReply(200, _modelReply());
    });
    tearDown(() => c.dispose());

    AskSheetController ctl() => c.read(askSheetControllerProvider.notifier);
    Iterable<RecordedRequest> chats() => http.requests.where((r) => r.path.contains('/mentor/chat'));

    Future<void> openOn(AskMobiContext about) async {
      c.read(askSheetControllerProvider);
      c.read(askSheetScopeProvider.notifier).open(about);
      // The question's context is read from the server before anything can be sent about it.
      for (var i = 0; i < 200 && (c.read(askSheetQuestionProvider)?.loading ?? false); i++) {
        await Future<void>.delayed(const Duration(milliseconds: 1));
      }
    }

    test('a question goes as revision, with its reference', () async {
      await openOn(_q7);
      expect(c.read(askSheetQuestionProvider)!.ready, isTrue);
      await ctl().send('Why is my answer wrong?');
      final sent = _body(chats().single);
      expect(sent['mode'], 'revision');
      expect(sent['questionRef'], 'm3:m3-q7');
    });

    test('a mock goes as an autopsy, Today as the mentor', () async {
      await openOn(const AskMobiContext.mock(label: 'Mock 3'));
      await ctl().send('Give me a 10 minute revision plan for tonight');
      expect(_body(chats().last)['mode'], 'autopsy');
      await openOn(const AskMobiContext.today());
      await ctl().send('Give me a 10 minute revision plan for tonight');
      expect(_body(chats().last)['mode'], 'mentor');
    });

    test('a free ask lands from the record and nothing leaves the phone', () async {
      await openOn(_q7);
      final free = suggestionsFor(_q7, rich()).last;
      ctl().answerLocally(free.text, free.answer!);
      expect(chats(), isEmpty);
      final m = c.read(askSheetControllerProvider).messages;
      expect(m.length, 2);
      expect(m.last.origin, AskOrigin.phone);
    });

    test('with a question open, a typed message is a written reply; dropped, a record question is free', () async {
      await openOn(_q7);
      expect(ctl().answersOnPhone('Where am I losing marks?'), isFalse);
      c.read(askSheetScopeProvider.notifier).drop();
      expect(ctl().answersOnPhone('Where am I losing marks?'), isTrue);
      expect(c.read(askSheetScopeProvider).effective.mode, 'mentor');
    });

    test('no answer keeps the request id: Send again is never charged twice', () async {
      await openOn(_q7);
      http.handler = (o) => o.path.contains('ask-context') ? const FakeReply(200, _askContext) : const FakeReply.network();
      expect(await ctl().send('Why is my answer wrong?'), AskFailure.offline);
      final first = _body(chats().last)['requestId'];
      http.handler = (o) => FakeReply(200, _modelReply());
      await ctl().retry();
      expect(_body(chats().last)['requestId'], first);
      expect(c.read(askSheetControllerProvider).messages.last.origin, AskOrigin.model);
      expect(c.read(askSheetWalletProvider)!.total, 8);
    });

    test('the same thing again keeps the conversation; something new starts one', () async {
      await openOn(const AskMobiContext.page());
      final free = suggestionsFor(const AskMobiContext.page(), rich()).first;
      ctl().answerLocally(free.text, free.answer!);
      await openOn(const AskMobiContext.page());
      expect(c.read(askSheetControllerProvider).messages, hasLength(2));
      await openOn(const AskMobiContext.practice());
      expect(c.read(askSheetControllerProvider).messages, isEmpty);
    });

    test('the full Ask screen keeps its own question and conversation', () async {
      await openOn(_q7);
      expect(c.read(askQuestionProvider), isNull);
      expect(c.read(askControllerProvider).messages, isEmpty);
    });
  });

  group('sheet', () {
    setUpAll(loadAppFonts);

    Future<void> pumpOpen(WidgetTester tester, AskMobiContext about, {AiCredits? credits}) async {
      await pumpMockmob(
        tester,
        Builder(builder: (context) => Center(child: TextButton(onPressed: () => openAskMobi(context, about), child: const Text('open')))),
        size: const Size(412, 915),
        disableAnimations: true,
        overrides: [
          ...insightsOverrides(credits: credits, realAsk: true),
          askSheetQuestionProvider.overrideWith(_NoQuestion.new),
        ],
      );
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
    }

    testWidgets('opens already scoped, with a flat Mobi mark and a price on every ask', (tester) async {
      await pumpOpen(
        tester,
        _q7,
        credits: AiCredits.fromJson({
          'state': 'available',
          'wallet': {'state': 'available', 'known': true, 'total': 9, 'includedMonthlyCredits': 10, 'bonusCredits': 0},
        }),
      );
      expect(find.byType(AskMobiSheet), findsOneWidget);
      expect(find.text(AskSheetCopy.title), findsOneWidget);
      expect(find.textContaining('Q7'), findsWidgets);
      expect(find.byType(MobiMark), findsWidgets);
      // The glass orb and the live character are gone from a question sheet.
      expect(find.byType(MobiCharacter), findsNothing);
      expect(find.text(AskSheetCopy.oneCredit), findsNWidgets(2));
      expect(find.text(AskSheetCopy.free), findsOneWidget);
      expect(find.textContaining('9 of 10 credits left'), findsOneWidget);
      await tester.pump(const Duration(seconds: 13));
    });

    testWidgets('the free ask answers at once, from the record', (tester) async {
      await pumpOpen(tester, _q7);
      await tester.tap(find.text('Have I missed Partnership before?'));
      await tester.pumpAndSettle();
      expect(find.textContaining('Partnership: admission of a partner: 4 wrong of 13 answered'), findsOneWidget);
      expect(find.textContaining('From your record'), findsOneWidget);
      await tester.pump(const Duration(seconds: 13));
    });

    testWidgets('out of credits: paid asks say they need a written reply and do nothing', (tester) async {
      await pumpOpen(
        tester,
        _q7,
        credits: AiCredits.fromJson({
          'state': 'empty',
          'wallet': {'state': 'empty', 'known': true, 'total': 0, 'includedMonthlyCredits': 10, 'bonusCredits': 0},
        }),
      );
      expect(find.text(AskSheetCopy.needsWritten), findsNWidgets(2));
      expect(find.textContaining('Nothing is charged from here'), findsOneWidget);
      await tester.tap(find.text('What did I misread?'));
      await tester.pumpAndSettle();
      expect(find.byType(AskMobiSheet), findsOneWidget);
      expect(find.textContaining('This message goes to an AI service'), findsNothing);
      await tester.pump(const Duration(seconds: 13));
    });

    testWidgets('dropping the subject falls back to the record', (tester) async {
      await pumpOpen(tester, _q7);
      await tester.tap(find.bySemanticsLabel(AskSheetCopy.dropSubject('Q7')));
      await tester.pumpAndSettle();
      expect(find.text(AskSheetCopy.askAboutQuestion), findsNothing);
      expect(find.text(InsightsCopy.promptLosing), findsOneWidget);
      await tester.pump(const Duration(seconds: 13));
    });

    testWidgets('Close leaves the page as it was', (tester) async {
      await pumpOpen(tester, const AskMobiContext.page());
      await tester.tap(find.bySemanticsLabel(AskSheetCopy.close));
      await tester.pumpAndSettle();
      expect(find.byType(AskMobiSheet), findsNothing);
      expect(find.text('open'), findsOneWidget);
    });
  });
}

class _NoQuestion extends AskQuestionController {
  @override
  AskQuestionHand? build() => null;

  @override
  Future<void> open(String? raw) async {}
}
