// P1 Play picker: what is open now, every state of its "Start a game" lines (billing off, Free with a start,
// used, mic, Pro), the rules that keep the Mob free of plan words when billing is off, the one start row that
// names every way to play and opens the one start sheet (D169), "Ask your Mob for a game" sending the Again
// sticker, and the rows that open games.

import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_fake_server.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_models.dart';
import 'package:mockmob/features/social/v3/screens/game_run_screen.dart';
import 'package:mockmob/features/social/v3/widgets/play_picker_sheet.dart';

import '../../../helpers/golden_harness.dart' show settleImages;
import '../mob_test_kit.dart';
import 'mob_v3_test_kit.dart';
import 'sheets_test_kit.dart';

final _price = RegExp(r'₹|\$|\bprice\b|\bbuy\b|per month|\bRs\b', caseSensitive: false);

Future<void> _open(WidgetTester t, {String billing = 'off', String scenario = 'open', bool nudges = false, JsonEdit? edit, RecordingNavigator? nav, MobV3FakeServer? server}) async {
  loadFoldManifestForTest();
  final s = server ?? v3Server(scenario: scenario, billing: billing);
  await openSheet(t, showPlayPicker, sheetOverrides(s, edit: edit, nav: nav, nudges: nudges));
  await settleImages(t);
}

final _startRow = find.byKey(const ValueKey('picker-start-row'));

