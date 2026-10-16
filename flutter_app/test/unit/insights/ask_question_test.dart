// "Ask Mobi about Q3" from a repair: Ask is handed the repaired mistake (`/ask?q=<attemptId>:<questionId>`),
// shows it in a card, and sends the reference with every message while it is there. A record answer
// cannot discuss a question, so nothing is answered on the phone meanwhile; when written replies cannot
// be bought Mobi cannot answer it, the card says so, and the composer goes.
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_providers.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/mascot/mascot.dart' show MobiRation;
import 'package:mockmob/core/models/ai_credits.dart';
import 'package:mockmob/core/repositories/credits_repository.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/router/action_router.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/insights/copy.dart';
import 'package:mockmob/features/insights/data/ai_reply_report.dart' show insightsPrefsStoreProvider;
import 'package:mockmob/features/insights/data/ask_controller.dart';
import 'package:mockmob/features/insights/data/ask_question.dart';
import 'package:mockmob/features/insights/data/insights_models.dart';
import 'package:mockmob/features/insights/data/insights_repository.dart';
import 'package:mockmob/features/insights/screens/ask_screen.dart';
import 'package:mockmob/features/insights/widgets/ask_question_card.dart';

import '../../golden/insights/insights_golden_support.dart';
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
  RemoteState<AiCredits> build() => RemoteState(value: _wallet());

  @override
  Future<void> refresh({bool force = false}) async {}
}

AiCredits _wallet({String state = 'available', int total = 9}) => AiCredits.fromJson({
      'state': state,
      'wallet': {'state': state, 'known': true, 'total': total, 'spendable': total, 'resetAt': '2026-10-31T18:30:00.000Z'},
    });

const _ref = 'm7:m7-q0';

/// The context the server sends for the Ask screen's card (contract: `ask.context`), with the pick and
/// the key's state the website's card also reads.
Map<String, Object?> contextBody({bool hasKey = true}) => {
      'ok': true,
      'context': {
        'question': 'Rao and Sen share profits 3:2. Which ratio follows when Iyer is admitted for 1/5?',
        'subject': 'accountancy',
        'chapter': 'Partnership Accounts',
        'rule': 'Split the sacrifice before you subtract.',
        'pick': {'letter': 'B'},
        'hasKey': hasKey,
        'cost': {'credits': 1, 'pool': 'ai'},
      },
    };

Map<String, dynamic> _sent(RecordedRequest r) => jsonDecode(r.body is String ? r.body! as String : jsonEncode(r.body)) as Map<String, dynamic>;

Map<String, Object?> _modelReply() => {
      'ok': true,
      'sessionId': 's-1',
      'reply': 'Because the sacrifice comes out of both old partners.',
      'origin': 'model',
      'actions': <Object>[],
      'charge': {'amount': 1},
      'usageSnapshot': {
        'aiWallet': {'state': 'available', 'known': true, 'spendable': true, 'total': 8},
      },
    };

