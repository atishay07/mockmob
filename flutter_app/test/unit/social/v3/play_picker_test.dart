// P1 Play picker: every state of "Start a game" (billing off, Free with a start, used, mic, Pro), the rules
// that keep the Mob free of plan words when billing is off, locked tiles drawn with a reason, the Live tile
// only when live is on, "Ask your Mob for a game" sending the Again sticker, and the rows that open games.

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

void main() {
  testWidgets('billing off: no plan word, no lock, no price, the plain line', (t) async {
    await _open(t);
    expect(find.text('Play with your Mob'), findsOneWidget);
    expect(find.text('Anyone in your Mob can start a game.'), findsOneWidget);
    expect(find.text('Sprint'), findsOneWidget);
    expect(find.text('Your own round'), findsOneWidget);
    expect(find.byIcon(LucideIcons.lock), findsNothing);
    expect(noText(t, 'Pro'), isTrue, reason: 'no Pro word with billing off');
    expect(noText(t, _price), isTrue);
    expect(find.text('What Pro adds'), findsNothing);
    expect(find.text('Full mock'), findsNothing);
    expect(find.text('Live'), findsNothing, reason: 'live is off in the fixture');
  });

  testWidgets('billing off, even with the Pro nudges on, shows no plan word', (t) async {
    await _open(t, nudges: true);
    expect(noText(t, 'Pro'), isTrue);
    expect(find.text('What Pro adds'), findsNothing);
  });

  testWidgets('Free with a start: the line, the tiles open, Full mock locked with Pro, "What Pro adds"', (t) async {
    await _open(t, billing: 'free', nudges: true);
    expect(find.text('You have 1 start in Chai Circle this week.'), findsOneWidget);
    expect(find.text('Full mock'), findsOneWidget);
    expect(find.text('Pro'), findsOneWidget);
    expect(find.byIcon(LucideIcons.lock), findsOneWidget, reason: 'only Full mock is locked');
    expect(find.text('What Pro adds'), findsOneWidget);
    expect(noText(t, _price), isTrue);
  });

  testWidgets('What Pro adds is hidden when the Pro nudges are off, even with billing on', (t) async {
    await _open(t, billing: 'free', nudges: false);
    expect(find.text('What Pro adds'), findsNothing);
  });

  testWidgets('Free, start used: the reason, locked tiles stay visible with a lock and a reason each', (t) async {
    await _open(t, billing: 'used', nudges: true);
    expect(find.text('Your start this week is used. It comes back on Monday.'), findsOneWidget);
    expect(find.text('Anyone in your Mob with Pro can start one, then everyone plays it free.'), findsOneWidget);
    expect(find.text('Sprint'), findsOneWidget);
    expect(find.text('Your own round'), findsOneWidget);
    expect(find.text('Used this week'), findsNWidgets(2));
    expect(find.byIcon(LucideIcons.lock), findsNWidgets(3), reason: 'Sprint, Your own round and Full mock');
    // A locked tile takes no tap.
    await t.ensureVisible(find.text('Sprint'));
    await t.tap(find.text('Sprint'), warnIfMissed: false);
    await t.pumpAndSettle();
    expect(keyLabel('Start the sprint'), findsNothing);
  });

  testWidgets('a mic: the sentence and the tiles open', (t) async {
    await _open(t, billing: 'mic', nudges: true);
    expect(find.text('Riya passed you the mic. You can start one game, live or anytime.'), findsOneWidget);
    expect(find.text('Used this week'), findsNothing);
    await tapAt(t, find.text('Sprint'));
    expect(keyLabel('Start the sprint'), findsOneWidget);
  });

  testWidgets('Pro: no sentence about starts, tiles open', (t) async {
    await _open(t, billing: 'pro', nudges: true);
    expect(find.textContaining('You have'), findsNothing);
    expect(find.byIcon(LucideIcons.lock), findsOneWidget);
  });

  testWidgets('a Live tile shows only when live is on', (t) async {
    await _open(t, edit: liveOn);
    expect(find.text('Live'), findsOneWidget);
    expect(find.text('Everyone at once'), findsOneWidget);
    expect(find.byIcon(LucideIcons.lock), findsNothing, reason: 'billing off and hours fine: Live is open');
  });

  testWidgets('Live outside live hours stays drawn, locked', (t) async {
    await _open(t, edit: (d) => liveOn(d, hoursOk: false));
    expect(find.text('Live'), findsOneWidget);
    expect(find.byIcon(LucideIcons.lock), findsOneWidget);
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
    await tapAt(t, keyLabel('Play'));
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
