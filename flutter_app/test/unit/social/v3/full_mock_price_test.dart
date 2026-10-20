// Full mock together pricing (owner D174, D175): Pro starts it; a Free member pays 50 credits to sit one a friend
// started; Pro sits free; there is no free first full mock. The app shows what the server will enforce, so these
// tests pin the server's contract (APP-API-CONTRACT 2.12: starts.mock and a game's price, camelCase; the codes
// MOCK_PRO_REQUIRED and MOCK_CREDITS), the plain copy and the one honest way to Pro in the row and in the sit sheet.

import 'dart:convert';
import 'dart:io';

import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/features/social/data/mob_models.dart' show MobRead;
import 'package:mockmob/features/social/v3/copy_v3.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_models.dart';
import 'package:mockmob/features/social/v3/widgets/play_picker_sheet.dart';
import 'package:mockmob/features/social/v3/widgets/sit_mock_sheet.dart';
import 'package:mockmob/features/social/v3/widgets/start_game_sheet.dart';

import '../../../helpers/golden_harness.dart' show settleImages;
import 'mob_v3_test_kit.dart';
import 'sheets_test_kit.dart';

final _price = RegExp(r'₹|\$|\bRs\b|per month', caseSensitive: false);

void main() {
  setUp(loadFoldManifestForTest);

  group('the server contract (APP-API-CONTRACT 2.12, camelCase)', () {
    Map<String, dynamic> fx(String n) => jsonDecode(File('test/fixtures/mob_v3/server/$n.json').readAsStringSync()) as Map<String, dynamic>;

    test("a Free member's starts: the mock is locked, priced 50, Pro starts it, Pro sits free", () {
      final s = StartRight.fromJson(fx('starts_free'));
      expect(s.mock?.costCredits, 50);
      expect(s.mock?.sitCredits, 50);
      expect(s.mock?.proRequiredToStart, isTrue);
      expect(s.mock?.canStart, isFalse);
      expect(s.mock?.proSitsFree, isTrue);
      expect(s.mockNeedsPro, isTrue);
      expect(s.mockCanStart, isFalse);
      expect(s.mockCost, 50);
      expect(s.freeMockPrice, 50);
      expect(s.shows(GameFormat.mock), isTrue);
      expect(s.allows(GameFormat.mock), isFalse);
    });

    test("a Pro member's starts: can start, pays nothing, still names the Free price", () {
      final s = StartRight.fromJson(fx('starts_pro'));
      expect(s.mock?.canStart, isTrue);
      expect(s.mockNeedsPro, isFalse);
      expect(s.mockCost, 0);
      expect(s.freeMockPrice, 50);
      expect(s.allows(GameFormat.mock), isTrue);
    });

    test('used and mic: still locked and priced', () {
      for (final n in ['starts_used', 'starts_mic']) {
        final s = StartRight.fromJson(fx(n));
        expect(s.mockNeedsPro, isTrue, reason: n);
        expect(s.mockCost, 50, reason: n);
      }
    });

    test('billing off does not unlock it for a Free member: the den says locked, not billingOn', () {
      final den = MobRead.fromJson(fx('den_get'));
      final s = den.v3!.starts;
      expect(s.billingOn, isFalse);
      expect(s.mockNeedsPro, isTrue);
      expect(s.shows(GameFormat.mock), isTrue);
    });

    test('a block the server does not send hides every price, and the locked list alone still locks', () {
      final bare = StartRight.fromJson({'billingOn': true, 'can': true, 'via': 'free_weekly', 'locked': ['mock']});
      expect(bare.mock, isNull);
      expect(bare.freeMockPrice, isNull);
      expect(bare.mockCost, 0);
      expect(bare.mockNeedsPro, isTrue);
      final none = StartRight.fromJson({'billingOn': true, 'can': true, 'via': 'free_weekly', 'formats': ['sprint', 'round']});
      expect(none.shows(GameFormat.mock), isFalse, reason: 'formats off: the row is not drawn');
      expect(none.mockNeedsPro, isFalse);
    });

    test('a game carries price: costCredits is what starting costs you now', () {
      final den = MobRead.fromJson(fx('den_get_formats'));
      final mock = den.v3!.games.firstWhere((g) => g.format == GameFormat.mock);
      expect(mock.price?.costCredits, 0, reason: 'already finished: never charged again');
      expect(mock.price?.sitCredits, 50);
      expect(mock.price?.proSitsFree, isTrue);
      final race = den.v3!.games.firstWhere((g) => g.format == GameFormat.race);
      expect(race.price, isNull, reason: 'other formats have no price');
      final open = MobGame.fromEnvelope(fx('game_open_mock'));
      expect(open.price?.costCredits, 0);
      expect(open.price?.sitCredits, 50);
    });

    test("mockSitCost: the game's own costCredits; nothing once begun, for Pro, or with no price", () {
      final free = StartRight.fromJson(fx('starts_free'));
      MobGameSummary g({YourRun yourRun = YourRun.none, MockPrice? price}) => MobGameSummary(id: 'g1', format: GameFormat.mock, count: 50, minutes: 60, yourRun: yourRun, price: price);
      const fifty = MockPrice(costCredits: 50, sitCredits: 50, proSitsFree: true);
      expect(mockSitCost(g(price: fifty), free), 50);
      expect(mockSitCost(g(price: const MockPrice(costCredits: 0, sitCredits: 50)), free), 0);
      expect(mockSitCost(g(yourRun: YourRun.playing, price: fifty), free), 0);
      expect(mockSitCost(g(yourRun: YourRun.finished, price: fifty), free), 0);
      expect(mockSitCost(const MobGameSummary(id: 'r', format: GameFormat.race), free), 0);
      expect(mockSitCost(g(), StartRight.fromJson(fx('starts_pro'))), 0);
    });

    test("both error codes carry the server's sentence and a code the client branches on", () {
      for (final code in ['MOCK_PRO_REQUIRED', 'MOCK_CREDITS']) {
        final e = (fx('errors_v3')[code] as Map)['body']['error'] as Map;
        final err = ApiError(kind: code == 'MOCK_CREDITS' ? ApiErrorKind.paymentRequired : ApiErrorKind.forbidden, code: code, status: code == 'MOCK_CREDITS' ? 402 : 403);
        expect(MobV3Copy.error(err), e['message'], reason: code);
      }
      final refused = (fx('game_open_mock_free')['body'] as Map)['error'] as Map;
      expect(refused['code'], 'MOCK_PRO_REQUIRED');
      expect((refused['detail'] as Map)['sitCredits'], 50);
    });
  });

  group('the fixture server follows the same contract', () {
    test('Free pays once when the paper starts, Pro pays nothing, and a short balance is MOCK_CREDITS', () {
      final s = v3Server(scenario: 'mock', billing: 'free');
      expect(s.credits, 112);
      s.sitMock('game-riya-mock');
      expect(s.credits, 62);
      final again = MobGameSummary.fromJson((s.denNow()['v3'] as Map<String, dynamic>)['games'].firstWhere((g) => (g as Map)['id'] == 'game-riya-mock') as Map<String, dynamic>);
      expect(again.yourRun, YourRun.finished);
      expect(again.price?.costCredits, 0);

      final pro = v3Server(scenario: 'mock', billing: 'pro')..credits = 0;
      pro.sitMock('game-riya-mock');
      expect(pro.credits, 0);

      final poor = v3Server(scenario: 'mock', billing: 'free')..credits = 49;
      expect(() => poor.sitMock('game-riya-mock'), throwsA(isA<ApiError>().having((e) => e.code, 'code', 'MOCK_CREDITS').having((e) => e.status, 'status', 402)));
      expect(poor.credits, 49, reason: 'a refusal charges nothing');
    });

    test('a Free member cannot start one: MOCK_PRO_REQUIRED, billing on or off', () async {
      for (final billing in ['off', 'free']) {
        final s = v3Server(scenario: 'quiet', billing: billing);
        await expectLater(
          s.openGame(mob: (s.denNow()['mob'] as Map<String, dynamic>)['id'] as String, format: GameFormat.mock, mode: GameMode.async, count: 50),
          throwsA(isA<ApiError>().having((e) => e.code, 'code', 'MOCK_PRO_REQUIRED').having((e) => e.status, 'status', 403)),
          reason: billing,
        );
      }
    });

    test('the den carries starts.mock and a price on every mock game', () {
      Map<String, dynamic> starts(String b) => (v3Server(scenario: 'mock', billing: b).denNow()['v3'] as Map<String, dynamic>)['starts'] as Map<String, dynamic>;
      const free = {'costCredits': 50, 'sitCredits': 50, 'proRequiredToStart': true, 'canStart': false, 'proSitsFree': true};
      expect(starts('free')['mock'], free);
      expect(starts('off')['mock'], free);
      expect(starts('pro')['mock'], {'costCredits': 0, 'sitCredits': 50, 'proRequiredToStart': true, 'canStart': true, 'proSitsFree': true});
      expect(starts('free')['locked'], ['mock']);
      expect(starts('pro')['locked'], isEmpty);
    });
  });

  group('Start a game', () {
    Future<void> open(WidgetTester t, {String billing = 'free', bool nudges = true}) async {
      await openSheet(t, (c) => showStartGame(c), sheetOverrides(v3Server(scenario: 'quiet', billing: billing), nudges: nudges));
    }

    testWidgets('Free: the mock row says what Pro does and what sitting costs, with one way to Pro in the row', (t) async {
      await open(t);
      // 20 Oct (golden judges, sheetlive mock-up): "Pro starts it" rides beside the title (or drops under it when the
      // line is full, so the title never wraps), and one short line says what sitting one costs.
      expect(find.byKey(const ValueKey('start-mock-pro-tag')), findsOneWidget);
      expect(find.text('Pro starts it'), findsOneWidget);
      expect(find.text('You can sit one for 50\u00A0credits.'), findsOneWidget);
      expect(find.byKey(const ValueKey('start-mock-pro')), findsOneWidget);
      expect(find.text('Get Pro'), findsOneWidget);
      await tapAt(t, find.text('Full mock together'));
      expect(find.text('Starting a full mock together is part of Pro. On Free you can sit one a friend starts for 50 credits.'), findsOneWidget);
      expect(noText(t, _price), isTrue);
      expect(noText(t, RegExp(r'free first|first in each subject|first mock', caseSensitive: false)), isTrue, reason: 'D175: no free first full mock');
    });

    testWidgets('Free with the Pro nudges off: the line stays and no key is drawn that goes nowhere', (t) async {
      await open(t, nudges: false);
      expect(find.byKey(const ValueKey('start-mock-pro-line')), findsOneWidget);
      expect(find.byKey(const ValueKey('start-mock-pro')), findsNothing);
    });

    testWidgets('Pro: the row is open, the rule box states the price and the key line is the allowance', (t) async {
      await open(t, billing: 'pro');
      expect(find.byKey(const ValueKey('start-mock-pro-line')), findsNothing);
      await tapAt(t, find.text('Full mock together'));
      // Review fix 3: the rule box says the price once; under the key the spec's allowance line.
      expect(find.text('With Pro you can start as many games as you like.'), findsOneWidget);
      expect(keyLabel('Start the full mock'), findsOneWidget);
    });

    testWidgets('billing off does not unlock it for a Free member: the row says Pro starts it', (t) async {
      await open(t, billing: 'off');
      expect(find.text('Pro starts it'), findsOneWidget);
      expect(find.text('You can sit one for 50\u00A0credits.'), findsOneWidget);
    });

    testWidgets('a start the server refuses for want of Pro says so, with the way to Pro under it', (t) async {
      // A den that wrongly lets a Free member start (stale): the server's MOCK_PRO_REQUIRED has the last word.
      await openSheet(
        t,
        (c) => showStartGame(c),
        sheetOverrides(v3Server(scenario: 'quiet', billing: 'free'), nudges: true, edit: (den) {
          final starts = v3Of(den)['starts'] as Map<String, dynamic>;
          starts['locked'] = <String>[];
          starts['formats'] = [...(starts['formats'] as List), 'mock'];
          (starts['mock'] as Map<String, dynamic>)['canStart'] = true;
        }),
      );
      await tapAt(t, find.text('Full mock together'));
      await tapAt(t, keyLabel('Start the full mock'));
      expect(find.text('Only a Pro member can start a Full mock together. Anyone in your Mob can sit one: 50 credits, or free with Pro.'), findsOneWidget);
      expect(find.byKey(const ValueKey('start-error-pro')), findsOneWidget);
    });

    testWidgets('no starts.mock block: no price anywhere, the row still says Pro starts it', (t) async {
      await openSheet(
        t,
        (c) => showStartGame(c),
        sheetOverrides(v3Server(scenario: 'quiet', billing: 'free'), nudges: true, edit: (den) => (v3Of(den)['starts'] as Map<String, dynamic>).remove('mock')),
      );
      expect(find.text('Pro starts it'), findsOneWidget);
      expect(find.text('You can sit one a friend starts.'), findsOneWidget);
      expect(noText(t, RegExp(r'\bcredits\b')), isTrue);
    });
  });

  group('the sit sheet', () {
    Future<void> openSit(WidgetTester t, {required int? balance, required bool nudges, int cost = 50}) => openSheet(
          t,
          (c) => showSitMockSheet(c, cost: cost),
          sheetOverridesWithBalance(v3Server(scenario: 'mock', billing: 'free'), balance: balance, nudges: nudges),
        );

    testWidgets('enough credits: the price, the balance, the key that says the price, and Pro under it', (t) async {
      await openSit(t, balance: 112, nudges: true);
      expect(find.text('Sit the full mock'), findsOneWidget);
      // D185: visual first. The price as one figure, the balance beside it, one line under Get Pro.
      expect(find.text('50 credits'), findsOneWidget);
      expect(find.text('You have 112'), findsOneWidget);
      expect(find.text('Charged once'), findsOneWidget);
      expect(find.bySemanticsLabel('Sitting it costs 50 credits. You have 112.'), findsOneWidget);
      expect(find.text('With Pro, every full mock is free.'), findsOneWidget);
      expect(keyLabel('Sit it for 50 credits'), findsOneWidget);
      expect(keyLabel('Get Pro'), findsOneWidget);
      expect(noText(t, _price), isTrue);
    });

    testWidgets('the key sits it: the sheet closes with a yes', (t) async {
      bool? result;
      await openSheet(
        t,
        (c) async => result = await showSitMockSheet(c, cost: 50),
        sheetOverridesWithBalance(v3Server(scenario: 'mock', billing: 'free'), balance: 112, nudges: true),
      );
      await tapAt(t, keyLabel('Sit it for 50 credits'));
      expect(result, isTrue);
      expect(find.text('Sit the full mock'), findsNothing);
    });

    testWidgets('short of credits: the shortfall, Pro first and Add credits beside it, no sit key', (t) async {
      await openSit(t, balance: 12, nudges: true);
      expect(find.text('You have 12'), findsOneWidget);
      expect(find.text('38 more needed'), findsOneWidget);
      expect(find.bySemanticsLabel('It costs 50 credits and you have 12, so you need 38 more.'), findsOneWidget);
      expect(keyLabel('Sit it for 50 credits'), findsNothing);
      expect(keyLabel('Get Pro'), findsOneWidget);
      expect(keyLabel('Add credits'), findsOneWidget);
    });

    testWidgets('short of credits with the Pro nudges off: Add credits is the one key', (t) async {
      await openSit(t, balance: 12, nudges: false);
      expect(keyLabel('Add credits'), findsOneWidget);
      expect(keyLabel('Get Pro'), findsNothing);
      expect(keyLabel('Sit it for 50 credits'), findsNothing);
    });

    testWidgets('the server refused (MOCK_CREDITS) though the balance here looked enough: short, nothing charged', (t) async {
      await openSheet(
        t,
        (c) => showSitMockSheet(c, cost: 50, refused: true),
        sheetOverridesWithBalance(v3Server(scenario: 'mock', billing: 'free'), balance: 112, nudges: true),
      );
      expect(find.text('Not enough credits'), findsOneWidget);
      expect(find.text('Nothing was charged'), findsOneWidget);
      expect(keyLabel('Sit it for 50 credits'), findsNothing);
      expect(keyLabel('Add credits'), findsOneWidget);
    });

    testWidgets('an unknown balance still names the price', (t) async {
      await openSit(t, balance: null, nudges: true);
      expect(find.text('50 credits'), findsOneWidget);
      expect(find.bySemanticsLabel('Sitting it costs 50 credits.'), findsOneWidget);
      expect(keyLabel('Sit it for 50 credits'), findsOneWidget);
    });
  });

  group('from the Play picker', () {
    testWidgets('Free: the open mock says what sitting costs, and Sit it asks before the paper opens', (t) async {
      await openSheet(t, showPlayPicker, sheetOverridesWithBalance(v3Server(scenario: 'mock', billing: 'free'), balance: 112, nudges: true));
      await settleImages(t);
      expect(find.textContaining('50 credits to sit, free with Pro.'), findsOneWidget);
      await tapAt(t, keyLabel('Sit it'));
      expect(find.text('Sit the full mock'), findsOneWidget);
      expect(keyLabel('Sit it for 50 credits'), findsOneWidget);
    });

    testWidgets('Pro: nothing about credits on the row, and no question before the paper', (t) async {
      await openSheet(t, showPlayPicker, sheetOverridesWithBalance(v3Server(scenario: 'mock', billing: 'pro'), balance: null, nudges: true));
      await settleImages(t);
      expect(find.textContaining('credits to sit'), findsNothing);
    });
  });

  test('the copy is plain: no exclamation mark, no emoji, no hype', () {
    final lines = [
      MobV3Copy.mockPro(50),
      MobV3Copy.mockPro(null),
      MobV3Copy.mockProRow(50),
      MobV3Copy.mockProRow(null),
      MobV3Copy.mockAllowance(50),
      MobV3Copy.errors['MOCK_PRO_REQUIRED']!,
      MobV3Copy.errors['MOCK_CREDITS']!,
      MobV3Copy.addCredits,
      MobV3Copy.sitMockTitle,
      MobV3Copy.sitMockCost(50, 112),
      MobV3Copy.sitMockKey(50),
      MobV3Copy.sitMockShort(50, 12),
      MobV3Copy.sitMockShort(50, null),
      MobV3Copy.sitMockPro,
      MobV3Copy.sitMockOnce,
      ...MobV3Copy.freeListFor(mocks: true),
      ...MobV3Copy.proListFor(live: true, mocks: true),
    ];
    for (final l in lines) {
      expect(l.contains('!'), isFalse, reason: l);
      expect(RegExp(r'[\u{1F300}-\u{1FAFF}☀-➿]', unicode: true).hasMatch(l), isFalse, reason: l);
      expect(RegExp(r'amazing|unlock|exclusive|best|incredible', caseSensitive: false).hasMatch(l), isFalse, reason: l);
    }
  });
}
