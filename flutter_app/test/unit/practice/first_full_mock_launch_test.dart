import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/models/practice_quote.dart';
import 'package:mockmob/features/practice/copy.dart';
import 'package:mockmob/features/practice/data/launch_flow.dart';
import 'package:mockmob/features/practice/data/practice_starter.dart';
import 'package:mockmob/features/practice/model/practice_selection.dart';

import '../../helpers/fonts.dart';
import 'support/harness.dart';

// Release 11, verifier M1: a Full mock the screen called free is never charged. When the server says the free one was
// taken between the quote and the start (409 FIRST_FULL_MOCK_TAKEN), the app asks for a new quote, so the new price is on
// screen before the student can start again, and it shows the server's own sentence.

PracticeQuote _free() => PracticeQuote.fromJson({
  'state': 'available',
  'launchable': true,
  'reasonCode': 'ok',
  'creditCost': 0,
  'creditBalance': 120,
  'allowance': {'kind': 'first_full_mock:accountancy', 'state': 'available'},
  'freeReason': 'first_full_mock_free',
  'subject': {'id': 'accountancy', 'name': 'Accountancy'},
  'mode': {'id': 'full'},
  'count': 50,
  'durationSec': 3600,
  'expiresAt': testNow.add(const Duration(minutes: 1)).toUtc().toIso8601String(),
});

PracticeQuote _charged() => creditsQuote(cost: 50, balance: 120, mode: 'full', count: 50);

void main() {
  setUpAll(loadAppFonts);

  final mock = PracticeSelection(mode: PracticeMode.full, subjectId: 'accountancy');
  const sentence = 'Your free full mock in this subject was already started on another device or tab, so this one is not free. It did not start, and nothing was charged. Check the price, then start again.';

  Future<LaunchResult> launch(WidgetTester tester, {required PracticeQuote shown, required FakeQuoteRepository quotes, required FakeStarter starter}) async {
    late WidgetRef captured;
    await pumpRouted(
      tester,
      location: '/x',
      routes: [
        GoRoute(
          path: '/x',
          builder: (c, s) => Consumer(
            builder: (context, ref, _) {
              captured = ref;
              return const SizedBox();
            },
          ),
        ),
      ],
      overrides: practiceOverrides(quotes: quotes, starter: starter),
    );
    late LaunchResult result;
    await tester.runAsync(() async {
      result = await launchPractice(captured, mock, shown);
    });
    return result;
  }

  testWidgets('taken: a new quote is read, the new price comes back with the server sentence, nothing is started again', (tester) async {
    final quotes = FakeQuoteRepository((s, m, c, p) => _charged());
    final starter = FakeStarter(const StartFailed(StartFailure.firstMockTaken, message: sentence));
    final result = await launch(tester, shown: _free(), quotes: quotes, starter: starter);
    expect(result, isA<LaunchNeedsLook>());
    final look = result as LaunchNeedsLook;
    expect(look.costChanged, isTrue);
    expect(look.message, sentence);
    expect(look.quote.creditCost, 50, reason: 'the price the student must now pay is the one returned');
    expect(look.quote.quotesFirstFullMockFree, isFalse);
    expect(quotes.calls, hasLength(1), reason: 'one fresh quote');
    expect(starter.started, hasLength(1), reason: 'the refused start is not repeated');
    expect(
      PracticeCopy.firstMockTakenNote(look.message!, costLineText(look.quote)),
      '$sentence The price now: 50 credits. You have 120.',
    );
  });

  testWidgets('taken, with no sentence from the server: the app uses the same words', (tester) async {
    final quotes = FakeQuoteRepository((s, m, c, p) => _charged());
    final starter = FakeStarter(const StartFailed(StartFailure.firstMockTaken));
    final result = await launch(tester, shown: _free(), quotes: quotes, starter: starter);
    expect((result as LaunchNeedsLook).message, PracticeCopy.firstMockTaken);
  });

  testWidgets('taken, and the new quote cannot be read: the failure carries the sentence, nothing is charged', (tester) async {
    var calls = 0;
    final quotes = FakeQuoteRepository((s, m, c, p) => ++calls == 1 ? throw StateError('offline') : _charged());
    final starter = FakeStarter(const StartFailed(StartFailure.firstMockTaken, message: sentence));
    final result = await launch(tester, shown: _free(), quotes: quotes, starter: starter);
    expect(result, isA<LaunchFailed>().having((f) => f.failure, 'failure', StartFailure.firstMockTaken).having((f) => f.message, 'message', sentence));
  });

  testWidgets('unchecked: a plain failure, retryable, no new quote, nothing started again', (tester) async {
    final quotes = FakeQuoteRepository((s, m, c, p) => _charged());
    final starter = FakeStarter(const StartFailed(StartFailure.firstMockUnchecked, message: 'We could not check that this full mock is still free, so it did not start and nothing was charged. Try again in a moment.'));
    final result = await launch(tester, shown: _free(), quotes: quotes, starter: starter);
    expect(result, isA<LaunchFailed>().having((f) => f.failure, 'failure', StartFailure.firstMockUnchecked));
    expect(quotes.calls, isEmpty);
    expect(starter.started, hasLength(1));
  });
}
