// Mobi v13 (MOBI-CONTRACT, 20 Oct): Where you stand reads every state honestly; a doubt opens a thread for 1 credit with
// its 2 real CUET questions answered in place and one free follow-up, then closes and offers a new doubt; failures
// say nothing was charged; "Fix it for good" is offered on a wrong answer with its price before the tap.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/api/api_providers.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/insights/data/ai_reply_report.dart' show insightsPrefsStoreProvider;
import 'package:mockmob/features/insights/data/ask_controller.dart';
import 'package:mockmob/features/insights/data/ask_doors.dart';
import 'package:mockmob/features/insights/data/ask_mobi_context.dart';
import 'package:mockmob/features/insights/data/mobi_models.dart';
import 'package:mockmob/features/insights/screens/ask_screen.dart';
import 'package:mockmob/features/insights/widgets/ask_doors.dart';
import 'package:mockmob/features/insights/widgets/ask_sheet.dart' show fixTarget, FixKeyCopy;
import 'package:mockmob/features/insights/widgets/doubt_thread.dart';
import 'package:mockmob/features/insights/widgets/where_you_stand.dart';

import '../../golden/insights/insights_golden_support.dart';
import '../../helpers/golden_harness.dart';
import '../core_data/support/fakes.dart';

const _wallet = {
  'tier': 'free',
  'isPaid': false,
  'aiWallet': {'state': 'available', 'known': true, 'spendable': true, 'total': 17, 'includedRemaining': 17, 'includedMonthlyCredits': 50, 'bonusCredits': 0, 'resetAt': '2026-10-31T18:30:00.000Z'},
};

Map<String, Object?> _check(String id) => {
      'checkQuestionId': id,
      'subject': 'accountancy',
      'chapter': 'Partnership Fundamentals',
      'topic': 'Admission',
      'format': 'mcq',
      'question': 'Question $id about a new profit-sharing ratio?',
      'passage': null,
      'options': [
        for (var i = 0; i < 4; i++) {'index': i, 'text': '$id option $i'},
      ],
    };

Map<String, Object?> _reply({required int left, int amount = 1, bool checks = true}) => {
      'ok': true,
      'sessionId': 's-1',
      'reply': 'Here is how CUET asks it.',
      'origin': 'model',
      'actions': [],
      'charge': {'creditUnits': amount, 'amount': amount, 'reference': 'prepos:u1:x'},
      'usageSnapshot': _wallet,
      'thread': {'id': 't1', 'followUpsLeft': left, 'followUpsMax': 1, 'subject': 'accountancy', 'chapter': 'Partnership Fundamentals'},
      'checks': checks ? [_check('c1'), _check('c2')] : [],
      'checksNote': null,
    };

Map<String, Object?> _body(RecordedRequest r) => Map<String, Object?>.from(r.body! as Map);

