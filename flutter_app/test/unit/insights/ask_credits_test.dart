// Ask Mobi and the AI credit wallet: the cost before sending, the balance in the header, the
// charge the server reports after a reply, the out-of-credits state, and one plain failure line
// per server code of POST /api/ai/mentor/chat. Every path runs against a fake API.
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
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/insights/copy.dart';
import 'package:mockmob/features/insights/data/ai_reply_report.dart' show insightsPrefsStoreProvider;
import 'package:mockmob/features/insights/data/ask_controller.dart';
import 'package:mockmob/features/insights/data/ask_wallet.dart';
import 'package:mockmob/features/insights/data/insights_models.dart';
import 'package:mockmob/features/insights/data/insights_repository.dart';
import 'package:mockmob/features/insights/screens/ask_screen.dart';
import 'package:mockmob/features/insights/widgets/ask_messages.dart';
import 'package:mockmob/features/insights/widgets/ask_wallet.dart';

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
  _Credits(this.value);

  final AiCredits? value;
  int refreshes = 0;

  @override
  RemoteState<AiCredits> build() => RemoteState(value: value);

  @override
  Future<void> refresh({bool force = false}) async => refreshes++;
}

/// The wallet exactly as `GET /api/ai/credits` sends it: `spendable` is a yes or no, the count is
/// `total`.
AiCredits serverCredits({int total = 9, int included = 7, int bonus = 2, bool paid = false, String? state}) => AiCredits.fromJson({
      'ok': true,
      'state': state ?? (total > 0 ? 'available' : 'empty'),
      'isPaid': paid,
      'wallet': {
        'state': state ?? (total > 0 ? 'available' : 'empty'),
        'known': true,
        'spendable': total > 0,
        'includedMonthlyCredits': paid ? 50 : 10,
        'includedRemaining': included,
        'bonusCredits': bonus,
        'total': total,
        'resetAt': '2026-10-31T18:30:00.000Z',
      },
    });

Map<String, dynamic> _body(RecordedRequest r) => r.body is String ? jsonDecode(r.body! as String) as Map<String, dynamic> : Map<String, dynamic>.from(r.body! as Map);

Map<String, Object?> modelReply({int? amount = 1, int total = 8}) => {
      'ok': true,
      'sessionId': 's-1',
      'reply': 'Goodwill is paid for future profits.',
      'origin': 'model',
      'actions': [],
      'charge': {'kind': 'prepos_credit', 'creditUnits': 1, 'amount': ?amount, 'reference': 'prepos:u1:x'},
      'usageSnapshot': {
        'tier': 'free',
        'isPaid': false,
        'aiWallet': {'state': total > 0 ? 'available' : 'empty', 'known': true, 'spendable': total > 0, 'total': total, 'includedRemaining': total, 'includedMonthlyCredits': 10, 'bonusCredits': 0, 'resetAt': '2026-10-31T18:30:00.000Z'},
      },
    };

