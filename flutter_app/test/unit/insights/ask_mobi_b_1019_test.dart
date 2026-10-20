// Ask Mobi option B (ASK-MOBI-1019; the owner's D112 and D114; C-pick 2): Ask Mobi's own screen with
// two big doors, "Ask now" and "Ask your record". These lock the build's contract:
// * a fresh record says "Your record is empty for now." with one key; a heavy one leads with its
//   biggest leak as a real figure;
// * every starter says "Free", "1 credit" or a Pro lock before the tap, and a tap sends at once with
//   no consent sheet (D53);
// * Pro asks stay visible with a quiet lock (D101): a calm sheet with Play billing off, the Upgrade
//   sheet with it on;
// * a written reply waits honestly ("Writing a reply"), never typing a fake reply;
// * "Why did I lose marks in my last paper?" is answered free from that paper on the phone;
// * the labelled "Ask Mobi" key sits in the Today, Practice and Mob headers, and Practice's card
//   takes the old "Ask Mobi what to practise" slot;
// * Mobi never greets the student by an email prefix (G16 findings 4 and 38).
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/api/api_providers.dart';
import 'package:mockmob/core/auth/display_name.dart' show shownFirstName;
import 'package:mockmob/core/mascot/mascot.dart' show MobiRation;
import 'package:mockmob/core/models/ai_credits.dart';
import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/widgets/widgets.dart' show KeyButton, Mobi, TabRootHeader;
import 'package:mockmob/features/insights/copy.dart';
import 'package:mockmob/features/insights/data/ai_reply_report.dart' show insightsPrefsStoreProvider;
import 'package:mockmob/features/insights/data/ask_controller.dart';
import 'package:mockmob/features/insights/data/ask_doors.dart';
import 'package:mockmob/features/insights/data/ask_wallet.dart';
import 'package:mockmob/features/insights/data/insights_models.dart';
import 'package:mockmob/features/insights/insights_routes.dart' show askScreen;
import 'package:mockmob/features/insights/screens/ask_screen.dart';
import 'package:mockmob/features/insights/screens/insights_screen.dart';
import 'package:mockmob/features/insights/widgets/ask_doors.dart';
import 'package:mockmob/features/insights/widgets/ask_mobi_button.dart';
import 'package:mockmob/features/insights/widgets/ask_mobi_card.dart';
import 'package:mockmob/features/insights/widgets/ask_prompts.dart' show AskIntent;
import 'package:mockmob/features/insights/widgets/insights_bits.dart' show ProRow;
import 'package:mockmob/features/pro_nudge/copy.dart' show ProNudgeCopy, ProReason;
import 'package:mockmob/features/today/logic/today_model.dart' show HeaderModel;
import 'package:mockmob/features/today/widgets/today_header.dart';
import 'package:mockmob/features/you/widgets/you_page.dart';

import '../../golden/insights/insights_golden_support.dart';
import '../../helpers/golden_harness.dart';
import '../core_data/support/fakes.dart';
import '../pro_nudge/pro_nudge_test_support.dart';
import 'support/insights_fixtures.dart';

/// The wallet as `GET /api/ai/credits` sends it: Free's 50 a month, none bought.
AiCredits monthly({int total = 38}) => AiCredits.fromJson({
      'ok': true,
      'state': 'available',
      'isPaid': false,
      'wallet': {
        'state': 'available',
        'known': true,
        'spendable': true,
        'includedMonthlyCredits': 50,
        'includedRemaining': total,
        'bonusCredits': 0,
        'total': total,
        'resetAt': '2026-10-31T18:30:00.000Z',
      },
    });

Map<String, Object?> modelReply() => {
      'ok': true,
      'sessionId': 's-1',
      'reply': 'The sacrificing ratio is the share each old partner gives up.',
      'origin': 'model',
      'actions': [],
      'charge': {'kind': 'prepos_credit', 'creditUnits': 1, 'amount': 1, 'reference': 'prepos:u1:x'},
      'usageSnapshot': {
        'tier': 'free',
        'isPaid': false,
        'aiWallet': {'state': 'available', 'known': true, 'spendable': true, 'total': 37, 'includedRemaining': 37, 'includedMonthlyCredits': 50, 'bonusCredits': 0, 'resetAt': '2026-10-31T18:30:00.000Z'},
      },
    };