void main() {
  testWidgets('billing off: no plan word, no lock, no price, the plain line and the start row', (t) async {
    await _open(t);
    expect(find.text('Play with your Mob'), findsOneWidget);
    expect(find.text('Anyone in your Mob can start a game.'), findsOneWidget);
    expect(_startRow, findsOneWidget);
    expect(find.text('Sprint, race, round or full mock'), findsOneWidget, reason: 'every way to play, named (K9)');
    expect(find.byIcon(LucideIcons.lock), findsNothing);
    expect(noText(t, 'Pro'), isTrue, reason: 'no Pro word with billing off');
    expect(noText(t, _price), isTrue);
    expect(find.text('What Pro adds'), findsNothing);
    expect(find.text('Live'), findsNothing, reason: 'live is a choice in the start sheet, not a tile');
    expect(find.text('Every game stays open for 24 hours. Friends who play later race the runs before them.'), findsOneWidget);
  });

  testWidgets('billing off, even with the Pro nudges on, shows no plan word', (t) async {
    await _open(t, nudges: true);
    expect(noText(t, 'Pro'), isTrue);
    expect(find.text('What Pro adds'), findsNothing);
  });

  testWidgets('the start row opens the one start sheet', (t) async {
    await _open(t);
    await tapAt(t, keyLabel('Start'));
    expect(find.text('Start a game'), findsWidgets);
    expect(keyLabel('Start the sprint'), findsOneWidget);
    expect(find.text('Full mock together'), findsOneWidget);
  });

  testWidgets('Free with a start: the line and "What Pro adds"', (t) async {
    await _open(t, billing: 'free', nudges: true);
    expect(find.text('You have 1 start in Chai Circle this week.'), findsOneWidget);
    expect(find.text('What Pro adds'), findsOneWidget);
    expect(noText(t, _price), isTrue);
  });

  testWidgets('What Pro adds is hidden when the Pro nudges are off, even with billing on', (t) async {
    await _open(t, billing: 'free', nudges: false);
    expect(find.text('What Pro adds'), findsNothing);
  });

  testWidgets('Free, start used: the reason, and the start row still opens the sheet to read', (t) async {
    await _open(t, billing: 'used', nudges: true);
    expect(find.text('Your start this week is used. It comes back on Monday.'), findsOneWidget);
    expect(find.text('Anyone in your Mob with Pro can start one, then everyone plays it free.'), findsOneWidget);
    expect(_startRow, findsOneWidget);
  });

  testWidgets('a mic: the sentence', (t) async {
    await _open(t, billing: 'mic', nudges: true);
    expect(find.text('Riya passed you the mic. You can start one game, live or anytime.'), findsOneWidget);
  });

  testWidgets('a Free start left and a mic held: both lines show', (t) async {
    await _open(t, billing: 'free', nudges: true, edit: (d) {
      final starts = v3Of(d)['starts'] as Map<String, dynamic>;
      starts['mics'] = 1;
      starts['micFrom'] = 'Riya';
    });
    expect(find.text('You have 1 start in Chai Circle this week.'), findsOneWidget);
    expect(find.text('Riya passed you the mic. You can start one game, live or anytime.'), findsOneWidget);
  });

  testWidgets('Pro: no sentence about starts', (t) async {
    await _open(t, billing: 'pro', nudges: true);
    expect(find.textContaining('You have'), findsNothing);
    expect(find.byIcon(LucideIcons.lock), findsNothing);
  });

  testWidgets('live on: the line says how each game can be played', (t) async {
    await _open(t, edit: liveOn);
    expect(find.text('Sprints, races and rounds can be live now, on one 3, 2, 1, or open for 24 hours. A full mock is open for 24 hours.'), findsOneWidget);
  });

  testWidgets('an open race and an open full mock say what they are', (t) async {
    await _open(t, scenario: 'race');
    expect(find.text("Kabir's 5-minute race"), findsOneWidget);
    expect(find.textContaining('5 minutes, as many as you can.'), findsOneWidget);
  });

  testWidgets('Ask your Mob for a game sends the Again sticker', (t) async {
    final spy = StickerSpy(scenario: 'open', billing: 'used');
    await _open(t, billing: 'used', nudges: true, server: spy);
    expect(keyLabel('Ask your Mob for a game'), findsOneWidget);
    await tapAt(t, keyLabel('Ask your Mob for a game'));
    expect(spy.sent, [StickerKind.again]);
    expect(keyLabel('Sent to your Mob.'), findsOneWidget);
  });

  testWidgets('Open now: a row per open game, with its words, and Play opens the run', (t) async {
    await _open(t);
    expect(find.text('Open now'), findsOneWidget);
    expect(find.text("Riya's sprint"), findsOneWidget);
    expect(find.text('5 questions. Open until 2:05 PM tomorrow.'), findsOneWidget);
    await tapToRun(t, keyLabel('Play'));
    expect(find.byType(GameRunScreen), findsOneWidget);
    expect(find.text('Play with your Mob'), findsNothing, reason: 'the sheet leaves when the run opens');
  });

  testWidgets('the weekly paper: "Answers" once sat', (t) async {
    final nav = RecordingNavigator();
    await _open(t, nav: nav, edit: (d) {
      final week = (d['mob'] as Map<String, dynamic>)['week'] as Map<String, dynamic>;
      week['yourResultId'] = 'practice_u2';
    });
    expect(find.text("This week's Mob paper"), findsOneWidget);
    expect(find.text('You sat it on Monday.'), findsOneWidget);
    await tapAt(t, keyLabel('Answers'));
    expect(nav.calls, ['answers:practice_u2']);
  });

  testWidgets('the weekly paper: "Sit it" with its length when not sat', (t) async {
    final nav = RecordingNavigator();
    await _open(t, scenario: 'quiet', nav: nav, edit: (d) {
      final week = (d['mob'] as Map<String, dynamic>)['week'] as Map<String, dynamic>;
      week['youSat'] = false;
      v3Of(d)['paperSatAt'] = null;
    });
    expect(find.text('10 questions, 10 minutes.'), findsOneWidget);
    await tapAt(t, keyLabel('Sit it'));
    expect(nav.calls, ['sit']);
  });

  testWidgets('a game you played shows Podium, not Play', (t) async {
    await _open(t, scenario: 'played');
    expect(keyLabel('Podium'), findsOneWidget);
    expect(keyLabel('Play'), findsNothing);
  });

  testWidgets('reads at 1.3x text without overflow', (t) async {
    loadFoldManifestForTest();
    await openSheet(t, showPlayPicker, sheetOverrides(v3Server(scenario: 'open', billing: 'used'), nudges: true), scale: 1.3);
    expect(t.takeException(), isNull);
    expect(find.text('Play with your Mob'), findsOneWidget);
  });
}
