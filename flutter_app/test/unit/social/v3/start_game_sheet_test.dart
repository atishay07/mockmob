// P2 Start a game, the one sheet where every Mob game starts (D167, D169; pass-1020 MOB-MINIMAL 3.2): the
// Anytime or Live choice at the top with its line (only when live is on), four rows (Sprint, Race with its 5 or 10
// minute chips, Your own round with 10, 15 or 20, Full mock together, "Anytime only" in Live), what it covers, one
// key that names the action, the start allowance, Pass the mic for Pro with billing on, the weekly paper's row,
// the errors inline (START_USED, LENGTH_INVALID, LIVE_BUSY), and the game opening at once on success.

import 'dart:ui' show Tristate;

import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
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

/// The paper is unsat in the week (the 'quiet' fixture has it sat).
void paperOpen(Map<String, dynamic> den) {
  final week = (den['mob'] as Map<String, dynamic>)['week'] as Map<String, dynamic>;
  week['youSat'] = false;
  week['sat'] = 0;
}

Finder _row(GameFormat f) => find.byKey(ValueKey('format-${f.name}'));

bool _selected(WidgetTester t, GameFormat f) => t.getSemantics(_row(f)).flagsCollection.isSelected == Tristate.isTrue;

void main() {
  setUp(loadFoldManifestForTest);

  testWidgets('defaults: Sprint chosen, the trap chapter, the anytime line, the key and the allowance', (t) async {
    await _open(t, v3Server(scenario: 'heavy'));
    expect(find.text('Start a game'), findsOneWidget);
    expect(find.text('Chai Circle · Accountancy'), findsOneWidget);
    expect(find.text('Open for 24 hours. Everyone races the runs that came before theirs.'), findsOneWidget);
    expect(_selected(t, GameFormat.sprint), isTrue);
    expect(find.text('5 questions · about 5 minutes'), findsOneWidget);
    expect(find.text('Goodwill, the chapter your Mob tripped on'), findsOneWidget);
    expect(keyLabel('Start the sprint'), findsOneWidget);
    expect(find.text('Everyone in Chai Circle plays it free.'), findsOneWidget);
    expect(find.byKey(const ValueKey('start-mode-async')), findsNothing, reason: 'live is off: no choice to make');
    expect(find.text('Pass the mic'), findsNothing);
    expect(noText(t, _price), isTrue);
    // A Free member's full mock stays locked with Pro even with billing off (D174): its tag says who starts it.
    expect(find.text('Pro starts it'), findsOneWidget);
  });

  testWidgets('four ways to play, each with one line (K9)', (t) async {
    await _open(t, v3Server(scenario: 'quiet'));
    for (final title in ['Sprint', 'Race', 'Your own round', 'Full mock together']) {
      expect(find.text(title), findsOneWidget, reason: title);
    }
    expect(find.text('As many as you can in 5 or 10 minutes'), findsOneWidget);
    expect(find.text('10, 15 or 20 questions'), findsOneWidget);
    expect(find.text('50 questions in 60 minutes · open\u00A024\u00A0hours'), findsOneWidget);
  });

  testWidgets('no trap yet: the whole subject', (t) async {
    await _open(t, v3Server(scenario: 'open'));
    expect(find.text('The whole of Accountancy'), findsOneWidget);
  });

  testWidgets('Your own round: chips 10, 15 and 20 open in its row, and 15 is sent', (t) async {
    final server = FailingServer(scenario: 'quiet');
    await _open(t, server);
    expect(find.byKey(const ValueKey('start-count')), findsNothing);
    await tapAt(t, find.text('Your own round'));
    expect(find.byKey(const ValueKey('start-count')), findsOneWidget);
    expect(keyLabel('Start the round'), findsOneWidget);
    await tapAt(t, find.byKey(const ValueKey('start-chip-15')));
    await tapToRun(t, keyLabel('Start the round'));
    expect(_result?.count, 15);
  });

  testWidgets('"Use the whole subject" replaces the trap chapter', (t) async {
    await _open(t, v3Server(scenario: 'heavy'));
    await tapAt(t, find.text('Use the whole subject'));
    expect(find.text('The whole of Accountancy'), findsOneWidget);
    expect(find.text('Use the whole subject'), findsNothing);
  });

  testWidgets('Start the sprint opens the game and the run at once, and returns the game', (t) async {
    await _open(t, v3Server(scenario: 'quiet'));
    await tapToRun(t, keyLabel('Start the sprint'));
    expect(_result, isNotNull);
    expect(_result!.count, 5);
    expect(find.byType(GameRunScreen), findsOneWidget);
    expect(find.text('Start a game'), findsNothing, reason: 'the sheet left');
  });

  testWidgets('Race: 5 or 10 minute chips in its row, and Start the race sends the minutes', (t) async {
    final server = FailingServer(scenario: 'quiet', clock: () => v3Now);
    await _open(t, server);
    await tapAt(t, find.text('Race'));
    expect(find.text('5 minutes'), findsOneWidget);
    expect(find.text('10 minutes'), findsOneWidget);
    expect(keyLabel('Start the race'), findsOneWidget);
    await tapAt(t, find.text('10 minutes'));
    await tapToRun(t, keyLabel('Start the race'));
    expect(server.openedFormats, [GameFormat.race]);
    expect(server.openedMinutes, [10]);
    expect(_result?.format, GameFormat.race);
    expect(_result?.minutes, 10);
    expect(_result?.count, 60, reason: 'the pool: 6 a minute');
    expect(find.byType(GameRunScreen), findsOneWidget, reason: 'the race opens at once');
  });

  testWidgets('Full mock together: the whole paper, its line, Start the full mock, always 24 hours', (t) async {
    final server = FailingServer(scenario: 'quiet', billing: 'pro', clock: () => v3Now);
    await _open(t, server, edit: liveOn);
    await tapAt(t, find.text('Full mock together'));
    // A8: the rule box says who can sit it and when.
    expect(find.text('Everyone in Chai Circle can sit it within 24 hours, then you compare mark sheets.'), findsOneWidget);
    expect(find.text('Change'), findsNothing, reason: 'a full mock is the whole paper');
    await tapAt(t, keyLabel('Start the full mock'));
    expect(server.openedFormats, [GameFormat.mock]);
    expect(server.openedModes, [GameMode.async]);
    expect(find.text('Start a game'), findsNothing, reason: 'the sheet left for the mock runner');
  });

  testWidgets('live on: the choice at the top, its line, and the key names the room', (t) async {
    await _open(t, v3Server(scenario: 'quiet'), edit: liveOn);
    expect(find.byKey(const ValueKey('start-mode-async')), findsOneWidget);
    await tapAt(t, find.byKey(const ValueKey('start-mode-live')));
    expect(find.text('Everyone starts together on 3, 2, 1. Anyone who misses it can play it later.'), findsOneWidget);
    expect(keyLabel('Open the room for the sprint'), findsOneWidget);
    await tapAt(t, find.text('Race'));
    expect(keyLabel('Open the room for the race'), findsOneWidget);
  });

  testWidgets('in Live the full mock stays drawn, dimmed, "Anytime only", and takes no tap', (t) async {
    await _open(t, v3Server(scenario: 'quiet', billing: 'pro'), edit: liveOn);
    await tapAt(t, find.byKey(const ValueKey('start-mode-live')));
    expect(find.text('Anytime only'), findsOneWidget);
    await tapAt(t, find.text('Full mock together'));
    expect(keyLabel('Start the full mock'), findsNothing);
    expect(keyLabel('Open the room for the sprint'), findsOneWidget);
  });

  testWidgets('choosing Live with the full mock chosen moves the choice to the sprint', (t) async {
    await _open(t, v3Server(scenario: 'quiet', billing: 'pro'), edit: liveOn);
    await tapAt(t, find.text('Full mock together'));
    await tapAt(t, find.byKey(const ValueKey('start-mode-live')));
    expect(_selected(t, GameFormat.sprint), isTrue);
  });

  testWidgets('LIVE_BUSY turns the sheet to Anytime with its sentence', (t) async {
    final server = FailingServer(scenario: 'quiet', openGameCode: 'LIVE_BUSY', openGameOnLiveOnly: true);
    await _open(t, server, edit: liveOn);
    await tapAt(t, find.byKey(const ValueKey('start-mode-live')));
    await tapAt(t, keyLabel('Open the room for the sprint'));
    expect(find.text('Live is busy right now. Play now, and your Mob can catch up within 24 hours.'), findsOneWidget);
    expect(keyLabel('Start the sprint'), findsOneWidget, reason: 'now an anytime game');
    await tapToRun(t, keyLabel('Start the sprint'));
    expect(server.openedModes, [GameMode.live, GameMode.async]);
    expect(_result, isNotNull);
  });

  testWidgets('outside live hours Live is locked and says why when tapped', (t) async {
    await _open(t, v3Server(scenario: 'quiet'), edit: (d) => liveOn(d, hoursOk: false));
    await tapAt(t, find.byKey(const ValueKey('start-mode-live')));
    expect(find.text('Live rooms open from 6:00 AM to 11:00 PM.'), findsOneWidget);
    expect(keyLabel('Start the sprint'), findsOneWidget, reason: 'still anytime');
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

  testWidgets('an unknown failure says so plainly, not a code', (t) async {
    await _open(t, FailingServer(scenario: 'quiet', openGameCode: 'unknown_code'));
    await tapAt(t, keyLabel('Start the sprint'));
    expect(find.text("That didn't go through. Try again."), findsOneWidget);
  });

  testWidgets('Free with a start: the allowance, and a locked full mock with Pro that says why', (t) async {
    await _open(t, v3Server(scenario: 'quiet', billing: 'free'));
    expect(find.text('1 start left this week. Everyone plays free.'), findsOneWidget);
    // V4 (MOB-V4-BUILD 1; golden judges 20 Oct): the tag says who starts it, the row's one line what sitting costs.
    expect(find.text('Pro starts it'), findsOneWidget);
    expect(find.text('You can sit one for 50\u00A0credits.'), findsOneWidget);
    await tapAt(t, find.text('Full mock together'));
    expect(find.text('Starting a full mock together is part of Pro. On Free you can sit one a friend starts for 50 credits.'), findsOneWidget);
    expect(keyLabel('Start the sprint'), findsOneWidget, reason: 'the choice stays on what Free can start');
    expect(noText(t, _price), isTrue);
  });

  testWidgets('Free with its start used: the allowance says so and the key is quiet', (t) async {
    await _open(t, v3Server(scenario: 'quiet', billing: 'used'));
    expect(find.text('Your start this week is used. It comes back on Monday.'), findsOneWidget);
    expect(find.text('Pass the mic'), findsNothing);
    expect(keyLabel('Start the sprint'), findsOneWidget);
    expect(find.textContaining('You started this week'), findsOneWidget);
  });

  testWidgets('a mic: the allowance names who passed it', (t) async {
    await _open(t, v3Server(scenario: 'quiet', billing: 'mic'));
    expect(find.text('Riya passed you the mic. Everyone plays free.'), findsOneWidget);
  });

  testWidgets('Pass the mic shows for Pro with billing on, and opens P3', (t) async {
    await _open(t, v3Server(scenario: 'quiet', billing: 'pro'));
    expect(find.text('Pass the mic'), findsOneWidget);
    expect(find.text('Let a friend start one game. 2 left this week.'), findsOneWidget);
    await tapAt(t, find.text('Pass the mic'));
    expect(find.text('Let a friend start one game in Chai Circle this week.'), findsOneWidget);
  });

  testWidgets("the week's Mob paper is the last row while it is unsat", (t) async {
    await _open(t, v3Server(scenario: 'quiet'), edit: paperOpen);
    expect(find.text("This week's Mob paper"), findsOneWidget);
    expect(find.text('Already open · 10 questions'), findsOneWidget);
    expect(find.byKey(const ValueKey('start-sit-paper')), findsOneWidget);
  });

  testWidgets('a sat paper leaves no row', (t) async {
    await _open(t, v3Server(scenario: 'quiet'));
    expect(find.byKey(const ValueKey('start-sit-paper')), findsNothing);
  });

  testWidgets('a rematch prefill selects the round of its length', (t) async {
    await _open(t, v3Server(scenario: 'quiet'), prefill: const StartGamePrefill(format: GameFormat.rematch, count: 15, rematchOf: 'game-x'));
    expect(_selected(t, GameFormat.round), isTrue);
    expect(keyLabel('Start the round'), findsOneWidget);
  });

  testWidgets('a race rematch prefill opens on the race of the same length', (t) async {
    await _open(t, v3Server(scenario: 'quiet'), prefill: const StartGamePrefill(format: GameFormat.race, count: 30, minutes: 10, rematchOf: 'game-x'));
    expect(keyLabel('Start the race'), findsOneWidget);
    expect(_selected(t, GameFormat.race), isTrue);
  });
}