void main() {
  late FakeHttpAdapter http;
  late ProviderContainer c;
  late MemoryPrefsStore store;
  final now = DateTime.utc(2026, 10, 16, 15);

  ProviderContainer make() => ProviderContainer(overrides: [
        authSnapshotProvider.overrideWith(_FakeAuth.new),
        apiClientProvider.overrideWithValue(newApiClient(http, now: () => now)),
        nowProvider.overrideWithValue(() => now),
        insightsRepositoryProvider.overrideWith(_FixedInsights.new),
        creditsRepositoryProvider.overrideWith(_Credits.new),
        insightsPrefsStoreProvider.overrideWithValue(store),
      ]);

  setUp(() {
    http = FakeHttpAdapter();
    store = MemoryPrefsStore();
    c = make();
  });
  tearDown(() => c.dispose());

  AskController ctl() => c.read(askControllerProvider.notifier);
  AskQuestionController hand() => c.read(askQuestionProvider.notifier);
  List<RecordedRequest> chats() => http.requests.where((r) => r.path.contains('/mentor/chat')).toList();

  group('the reference', () {
    test('only <attemptId>:<questionId> of letters, digits, underscore and hyphen is handed over', () {
      expect(cleanQuestionRef('m7:m7-q0'), 'm7:m7-q0');
      expect(cleanQuestionRef(' att_1:q_1 '), 'att_1:q_1');
      for (final bad in [null, '', 'm7', 'm7:', ':q', 'a b:c', 'a:b:c', 'a/../b:c', 'a:${'x' * 101}', 'a;drop:b']) {
        expect(cleanQuestionRef(bad), isNull, reason: '$bad');
      }
    });

    test('the web link /mentor?tab=ask&q= keeps a good reference and drops a bad one', () {
      expect((ActionRouter.resolve('/mentor?tab=ask&q=att_1:q_1') as NativeTarget).location, '/ask?q=att_1%3Aq_1');
      expect((ActionRouter.resolve('/mentor?tab=ask') as NativeTarget).location, '/ask');
      expect((ActionRouter.resolve('/mentor?tab=ask&q=a;b') as NativeTarget).location, '/ask');
      expect((ActionRouter.resolve('/ask?q=m7:m7-q0') as NativeTarget).location, '/ask?q=m7%3Am7-q0');
      expect((ActionRouter.resolve('/ask?q=%20bad') as NativeTarget).location, '/ask');
    });

    test('the context reads its parts, the key state and the price, and a body with no question is no context', () {
      final ctx = AskQuestionContext.tryParse(contextBody(hasKey: false))!;
      expect(ctx.chapter, 'Partnership Accounts');
      expect(ctx.pickLetter, 'B');
      expect(ctx.hasKey, isFalse);
      expect(ctx.rule, 'Split the sacrifice before you subtract.');
      expect(ctx.credits, 1);
      expect(AskQuestionContext.tryParse({'ok': true, 'context': <String, Object?>{}}), isNull);
      expect(AskQuestionContext.tryParse({'ok': false, 'context': contextBody()['context']}), isNull);
      expect(AskQuestionContext.tryParse('nope'), isNull);
    });
  });

  group('opening and sending', () {
    test('open reads the context for the reference, and clear hands nothing over', () async {
      http.handler = (_) => FakeReply(200, contextBody());
      final done = hand().open(_ref);
      expect(c.read(askQuestionProvider)!.loading, isTrue);
      await done;
      expect(c.read(askQuestionProvider)!.ready, isTrue);
      expect(c.read(askQuestionProvider)!.context!.chapter, 'Partnership Accounts');
      final req = http.requests.single;
      expect(req.path, '/api/recovery/ask-context');
      expect(req.method, 'GET');
      hand().clear();
      expect(c.read(askQuestionProvider), isNull);
    });

    test('a question that cannot be opened says so, and a bad reference is never asked for', () async {
      http.handler = (_) => const FakeReply(404, {'ok': false, 'error': 'not_found', 'message': 'That session was not found.'});
      await hand().open(_ref);
      final s = c.read(askQuestionProvider)!;
      expect(s.status, AskQuestionStatus.error);
      expect(s.message, 'That question could not be opened.', reason: 'nothing from the server body reaches the screen');
      http.requests.clear();
      hand().clear();
      await hand().open('not a reference');
      expect(http.requests, isEmpty);
      expect(c.read(askQuestionProvider), isNull);
    });

    test('with the question handed over every message goes to Mobi with the reference, even one the record could answer', () async {
      http.handler = (r) => r.path.contains('ask-context') ? FakeReply(200, contextBody()) : FakeReply(200, _modelReply());
      await hand().open(_ref);
      expect(ctl().answersOnPhone('Where am I losing marks?'), isFalse, reason: 'a record answer cannot discuss a question');
      expect(await ctl().send('Where am I losing marks?'), isNull);
      final sent = _sent(chats().single);
      expect(sent['questionRef'], _ref);
      expect(sent['message'], 'Where am I losing marks?');
      expect(c.read(askControllerProvider).messages.last.origin, AskOrigin.model);
    });

    test('without a question nothing is added: a record question is answered on the phone and no reference is sent', () async {
      http.handler = (_) => FakeReply(200, _modelReply());
      expect(ctl().answersOnPhone('Where am I losing marks?'), isTrue);
      await ctl().send('Where am I losing marks?');
      expect(chats(), isEmpty);
      expect(c.read(askControllerProvider).messages.last.origin, AskOrigin.phone);
      await ctl().send('Explain goodwill in simple words');
      expect(_sent(chats().single).containsKey('questionRef'), isFalse);
    });

    test('while the question is still opening nothing is sent: a reply would go without it and still cost a credit', () async {
      http.handler = (r) => FakeReply(200, contextBody());
      final opening = hand().open(_ref);
      expect(await ctl().send('Why is B wrong?'), isNull);
      expect(c.read(askControllerProvider).messages, isEmpty);
      expect(chats(), isEmpty);
      await opening;
    });

    test('a question that could not be opened is no longer handed over: the message goes as an ordinary one', () async {
      http.handler = (r) => r.path.contains('ask-context') ? const FakeReply(404, {'ok': false}) : FakeReply(200, _modelReply());
      await hand().open(_ref);
      await ctl().send('Explain goodwill in simple words');
      expect(_sent(chats().single).containsKey('questionRef'), isFalse);
    });

    test('Send again goes with the same question, and with the same request id after an unknown outcome', () async {
      http.handler = (r) => r.path.contains('ask-context') ? FakeReply(200, contextBody()) : const FakeReply.network();
      await hand().open(_ref);
      expect(await ctl().send('Why is B wrong?'), AskFailure.offline);
      final first = _sent(chats().single);
      expect(first['questionRef'], _ref);
      // The student dropped the question meanwhile: the bubble still belongs to the question it was about.
      hand().clear();
      http.handler = (_) => FakeReply(200, _modelReply());
      await ctl().retry();
      final again = _sent(chats().last);
      expect(again['questionRef'], _ref);
      expect(again['requestId'], first['requestId'], reason: 'the server never charges the same question twice');
    });

    test('a message that was on its way when the app closed comes back with its question', () async {
      http.handler = (r) => r.path.contains('ask-context') ? FakeReply(200, contextBody()) : const FakeReply.network();
      await hand().open(_ref);
      await ctl().send('Why is B wrong?');
      c.dispose();
      c = make();
      await ctl().restoreInterrupted();
      final m = c.read(askControllerProvider).messages.last;
      expect(m.failure, AskFailure.interrupted);
      expect(m.questionRef, _ref);
      expect(m.retryText, 'Why is B wrong?');
    });
  });

  group('the screen', () {
    setUp(() {
      MobiRation.reset();
      addTearDown(MobiRation.reset);
    });

    Future<void> pump(WidgetTester tester, AskQuestionHand? handed, {AiCredits? credits, Brightness brightness = Brightness.dark, Size size = const Size(390, 900), double textScale = 1}) => pumpMockmob(
          tester,
          const AskScreen(questionRef: _ref),
          brightness: brightness,
          size: size,
          textScale: textScale,
          disableAnimations: true,
          overrides: [
            ...insightsOverrides(credits: credits ?? _wallet()),
            askQuestionProvider.overrideWith(() => _FixedHand(handed)),
          ],
          wrapInScaffold: false,
        );

    AskQuestionHand ready({bool hasKey = true}) => AskQuestionHand(ref: _ref, status: AskQuestionStatus.ready, context: AskQuestionContext.tryParse(contextBody(hasKey: hasKey)));

    testWidgets('a handed-over question: the card with what Mobi will see, no record prompts, the question hint and one cost line', (tester) async {
      await pump(tester, ready());
      expect(find.text('About the mistake you repaired, Partnership Accounts'), findsWidgets);
      expect(find.textContaining('Rao and Sen share profits 3:2.'), findsOneWidget);
      expect(find.text('You picked B.'), findsOneWidget);
      expect(find.text('Your rule: Split the sacrifice before you subtract.'), findsOneWidget);
      expect(find.text('Ask something else'), findsWidgets);
      expect(find.text(InsightsCopy.questionHint), findsOneWidget);
      expect(find.text('What about this mistake is unclear?'), findsOneWidget);
      // The record's prompt tiles are about the record: none are offered beside a question.
      expect(find.text(InsightsCopy.askGroupRecord), findsNothing);
      // The cost line says a written reply, never that record questions are free.
      expect(find.text('Uses 1 of your 9 AI credits'), findsOneWidget);
      expect(find.textContaining('free'), findsNothing);
    });

    testWidgets('while the key is being re-checked the card says Mobi will not name an answer', (tester) async {
      await pump(tester, ready(hasKey: false));
      expect(find.text('You picked B. The key is being re-checked, so Mobi will not name an answer.'), findsOneWidget);
    });

    testWidgets('the question is still opening: one line, and the composer cannot send', (tester) async {
      await pump(tester, const AskQuestionHand(ref: _ref, status: AskQuestionStatus.loading));
      expect(find.text('Opening your question.'), findsOneWidget);
      await tester.enterText(find.byType(TextField), 'Why is B wrong?');
      await tester.pump();
      await tester.tap(find.bySemanticsLabel('Sending'));
      await tester.pump();
      expect(find.text('Opening your question.'), findsOneWidget);
    });

    testWidgets('a question that could not be opened: the plain line, the record is still there, and one way on', (tester) async {
      await pump(tester, const AskQuestionHand(ref: _ref, status: AskQuestionStatus.error, message: askQuestionOpenFailed));
      expect(find.text('That question could not be opened.'), findsOneWidget);
      expect(find.text('You can still ask about your recorded practice.'), findsOneWidget);
      expect(find.text('Ask about my record'), findsWidgets);
    });

    testWidgets('written replies paused: Mobi cannot answer it, nothing was charged, one way out, and no greyed-out composer', (tester) async {
      await pump(tester, ready(), credits: _wallet(state: 'paused'));
      expect(find.text('Mobi cannot answer this question right now. Nothing was charged.'), findsOneWidget);
      expect(find.text('Ask about my record'), findsWidgets);
      expect(find.text('Ask something else'), findsNothing);
      expect(find.byType(TextField), findsNothing, reason: 'a composer for a question that cannot be asked is a dead end');
      expect(find.textContaining('Uses 1'), findsNothing);
      expect(find.textContaining('free'), findsNothing, reason: 'it never says the question can be asked about for free');
      expect(find.text(InsightsCopy.questionHint), findsNothing);
    });

    testWidgets('no credits is the same blocked state', (tester) async {
      await pump(tester, ready(), credits: _wallet(state: 'empty', total: 0));
      expect(find.text('Mobi cannot answer this question right now. Nothing was charged.'), findsOneWidget);
      expect(find.byType(TextField), findsNothing);
    });

    testWidgets('an unreadable wallet is the same blocked state', (tester) async {
      await pump(tester, ready(), credits: AiCredits.fromJson({'state': 'error', 'wallet': {'state': 'error', 'known': false}}));
      expect(find.text('Mobi cannot answer this question right now. Nothing was charged.'), findsOneWidget);
      expect(find.byType(TextField), findsNothing);
    });

    testWidgets('the way out drops the question and the screen becomes the ordinary Ask', (tester) async {
      await pump(tester, ready(), credits: _wallet(state: 'paused'));
      await tester.tap(find.text('Ask about my record').first);
      await tester.pumpAndSettle();
      expect(find.byType(AskQuestionCard), findsNothing);
      expect(find.text('Mobi cannot answer this question right now. Nothing was charged.'), findsNothing);
      expect(find.byType(TextField), findsOneWidget, reason: 'the composer is back, for the record');
      expect(find.text(InsightsCopy.askHint), findsOneWidget);
    });

    for (final b in Brightness.values) {
      testWidgets('${b.name}: no overflow at 360 wide and 1.3 text, with the card and with the blocked card', (tester) async {
        await pump(tester, ready(), brightness: b, size: const Size(360, 700), textScale: 1.3);
        expect(tester.takeException(), isNull);
        expect(find.text('Ask something else'), findsWidgets);
      });

      testWidgets('${b.name}: the blocked card at 360 wide and 1.3 text does not overflow', (tester) async {
        await pump(tester, ready(), credits: _wallet(state: 'paused'), brightness: b, size: const Size(360, 700), textScale: 1.3);
        expect(tester.takeException(), isNull);
        expect(find.text('Ask about my record'), findsWidgets);
      });
    }
  });
}

class _FixedHand extends AskQuestionController {
  _FixedHand(this.initial);

  final AskQuestionHand? initial;

  @override
  AskQuestionHand? build() => initial;

  @override
  Future<void> open(String? raw) async {}
}
