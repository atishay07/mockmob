import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/models/mistake_lab_traps.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart' show KeyButton;
import 'package:mockmob/features/review/revise/revise_data.dart';
import 'package:mockmob/features/review/revise/revise_entry.dart';
import 'package:mockmob/features/review/revise/revise_screen.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';

Map<String, dynamic> later() => jsonDecode(File('test/fixtures/mistake_lab/contract_later_v1.json').readAsStringSync()) as Map<String, dynamic>;

Map<String, dynamic> reviseBody({int? cap, Map<String, dynamic>? patch}) =>
    {...later()['revise'] as Map<String, dynamic>, 'cap': ?cap, ...?patch};

Map<String, dynamic> answerBody(String which, {int? keyIndex, int? box, bool? retired, bool? correct}) {
  final base = Map<String, dynamic>.from((later()['answers'] as Map)[which] as Map);
  return {
    ...base,
    'keyIndex': ?keyIndex,
    'box': ?box,
    'retired': ?retired,
    'correct': ?correct,
  };
}

/// Revise as the server answers it: the read, and each recall held until the test releases it.
class FakeReviseApi implements ReviseApi {
  FakeReviseApi({Map<String, dynamic>? body}) : body = body ?? reviseBody();

  Map<String, dynamic> body;
  final List<int> reads = [];
  final List<({String qid, int choice, int cap})> answers = [];
  Completer<ReviseAnswer>? pending;
  final List<Object> queue = [];
  Object? readFailure;

  @override
  Future<ReviseRead> read({required int cap}) async {
    reads.add(cap);
    if (readFailure != null) throw readFailure!;
    return ReviseRead.parse({...body, 'cap': cap});
  }

  @override
  Future<ReviseAnswer> answer({required String questionId, required int choice, required int cap}) {
    answers.add((qid: questionId, choice: choice, cap: cap));
    if (queue.isNotEmpty) {
      final next = queue.removeAt(0);
      if (next is ReviseAnswer) return Future.value(next);
      return Future.error(next);
    }
    pending = Completer<ReviseAnswer>();
    return pending!.future;
  }
}

Future<void> settle(WidgetTester tester) async {
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 400));
  await tester.pump(const Duration(milliseconds: 400));
}

Finder keyLabelled(String label) => find.byWidgetPredicate((w) => w is KeyButton && w.label == label);

Future<void> pumpRevise(WidgetTester tester, FakeReviseApi api, {PrefsStore? store, Size size = const Size(390, 1800)}) async {
  tester.view.physicalSize = size * 2;
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        reviseApiProvider.overrideWithValue(api),
        revisePrefsStoreProvider.overrideWithValue(store ?? MemoryPrefsStore()),
      ],
      child: DefaultAssetBundle(
        bundle: FileAssetBundle(),
        child: MaterialApp(
          theme: buildTheme(Brightness.light),
          builder: (context, app) => MediaQuery(data: MediaQuery.of(context).copyWith(disableAnimations: true), child: app!),
          home: const ReviseScreen(),
        ),
      ),
    ),
  );
  await settle(tester);
}

/// The lane counts as drawn, in order: "4 Box 1 back after 1 day" and so on.
List<String> lanes(WidgetTester tester) {
  final out = <String>[];
  for (var n = 1; n <= 4; n++) {
    final box = find.text('Box $n');
    expect(box, findsOneWidget);
    // The count sits above its box name, in the same column.
    final count = find.descendant(of: find.ancestor(of: box, matching: find.byType(Column)).first, matching: find.byType(Text)).first;
    out.add((tester.widget(count) as Text).data!);
  }
  return out;
}

