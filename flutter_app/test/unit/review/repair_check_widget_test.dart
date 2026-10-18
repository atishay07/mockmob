import 'dart:async';
import 'dart:ui' show Tristate;

import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart' show SemanticsData;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/models/models.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/insights/data/ask_question.dart';
import 'package:mockmob/features/insights/data/ask_sheet_controller.dart';
import 'package:mockmob/features/insights/widgets/ask_sheet.dart';
import 'package:mockmob/features/review/data/repair_check_api.dart';
import 'package:mockmob/features/review/data/repair_check_controller.dart';
import 'package:mockmob/features/review/data/repair_check_logic.dart';
import 'package:mockmob/features/review/screens/repair_screen.dart';
import 'package:mockmob/features/review/widgets/repair_check_section.dart';

import '../../golden/insights/insights_golden_support.dart' show insightsOverrides;
import '../../golden/review/review_golden_support.dart' show credits, runOf;
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'support/repair_check_fixtures.dart';
import 'support/repair_v3_fixtures.dart';

/// Repair v4, "Ask Mobi about Qn" and "Check it held" on the repair screen, state by state, against
/// a fake check API. The contract is `test/fixtures/repair4/contract_check_v1.json`.
const _attempt = 'm7';
const _question = 'm7-q0';

/// A v3 repair as the server sends it, with the check field of [status] (a contract example).
Map<String, dynamic> _body({String? status = 'ready', bool noCheck = false}) => {
      ...v3Json(),
      if (!noCheck) 'check': {...examples()[status]! as Map<String, dynamic>, 'href': '/api/recovery/check?attemptId=$_attempt&questionId=$_question', 'askHref': '/mentor?tab=ask&q=$_attempt:$_question'},
    };

AiCredits _paused() => AiCredits.fromJson({'state': 'paused', 'wallet': {'state': 'paused', 'known': true, 'total': 9}});
AiCredits _unreadable() => AiCredits.fromJson({'state': 'error', 'wallet': {'state': 'error', 'known': false}});

List<Override> _overrides({String? status = 'ready', bool noCheck = false, FakeCheckApi? api, AiCredits? wallet, bool noWallet = false}) => [
      ...v3Overrides(v3Outcome(_body(status: status, noCheck: noCheck)), insights: v3Insights(), credits: noWallet ? null : (wallet ?? credits(9))),
      repairCheckApiProvider.overrideWithValue(api ?? FakeCheckApi()),
    ];

Future<void> _pump(WidgetTester tester, List<Override> overrides, {Size size = const Size(390, 3200), Brightness brightness = Brightness.dark, double textScale = 1}) async {
  await pumpMockmob(
    tester,
    const RepairScreen(attemptId: _attempt, questionId: _question),
    size: size,
    brightness: brightness,
    textScale: textScale,
    disableAnimations: true,
    wrapInScaffold: false,
    overrides: overrides,
  );
  // The check asks for its question once the repair is on screen.
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 50));
}

/// Past the key's tap lock, so the next tap on it is a new tap.
Future<void> _past(WidgetTester tester) => tester.pump(const Duration(seconds: 2));

Future<void> _settle(WidgetTester tester) async {
  for (var i = 0; i < 4; i++) {
    await tester.pump(const Duration(milliseconds: 60));
  }
}

double _y(WidgetTester tester, Finder f) => tester.getTopLeft(f.first).dy;

/// One KeyButton by its label (it draws its label twice, once as a width reserve).
Finder _keys(String label) => find.widgetWithText(KeyButton, label);
Finder _key(String label) => _keys(label).first;

Finder _row(String text) => find.widgetWithText(MmSelectRow, text);

const _options = ['Debit Cash, credit Goodwill', 'Debit Goodwill, credit the sacrificing partners', 'Debit Premium, credit Capital', 'Debit Revaluation, credit Goodwill'];

