// P2 Start a game: the tiles and the length stepper, what it covers, how the Mob plays it (only when live is
// on), the key and its line, the errors inline (START_USED, LENGTH_INVALID, LIVE_BUSY), Pass the mic only for
// Pro with billing on, and the run opening at once on success.

import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_models.dart';
import 'package:mockmob/features/social/v3/screens/game_run_screen.dart';
import 'package:mockmob/features/social/v3/widgets/start_game_sheet.dart';

import 'mob_v3_test_kit.dart';
import 'sheets_test_kit.dart';

final _price = RegExp(r'₹|\$|\bprice\b|\bbuy\b|per month|\bRs\b', caseSensitive: false);

MobGame? _result;

Future<void> _open(WidgetTester t, dynamic server, {JsonEdit? edit, StartGamePrefill prefill = const StartGamePrefill()}) async {
  _result = null;
  await openSheet(t, (c) async => _result = await showStartGame(c, prefill: prefill), sheetOverrides(server, edit: edit));
}

void main() {
  setUp(loadFoldManifestForTest);

  testWidgets('defaults: Sprint selected, the trap chapter, anytime line, the key and its line', (t) async {
    await _open(t, v3Server(scenario: 'heavy'));
    expect(find.text('Start a game'), findsOneWidget);
    expect(find.text('Chai Circle, Accountancy'), findsOneWidget);
    expect(find.text('Sprint'), findsOneWidget);
    expect(find.text('5 questions'), findsOneWidget);
    expect(find.text('10, 15 or 20 questions'), findsOneWidget);
    expect(find.text("Goodwill, the chapter of your Mob's last trap"), findsOneWidget);
    expect(find.text('Everyone gets the same questions for 24 hours and races the runs before them.'), findsOneWidget);
    expect(keyLabel('Start the sprint'), findsOneWidget);
    expect(find.text('Everyone in Chai Circle plays it free. Marks count the same for all.'), findsOneWidget);
    expect(find.text('Live now'), findsNothing, reason: 'live is off');
    expect(find.text('Pass the mic'), findsNothing);
    expect(noText(t, _price), isTrue);
    expect(noText(t, 'Pro'), isTrue);
  });

  testWidgets('no trap yet: the whole subject', (t) async {
    await _open(t, v3Server(scenario: 'open'));
    expect(find.text('The whole of Accountancy'), findsOneWidget);
  });

  testWidgets('Your own round: the stepper goes 10, 15, 20 and stops at both ends', (t) async {
    await _open(t, v3Server(scenario: 'heavy'));
    expect(find.text('10 questions'), findsNothing);
    await tapAt(t, find.text('Your own round'));
    expect(find.text('10 questions'), findsOneWidget);
    expect(keyLabel('Start the round'), findsOneWidget);
    await tapAt(t, find.byIcon(LucideIcons.plus));
    expect(find.text('15 questions'), findsOneWidget);
    await tapAt(t, find.byIcon(LucideIcons.plus));
    expect(find.text('20 questions'), findsOneWidget);
    await tapAt(t, find.byIcon(LucideIcons.plus));
    expect(find.text('20 questions'), findsOneWidget, reason: 'the top of the range');
    await tapAt(t, find.byIcon(LucideIcons.minus));
    await tapAt(t, find.byIcon(LucideIcons.minus));
    await tapAt(t, find.byIcon(LucideIcons.minus));
    expect(find.text('10 questions'), findsOneWidget, reason: 'the bottom of the range');
  });

  testWidgets('"Use the whole subject" replaces the trap chapter', (t) async {
    await _open(t, v3Server(scenario: 'heavy'));
    await tapAt(t, find.text('Use the whole subject'));
    expect(find.text('The whole of Accountancy'), findsOneWidget);
    expect(find.text('Use the whole subject'), findsNothing);
  });

  testWidgets('Start the sprint opens the game and the run at once, and returns the game', (t) async {
    final server = v3Server(scenario: 'quiet');
    await _open(t, server);
    await tapToRun(t, keyLabel('Start the sprint'));
    expect(_result, isNotNull);
    expect(_result!.count, 5);
    expect(find.byType(GameRunScreen), findsOneWidget);
    expect(find.text('Start a game'), findsNothing, reason: 'the sheet left');
  });

  testWidgets('a round of 15 is sent with its length', (t) async {
    final server = FailingServer(scenario: 'quiet');
    await _open(t, server);
    await tapAt(t, find.text('Your own round'));
    await tapAt(t, find.byIcon(LucideIcons.plus));
    await tapToRun(t, keyLabel('Start the round'));
    expect(_result?.count, 15);
  });

  testWidgets('START_USED shows the server sentence inline and the sheet stays', (t) async {
    await _open(t, FailingServer(scenario: 'quiet', openGameCode: 'START_USED'));
    await tapAt(t, keyLabel('Start the sprint'));
    expect(find.text("You started this week's game in this Mob. You can start another on Monday, or a friend with Pro can pass you the mic."), findsOneWidget);
    expect(find.text('Start a game'), findsOneWidget);
    expect(_result, isNull);
  });

  testWidgets('LENGTH_INVALID shows its sentence inline', (t) async {
    await _open(t, FailingServer(scenario: 'quiet', openGameCode: 'LENGTH_INVALID'));
    await tapAt(t, keyLabel('Start the sprint'));
    expect(find.text('Choose 5, 10, 15 or 20 questions.'), findsOneWidget);
  });

  testWidgets('an offline failure says so, not a code', (t) async {
    await _open(t, FailingServer(scenario: 'quiet', openGameCode: 'unknown_code'));
    await tapAt(t, keyLabel('Start the sprint'));
    expect(find.text("That didn't go through. Try again."), findsOneWidget);
  });

  testWidgets('live on: the segmented control, the live line, and "Open the room"', (t) async {
    await _open(t, v3Server(scenario: 'quiet'), edit: liveOn);
    expect(find.text('Live now'), findsOneWidget);
    expect(find.text('Anytime in 24 hours'), findsOneWidget);
    await tapAt(t, find.text('Live now'));
    expect(find.text('Live starts everyone on one 3, 2, 1. Anyone who misses it gets the same questions for 24 hours.'), findsOneWidget);
    expect(keyLabel('Open the room'), findsOneWidget);
  });

  testWidgets('LIVE_BUSY turns the sheet to anytime in 24 hours with its sentence', (t) async {
    final server = FailingServer(scenario: 'quiet', openGameCode: 'LIVE_BUSY', openGameOnLiveOnly: true);
    await _open(t, server, edit: liveOn);
    await tapAt(t, find.text('Live now'));
    await tapAt(t, keyLabel('Open the room'));
    expect(find.text('Live is busy right now. Play now, and your Mob can catch up within 24 hours.'), findsOneWidget);
    expect(keyLabel('Start the sprint'), findsOneWidget, reason: 'now an anytime game');
    expect(find.text('Everyone gets the same questions for 24 hours and races the runs before them.'), findsOneWidget);
    // The next press opens it as anytime.
    await tapToRun(t, keyLabel('Start the sprint'));
    expect(server.openedModes, [GameMode.live, GameMode.async]);
    expect(_result, isNotNull);
  });

  testWidgets('outside live hours the Live segment is locked and says why when tapped', (t) async {
    await _open(t, v3Server(scenario: 'quiet'), edit: (d) => liveOn(d, hoursOk: false));
    await tapAt(t, find.text('Live now'));
    expect(find.text('Live rooms open from 6:00 AM to 11:00 PM.'), findsOneWidget);
    expect(keyLabel('Start the sprint'), findsOneWidget, reason: 'still anytime');
  });

  testWidgets('Pass the mic shows for Pro with billing on, and opens P3', (t) async {
    await _open(t, v3Server(scenario: 'quiet', billing: 'pro'));
    expect(find.text('Pass the mic'), findsOneWidget);
    expect(find.text('Let a friend start one game. 2 left this week.'), findsOneWidget);
    await tapAt(t, find.text('Pass the mic'));
    expect(find.text('Let a friend start one game in Chai Circle this week.'), findsOneWidget);
  });

  testWidgets('Free with its start used: the key is quiet and says why', (t) async {
    await _open(t, v3Server(scenario: 'quiet', billing: 'used'));
    expect(find.text('Pass the mic'), findsNothing);
    expect(keyLabel('Start the sprint'), findsOneWidget);
    expect(find.textContaining('You started this week'), findsOneWidget);
  });

  testWidgets('a rematch prefill selects the round of its length', (t) async {
    await _open(t, v3Server(scenario: 'quiet'), prefill: const StartGamePrefill(format: GameFormat.rematch, count: 10, rematchOf: 'game-x'));
    expect(find.text('10 questions'), findsOneWidget);
    expect(keyLabel('Start the round'), findsOneWidget);
  });
}