/// Revise (Mistake Lab v4 slice 4, spec 4.8): the student's own wrong answers come back. One card
/// at a time; the key and the explanation arrive only with the server's grade; nothing on screen
/// moves until the server says so; it costs no credits and writes no attempts row.
void main() {
  setUpAll(loadAppFonts);

  testWidgets('the top: how many, how long, the summary and the four boxes with their counts and days', (tester) async {
    await pumpRevise(tester, FakeReviseApi());
    expect(find.text('Revise'), findsWidgets);
    expect(find.text('4 questions to revise today'), findsOneWidget);
    expect(find.text('About 5 minutes'), findsOneWidget);
    expect(find.text('4 due today. 7 cards, 2 recalled twice.'), findsOneWidget);
    expect(find.text('Same question, so this checks memory. A check on new questions is separate.'), findsOneWidget);
    expect(find.text('Revise costs no credits. It does not change your record, your chapter numbers or any accuracy.'), findsOneWidget);
    expect(lanes(tester), ['4', '1', '1', '1']);
    for (final d in ['back after 1 day', 'after 3 days', 'after 7 days', 'after 21 days']) {
      expect(find.text(d), findsOneWidget);
    }
  });

  testWidgets('the first card shows the question and its options, and no key before an answer', (tester) async {
    final api = FakeReviseApi();
    await pumpRevise(tester, api);
    expect(find.text('Question 1 of 4'), findsOneWidget);
    expect(find.text('Cash Flow Statement'), findsWidgets);
    expect(find.text('Illustrative revise question 5'), findsOneWidget);
    for (final l in ['A. Illustrative option 5a', 'B. Illustrative option 5b', 'C. Illustrative option 5c', 'D. Illustrative option 5d']) {
      expect(find.text(l), findsOneWidget);
    }
    expect(find.text('Right answer'), findsNothing);
    expect(find.text('Your pick'), findsNothing);
    expect(find.text('Next question'), findsNothing);
    expect(api.answers, isEmpty);
    // Every option is a 56 dp target.
    for (final l in ['A. Illustrative option 5a', 'D. Illustrative option 5d']) {
      final box = find.ancestor(of: find.text(l), matching: find.byType(Container)).first;
      expect(tester.getSize(box).height, greaterThanOrEqualTo(56));
    }
  });

  testWidgets('a right recall: the server\'s grade moves the card, shows the key, the line and the explanation', (tester) async {
    final api = FakeReviseApi();
    await pumpRevise(tester, api);
    await tester.tap(find.text('B. Illustrative option 5b'));
    await tester.pump();
    // Held: nothing has moved, a second tap posts nothing, the options are off.
    expect(api.answers.single, (qid: 'r-q5', choice: 1, cap: 10));
    expect(find.text('Checking your answer'), findsOneWidget);
    expect(lanes(tester), ['4', '1', '1', '1']);
    await tester.tap(find.text('C. Illustrative option 5c'));
    await tester.pump();
    expect(api.answers.length, 1);
    expect(find.text('Right answer'), findsNothing);

    api.pending!.complete(ReviseAnswer.tryParse(answerBody('right'))!);
    await settle(tester);
    expect(find.text('Right. It comes back in 3 days.'), findsOneWidget);
    expect(find.text('Illustrative stored explanation 1.'), findsOneWidget);
    expect(find.text('Right answer'), findsOneWidget);
    expect(find.text('Your pick'), findsNothing, reason: 'a right pick is the right answer, not a second tag');
    expect(find.text('Checking your answer'), findsNothing);
    // The card left box 1 and entered box 2.
    expect(lanes(tester), ['3', '2', '1', '1']);
    expect(find.text('Next question'), findsOneWidget);
  });

  testWidgets('a wrong recall: your pick and the right answer, the card goes back to box 1, no lane count changes', (tester) async {
    final api = FakeReviseApi();
    await pumpRevise(tester, api);
    await tester.tap(find.text('A. Illustrative option 5a'));
    await tester.pump();
    api.pending!.complete(ReviseAnswer.tryParse(answerBody('wrong', correct: false))!);
    await settle(tester);
    expect(find.text('Not this time. It comes back tomorrow.'), findsOneWidget);
    expect(find.text('Your pick'), findsOneWidget);
    expect(find.text('Right answer'), findsOneWidget);
    expect(lanes(tester), ['4', '1', '1', '1']);
    // Both tags are words as well as the border and the bubble.
    final mine = find.ancestor(of: find.text('Your pick'), matching: find.byType(Row)).first;
    expect(find.descendant(of: mine, matching: find.text('A. Illustrative option 5a')), findsOneWidget);
  });

  testWidgets('a card finished in the last box leaves it: that lane drops by one and nothing enters', (tester) async {
    final api = FakeReviseApi(body: reviseBody(patch: {'items': [((later()['revise'] as Map)['items'] as List).last]}));
    await pumpRevise(tester, api);
    expect(lanes(tester), ['4', '1', '1', '1']);
    await tester.tap(find.text('B. Illustrative option 3b'));
    await tester.pump();
    api.pending!.complete(ReviseAnswer.tryParse(answerBody('done'))!);
    await settle(tester);
    expect(find.text('Right again. This one is done.'), findsOneWidget);
    expect(lanes(tester), ['4', '1', '1', '0']);
    // The only question of the run: the key says Finish.
    expect(find.text('Finish'), findsOneWidget);
  });

  testWidgets('the whole run: Next, Finish, then "N recalled, M come back tomorrow" and the next day', (tester) async {
    final api = FakeReviseApi();
    api.queue.addAll([
      ReviseAnswer.tryParse(answerBody('right'))!,
      ReviseAnswer.tryParse(answerBody('wrong', correct: false))!,
      ReviseAnswer.tryParse(answerBody('right'))!,
      ReviseAnswer.tryParse(answerBody('done'))!,
    ]);
    await pumpRevise(tester, api);
    for (var i = 0; i < 4; i++) {
      expect(find.text('Question ${i + 1} of 4'), findsOneWidget);
      await tester.tap(find.text('B. Illustrative option ${[5, 1, 2, 3][i]}b'));
      await settle(tester);
      final next = keyLabelled(i == 3 ? 'Finish' : 'Next question');
      expect(next, findsOneWidget);
      await tester.ensureVisible(next);
      await tester.tap(next);
      await settle(tester);
    }
    expect(api.answers.map((a) => a.qid), ['r-q5', 'r-q1', 'r-q2', 'r-q3']);
    expect(find.text('3 recalled, 1 come back tomorrow'), findsOneWidget);
    expect(find.text('The next ones are due on Sat 17 Oct.'), findsOneWidget);
    expect(keyLabelled('Back to Your papers'), findsOneWidget);
    // The head of today's run is gone at the end.
    expect(find.text('4 questions to revise today'), findsNothing);
    // From [4,1,1,1]: box 1 to box 2, back to box 1, box 2 to box 2 (the fake grades each in its own box), then the last box finished.
    expect(lanes(tester), ['3', '2', '1', '0']);
  });

  testWidgets('a recall the server refuses says so in its words and changes nothing; the options stay open', (tester) async {
    final api = FakeReviseApi();
    api.queue.add(const ReviseRefused('cap_reached', 'You have done today\'s questions. The rest come back tomorrow.'));
    await pumpRevise(tester, api);
    await tester.tap(find.text('B. Illustrative option 5b'));
    await settle(tester);
    expect(find.text('You have done today\'s questions. The rest come back tomorrow.'), findsOneWidget);
    expect(lanes(tester), ['4', '1', '1', '1']);
    expect(find.text('Right answer'), findsNothing);
    // The student can answer again, and can move on.
    expect(find.text('Next question'), findsOneWidget);
    api.queue.add(ReviseAnswer.tryParse(answerBody('right'))!);
    await tester.tap(find.text('B. Illustrative option 5b'));
    await settle(tester);
    expect(find.text('Right. It comes back in 3 days.'), findsOneWidget);
    expect(find.text('You have done today\'s questions. The rest come back tomorrow.'), findsNothing);
  });

  testWidgets('a recall that did not reach the server says it was not saved, and nothing moves', (tester) async {
    final api = FakeReviseApi();
    api.queue.add(const ApiError(kind: ApiErrorKind.network, code: 'network'));
    await pumpRevise(tester, api);
    await tester.tap(find.text('D. Illustrative option 5d'));
    await settle(tester);
    expect(find.text('Your answer was not saved. Try again.'), findsOneWidget);
    expect(find.text('Right answer'), findsNothing);
    expect(lanes(tester), ['4', '1', '1', '1']);
  });

  testWidgets('questions a day: 5 reads again at 5, and the choice is kept on the device', (tester) async {
    final api = FakeReviseApi();
    final store = MemoryPrefsStore();
    await pumpRevise(tester, api, store: store);
    expect(api.reads, [10]);
    await tester.tap(find.text('5').first);
    await settle(tester);
    expect(api.reads, [10, 5]);
    expect(await store.getInt('revise.cap'), 5);
    // A new visit starts at the kept choice.
    final again = FakeReviseApi();
    await pumpRevise(tester, again, store: store);
    expect(again.reads.first, 5);
  });

  testWidgets('the two cap segments are 48 dp targets', (tester) async {
    await pumpRevise(tester, FakeReviseApi());
    for (final n in ['5', '10']) {
      final seg = find.ancestor(of: find.text(n), matching: find.byType(AnimatedContainer)).first;
      expect(tester.getSize(seg).height, greaterThanOrEqualTo(48));
    }
  });

  testWidgets('not available: the website\'s sentence and Try again, which reads once more', (tester) async {
    final api = FakeReviseApi(body: {'state': 'unavailable', 'items': <dynamic>[]});
    await pumpRevise(tester, api);
    expect(find.text('Revise is not available right now. Try again shortly.'), findsOneWidget);
    expect(find.text('4 questions to revise today'), findsNothing);
    final before = api.reads.length;
    api.body = reviseBody();
    await tester.tap(keyLabelled('Try again'));
    await settle(tester);
    expect(api.reads.length, before + 1);
    expect(find.text('4 questions to revise today'), findsOneWidget);
  });

  testWidgets('a failed read is the same page: the sentence and Try again', (tester) async {
    final api = FakeReviseApi()..readFailure = const ApiError(kind: ApiErrorKind.server, code: 'server_error', status: 500);
    await pumpRevise(tester, api);
    expect(find.text('Revise is not available right now. Try again shortly.'), findsOneWidget);
    expect(keyLabelled('Try again'), findsOneWidget);
  });

  testWidgets('nothing due today: the server\'s next day, and the way back', (tester) async {
    final api = FakeReviseApi(body: reviseBody(patch: {'items': <dynamic>[], 'shown': 0, 'due': 0, 'head': 'Nothing to revise today'}));
    await pumpRevise(tester, api);
    expect(find.text('Nothing to revise today'), findsOneWidget);
    expect(find.text('The next ones are due on Sat 17 Oct.'), findsOneWidget);
    expect(keyLabelled('Back to Your papers'), findsOneWidget);
    expect(find.text('About 5 minutes'), findsNothing, reason: 'no questions, no minutes');
    expect(find.text('Example'), findsNothing, reason: 'a student who has cards is not shown a sample');
  });

  testWidgets('the day\'s cap is reached: the website\'s sentence', (tester) async {
    final api = FakeReviseApi(body: reviseBody(patch: {'items': <dynamic>[], 'shown': 0, 'answeredToday': 10, 'head': 'Nothing to revise today'}));
    await pumpRevise(tester, api);
    expect(find.text('You have done today\'s questions. The rest come back tomorrow.'), findsOneWidget);
  });

  testWidgets('a student with no card yet: the server\'s empty sentence', (tester) async {
    final api = FakeReviseApi(
      body: {'state': 'empty', 'today': '2026-10-16', 'cap': 10, 'due': 0, 'shown': 0, 'answeredToday': 0, 'minutes': 0, 'boxes': [0, 0, 0, 0], 'cards': 0, 'nextDay': null, 'nextDayLabel': null, 'head': 'Nothing to revise today', 'summary': null, 'next': 'Questions you get wrong in a paper or a practice set come back here after 1, 3, 7 and 21 days.', 'items': <dynamic>[]},
    );
    await pumpRevise(tester, api);
    expect(find.text('Questions you get wrong in a paper or a practice set come back here after 1, 3, 7 and 21 days.'), findsOneWidget);
    expect(lanes(tester), ['0', '0', '0', '0']);
    // The empty page teaches: one sample card tagged as an example, and the next action first.
    expect(find.text('Example'), findsOneWidget);
    expect(find.text('Question 4, Partnership'), findsOneWidget);
    expect(keyLabelled('Start 10 questions'), findsOneWidget);
  });

  group('Review\'s entry', () {
    Future<void> pumpEntry(WidgetTester tester, ReviseApi api) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            reviseApiProvider.overrideWithValue(api),
            authSnapshotProvider.overrideWithBuild((ref, n) => const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1', name: 'Riya')),
          ],
          child: MaterialApp(
            theme: buildTheme(Brightness.light),
            builder: (context, app) => MediaQuery(data: MediaQuery.of(context).copyWith(disableAnimations: true), child: app!),
            home: const Scaffold(body: ReviseEntry()),
          ),
        ),
      );
      await settle(tester);
    }

    testWidgets('the server\'s head and summary, one row', (tester) async {
      await pumpEntry(tester, FakeReviseApi());
      expect(find.text('4 questions to revise today'), findsOneWidget);
      expect(find.text('4 due today. 7 cards, 2 recalled twice.'), findsOneWidget);
    });

    testWidgets('absent for a student with no card, when unavailable, and when the read fails', (tester) async {
      await pumpEntry(tester, FakeReviseApi(body: {'state': 'empty', 'items': <dynamic>[], 'boxes': [0, 0, 0, 0]}));
      expect(find.byType(ListTile), findsNothing);
      expect(find.textContaining('Revise'), findsNothing);
      expect(find.textContaining('questions'), findsNothing);
      await pumpEntry(tester, FakeReviseApi(body: {'state': 'unavailable', 'items': <dynamic>[]}));
      expect(find.textContaining('Revise'), findsNothing);
      await pumpEntry(tester, FakeReviseApi()..readFailure = const ApiError(kind: ApiErrorKind.network, code: 'network'));
      expect(find.textContaining('Revise'), findsNothing);
      expect(find.textContaining('come back'), findsNothing);
    });
  });
}
