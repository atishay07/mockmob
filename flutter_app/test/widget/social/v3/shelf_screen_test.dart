// S1 Your shelf (spec 5.3, D133): every Fold with the real rule and count for the ones not yet earned,
// the creases, the finishes, the Mob's shelf, the owned-only Change, and the detail sheet.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/social/v3/copy_v3.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_models.dart';
import 'package:mockmob/features/social/v3/screens/shelf_screen.dart';

import '../../../unit/social/v3/mob_v3_test_kit.dart';
import '../../../unit/social/v3/social_test_kit.dart';

Future<SocialServer> _open(WidgetTester tester, {SocialServer? server, Brightness brightness = Brightness.dark}) async {
  final s = server ?? SocialServer();
  await pumpSocial(tester, const ShelfScreen(), s, size: const Size(360, 2600), brightness: brightness);
  await settleSocial(tester);
  return s;
}

Iterable<int> _creases(WidgetTester tester) => [
      for (final e in find.byWidgetPredicate((w) => w is CustomPaint && w.painter is CreasePainter).evaluate()) ((e.widget as CustomPaint).painter as CreasePainter).folds,
    ];

void main() {
  setUpAll(loadFoldManifestForTest);

  testWidgets('title, the line, and who you play as', (tester) async {
    await _open(tester);
    expect(find.text(MobV3Copy.shelfTitle), findsOneWidget);
    expect(find.text(MobV3Copy.shelfLead), findsOneWidget);
    expect(find.text(MobV3Copy.youPlayAs('Dart')), findsOneWidget);
    expect(find.text(MobV3Copy.change), findsOneWidget);
  });

  testWidgets('all twelve Folds: four owned, eight locked', (tester) async {
    await _open(tester);
    expect(find.byType(FoldTile), findsNWidgets(12));
    expect(find.text(MobV3Copy.shelfOwned), findsOneWidget);
    expect(find.text(MobV3Copy.shelfToEarn), findsOneWidget);
    for (final f in FoldKey.starters) {
      expect(find.text(MobV3Copy.foldLine(f)), findsOneWidget);
    }
  });

  testWidgets('a locked Fold says how to earn it with the real count, and names the Mob that leads it', (tester) async {
    final semantics = tester.ensureSemantics();
    await _open(tester);
    expect(find.bySemanticsLabel('Crane. Your Mob fixes 3 traps together. 1 of 3, in Chai Circle.'), findsOneWidget);
    expect(find.bySemanticsLabel('Hop. Your Mob finishes its first weekly quest. 0 of 1, in Chai Circle.'), findsOneWidget);
    expect(find.bySemanticsLabel("Stamp. Your Mob's chain reaches 4 weeks in a row. 3 of 4, in Chai Circle."), findsOneWidget);
    // Your own to earn: the count with no Mob.
    expect(find.bySemanticsLabel('Tally. Finish 3 Mob games with no minus marks. 1 of 3.'), findsOneWidget);
    expect(find.bySemanticsLabel('Sticky. 5 fixes that held. 2 of 5.'), findsOneWidget);
    expect(find.bySemanticsLabel('Naav. Finish your first full-length mock. 0 of 1.'), findsOneWidget);
    expect(find.bySemanticsLabel('Cutting. Come back after 3 or more days away. 0 of 1.'), findsOneWidget);
    expect(find.bySemanticsLabel("Patang. Beat your own best score in a subject's full mock. 0 of 1."), findsOneWidget);
    // The text on the card reads the same.
    expect(find.textContaining('Your Mob fixes 3 traps together. 1 of 3, in Chai Circle.', findRichText: true), findsOneWidget);
    semantics.dispose();
  });

  testWidgets('creases in the corner: one for a starter, two for one you earn, three for one your Mob earns', (tester) async {
    await _open(tester);
    final counts = _creases(tester).toList()..sort();
    expect(counts, [1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3]);
  });

  testWidgets('finishes: the foil edge with the days so far', (tester) async {
    await _open(tester);
    expect(find.text(MobV3Copy.finishes), findsOneWidget);
    expect(find.text(MobV3Copy.foilProgress(13, 30)), findsOneWidget);
  });

  testWidgets('the Mob\'s shelf: what it has and what is next, with the counts', (tester) async {
    await _open(tester);
    expect(find.text(MobV3Copy.mobShelf('Chai Circle')), findsOneWidget);
    expect(find.text('Den stamp'), findsOneWidget);
    expect(find.text(MobV3Copy.mobShelfOwned), findsOneWidget);
    expect(find.text('A desk bell'), findsOneWidget);
    expect(find.text('3 of 4 weeks in a row'), findsOneWidget);
    expect(find.text('3 of 8 weeks in a row'), findsOneWidget);
    expect(find.text('3 of 12 weeks in a row'), findsOneWidget);
  });

  testWidgets('Change offers the Folds you own and nothing else, and sits you as the one you pick', (tester) async {
    final server = await _open(tester);
    await tester.tap(find.byKey(const ValueKey('s1-change')));
    await settleSocial(tester);
    await tester.pumpAndSettle();
    expect(find.text(MobV3Copy.changeFoldTitle), findsOneWidget);
    // In the chooser, each owned name appears once more than on the shelf; a locked Fold is not offered.
    expect(find.text('Hexa'), findsNWidgets(2));
    expect(find.text('Crane'), findsNothing);
    await tester.tap(find.text('Hexa').last);
    await settleSocial(tester);
    await tester.pumpAndSettle();
    expect(server.calls, contains('profile:hexa:plain'));
    expect(find.text(MobV3Copy.youPlayAs('Hexa')), findsOneWidget);
  });

  testWidgets('FOLD_LOCKED from the server is said in a sentence, and you still play as the same Fold', (tester) async {
    await _open(tester, server: SocialServer(failures: {'profile': 'FOLD_LOCKED'}));
    await tester.tap(find.byKey(const ValueKey('s1-change')));
    await settleSocial(tester);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Hexa').last);
    await settleSocial(tester);
    await tester.pumpAndSettle();
    expect(find.text(MobV3Copy.errors['FOLD_LOCKED']!), findsOneWidget);
    expect(find.text(MobV3Copy.youPlayAs('Dart')), findsOneWidget);
  });

  testWidgets('tapping a locked Fold opens its big still with its line and its rule, and no way to play as it', (tester) async {
    await _open(tester);
    await tester.tap(find.byType(FoldTile).at(5));
    await settleSocial(tester);
    await tester.pumpAndSettle();
    expect(find.text(MobV3Copy.foldLine(FoldKey.crane)), findsOneWidget);
    // The card behind the sheet says it too: once on the card, once in the sheet.
    expect(find.text('Crane. Your Mob fixes 3 traps together. 1 of 3, in Chai Circle.'), findsNWidgets(2));
    expect(find.byKey(const ValueKey('s1-play-as')), findsNothing);
  });

  testWidgets('tapping an owned Fold offers Play as, and the key sits you as it', (tester) async {
    final server = await _open(tester);
    await tester.tap(find.byType(FoldTile).at(1));
    await settleSocial(tester);
    await tester.pumpAndSettle();
    expect(find.text(MobV3Copy.playAs(FoldKey.dogear)), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('s1-play-as')));
    await settleSocial(tester);
    await tester.pumpAndSettle();
    expect(server.calls, contains('profile:dogear:plain'));
    expect(find.text(MobV3Copy.youPlayAs('Dog-ear')), findsOneWidget);
  });

  testWidgets('the Fold you play as has no Play as key in its detail', (tester) async {
    await _open(tester);
    await tester.tap(find.byType(FoldTile).first);
    await settleSocial(tester);
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('s1-play-as')), findsNothing);
    expect(find.text(MobV3Copy.shelfSeatTag('Dart')), findsWidgets);
  });

  testWidgets('a failed read says so and offers Try again', (tester) async {
    await _open(tester, server: SocialServer(failures: {'shelf': 'SOMETHING_ELSE'}));
    expect(find.text(MobV3Copy.shelfFailed), findsOneWidget);
    expect(find.text(MobV3Copy.tryAgain), findsOneWidget);
  });

  testWidgets('Day, a narrow phone and large text: no overflow', (tester) async {
    final server = SocialServer();
    await pumpSocial(tester, const ShelfScreen(), server, size: const Size(320, 3600), scale: 1.3, brightness: Brightness.light);
    await settleSocial(tester);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Folds you earn move from still to earn to yours', (tester) async {
    final server = SocialServer(scenario: 'questdone');
    server.denNow(); // the quest paid out when the den was read: Hop is yours
    await _open(tester, server: server);
    expect(find.byType(FoldTile), findsNWidgets(12));
    expect(find.text(MobV3Copy.foldLine(FoldKey.hop)), findsOneWidget);
    final counts = _creases(tester).toList();
    expect(counts.length, 12);
  });
}