void main() {
  setUpAll(loadAppFonts);
  final number = runOf().steps.first.item.number;
  final askLabel = 'Ask Mobi about Q$number';

  group('what the repair draws', () {
    testWidgets('no check field (an older server, a held repair) draws neither Ask nor the check', (tester) async {
      final api = FakeCheckApi();
      await _pump(tester, _overrides(noCheck: true, api: api));
      expect(find.text('Check it held'), findsNothing);
      expect(find.textContaining('Ask Mobi about'), findsNothing);
      expect(api.loads, 0, reason: 'nothing is asked for');
      // The rest of the repair is as it was.
      expect(find.text('From your record'), findsOneWidget);
    });

    testWidgets('Ask comes first, then the check, both after the rule and before "From your record"', (tester) async {
      await _pump(tester, _overrides());
      await _settle(tester);
      expect(find.text('Check it held'), findsOneWidget);
      expect(_keys(askLabel), findsWidgets);
      final rule = _y(tester, find.text('Keep this'));
      final ask = _y(tester, _key(askLabel));
      final check = _y(tester, find.text('Check it held'));
      final record = _y(tester, find.text('From your record'));
      expect(rule < ask, isTrue, reason: 'the rule is read before the follow-ups');
      expect(ask < check, isTrue, reason: 'Ask belongs to the mistake, so it sits before the check');
      expect(check < record, isTrue);
    });
  });

  group('Ask Mobi about the mistake, from the wallet', () {
    testWidgets('an available wallet: the link names the mistake by its number, with the price and what Mobi sees', (tester) async {
      await _pump(tester, _overrides());
      expect(_keys(askLabel), findsWidgets);
      expect(find.textContaining('One written reply uses 1 credit. You have 9. Mobi sees Q$number, your pick, the key and your rule, and nothing else about you.'), findsOneWidget);
    });

    testWidgets('paused: no link, one line, and nothing about a price or free asking', (tester) async {
      await _pump(tester, _overrides(wallet: _paused()));
      expect(_keys(askLabel), findsNothing);
      expect(find.text('Written replies are paused right now. Nothing is charged.'), findsOneWidget);
      expect(find.textContaining('One written reply'), findsNothing);
      expect(find.textContaining('free'), findsNothing);
    });

    testWidgets('no credits: no link, and the line says Mobi cannot write a reply and that nothing is charged', (tester) async {
      await _pump(tester, _overrides(wallet: credits(0)));
      expect(_keys(askLabel), findsNothing);
      expect(find.text('You have no credits left, so Mobi cannot write a reply. Nothing is charged.'), findsOneWidget);
    });

    testWidgets('an unreadable wallet says so, and that nothing is charged', (tester) async {
      await _pump(tester, _overrides(wallet: _unreadable()));
      expect(_keys(askLabel), findsNothing);
      expect(find.text('Your credits could not be read just now, so Mobi cannot write a reply. Nothing is charged.'), findsOneWidget);
    });

    testWidgets('before the wallet is read nothing is shown, so nothing is shown and then taken back', (tester) async {
      await _pump(tester, _overrides(noWallet: true));
      expect(_keys(askLabel), findsNothing);
      expect(find.textContaining('Nothing is charged'), findsNothing);
      expect(find.textContaining('written reply'), findsNothing);
      // The place is held (48 dp), and the check below does not wait for it.
      expect(find.text('Check it held'), findsOneWidget);
    });

    testWidgets('Ask Mobi opens over the repair about the mistake being repaired, never the check question', (tester) async {
      // The /ask deep link still names the same mistake.
      expect(askAboutLocation(_attempt, _question), '/ask?q=m7%3Am7-q0');
      tester.view.physicalSize = const Size(390, 800) * 2;
      tester.view.devicePixelRatio = 2;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            // The record and the wallet as the sheet reads them (the wallet holds 9 credits).
            ...insightsOverrides(realAsk: true, credits: credits(9)),
            askSheetQuestionProvider.overrideWith(_NoQuestion.new),
          ],
          child: MaterialApp(
            theme: buildTheme(Brightness.dark),
            home: const Scaffold(body: AskAboutMistake(attemptId: _attempt, questionId: _question, number: 3)),
          ),
        ),
      );
      await tester.pump();
      expect(find.text('Ask Mobi about Q3'), findsWidgets);
      await tester.tap(find.byType(KeyButton));
      await tester.pumpAndSettle();
      expect(find.byType(AskMobiSheet), findsOneWidget);
      final container = ProviderScope.containerOf(tester.element(find.byType(AskMobiSheet)));
      final about = container.read(askSheetScopeProvider).context;
      expect(about.question!.ref, 'm7:m7-q0');
      expect(about.chipLabel, 'Q3');
      await tester.pump(const Duration(seconds: 13));
    });
  });

  group('Check it held: the question', () {
    testWidgets('loading: one plain line and the shape of the question, then the question with four rows of 48 dp or more', (tester) async {
      final wait = Completer<void>();
      final api = FakeCheckApi(onLoad: (_) async {
        await wait.future;
        return readyLoad();
      });
      await _pump(tester, _overrides(api: api));
      expect(find.text('Finding a question you have not seen.'), findsOneWidget);
      expect(find.byType(Skeleton), findsWidgets);
      expect(find.byType(MmSelectRow), findsNothing, reason: 'no question before it arrives');
      wait.complete();
      await _settle(tester);
      expect(find.text('Finding a question you have not seen.'), findsNothing);
      for (final o in _options) {
        expect(_row(o), findsOneWidget);
        expect(tester.getSize(_row(o)).height, greaterThanOrEqualTo(48), reason: o);
      }
      expect(find.text('Same topic: Goodwill'), findsOneWidget);
      expect(find.text('Of the 41 questions in this chapter, 7 are new to you and can be used for a check.'), findsOneWidget);
      expect(find.textContaining('One new question on the same topic that you have not seen. It comes with this repair, so there is no extra credit.'), findsOneWidget);
      // Nothing about the answer before the answer.
      expect(find.text('Key'), findsNothing);
      expect(find.text('Explanation'), findsNothing);
      expect(find.text('Your first answer counts.'), findsNothing, reason: 'with no pick the note asks for one first');
      expect(find.text('Pick one option. Your first answer counts.'), findsOneWidget);
    });

    testWidgets('the rows are one radio group: one pick at a time, with selected and radio semantics', (tester) async {
      final handle = tester.ensureSemantics();
      await _pump(tester, _overrides());
      await _settle(tester);
      SemanticsData data(String text) => tester.getSemantics(_row(text)).getSemanticsData();
      expect(data(_options[0]).flagsCollection.isInMutuallyExclusiveGroup, isTrue, reason: 'radio semantics');
      expect(data(_options[0]).flagsCollection.isSelected, Tristate.isFalse);
      await tester.tap(_row(_options[2]));
      await tester.pump();
      expect(data(_options[2]).flagsCollection.isSelected, Tristate.isTrue);
      await tester.tap(_row(_options[0]));
      await tester.pump();
      expect(data(_options[0]).flagsCollection.isSelected, Tristate.isTrue);
      expect(data(_options[2]).flagsCollection.isSelected, Tristate.isFalse, reason: 'the first pick lets go');
      handle.dispose();
    });

    testWidgets('the submit key waits for a pick, then sends the position the student saw with a request id of the contract\'s pattern', (tester) async {
      final api = FakeCheckApi();
      await _pump(tester, _overrides(api: api));
      await _settle(tester);
      final submit = _key('Check my answer');
      expect(submit, findsOneWidget);
      await tester.tap(submit);
      await tester.pump();
      expect(api.submits, isEmpty, reason: 'nothing to send without a pick');
      await tester.tap(_row(_options[2]));
      await tester.pump();
      await tester.tap(submit);
      await _settle(tester);
      final sent = api.submits.single;
      expect((sent.attemptId, sent.questionId, sent.checkQuestionId, sent.pick), (_attempt, _question, 'q_fresh_1', 2));
      expect(HttpRepairCheckApi.requestIdPattern.hasMatch(sent.requestId), isTrue, reason: sent.requestId);
    });

    testWidgets('the lead follows the basis: idea, topic, chapter, and nothing tied before the server says', (tester) async {
      final api = FakeCheckApi(onLoad: (_) => readyLoad(basis: 'concept'));
      await _pump(tester, _overrides(api: api));
      await _settle(tester);
      expect(find.textContaining('on the same idea'), findsOneWidget);
    });

    testWidgets('a question from the same chapter says so', (tester) async {
      final api = FakeCheckApi(onLoad: (_) => readyLoad(basis: 'chapter'));
      await _pump(tester, _overrides(api: api));
      await _settle(tester);
      expect(find.textContaining('from the same chapter'), findsOneWidget);
    });
  });

  group('Check it held: the answer', () {
    Future<void> answerWith(WidgetTester tester, FakeCheckApi api, int pick, {List<Override>? overrides}) async {
      await _pump(tester, overrides ?? _overrides(api: api));
      await _settle(tester);
      await tester.tap(_row(_options[pick]));
      await tester.pump();
      await tester.tap(_key('Check my answer'));
      await _settle(tester);
    }

    testWidgets('right: the verdict, one row that is your pick and the key, the explanation, and Revise', (tester) async {
      final api = FakeCheckApi(onSubmit: (_, _) => answer(right: true));
      await answerWith(tester, api, 1);
      expect(find.text('Right on a new question from the same topic. One question is a check, not a measure.'), findsOneWidget);
      // The receipt counts only this run's checks that were answered: one answered, one held.
      final fixed = tester.widget<Text>(find.byKey(const ValueKey('check-receipt'))).data!;
      expect(fixed, startsWith('Fixed. This '));
      expect(fixed, contains('Mock 2'));
      expect(fixed, endsWith('Held 1 of 1.'));
      expect(find.text('Your pick and the key'), findsOneWidget);
      expect(find.text('Key'), findsNothing);
      expect(find.text('Your pick'), findsNothing);
      expect(find.text('Explanation'), findsOneWidget);
      expect(find.textContaining('Goodwill brought in by the new partner is credited'), findsOneWidget);
      expect(find.text('Your rule'), findsNothing, reason: 'the rule is for a miss');
      expect(find.textContaining('Revise. This mistake comes back', findRichText: true), findsOneWidget);
      // The submit key and the first-answer note are gone with the question.
      expect(find.text('Check my answer'), findsNothing);
      expect(find.text('Your first answer counts.'), findsNothing);
      // Every option is still shown, in the order the student saw them.
      for (final o in _options) {
        expect(find.textContaining(o), findsOneWidget);
      }
    });

    testWidgets('missed: the key row and the pick row in words, the explanation, "Your rule", and both cards in Revise', (tester) async {
      final api = FakeCheckApi(onSubmit: (_, _) => answer(pick: 2));
      await answerWith(tester, api, 2);
      expect(find.text('Missed on a new question from the same topic.'), findsOneWidget);
      final notYet = tester.widget<Text>(find.byKey(const ValueKey('check-receipt'))).data!;
      expect(notYet, startsWith('Not yet. This '));
      expect(notYet, endsWith('Held 0 of 1.'));
      expect(find.text('Key'), findsOneWidget);
      expect(find.text('Your pick'), findsOneWidget);
      expect(find.text('Your pick and the key'), findsNothing);
      // The key row sits at option B, the pick row at option C.
      expect(_y(tester, find.textContaining(_options[1])) < _y(tester, find.textContaining(_options[2])), isTrue);
      expect(find.text('Your rule'), findsOneWidget);
      expect(find.text('Split the sacrifice before you subtract.'), findsWidgets);
      expect(find.textContaining('Revise. Both come back', findRichText: true), findsOneWidget);
      expect(find.textContaining('this mistake and the question you just missed.', findRichText: true), findsOneWidget);
    });

    testWidgets('no Revise line when the server wrote no cards, and no explanation line when the bank has none', (tester) async {
      final api = FakeCheckApi(
        onSubmit: (_, _) => CheckAnswer(
          result: CheckResult.tryParse({...resultJson(noRevise: true), 'explanation': ''})!,
          replayed: false,
        ),
      );
      await answerWith(tester, api, 2);
      expect(find.textContaining('Revise.', findRichText: true), findsNothing);
      expect(find.textContaining('comes back', findRichText: true), findsNothing);
      expect(find.text('Explanation'), findsNothing);
      expect(find.text('Your rule'), findsOneWidget);
    });

    testWidgets('the Revise day is worked out from its due day: a stored answer opened days later does not say tomorrow', (tester) async {
      final api = FakeCheckApi(
        onSubmit: (_, _) => CheckAnswer(
          result: CheckResult.tryParse(resultJson(right: true, revise: {'scheduled': true, 'dueDay': '2020-01-02', 'whenLabel': 'tomorrow', 'cards': 1}))!,
          replayed: false,
        ),
      );
      await answerWith(tester, api, 1);
      expect(find.textContaining('This mistake comes back today.', findRichText: true), findsOneWidget, reason: 'a due day that has passed is today');
    });

    testWidgets('a check already answered (status answered) opens on the stored answer, with no submit key', (tester) async {
      final api = FakeCheckApi(
        onLoad: (_) => CheckLoad.tryParse({'ok': true, 'status': 'answered', 'check': checkJson(), 'result': resultJson()})!,
      );
      await _pump(tester, _overrides(status: 'answered', api: api));
      await _settle(tester);
      expect(find.text('You answered this check earlier. The first answer counts.'), findsOneWidget);
      expect(find.text('Missed on a new question from the same topic.'), findsOneWidget);
      expect(find.text('Key'), findsOneWidget);
      expect(find.text('Check my answer'), findsNothing);
      expect(find.byType(MmSelectRow), findsNothing, reason: 'nothing to pick any more');
    });

    testWidgets('the key never shows before the answer, in any row', (tester) async {
      await _pump(tester, _overrides());
      await _settle(tester);
      expect(find.text('Key'), findsNothing);
      expect(find.text('Your pick'), findsNothing);
    });
  });

  group('Check it held: the states that are not a question', () {
    testWidgets('none: the reason in the server\'s words, no retry for a reason trying again cannot fix, and no pool line', (tester) async {
      final api = FakeCheckApi();
      await _pump(tester, _overrides(status: 'none', api: api));
      await _settle(tester);
      expect(find.text('Check it held'), findsOneWidget);
      expect(find.text('No unseen question on this idea yet.'), findsOneWidget);
      expect(find.text('Try again'), findsNothing);
      expect(find.byType(MmSelectRow), findsNothing);
      expect(find.textContaining('One new question'), findsNothing, reason: 'no lead for a question that is not there');
      expect(api.loads, 0, reason: 'the repair already said there is nothing to ask for');
    });

    testWidgets('unchecked: the reason, with a retry that asks for the question', (tester) async {
      final api = FakeCheckApi();
      await _pump(tester, _overrides(status: 'unchecked', api: api));
      await _settle(tester);
      expect(find.text('The check is not available right now. Nothing was charged.'), findsOneWidget);
      await tester.tap(_key('Try again'));
      await _settle(tester);
      expect(api.loads, 1);
      expect(find.byType(MmSelectRow), findsNWidgets(4));
      expect(find.text('The check is not available right now. Nothing was charged.'), findsNothing);
    });

    testWidgets('a question that could not be loaded: plain words, nothing charged, and Try again', (tester) async {
      final api = FakeCheckApi(onLoad: (call) {
        if (call == 0) throw const ApiError(kind: ApiErrorKind.network, code: 'network');
        return readyLoad();
      });
      await _pump(tester, _overrides(api: api));
      await _settle(tester);
      expect(find.text('The question could not be loaded. Nothing was charged.'), findsOneWidget);
      await tester.tap(_key('Try again'));
      await _settle(tester);
      expect(find.byType(MmSelectRow), findsNWidgets(4));
      expect(find.text('The question could not be loaded. Nothing was charged.'), findsNothing);
    });

    testWidgets('a lookup that failed on the server is a reason that may work next time', (tester) async {
      final api = FakeCheckApi(onLoad: (_) => throw ApiError.fromResponse(503, {'ok': false, 'status': 'none', 'error': 'lookup_failed', 'reason': 'lookup_failed', 'message': RepairCheckReasons.lookupFailed}));
      await _pump(tester, _overrides(api: api));
      await _settle(tester);
      expect(find.text(RepairCheckReasons.lookupFailed), findsOneWidget);
      expect(_keys('Try again'), findsWidgets);
    });

    testWidgets('a mark that did not come back keeps the question and the pick, says the answer counts once, and sends the same request id again', (tester) async {
      var fail = true;
      final api = FakeCheckApi(onSubmit: (_, _) {
        if (fail) throw const ApiError(kind: ApiErrorKind.timeout, code: 'timeout');
        return answer(pick: 2);
      });
      await _pump(tester, _overrides(api: api));
      await _settle(tester);
      await tester.tap(_row(_options[2]));
      await tester.pump();
      await tester.tap(_key('Check my answer'));
      await _settle(tester);
      expect(find.text('We could not confirm the mark. Try again. Your answer is counted once.'), findsOneWidget);
      expect(find.byType(MmSelectRow), findsNWidgets(4), reason: 'the question stays');
      expect(tester.widget<MmSelectRow>(_row(_options[2])).selected, isTrue, reason: 'and so does the pick');
      expect(_keys('Try again'), findsWidgets);
      fail = false;
      await _past(tester);
      await tester.tap(_key('Try again'));
      await _settle(tester);
      expect(api.submits, hasLength(2));
      expect(api.submits[1].requestId, api.submits[0].requestId, reason: 'a retry is the same action: the answer counts once');
      expect(api.submits[1].pick, 2);
      expect(find.text('Missed on a new question from the same topic.'), findsOneWidget);
    });

    testWidgets('a withdrawn question: the words, rows that stop taking taps, and one way on: another question', (tester) async {
      var changed = true;
      final api = FakeCheckApi(
        onLoad: (call) => readyLoad(id: 'q_fresh_${call + 1}'),
        onSubmit: (_, _) {
          if (changed) throw ApiError.fromResponse(409, {'ok': false, 'error': 'check_changed', 'message': RepairCheckReasons.checkChanged});
          return answer();
        },
      );
      await _pump(tester, _overrides(api: api));
      await _settle(tester);
      await tester.tap(_row(_options[2]));
      await tester.pump();
      await tester.tap(_key('Check my answer'));
      await _settle(tester);
      expect(find.text('That question was withdrawn before it was marked. Nothing was recorded.'), findsOneWidget);
      expect(_keys('Get another question'), findsWidgets);
      expect(find.text('Check my answer'), findsNothing);
      expect(find.text('Your first answer counts.'), findsNothing, reason: 'a withdrawn question has no first answer to count');
      // The old rows are readable but dead, and the old pick is no longer lit.
      expect(tester.widget<MmSelectRow>(_row(_options[2])).onTap, isNull);
      expect(tester.widget<MmSelectRow>(_row(_options[2])).selected, isFalse);
      changed = false;
      await _past(tester);
      await tester.tap(_key('Get another question'));
      await _settle(tester);
      expect(api.loads, 2);
      expect(tester.widget<MmSelectRow>(_row(_options[2])).onTap, isNotNull);
      await tester.tap(_row(_options[2]));
      await tester.pump();
      await _past(tester);
      await tester.tap(_key('Check my answer'));
      await _settle(tester);
      expect(api.submits.last.checkQuestionId, 'q_fresh_2', reason: 'the new question is the one marked');
      expect(api.submits.last.requestId, isNot(api.submits.first.requestId), reason: 'a new question is a new action');
    });
  });

  group('the controller owns the check', () {
    testWidgets('the question and the pick live in the controller, so the run keeps them', (tester) async {
      final api = FakeCheckApi();
      await _pump(tester, _overrides(api: api));
      await _settle(tester);
      await tester.tap(_row(_options[3]));
      await tester.pump();
      expect(tester.widget<MmSelectRow>(_row(_options[3])).selected, isTrue);
      final container = ProviderScope.containerOf(tester.element(find.byType(RepairScreen)));
      final view = container.read(repairCheckProvider((attemptId: _attempt, questionId: _question)));
      expect(view.phase, CheckPhase.ready);
      expect(view.pick, 3);
      expect(api.loads, 1, reason: 'one question is asked for, once');
    });
  });
}

class _NoQuestion extends AskQuestionController {
  @override
  AskQuestionHand? build() => null;

  @override
  Future<void> open(String? raw) async {}
}
