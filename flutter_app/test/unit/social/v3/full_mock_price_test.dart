// Full mock together pricing (owner D174, D175): Pro starts it; a Free member pays 50 credits to sit one a friend
// started; Pro sits free; there is no free first full mock. The app shows what the server will enforce, so these
// tests pin the contract it assumes (starts.mock { cost_credits, pro_required_to_start }, games[].cost_credits),
// the plain copy and the one honest way to Pro in the row and in the sit sheet.

import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/widgets/widgets.dart' show KeyButton;
import 'package:mockmob/features/social/v3/copy_v3.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_models.dart';
import 'package:mockmob/features/social/v3/widgets/play_picker_sheet.dart';
import 'package:mockmob/features/social/v3/widgets/sit_mock_sheet.dart';
import 'package:mockmob/features/social/v3/widgets/start_game_sheet.dart';

import '../../../helpers/golden_harness.dart' show settleImages;
import 'mob_v3_test_kit.dart';
import 'sheets_test_kit.dart';

StartRight _starts(Map<String, dynamic> j) => StartRight.fromJson(j);

MobGameSummary _mock({YourRun yourRun = YourRun.none, int? cost}) => MobGameSummary(id: 'g1', format: GameFormat.mock, count: 50, minutes: 60, subjectName: 'Accountancy', yourRun: yourRun, costCredits: cost);

final _price = RegExp(r'₹|\$|\bRs\b|per month', caseSensitive: false);