void main() {
  final evening = DateTime.utc(2026, 10, 13, 15);

  group('the doors, read from the record', () {
    test('Mobi never greets by an email prefix; a real first name is used', () {
      // One rule for every screen (core/auth/display_name.dart), the Ask screen's greeting included.
      expect(shownFirstName('g16-fresh-1019a', email: 'g16-fresh-1019a@example.com'), isNull);
      expect(shownFirstName('riya', email: 'Riya@example.com'), isNull, reason: 'the server stores the email part as the name');
      expect(shownFirstName('student42'), isNull);
      expect(shownFirstName('Riya Sharma', email: 'riya.s@example.com'), 'Riya');
      expect(shownFirstName('  ', email: 'a@b.c'), isNull);
      expect(shownFirstName(null, email: 'a@b.c'), isNull);
    });

    test('the greetings are whole sentences, with no number words broken (finding 38)', () {
      expect(InsightsCopy.askGreeting(null, 1), "Hi. I've read your first paper. Ask me anything about it.");
      expect(InsightsCopy.askGreeting('Riya', 25), "Hi Riya. I've read your latest 25 papers. Ask me anything about them.");
      expect(InsightsCopy.askGreeting(null, 0), 'Hi. Stuck on a CUET doubt? Ask me.');
      expect(AskDoorCopy.greetFresh(null), 'Hi. Stuck on a CUET doubt? Ask me.');
      expect(AskDoorCopy.greetHeavy('Riya', 25), 'Hi Riya. Ask me any doubt, or ask what your 25 papers say.');
      expect(AskDoorCopy.greetHeavy(null, 1), 'Hi. Ask me any doubt, or ask what your first paper says.');
    });

    test('Mobi reads at most the last 60 papers, and the lines say so past that (verifier L5)', () {
      expect(AskDoorCopy.recordLine(25), 'Mobi reads your 25 papers and answers from them.');
      expect(AskDoorCopy.recordLine(60), 'Mobi reads your latest 60 papers and answers from them.');
      expect(AskDoorCopy.recordLine(61), 'Mobi reads your latest 60 papers and answers from them.');
      expect(AskDoorCopy.greetHeavy('Riya', 60), 'Hi Riya. Ask me any doubt, or ask what your latest 60 papers say.');
      expect(AskDoorCopy.greetHeavy('Riya', 59), 'Hi Riya. Ask me any doubt, or ask what your 59 papers say.');
    });

    test('Ask now always has three starters: doubts on the weakest chapters, each sent with its chapter; else the student subjects', () {
      final heavy = askNowStarters(record: rich(), subjects: const ['accountancy', 'economics']);
      expect(heavy, hasLength(3));
      final lead = recordLead(rich())!;
      expect(heavy.first.text, 'My marks keep slipping in ${lead.chapter}. Explain it the CUET way.');
      expect(heavy.first.chapter, lead.chapter, reason: 'the server attaches 2 bank questions on that chapter');
      expect(heavy.first.subject, isNotNull);
      expect(heavy.every((s) => s.chapter != null), isTrue, reason: 'the rich record ranks at least three chapters');
      expect(askNowStarters(subjects: const ['physics']), hasLength(3), reason: 'a set with one starter is filled from English and the General Test');
      final fresh = askNowStarters();
      expect(fresh, hasLength(3));
      expect({for (final s in fresh) s.text}, hasLength(3));
      expect(fresh.every((s) => s.chapter == null && s.subject != null), isTrue, reason: 'no record: the subject only, a chapter is never guessed');
    });

    test('a heavy record: the lead is the biggest leak, every ask says its price, Pro asks are locked on Free', () {
      final last = lastPaper(trendAttempts(), evening);
      final asks = recordDoorAsks(rich(), pro: false, last: last, now: evening);
      expect(asks, hasLength(7), reason: '"See all 7 questions about your record"');
      final lead = recordLead(rich())!;
      expect(asks.first.text, 'Where are my marks slipping?');
      expect(asks.first.price, DoorPrice.free);
      expect(asks.first.preview, '${lead.lost} marks slipped in ${lead.chapter}');
      DoorAsk byText(String t) => asks.firstWhere((a) => a.text == t);
      expect(byText('Which chapter should I practise?').price, DoorPrice.free);
      expect(byText(AskDoorCopy.lastPaper).price, DoorPrice.free);
      expect(byText(AskDoorCopy.revise(evening)).price, DoorPrice.free, reason: 'tonight is worked out from the record with no model (C-dec 3)');
      expect(byText('Am I too slow on wrong answers?').price, DoorPrice.pro);
      expect(byText('Do I change answers too much?').price, DoorPrice.pro, reason: 'locked for Free, as the app already treats it (D101)');
      expect(byText('How is my week going?').price, DoorPrice.free);

      final onPro = recordDoorAsks(rich(), pro: true, last: last, now: evening);
      expect(onPro.where((a) => a.locked), isEmpty);
    });

    test('with no paper on the phone the last-paper ask is left out, never made up', () {
      expect(lastPaper(const [], evening), isNull);
      expect(recordDoorAsks(rich(), pro: false, now: evening), hasLength(6));
    });

    test('the last-paper answer reads that paper only, free, with a way to it', () {
      final last = lastPaper(trendAttempts(), evening)!;
      expect(last.attempt.id, 'a4', reason: 'the newest paper');
      expect(last.answer.reply, startsWith(lastPaperLead));
      expect(last.answer.reply, contains('Accountancy'));
      expect(last.answer.actions.single.$2, '/practice/result/a4', reason: 'a practice set opens the practice result');
    });

    test('a paper whose result is still sealed is never read, scored or linked (verifier M4)', () {
      // a4 (newest) and a3 are unopened: the answer is e1, a full mock, and says it is the last one opened.
      final last = lastPaper(trendAttempts(), evening, unopened: {'a4', 'a3'})!;
      expect(last.attempt.id, 'e1');
      expect(last.answer.reply, startsWith(lastOpenedPaperLead));
      expect(last.answer.reply, isNot(startsWith(lastPaperLead)));
      expect(last.answer.actions.single.$2, '/result/e1', reason: 'a mock opens the mock result');
      expect(last.preview, contains('Economics'));
      // Only the newest is sealed: the next one is read and a practice set opens the practice result.
      final next = lastPaper(trendAttempts(), evening, unopened: {'a4'})!;
      expect(next.attempt.id, 'a3');
      expect(next.answer.actions.single.$2, '/practice/result/a3');
      // An unopened paper older than the one read changes nothing: it is still "your last paper".
      final older = lastPaper(trendAttempts(), evening, unopened: {'a1'})!;
      expect(older.attempt.id, 'a4');
      expect(older.answer.reply, startsWith(lastPaperLead));
      // Nothing opened yet: the ask is left out, never answered from a sealed paper.
      expect(lastPaper(trendAttempts(), evening, unopened: {'a1', 'a2', 'e1', 'a3', 'a4'}), isNull);
      expect(recordDoorAsks(rich(), pro: false, now: evening), hasLength(6));
    });

    test('the credit line is the wallet: of your 50 monthly, the real renewal day, or nothing invented', () {
      final w = AskWallet.fromCredits(monthly());
      expect(creditLineWords(w, renew: renewDay(w, evening)).$1, '38 of your 50 free credits left\u00a0· they refill\u00a01\u00a0Nov');
      expect(creditLineWords(w, renew: '1 November').$2, 'Answers from your record are free. A doubt uses 1 credit, with its follow-up and 2 new CUET-style questions.');
      expect(creditLineWords(w, renew: '1 November', oneBalance: true).$1, '38 credits left\u00a0· free ones refill\u00a01\u00a0Nov');
      expect(creditLineWords(null, renew: '1 November').$1, AskDoorCopy.creditsUnknown, reason: 'an unknown balance is never a zero');
      expect(creditLineWords(w.withTotal(0), renew: '1 November').$1, 'You have no credits left. Your free credits refill on 1 November.');
    });
  });

  group('the screen', () {
    setUp(() {
      MobiRation.reset();
      addTearDown(MobiRation.reset);
    });

    Future<void> pump(WidgetTester tester, {RemoteState<PrepInsights>? record, List<Attempt>? attempts, Size size = const Size(384, 900), List<Override> extra = const []}) =>
        pumpMockmob(
          tester,
          const AskScreen(),
          brightness: Brightness.dark,
          size: size,
          disableAnimations: true,
          overrides: [...insightsOverrides(insights: record, attempts: attempts, credits: monthly()), ...extra],
          wrapInScaffold: false,
        );

    testWidgets('a fresh account: Ask now works at once; the record door says it is empty, with one key', (tester) async {
      await pump(tester, record: RemoteState(value: empty()), attempts: const []);
      await tester.pumpAndSettle();
      expect(find.text(AskDoorCopy.nowTitle), findsOneWidget);
      expect(find.text(AskDoorCopy.recordTitle), findsOneWidget);
      expect(find.text(AskDoorCopy.emptySay), findsOneWidget);
      expect(find.text(AskDoorCopy.emptyKey), findsOneWidget);
      expect(find.text(AskDoorCopy.emptyAfter), findsOneWidget);
      // At 384 dp a fresh account shows two starters, each priced before the tap.
      final now = find.byType(AskNowDoor);
      expect(find.descendant(of: now, matching: find.byType(AskStarterRow)), findsNWidgets(2));
      expect(find.descendant(of: now, matching: find.text(AskDoorCopy.oneCredit)), findsNWidgets(2));
      expect(find.text(AskDoorCopy.nowTipFresh), findsOneWidget);
      // The credit line is the wallet's own numbers.
      expect(find.text('38 of your 50 free credits left\u00a0· they refill\u00a01\u00a0Nov'), findsOneWidget);
    });

    testWidgets('a heavy account: the record door leads with the real figure and says Free', (tester) async {
      await pump(tester);
      await tester.pumpAndSettle();
      final lead = recordLead(rich())!;
      expect(find.text('${lead.lost}'), findsOneWidget);
      expect(find.text(AskDoorCopy.leadFigureLine(lead.chapter)), findsOneWidget);
      expect(find.text(AskDoorCopy.recordLine(rich().sessions)), findsOneWidget);
      expect(find.text(AskDoorCopy.emptySay), findsNothing);
      // Heavy at 384 dp: one Ask now starter, so the record door's figure stays in view.
      expect(find.descendant(of: find.byType(AskNowDoor), matching: find.byType(AskStarterRow)), findsOneWidget);
      // "See all 7" opens every record ask, each with its price.
      await tester.scrollUntilVisible(find.text(AskDoorCopy.seeAll(7)), 200, scrollable: find.byType(Scrollable).first);
      await tester.tap(find.text(AskDoorCopy.seeAll(7)));
      await tester.pumpAndSettle();
      final record = find.byType(AskRecordDoor);
      expect(find.descendant(of: record, matching: find.byType(AskPriceTag)), findsNWidgets(7));
      expect(find.descendant(of: record, matching: find.text(AskDoorCopy.pro)), findsNWidgets(2), reason: 'pace and changes: visible but locked');
      expect(find.descendant(of: record, matching: find.text(AskDoorCopy.oneCredit)), findsNothing, reason: 'the revision plan is free now');
    });

    testWidgets('at 360 dp a heavy account shows no starter and says where they are; a tap into the field brings all three', (tester) async {
      await pump(tester, size: const Size(360, 800));
      await tester.pumpAndSettle();
      final now = find.byType(AskNowDoor);
      expect(find.descendant(of: now, matching: find.byType(AskStarterRow)), findsNothing);
      expect(find.text(AskDoorCopy.nowTapBox), findsOneWidget);
      await tester.tap(find.descendant(of: now, matching: find.byType(TextField)));
      await tester.pumpAndSettle();
      expect(find.descendant(of: now, matching: find.byType(AskStarterRow)), findsNWidgets(3));
      expect(find.text(AskDoorCopy.nowTip), findsOneWidget);
    });

    for (final scale in [1.0, 1.3]) {
      for (final heavy in [true, false]) {
        testWidgets('M4: at 360 by 640 and text $scale every key of the doors scrolls clear of the credits footer (${heavy ? 'heavy' : 'fresh'} record)', (tester) async {
          await pumpMockmob(
            tester,
            const AskScreen(),
            brightness: Brightness.dark,
            size: const Size(360, 640),
            textScale: scale,
            disableAnimations: true,
            overrides: insightsOverrides(insights: heavy ? null : RemoteState(value: empty()), attempts: heavy ? null : const [], credits: monthly()),
            wrapInScaffold: false,
          );
          await tester.pumpAndSettle();
          final scroll = find.byType(Scrollable).first;
          // To the end of the page, whatever its length at this text size.
          final position = (tester.state(scroll) as ScrollableState).position;
          position.jumpTo(position.maxScrollExtent);
          await tester.pumpAndSettle();
          final footerTop = tester.getRect(find.byType(AskCreditLine)).top;
          final keys = find.descendant(of: find.byType(AskRecordDoor), matching: find.byWidgetPredicate((w) => w is KeyButton || w is AskStarterRow || w is AskPriceTag));
          expect(keys, findsWidgets);
          for (final k in keys.evaluate()) {
            expect(tester.getRect(find.byWidget(k.widget)).bottom, lessThanOrEqualTo(footerTop + 0.5), reason: 'the end of the doors clears the footer');
          }
          expect(tester.getRect(find.byType(AskRecordDoor)).bottom, lessThanOrEqualTo(footerTop + 0.5), reason: 'the whole record door clears the footer once scrolled to the end');
        });
      }
    }

    // M4, the layout (V11 truth audit): the credit line was pinned under the page, so at 360 dp the
    // "Ask your record" key sat under it at rest. Now the line ends the scrolling page: it is never over
    // any key at any scroll position, and at 360 by 800 a student with papers sees both doors named on the first screen.
    for (final height in [640.0, 800.0]) {
      for (final scale in [1.0, 1.3]) {
        for (final heavy in [true, false]) {
          testWidgets('M4: at 360 by ${height.round()} and text $scale the credit line scrolls with the page and never covers a key (${heavy ? 'heavy' : 'fresh'} record)', (tester) async {
            await pumpMockmob(
              tester,
              const AskScreen(),
              brightness: Brightness.dark,
              size: Size(360, height),
              textScale: scale,
              disableAnimations: true,
              overrides: insightsOverrides(insights: heavy ? null : RemoteState(value: empty()), attempts: heavy ? null : const [], credits: monthly()),
              wrapInScaffold: false,
            );
            await tester.pumpAndSettle();
            final line = find.byType(AskCreditLine);
            expect(line, findsOneWidget, reason: 'the credit line is still on the page (R3: moved, never hidden)');
            expect(find.descendant(of: find.byType(SingleChildScrollView), matching: line), findsOneWidget, reason: 'it scrolls with the doors, never pinned over them');
            final keys = find.descendant(of: find.byType(AskRecordDoor), matching: find.byWidgetPredicate((w) => w is KeyButton || w is AskStarterRow || w is AskPriceTag));
            expect(keys, findsWidgets);
            if (heavy && height == 800 && scale == 1.0) {
              expect(tester.getRect(find.text(AskDoorCopy.recordTitle)).bottom, lessThanOrEqualTo(height), reason: 'both ways in are named on the first screen');
            }
            final position = (tester.state(find.byType(Scrollable).first) as ScrollableState).position;
            for (var at = 0.0;; at = (at + 80).clamp(0.0, position.maxScrollExtent)) {
              position.jumpTo(at);
              await tester.pump();
              final cover = tester.getRect(line);
              for (final k in keys.evaluate()) {
                final r = tester.getRect(find.byWidget(k.widget));
                expect(r.overlaps(cover.deflate(0.5)), isFalse, reason: 'a key under the credit line at scroll $at');
              }
              if (at >= position.maxScrollExtent) break;
            }
          });
        }
      }
    }

    testWidgets('a starter sends at once with no sheet first (D53), and the wait says "Writing a reply"', (tester) async {
      final http = FakeHttpAdapter()
        ..handler = ((o) => FakeReply(200, modelReply()))
        ..hold = Completer<void>();
      await pumpMockmob(
        tester,
        const AskScreen(),
        brightness: Brightness.dark,
        size: const Size(384, 900),
        disableAnimations: true,
        overrides: [
          ...insightsOverrides(realAsk: true, credits: monthly()),
          apiClientProvider.overrideWithValue(newApiClient(http, now: () => evening)),
          insightsPrefsStoreProvider.overrideWithValue(MemoryPrefsStore()),
        ],
        wrapInScaffold: false,
      );
      await tester.pumpAndSettle();
      final starter = find.descendant(of: find.byType(AskNowDoor), matching: find.byType(AskStarterRow)).first;
      await tester.tap(starter);
      for (var i = 0; i < 5; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }
      expect(find.byType(BottomSheet), findsNothing, reason: 'no consent sheet');
      expect(http.requests.where((r) => r.path.contains('/mentor/chat')), hasLength(1));
      expect(find.text(InsightsCopy.askThinking), findsOneWidget);
      expect(InsightsCopy.askThinking, 'Writing a reply');
      expect(find.text(AskDoorCopy.writingNote), findsOneWidget);
      http.hold!.complete();
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pump(const Duration(seconds: 2));
      expect(find.text(InsightsCopy.askThinking), findsNothing);
      await tester.pump(const Duration(seconds: 13));
    });

    testWidgets('"Why did I lose marks in my last paper?" is answered free on the phone, no request sent', (tester) async {
      final http = FakeHttpAdapter()..handler = (o) => FakeReply(200, modelReply());
      await pumpMockmob(
        tester,
        const AskScreen(),
        brightness: Brightness.dark,
        size: const Size(384, 900),
        disableAnimations: true,
        overrides: [
          ...insightsOverrides(realAsk: true, credits: monthly()),
          apiClientProvider.overrideWithValue(newApiClient(http, now: () => evening)),
          insightsPrefsStoreProvider.overrideWithValue(MemoryPrefsStore()),
        ],
        wrapInScaffold: false,
      );
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(find.text(AskDoorCopy.seeAll(7)), 200, scrollable: find.byType(Scrollable).first);
      await tester.tap(find.text(AskDoorCopy.seeAll(7)));
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(find.text(AskDoorCopy.lastPaper), 200, scrollable: find.byType(Scrollable).first);
      await tester.tap(find.text(AskDoorCopy.lastPaper));
      await tester.pump(const Duration(milliseconds: 600));
      await tester.pump(const Duration(seconds: 2));
      expect(http.requests.where((r) => r.path.contains('/mentor/chat')), isEmpty);
      expect(find.textContaining(lastPaperLead), findsWidgets);
      await tester.pump(const Duration(seconds: 13));
    });

    testWidgets('a Pro ask on Free, billing off: a calm sheet with no price and no link; nothing is sent', (tester) async {
      await pump(tester);
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(find.text(AskDoorCopy.seeAll(7)), 200, scrollable: find.byType(Scrollable).first);
      await tester.tap(find.text(AskDoorCopy.seeAll(7)));
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(find.text('Am I too slow on wrong answers?'), 200, scrollable: find.byType(Scrollable).first);
      await tester.tap(find.text('Am I too slow on wrong answers?'));
      await tester.pumpAndSettle();
      expect(find.text(AskDoorCopy.proPaceTitle), findsOneWidget);
      expect(find.text(AskDoorCopy.proSoon), findsOneWidget);
      expect(find.textContaining('₹'), findsNothing);
      expect(find.textContaining('Rs'), findsNothing);
      expect(find.textContaining('mockmob.in'), findsNothing);
    });

    for (final b in Brightness.values) {
      for (final heavy in [false, true]) {
        testWidgets('${b.name}, ${heavy ? 'heavy' : 'fresh'}: no overflow at 360 by 800 and 1.3 text', (tester) async {
          await pumpMockmob(
            tester,
            const AskScreen(),
            brightness: b,
            size: const Size(360, 800),
            textScale: 1.3,
            disableAnimations: true,
            overrides: insightsOverrides(insights: heavy ? null : RemoteState(value: empty()), attempts: heavy ? null : const [], credits: monthly()),
            wrapInScaffold: false,
          );
          await tester.pumpAndSettle();
          expect(tester.takeException(), isNull);
          expect(find.text(AskDoorCopy.nowTitle), findsOneWidget);
          expect(find.text('Back'), findsOneWidget, reason: 'the labelled Back key (D43)');
        });
      }
    }

    testWidgets("with no credits left the stage says so once: the band takes the credit line's place", (tester) async {
      await pumpMockmob(
        tester,
        const AskScreen(),
        brightness: Brightness.dark,
        size: const Size(360, 800),
        disableAnimations: true,
        overrides: insightsOverrides(credits: monthly(total: 0)),
        wrapInScaffold: false,
      );
      await tester.pumpAndSettle();
      expect(find.text(InsightsCopy.outTitle), findsOneWidget);
      expect(find.byType(AskCreditLine), findsNothing);
      expect(find.text(AskDoorCopy.recordTitle), findsOneWidget);
      // Where the door sits is font-dependent; the real-font golden ask_b_heavy_360_no_credits shows it above the band.
    });

    const lastTalk = AskState(messages: [
      AskMessage.student('Explain the sacrificing ratio in simple words'),
      AskMessage.reply('The sacrificing ratio is the share each old partner gives up.', origin: AskOrigin.model),
    ]);

    testWidgets('an ordinary open keeps the last conversation, and "Ask something new" brings back the two doors', (tester) async {
      await pumpMockmob(
        tester,
        const AskScreen(),
        brightness: Brightness.dark,
        size: const Size(384, 900),
        disableAnimations: true,
        overrides: insightsOverrides(credits: monthly(), ask: lastTalk),
        wrapInScaffold: false,
      );
      await tester.pumpAndSettle();
      expect(find.byType(AskNowDoor), findsNothing, reason: 'the conversation is still there, as in v15.2');
      expect(find.text(AskDoorCopy.startOver), findsWidgets);
      await tester.tap(find.text(AskDoorCopy.startOver).first);
      await tester.pumpAndSettle();
      expect(find.byType(AskNowDoor), findsOneWidget);
      expect(find.byType(AskRecordDoor), findsOneWidget);
    });

    testWidgets("a door chosen on Practice's card opens at the doors, even after a conversation", (tester) async {
      await pumpMockmob(
        tester,
        const AskScreen(door: AskDoor.record),
        brightness: Brightness.dark,
        size: const Size(384, 900),
        disableAnimations: true,
        overrides: insightsOverrides(credits: monthly(), ask: lastTalk),
        wrapInScaffold: false,
      );
      await tester.pumpAndSettle();
      expect(find.byType(AskRecordDoor), findsOneWidget);
      expect(find.text(AskDoorCopy.startOver), findsNothing);
    });

    testWidgets('?door=record and ?door=now reach the screen; anything else opens at the top', (tester) async {
      AskScreen? built;
      final router = GoRouter(
        initialLocation: '/ask?door=record',
        routes: [
          GoRoute(
            path: '/ask',
            builder: (context, state) {
              final w = askScreen(context, state) as AskScreen;
              built = w;
              return const SizedBox();
            },
          ),
        ],
      );
      await tester.pumpWidget(MaterialApp.router(routerConfig: router));
      expect(built!.door, AskDoor.record);
      router.go('/ask?door=now');
      await tester.pumpAndSettle();
      expect(built!.door, AskDoor.now);
      router.go('/ask?door=elsewhere');
      await tester.pumpAndSettle();
      expect(built!.door, isNull);
    });
  });

  group('Pro, visible but locked (D101)', () {
    testWidgets('with Play billing on, the Pro ask opens the Upgrade sheet instead of the calm one', (tester) async {
      final rig = NudgeRig(on: true);
      await pumpNudges(tester, Builder(builder: (context) => TextButton(onPressed: () => showAskProSheet(context, AskIntent.pace), child: const Text('open'))), rig);
      await tester.tap(find.text('open'));
      await settleNudges(tester);
      expect(find.text(ProNudgeCopy.head(ProReason.insightsPace).title), findsOneWidget);
      expect(find.text(AskDoorCopy.proPaceTitle), findsNothing);
    });

    testWidgets('with Play billing off, the calm sheet', (tester) async {
      final rig = NudgeRig(on: false);
      await pumpNudges(tester, Builder(builder: (context) => TextButton(onPressed: () => showAskProSheet(context, AskIntent.changes), child: const Text('open'))), rig);
      await tester.tap(find.text('open'));
      await settleNudges(tester);
      expect(find.text(AskDoorCopy.proChangesTitle), findsOneWidget);
      expect(find.textContaining(playProPrice), findsNothing);
    });
  });

  group('the record screen, Pro rows visible but locked (D101, R3)', () {
    testWidgets('a Free student sees Changed answers, Pace and the locked chapters with billing off; a tap says what Pro adds, with no price', (tester) async {
      await pumpMockmob(
        tester,
        const InsightsScreen(),
        brightness: Brightness.dark,
        size: const Size(384, 900),
        disableAnimations: true,
        overrides: insightsOverrides(),
        wrapInScaffold: false,
      );
      await tester.pumpAndSettle();
      final list = find.byType(Scrollable).first;
      await tester.scrollUntilVisible(find.text(InsightsCopy.proMore(1)), 200, scrollable: list);
      expect(find.text(InsightsCopy.proMore(1)), findsOneWidget, reason: 'the chapters past the free three');
      await tester.scrollUntilVisible(find.text(InsightsCopy.proChanges), 200, scrollable: list);
      expect(find.text(InsightsCopy.proChanges), findsOneWidget);
      await tester.scrollUntilVisible(find.text(InsightsCopy.proPace), 200, scrollable: list);
      expect(find.text(InsightsCopy.proPace), findsOneWidget);
      await tester.tap(find.text(InsightsCopy.proPace));
      await tester.pumpAndSettle();
      expect(find.text(AskDoorCopy.proPaceTitle), findsOneWidget);
      expect(find.textContaining('₹'), findsNothing);
      expect(find.textContaining('mockmob.in'), findsNothing);
    });

    testWidgets('with billing off the chapters row opens the calm sheet', (tester) async {
      await pumpNudges(tester, const Padding(padding: EdgeInsets.all(16), child: ProRow('1 more chapter with Pro', reason: ProReason.insightsChapters)), NudgeRig(on: false));
      await tester.tap(find.byType(ProRow));
      await settleNudges(tester);
      expect(find.text(AskDoorCopy.proChaptersTitle), findsOneWidget);
      expect(find.textContaining(playProPrice), findsNothing);
    });

    testWidgets('with billing on the same row opens the Upgrade sheet', (tester) async {
      await pumpNudges(tester, const Padding(padding: EdgeInsets.all(16), child: ProRow('1 more chapter with Pro', reason: ProReason.insightsChapters)), NudgeRig(on: true));
      await tester.tap(find.byType(ProRow));
      await settleNudges(tester);
      expect(find.text(ProNudgeCopy.head(ProReason.insightsChapters).title), findsOneWidget);
      expect(find.text(AskDoorCopy.proChaptersTitle), findsNothing);
    });
  });

  group('the ways in', () {
    testWidgets('Today: the header carries the labelled Ask Mobi key, with Mobi or his mark', (tester) async {
      var taps = 0;
      const header = HeaderModel(dateLine: 'Monday 13 October', greeting: 'Good evening');
      await pumpMockmob(tester, TodayHeader(header: header, onMobi: () => taps++), size: const Size(412, 200), disableAnimations: true, overrides: insightsOverrides());
      expect(find.byType(AskMobiButton), findsOneWidget);
      expect(find.text(AskDoorCopy.button), findsOneWidget);
      expect(find.bySemanticsLabel(AskDoorCopy.button), findsOneWidget);
      // At 360 dp it says "Ask Mobi" too, like the Mob and Practice tabs (the owner's v16 walk).
      await pumpMockmob(tester, TodayHeader(header: header, onMobi: () => taps++), size: const Size(360, 200), disableAnimations: true, overrides: insightsOverrides());
      expect(find.text(AskDoorCopy.button), findsOneWidget);
      expect(find.text(AskDoorCopy.buttonShort), findsNothing);
      // With large text on a phone this narrow the greeting needs the room back: "Ask" beside Mobi, still spoken as "Ask Mobi".
      await pumpMockmob(tester, TodayHeader(header: header, onMobi: () => taps++), size: const Size(360, 200), textScale: 1.3, disableAnimations: true, overrides: insightsOverrides());
      expect(find.text(AskDoorCopy.buttonShort), findsOneWidget);
      expect(find.bySemanticsLabel(AskDoorCopy.button), findsOneWidget);
      await pumpMockmob(tester, TodayHeader(header: header, onMobi: () => taps++), size: const Size(360, 200), disableAnimations: true, overrides: insightsOverrides());
      expect(find.bySemanticsLabel(AskDoorCopy.button), findsOneWidget);
      await tester.tap(find.byType(AskMobiButton));
      await tester.pump();
      expect(taps, 1);
      await pumpMockmob(tester, TodayHeader(header: header, showMobi: false, onMobi: () => taps++), size: const Size(360, 200), disableAnimations: true, overrides: insightsOverrides());
      expect(find.byType(AskMobiButton), findsOneWidget, reason: 'the key stays while the move card holds Mobi');
      expect(find.byType(Mobi), findsNothing, reason: 'never two Mobis: the key carries his flat mark');
    });

    testWidgets('Mob: the page header carries the key at its end', (tester) async {
      await pumpMockmob(
        tester,
        const YouPage(title: 'Mob', trailing: AskMobiButton(), children: [SizedBox(height: 10)]),
        size: const Size(360, 400),
        disableAnimations: true,
        overrides: insightsOverrides(),
        wrapInScaffold: false,
      );
      expect(find.byType(AskMobiButton), findsOneWidget);
      expect(find.text(AskDoorCopy.button), findsOneWidget);
    });

    testWidgets('a tab header fits the key beside its title at 360 dp', (tester) async {
      await pumpMockmob(
        tester,
        const TabRootHeader(title: 'Practice', trailing: AskMobiButton()),
        size: const Size(360, 120),
        disableAnimations: true,
        overrides: insightsOverrides(),
      );
      expect(tester.takeException(), isNull);
      expect(tester.getSize(find.byType(AskMobiButton)).height, greaterThanOrEqualTo(48));
    });

    testWidgets("Practice's card: one line for what Mobi is for, and the two doors as keys", (tester) async {
      await pumpMockmob(tester, const SingleChildScrollView(child: AskMobiCard()), size: const Size(360, 600), disableAnimations: true, overrides: insightsOverrides());
      final lead = recordLead(rich())!;
      expect(find.text(AskDoorCopy.cardTitle), findsOneWidget);
      expect(find.text(AskDoorCopy.cardLineHeavy(lead.lost, lead.chapter)), findsOneWidget);
      expect(find.text(AskDoorCopy.cardNow), findsOneWidget);
      expect(find.text(AskDoorCopy.cardRecord), findsOneWidget);
    });

    testWidgets("Practice's card on a fresh account says what Mobi is for, with no figure made up", (tester) async {
      await pumpMockmob(
        tester,
        const SingleChildScrollView(child: AskMobiCard()),
        size: const Size(360, 600),
        disableAnimations: true,
        overrides: insightsOverrides(insights: RemoteState(value: empty()), attempts: const []),
      );
      expect(find.text(AskDoorCopy.cardLineFresh), findsOneWidget);
      expect(find.text(AskDoorCopy.cardNow), findsOneWidget);
      expect(find.text(AskDoorCopy.cardRecord), findsOneWidget);
    });
  });
}