void main() {
  late FakeHttpAdapter http;
  late ProviderContainer c;
  final now = DateTime.utc(2026, 10, 13, 15);

  ProviderContainer make({AiCredits? credits}) => ProviderContainer(overrides: [
        authSnapshotProvider.overrideWith(_FakeAuth.new),
        apiClientProvider.overrideWithValue(newApiClient(http, now: () => now)),
        nowProvider.overrideWithValue(() => now),
        insightsRepositoryProvider.overrideWith(_FixedInsights.new),
        creditsRepositoryProvider.overrideWith(() => _Credits(credits ?? serverCredits())),
      ]);

  setUp(() => http = FakeHttpAdapter());
  tearDown(() {
    try {
      c.dispose();
    } on Error {
      // A test that never made a container has nothing to dispose.
    }
  });

  AskController ctl() => c.read(askControllerProvider.notifier);
  AskMessage last() => c.read(askControllerProvider).messages.last;
  int refreshes() => (c.read(creditsRepositoryProvider.notifier) as _Credits).refreshes;
  String sentId() => _body(http.requests.lastWhere((r) => r.path.contains('/mentor/chat')))['requestId'] as String;

  group('the wallet', () {
    test('reads the count from total: the server sends spendable as a yes or no', () {
      final w = AskWallet.fromCredits(serverCredits());
      expect(w.total, 9);
      expect(w.includedRemaining, 7);
      expect(w.includedMonthly, 10);
      expect(w.bonus, 2);
      expect(w.empty, isFalse);
    });

    test('an unreadable wallet has no number, never zero', () {
      final w = AskWallet.fromCredits(AiCredits.fromJson({
        'state': 'error',
        'wallet': {'state': 'error', 'known': false, 'spendable': false, 'total': null},
      }));
      expect(w.total, isNull);
      expect(w.known, isFalse);
      expect(w.empty, isFalse);
    });

    test('renews on the first of next month, India time', () {
      expect(renewDay(AskWallet.fromCredits(serverCredits()), now), '1 November');
      expect(renewDay(null, DateTime.utc(2026, 12, 31, 19)), '1 February');
      expect(renewDay(null, DateTime.utc(2026, 12, 31, 17)), '1 January');
    });
  });

  group('a reply says what the server charged', () {
    test('1 credit used, and the balance the server reported after it', () async {
      c = make();
      http.handler = (o) => FakeReply(200, modelReply());
      await ctl().send('What is goodwill?');
      expect(last().origin, AskOrigin.model);
      expect(last().charged, 1);
      expect(last().left, 8);
      expect(c.read(askWalletProvider)!.total, 8);
      expect(InsightsCopy.chargedLine(last().charged, last().left), '1 credit used. 8 left');
      expect(refreshes(), 1);
    });

    test('a reply whose charge did not commit says no credit was used', () async {
      c = make();
      http.handler = (o) => FakeReply(200, modelReply(amount: 0, total: 9));
      await ctl().send('What is goodwill?');
      expect(last().charged, 0);
      expect(InsightsCopy.chargedLine(0, 9), 'No credit used');
    });

    test('a reply with no charge reported never claims one', () async {
      c = make();
      http.handler = (o) => FakeReply(200, modelReply(amount: null));
      await ctl().send('What is goodwill?');
      expect(last().charged, isNull);
      expect(InsightsCopy.chargedLine(null, 8), 'Check your credits for the final charge');
    });

    test('a record answer from the server is free', () async {
      c = make();
      http.handler = (o) => const FakeReply(200, {'reply': 'From your sessions.', 'origin': 'record', 'actions': []});
      await ctl().send('Tell me about my record');
      expect(last().origin, AskOrigin.record);
      expect(last().charged, 0);
      expect(refreshes(), 0);
    });
  });

  group('each server code ends in its own plain line, and nothing is charged', () {
    test('insufficient_ai_credits: out of credits, the balance it named, the wallet re-read', () async {
      c = make();
      http.handler = (o) => const FakeReply(402, {'ok': false, 'error': 'insufficient_ai_credits', 'status': 'blocked', 'balance': 0, 'required': 1, 'charged': 0});
      expect(await ctl().send('What is goodwill?'), AskFailure.noCredits);
      expect(last().balance, 0);
      expect(c.read(askWalletProvider)!.empty, isTrue);
      expect(refreshes(), 1);
    });

    test('operation_released: Send again goes with a fresh request id', () async {
      c = make();
      http.handler = (o) => const FakeReply(409, {'ok': false, 'error': 'operation_released', 'status': 'resend', 'charged': 0});
      expect(await ctl().send('What is goodwill?'), AskFailure.resend);
      final first = sentId();
      http.handler = (o) => FakeReply(200, modelReply());
      await ctl().retry();
      expect(sentId(), isNot(first));
    });

    test('in_progress: Send again asks for the same request, so it is not charged twice', () async {
      c = make();
      http.handler = (o) => const FakeReply(409, {'ok': false, 'error': 'in_progress', 'status': 'in_progress', 'charged': 0});
      expect(await ctl().send('What is goodwill?'), AskFailure.inProgress);
      final first = sentId();
      http.handler = (o) => FakeReply(200, modelReply());
      await ctl().retry();
      expect(sentId(), first);
      expect(last().charged, 1);
    });

    test('duplicate: the reply is read back from the history with its charge', () async {
      c = make();
      String? id;
      http.handler = (o) {
        if (o.path.contains('/mentor/chat')) {
          id = (o.data is String ? jsonDecode(o.data as String) : o.data)['requestId'] as String;
          return const FakeReply(409, {'ok': false, 'error': 'duplicate', 'status': 'duplicate', 'charged': 0});
        }
        return FakeReply(200, {
          'messages': [
            {'role': 'user', 'text': 'What is goodwill?'},
            {
              'role': 'assistant',
              'text': 'Goodwill is paid for future profits.',
              'response': {
                'reply': 'Goodwill is paid for future profits.',
                'origin': 'model',
                'charge': {'kind': 'prepos_credit', 'amount': 1, 'reference': 'prepos:u1:$id'},
              },
            },
          ],
        });
      };
      expect(await ctl().send('What is goodwill?'), isNull);
      expect(last().origin, AskOrigin.model);
      expect(last().text, contains('future profits'));
      expect(last().charged, 1);
      expect(http.requests.any((r) => r.path.contains('/mentor/history')), isTrue);
    });

    test('duplicate of a paid doubt: the reply is found in its thread\'s own conversation, with the thread (L-01)', () async {
      c = make();
      String? id;
      http.handler = (o) {
        if (o.path.contains('/mentor/chat')) {
          id = (o.data is String ? jsonDecode(o.data as String) : o.data)['requestId'] as String;
          return const FakeReply(409, {'ok': false, 'error': 'duplicate', 'status': 'duplicate', 'charged': 0});
        }
        final session = o.queryParameters['sessionId'];
        if (session == 'thread-1') {
          return FakeReply(200, {
            'session': {'id': 'thread-1'},
            'sessions': [
              {'id': 'thread-1'},
            ],
            'messages': [
              {'role': 'user', 'text': 'How is goodwill valued by the super profit method?'},
              {
                'role': 'assistant',
                'text': 'Super profit is the profit above the normal profit.',
                'response': {
                  'reply': 'Super profit is the profit above the normal profit.',
                  'origin': 'model',
                  'charge': {'kind': 'prepos_credit', 'amount': 1, 'reference': 'prepos:u1:$id'},
                  'thread': {'id': 'thread-1', 'followUpsLeft': 1, 'followUpsMax': 1, 'subject': 'accountancy', 'chapter': null},
                  'checks': [],
                  'checksNote': 'Pick the chapter and Mobi adds 2 real CUET questions on it to test this.',
                },
              },
            ],
          });
        }
        // The newest conversation is the empty row the retry opened; the doubt's thread is the one before it.
        return const FakeReply(200, {
          'session': {'id': 'thread-2'},
          'sessions': [
            {'id': 'thread-2'},
            {'id': 'thread-1'},
            {'id': 's-old'},
          ],
          'messages': [],
        });
      };
      expect(await ctl().send('How is goodwill valued by the super profit method?', subject: 'accountancy'), isNull);
      expect(last().origin, AskOrigin.model);
      expect(last().text, contains('Super profit'));
      expect(last().charged, 1);
      final state = c.read(askControllerProvider);
      expect(state.thread?.info.id, 'thread-1');
      expect(state.thread?.canFollowUp, isTrue, reason: 'the free follow-up the credit bought is still there');
      expect(state.thread?.askedSubject, 'accountancy');
      expect(state.sessionId, 'thread-1');
      expect(http.requests.where((r) => r.path.contains('/mentor/history')).length, greaterThanOrEqualTo(2));
    });

    test('duplicate with no reply in the history: says so, and asking again is a new question', () async {
      c = make();
      http.handler = (o) => o.path.contains('/mentor/chat')
          ? const FakeReply(409, {'ok': false, 'error': 'duplicate', 'status': 'duplicate', 'charged': 0})
          : const FakeReply(200, {'messages': []});
      expect(await ctl().send('What is goodwill?'), AskFailure.alreadyAnswered);
      final first = sentId();
      http.handler = (o) => FakeReply(200, modelReply());
      await ctl().retry();
      expect(sentId(), isNot(first));
    });

    for (final (code, status, failure) in [
      ('paused', 503, AskFailure.paused),
      ('budget_reached', 503, AskFailure.budgetReached),
      ('wallet_unavailable', 503, AskFailure.walletUnavailable),
      ('could_not_start', 503, AskFailure.unavailable),
      ('provider_error', 502, AskFailure.unavailable),
      ('unusable_output', 502, AskFailure.unavailable),
      ('reserve_failed', 500, AskFailure.unavailable),
      ('message_too_long', 413, AskFailure.tooLong),
    ]) {
      test('$code ($status) is ${failure.name}', () async {
        c = make();
        http.handler = (o) => FakeReply(status, {'ok': false, 'error': code, 'charged': 0});
        expect(await ctl().send('What is goodwill?'), failure);
        expect(last().creditHeld, isFalse);
      });
    }

    test('a release that has not happened yet is said as a held credit', () async {
      c = make();
      http.handler = (o) => const FakeReply(502, {
            'ok': false,
            'error': 'unusable_output',
            'charged': 0,
            'message': 'PrepOS could not produce a reliable reply this time. Your credit is held briefly and returns automatically.',
          });
      expect(await ctl().send('What is goodwill?'), AskFailure.unavailable);
      expect(last().creditHeld, isTrue);
    });

    test('no answer at all keeps the request id: the same question is never charged twice', () async {
      c = make();
      http.handler = (o) => const FakeReply.network();
      expect(await ctl().send('What is goodwill?'), AskFailure.offline);
      final first = sentId();
      http.handler = (o) => FakeReply(200, modelReply());
      await ctl().retry();
      expect(sentId(), first);
    });

    test('a rate limit is its own line', () async {
      c = make();
      http.handler = (o) => const FakeReply(429, {'error': 'Too many requests'});
      expect(await ctl().send('What is goodwill?'), AskFailure.rateLimited);
    });
  });

  group('the screen', () {
    setUp(() {
      MobiRation.reset();
      addTearDown(MobiRation.reset);
    });

    Future<void> pump(WidgetTester tester, {AiCredits? credits, AskState ask = const AskState()}) => pumpMockmob(
          tester,
          const AskScreen(),
          brightness: Brightness.dark,
          size: const Size(384, 900),
          disableAnimations: true,
          overrides: insightsOverrides(credits: credits ?? serverCredits(), ask: ask),
          wrapInScaffold: false,
        );

    testWidgets('the header shows the live balance, and opens the credit details', (tester) async {
      await pump(tester);
      expect(find.byType(AskCreditPill), findsOneWidget);
      expect(find.bySemanticsLabel('9 credits. Credit details'), findsOneWidget);
      await tester.tap(find.byType(AskCreditPill));
      await tester.pumpAndSettle();
      expect(find.text(InsightsCopy.walletTitle), findsOneWidget);
      expect(find.text('7 of 10 left'), findsOneWidget);
      expect(find.text('1 November'), findsOneWidget);
      expect(find.text(InsightsCopy.walletHowFailed), findsOneWidget);
    });

    testWidgets('the cost line says what the typed question will use, before it is sent', (tester) async {
      await pump(tester);
      expect(find.text(InsightsCopy.askNoteIdle(9)), findsOneWidget);
      await tester.enterText(find.byType(TextField), 'What is goodwill?');
      await tester.pumpAndSettle();
      expect(find.text(InsightsCopy.askNoteCost(9)), findsOneWidget);
      await tester.enterText(find.byType(TextField), 'Where am I losing marks?');
      await tester.pumpAndSettle();
      expect(find.text(InsightsCopy.askNoteFree), findsOneWidget);
    });

    testWidgets('Send goes straight to the answer: no sheet first, and the AI service line stays under the field', (tester) async {
      http.handler = (o) => FakeReply(200, modelReply());
      await pumpMockmob(
        tester,
        const AskScreen(),
        brightness: Brightness.dark,
        size: const Size(384, 900),
        disableAnimations: true,
        overrides: [
          ...insightsOverrides(realAsk: true, credits: serverCredits()).where((o) => !identical(o.origin, creditsRepositoryProvider)),
          creditsRepositoryProvider.overrideWith(() => _Credits(serverCredits())),
          apiClientProvider.overrideWithValue(newApiClient(http, now: () => now)),
          insightsPrefsStoreProvider.overrideWithValue(MemoryPrefsStore()),
        ],
        wrapInScaffold: false,
      );
      await tester.enterText(find.byType(TextField), 'What is goodwill?');
      await tester.pumpAndSettle();
      expect(find.text(InsightsCopy.askNoteCost(9)), findsOneWidget);
      await tester.tap(find.bySemanticsLabel(InsightsCopy.askSend));
      for (var i = 0; i < 5; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }
      expect(http.requests.where((r) => r.path.contains('/mentor/chat')), hasLength(1));
      expect(find.text('This question goes to an AI service'), findsNothing);
      expect(find.text('This message goes to an AI service'), findsNothing);
      expect(find.text('Send it'), findsNothing);
      await tester.pump(const Duration(seconds: 13));
    });

    // New contract (final fix pass, 18 Oct): Pro is named only when it can be bought in the app
    // (PLAY_BILLING on); the release APK has it off, so the band carries no Pro line.
    testWidgets('out of credits: when they renew and that record questions stay free; no Pro line with billing off', (tester) async {
      await pump(tester, credits: serverCredits(total: 0, included: 0, bonus: 0));
      expect(find.byType(AskOutOfCredits), findsOneWidget);
      expect(find.text(InsightsCopy.outTitle), findsOneWidget);
      expect(find.textContaining('They refill on 1 November'), findsWidgets);
      expect(find.textContaining(InsightsCopy.outPro), findsNothing);
    });

    testWidgets('a Pro wallet that is empty does not mention Pro', (tester) async {
      await pump(tester, credits: serverCredits(total: 0, included: 0, bonus: 0, paid: true));
      expect(find.byType(AskOutOfCredits), findsOneWidget);
      expect(find.textContaining(InsightsCopy.outPro), findsNothing);
    });

    testWidgets('a charged reply says what it used and what is left; the conversation lists it', (tester) async {
      await pump(
        tester,
        ask: const AskState(messages: [
          AskMessage.student('What is goodwill?'),
          AskMessage.reply('Goodwill is paid for future profits.', origin: AskOrigin.model, requestId: 'r1', charged: 1, left: 8),
        ]),
      );
      expect(find.textContaining('1 credit used. 8 left'), findsOneWidget);
      await tester.tap(find.byType(AskCreditPill));
      await tester.pumpAndSettle();
      expect(find.text(InsightsCopy.walletHistory), findsOneWidget);
      expect(find.text('1 credit used'), findsOneWidget);
    });

    for (final (failure, line) in [
      (AskFailure.noCredits, InsightsCopy.creditNone),
      (AskFailure.paused, InsightsCopy.creditNone),
      (AskFailure.budgetReached, InsightsCopy.creditNone),
      (AskFailure.walletUnavailable, InsightsCopy.creditNone),
      (AskFailure.unavailable, InsightsCopy.creditNone),
      (AskFailure.offline, InsightsCopy.creditNotTwice),
      (AskFailure.inProgress, InsightsCopy.creditNotTwice),
      (AskFailure.alreadyAnswered, InsightsCopy.creditNoMore),
    ]) {
      testWidgets('${failure.name} says what it cost: $line', (tester) async {
        await pumpMockmob(
          tester,
          Padding(
            padding: const EdgeInsets.all(16),
            child: AskMessageView(message: AskMessage.failed(failure, balance: 0, retryText: 'x'), onRetry: () {}, onCredits: () {}, renew: '1 November'),
          ),
          brightness: Brightness.dark,
          disableAnimations: true,
        );
        expect(find.text(line), findsOneWidget);
        final credits = failure == AskFailure.noCredits || failure == AskFailure.budgetReached;
        expect(find.text(InsightsCopy.creditDetails), credits ? findsOneWidget : findsNothing);
      });
    }

    testWidgets('a held credit is never said as not charged', (tester) async {
      await pumpMockmob(
        tester,
        Padding(
          padding: const EdgeInsets.all(16),
          child: AskMessageView(message: const AskMessage.failed(AskFailure.unavailable, retryText: 'x', creditHeld: true), onRetry: () {}),
        ),
        brightness: Brightness.dark,
        disableAnimations: true,
      );
      expect(find.text(InsightsCopy.creditHeld), findsOneWidget);
      expect(find.text(InsightsCopy.creditNone), findsNothing);
    });
  });
}