void main() {
  group('Where you stand, read from the server', () {
    test('ready, partial, thin and empty each parse; a ready standing without a band is not shown as a range', () {
      final ready = MobiStanding.tryParse({
        'ok': true,
        'status': 'ready',
        'band': {'low': 612.4, 'mid': 648, 'high': 684.2, 'max': 1000, 'count': 4, 'complete': true, 'papers': []},
        'colleges': [
          {'college': 'Hindu College', 'programme': 'B.Com (Hons)', 'cutoff': 712, 'category': 'UR', 'position': 'below', 'gap': 63.6},
        ],
        'first': {'college': 'Hindu College', 'programme': 'B.Com (Hons)', 'cutoff': 712, 'category': 'UR', 'position': 'below', 'gap': 63.6},
        'closeFastest': [
          {'subject': 'accountancy', 'subjectName': 'Accountancy', 'chapter': 'Partnership', 'marks': 38, 'href': '/test?subject=accountancy&mode=quick&count=10&chapter=Partnership'},
          {'subject': 'economics', 'subjectName': 'Economics', 'chapter': 'Money', 'marks': 0},
        ],
        'links': {'practice': '/dashboard?mode=chapter&subject=<s>&chapter=<c>'},
      })!;
      expect(ready.status, StandingStatus.ready);
      expect(ready.closeFastest, hasLength(1), reason: 'a chapter with no open marks is not a way to close the gap');
      expect(ready.practiceHref(ready.closeFastest.single), startsWith('/test?subject=accountancy'), reason: 'the server link wins');
      expect(StandCopy.against(ready.first!), 'Hindu College, B.Com (Hons) closed at 712 for UR in 2026 Round 1. You are 64 marks short at the middle of your range.');
      expect(StandCopy.rangeSentence(WhereYouStand.marks(612.4), WhereYouStand.marks(684.2), 1000), 'Your practice puts you at 612 to 684 of 1000.');
      expect(ready.note, MobiStanding.defaultNote);

      final noBand = MobiStanding.tryParse({'ok': true, 'status': 'ready', 'band': null, 'thin': []})!;
      expect(noBand.status, StandingStatus.empty);
      final thin = MobiStanding.tryParse({
        'ok': true,
        'status': 'thin',
        'thin': [
          {'subject': 'accountancy', 'name': 'Accountancy', 'needed': 12},
        ],
      })!;
      expect(thin.thin.single.needed, 12);
      expect(MobiStanding.tryParse({'ok': false, 'error': 'standing_unavailable'}), isNull);
      expect(MobiStanding.defaultNote, 'From your own practice, before NTA normalisation. Not a prediction.');
    });

    test('the words never promise: no prediction, no exclamation marks, no middle dots', () {
      for (final s in [
        StandCopy.fromFour,
        StandCopy.noColleges,
        StandCopy.partialNext(const ['English']),
        StandCopy.thinLead(30),
        AskDoorCopy.nowLine,
        AskDoorCopy.threadDone,
        AskDoorCopy.threadDoneBody,
        AskDoorCopy.followUpLeft,
        DoubtCopy.lead,
        FixKeyCopy.line,
        FixKeyCopy.storedLine,
      ]) {
        expect(s.contains('!'), isFalse, reason: s);
        expect(s.contains('·'), isFalse, reason: s);
        expect(s.toLowerCase().contains('predict'), isFalse, reason: s);
      }
      expect('${FixKeyCopy.fix} ${FixKeyCopy.price}', 'Fix it for good, 1 credit');
    });
  });

  group('a doubt thread', () {
    test('thread_full and thread_not_found are their own failures, and say nothing was charged', () {
      expect(askFailureFor(const ApiError(kind: ApiErrorKind.conflict, code: 'thread_full', status: 409)), AskFailure.threadFull);
      expect(askFailureFor(const ApiError(kind: ApiErrorKind.notFound, code: 'thread_not_found', status: 404)), AskFailure.threadGone);
    });

    testWidgets('a starter opens a doubt with its chapter; its 2 questions are answered in place; one free follow-up, then a new doubt', (tester) async {
      final http = FakeHttpAdapter();
      var chats = 0;
      http.handler = (o) {
        if (o.path.contains('/mentor/chat')) {
          chats++;
          return FakeReply(200, chats == 1 ? _reply(left: 1) : _reply(left: 0, amount: 0, checks: false));
        }
        if (o.path.contains('/api/mobi/thread')) {
          return const FakeReply(200, {
            'ok': true,
            'replayed': false,
            'result': {
              'right': true,
              'pick': 1,
              'key': {'index': 1, 'text': 'c1 option 1'},
              'picked': {'index': 1, 'text': 'c1 option 1'},
              'explanation': 'The bank explains it.',
              'line': 'Right. That is the new ratio.',
            },
          });
        }
        return const FakeReply(200, {});
      };
      await pumpMockmob(
        tester,
        const AskScreen(),
        brightness: Brightness.dark,
        size: const Size(412, 2600),
        disableAnimations: true,
        overrides: [
          ...insightsOverrides(realAsk: true),
          apiClientProvider.overrideWithValue(newApiClient(http, now: () => DateTime.utc(2026, 10, 13, 15))),
          insightsPrefsStoreProvider.overrideWithValue(MemoryPrefsStore()),
        ],
        wrapInScaffold: false,
      );
      await tester.pumpAndSettle();
      final starter = find.descendant(of: find.byType(AskNowDoor), matching: find.byType(AskStarterRow)).first;
      await tester.tap(starter);
      await tester.pumpAndSettle();

      final chat = http.requests.where((r) => r.path.contains('/mentor/chat')).toList();
      expect(chat, hasLength(1));
      final sent = _body(chat.single);
      expect(sent['subject'], isNotNull);
      expect(sent['chapter'], isNotNull, reason: 'a starter from the record names its chapter');
      expect(sent['replyKind'], 'doubt');
      expect(sent.containsKey('threadId'), isFalse);

      expect(find.byType(DoubtChecks), findsOneWidget);
      expect(find.text(DoubtCopy.title), findsOneWidget);
      expect(find.text(AskDoorCopy.followUpLeft), findsOneWidget, reason: 'the composer says the follow-up is free');

      await tester.tap(find.text('c1 option 1'));
      await tester.pump();
      await tester.tap(find.text('Check my answer').first);
      await tester.pumpAndSettle();
      final answer = _body(http.requests.lastWhere((r) => r.path.contains('/api/mobi/thread')));
      expect(answer['op'], 'answer');
      expect(answer['threadId'], 't1');
      expect(answer['checkQuestionId'], 'c1');
      expect(answer['pick'], 1);
      expect(find.text('Right. That is the new ratio.'), findsOneWidget);
      expect(find.text('The bank explains it.'), findsOneWidget);

      await tester.enterText(find.byType(TextField).last, 'Why equally?');
      await tester.testTextInput.receiveAction(TextInputAction.send);
      await tester.pumpAndSettle();
      final follow = _body(http.requests.where((r) => r.path.contains('/mentor/chat')).last);
      expect(follow['threadId'], 't1');
      expect(follow.containsKey('replyKind'), isFalse, reason: 'a follow-up is never sent as a new doubt');
      expect(find.byType(DoubtClosed), findsOneWidget);
      expect(find.text(AskDoorCopy.newDoubt), findsOneWidget);
    });

    testWidgets('What should I revise tonight is sent as the free record plan', (tester) async {
      final http = FakeHttpAdapter()
        ..handler = (o) => const FakeReply(200, {
              'ok': true,
              'reply': 'Tonight, revise Partnership.',
              'origin': 'record',
              'charge': {'creditUnits': 0, 'amount': 0},
              'actions': [
                {'label': 'Open Revise', 'type': 'navigate', 'route': '/review/revise'},
              ],
            });
      await pumpMockmob(
        tester,
        const AskScreen(),
        brightness: Brightness.light,
        size: const Size(412, 2200),
        disableAnimations: true,
        overrides: [
          ...insightsOverrides(realAsk: true),
          apiClientProvider.overrideWithValue(newApiClient(http, now: () => DateTime.utc(2026, 10, 13, 15))),
          insightsPrefsStoreProvider.overrideWithValue(MemoryPrefsStore()),
        ],
        wrapInScaffold: false,
      );
      await tester.pumpAndSettle();
      final ask = find.text(AskDoorCopy.revise(DateTime.utc(2026, 10, 13, 15)));
      await tester.ensureVisible(ask);
      await tester.tap(ask);
      await tester.pumpAndSettle();
      expect(_body(http.requests.singleWhere((r) => r.path.contains('/mentor/chat')))['replyKind'], 'tonight');
      expect(find.text('Open Revise'), findsOneWidget);
    });
  });

  group('Fix it for good, from Ask Mobi about Q7', () {
    test('offered for a wrong answer of an attempt, never for a right one or a loose question', () {
      final wrong = AskMobiContext.question(number: 7, ref: 'm7:m7-q6', pickLetter: 'A', keyLetter: 'B').question;
      expect(fixTarget(wrong), (attemptId: 'm7', questionId: 'm7-q6'));
      expect(fixTarget(AskMobiContext.question(number: 7, ref: 'm7:m7-q6', pickLetter: 'B', keyLetter: 'B').question), isNull);
      expect(fixTarget(AskMobiContext.question(number: 7, stem: 'A question').question), isNull);
    });
  });
}