void main() {
  setUp(loadFoldManifestForTest);

  group('the contract the client assumes', () {
    test('a Free member: the mock costs 50 to sit and Pro starts it, from the server or by default', () {
      final withBlock = _starts({'billingOn': true, 'can': true, 'via': 'free_weekly', 'locked': ['mock'], 'mock': {'cost_credits': 50, 'pro_required_to_start': true}});
      expect(withBlock.mockCost, 50);
      expect(withBlock.mockNeedsPro, isTrue);
      expect(withBlock.allows(GameFormat.mock), isFalse);
      // Nothing sent: the owner's rule applies (the server enforces it before the formats switch is on).
      final bare = _starts({'billingOn': true, 'can': true, 'via': 'free_weekly', 'locked': ['mock']});
      expect(bare.mockCost, 50);
      expect(bare.freeMockPrice, 50);
    });

    test('camelCase is read too, and the server\'s own number wins', () {
      final s = _starts({'billingOn': true, 'can': true, 'via': 'mic', 'mock': {'costCredits': 40, 'proRequiredToStart': true}});
      expect(s.mockCost, 40);
      expect(s.freeMockPrice, 40);
      expect(s.mockNeedsPro, isTrue, reason: 'pro_required_to_start alone locks the row');
      expect(s.shows(GameFormat.mock), isTrue);
    });

    test('a server that says 0 for a Free member is believed', () {
      final s = _starts({'billingOn': true, 'can': true, 'via': 'free_weekly', 'mock': {'cost_credits': 0, 'pro_required_to_start': false}});
      expect(s.mockCost, 0);
      expect(s.mockNeedsPro, isFalse);
    });

    test('Pro and billing off pay nothing, and Pro still names the Free price', () {
      final pro = _starts({'billingOn': true, 'can': true, 'via': 'pro', 'formats': ['sprint', 'round', 'race', 'mock'], 'mock': {'cost_credits': 0, 'pro_required_to_start': false}});
      expect(pro.mockCost, 0);
      expect(pro.freeMockPrice, kMockSitCredits);
      expect(pro.mockNeedsPro, isFalse);
      expect(pro.allows(GameFormat.mock), isTrue);
      final off = _starts({'billingOn': false, 'can': true, 'via': 'open', 'formats': ['sprint', 'round', 'race', 'mock']});
      expect(off.mockCost, 0);
      expect(off.mockNeedsPro, isFalse);
    });

    test('the game carries cost_credits either way round; mockSitCost asks for nothing once begun, for Pro or for a free game', () {
      expect(MobGameSummary.fromJson({'id': 'g', 'format': 'mock', 'cost_credits': 50}).costCredits, 50);
      expect(MobGameSummary.fromJson({'id': 'g', 'format': 'mock', 'costCredits': 50}).costCredits, 50);
      expect(MobGameSummary.fromJson({'id': 'g', 'format': 'mock'}).costCredits, isNull);
      final free = _starts({'billingOn': true, 'can': true, 'via': 'free_weekly', 'locked': ['mock']});
      expect(mockSitCost(_mock(), free), 50);
      expect(mockSitCost(_mock(cost: 30), free), 30, reason: 'the game\'s own number wins');
      expect(mockSitCost(_mock(cost: 0), free), 0);
      expect(mockSitCost(_mock(yourRun: YourRun.playing), free), 0, reason: 'a paper already begun is not paid for twice');
      expect(mockSitCost(_mock(yourRun: YourRun.finished), free), 0);
      expect(mockSitCost(const MobGameSummary(id: 'r', format: GameFormat.race), free), 0);
      expect(mockSitCost(_mock(), _starts({'billingOn': true, 'can': true, 'via': 'pro'})), 0);
      expect(mockSitCost(_mock(), _starts({'billingOn': false})), 0);
    });
  });

  group('the fixture server', () {
    test('Free pays once when the paper starts, Pro and the host pay nothing, and a short balance is CREDITS', () {
      final s = v3Server(scenario: 'mock', billing: 'free');
      expect(s.credits, 112);
      s.sitMock('game-riya-mock');
      expect(s.credits, 62);
      // The game now says nothing is owed (the run exists).
      final again = MobGameSummary.fromJson((s.denNow()['v3'] as Map<String, dynamic>)['games'].firstWhere((g) => (g as Map)['id'] == 'game-riya-mock') as Map<String, dynamic>);
      expect(again.yourRun, YourRun.finished);
      expect(again.costCredits, 0);

      final pro = v3Server(scenario: 'mock', billing: 'pro')..credits = 0;
      pro.sitMock('game-riya-mock');
      expect(pro.credits, 0);

      final poor = v3Server(scenario: 'mock', billing: 'free')..credits = 49;
      expect(() => poor.sitMock('game-riya-mock'), throwsA(isA<ApiError>().having((e) => e.code, 'code', 'CREDITS')));
      expect(poor.credits, 49, reason: 'a refusal charges nothing');
    });

    test('the den says what the student pays and that starting is Pro only', () {
      final free = (v3Server(scenario: 'mock', billing: 'free').denNow()['v3'] as Map<String, dynamic>)['starts'] as Map<String, dynamic>;
      expect(free['mock'], {'pro_required_to_start': true, 'cost_credits': 50});
      final pro = (v3Server(scenario: 'mock', billing: 'pro').denNow()['v3'] as Map<String, dynamic>)['starts'] as Map<String, dynamic>;
      expect(pro['mock'], {'pro_required_to_start': false, 'cost_credits': 0});
      final off = (v3Server(scenario: 'mock').denNow()['v3'] as Map<String, dynamic>)['starts'] as Map<String, dynamic>;
      expect(off.containsKey('mock'), isFalse);
    });
  });

  group('Start a game', () {
    Future<void> open(WidgetTester t, {String billing = 'free', bool nudges = true}) async {
      await openSheet(t, (c) => showStartGame(c), sheetOverrides(v3Server(scenario: 'quiet', billing: billing), nudges: nudges));
    }

    testWidgets('Free: the mock row says what Pro does and what sitting costs, with one way to Pro in the row', (t) async {
      await open(t);
      expect(find.text('Pro starts it and sits every one free. Free members sit one for 50 credits.'), findsOneWidget);
      expect(find.byKey(const ValueKey('start-mock-pro')), findsOneWidget);
      expect(find.text('See Pro plans'), findsOneWidget);
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

    testWidgets('Pro: the row is open, and under the key it says Pro sits free and Free pays 50', (t) async {
      await open(t, billing: 'pro');
      expect(find.byKey(const ValueKey('start-mock-pro-line')), findsNothing);
      await tapAt(t, find.text('Full mock together'));
      expect(find.text('You sit it free with Pro. Free members in your Mob sit it for 50 credits.'), findsOneWidget);
      expect(keyLabel('Start the full mock'), findsOneWidget);
    });

    testWidgets('billing off: no credits and no Pro word on the mock row', (t) async {
      await open(t, billing: 'off');
      await tapAt(t, find.text('Full mock together'));
      expect(noText(t, 'Pro'), isTrue);
      expect(noText(t, RegExp(r'\bcredits\b')), isTrue);
    });
  });

  group('the sit sheet', () {
    Future<void> openSit(WidgetTester t, {required int? balance, required bool nudges, int cost = 50}) => openSheet(
          t,
          (c) => showSitMockSheet(c, game: _mock(), cost: cost),
          sheetOverridesWithBalance(v3Server(scenario: 'mock', billing: 'free'), balance: balance, nudges: nudges),
        );

    testWidgets('enough credits: the price, the balance, the key that says the price, and Pro under it', (t) async {
      await openSit(t, balance: 112, nudges: true);
      expect(find.text('Sit the full mock'), findsOneWidget);
      expect(find.text('Sitting it costs 50 credits. You have 112.'), findsOneWidget);
      expect(find.text('With Pro you start full mocks together and sit every one free.'), findsOneWidget);
      expect(keyLabel('Sit it for 50 credits'), findsOneWidget);
      expect(keyLabel('See Pro plans'), findsOneWidget);
      expect(noText(t, _price), isTrue);
    });

    testWidgets('the key sits it: the sheet closes with a yes', (t) async {
      bool? result;
      await openSheet(
        t,
        (c) async => result = await showSitMockSheet(c, game: _mock(), cost: 50),
        sheetOverridesWithBalance(v3Server(scenario: 'mock', billing: 'free'), balance: 112, nudges: true),
      );
      await tapAt(t, keyLabel('Sit it for 50 credits'));
      expect(result, isTrue);
      expect(find.text('Sit the full mock'), findsNothing);
    });

    testWidgets('short of credits: it says so, and Pro is the key to press', (t) async {
      await openSit(t, balance: 12, nudges: true);
      expect(find.text('You need 50 credits to sit it and have 12.'), findsOneWidget);
      expect(keyLabel('Sit it for 50 credits'), findsNothing);
      expect(keyLabel('See Pro plans'), findsOneWidget);
    });

    testWidgets('short of credits with the Pro nudges off: the sit key stays, quiet, with the reason', (t) async {
      await openSit(t, balance: 12, nudges: false);
      expect(t.widget<KeyButton>(keyLabel('Sit it for 50 credits')).onPressed, isNull);
      expect(keyLabel('See Pro plans'), findsNothing);
    });

    testWidgets('an unknown balance still names the price', (t) async {
      await openSit(t, balance: null, nudges: true);
      expect(find.text('Sitting it costs 50 credits.'), findsOneWidget);
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
      MobV3Copy.mockProRow(50),
      MobV3Copy.mockAllowance(50),
      MobV3Copy.sitMockTitle,
      MobV3Copy.sitMockCost(50, 112),
      MobV3Copy.sitMockKey(50),
      MobV3Copy.sitMockShort(50, 12),
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
