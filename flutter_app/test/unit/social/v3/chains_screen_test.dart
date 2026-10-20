// C1 and C2, the chains (now the Your chain and This week sheets, opened through the old route): the figure and its words, the strip, passes, make-up, a new chain after a break, the
// calendar, the milestones, "Exam pause days", "Hide my chain" and its hidden state; C2's pennant, quest
// (56 of 60, and 70 of 60 with the bar full), what filled it by game, the parcel, how it counts, step out and
// the path of den items. Nothing counts down, warns, or says "N of you" about a game.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/social/v3/screens/chains_screen.dart';
import 'package:mockmob/features/social/v3/widgets/quest_segments.dart';

import '../../../helpers/golden_harness.dart';
import 'mob_v3_test_kit.dart';
import 'sheets_test_kit.dart';

final _pressure = RegExp(r'!|\bat risk\b|\bhurry\b|\bwarning\b|\bexpires?\b|\bhours? left\b|\blost\b', caseSensitive: false);

Future<void> _screen(WidgetTester t, dynamic server, {bool mobTab = false, double scale = 1, Size size = const Size(360, 2400), JsonEdit? edit}) async {
  loadFoldManifestForTest();
  await pumpMockmob(t, ChainsScreen(mobTab: mobTab), size: size, textScale: scale, wrapInScaffold: false, disableAnimations: true, overrides: sheetOverrides(server, edit: edit));
  await t.pumpAndSettle();
  await settleImages(t);
}

void main() {
  group('C1 You', () {
    testWidgets('the figure, its words, today, the passes, the calendar and the milestones', (t) async {
      await _screen(t, v3Server());
      // The Chains screen is a redirect now: the Your chain sheet rises, with no tabs.
      expect(find.text('Your chain'), findsOneWidget);
      expect(find.text('Chai Circle'), findsNothing);
      expect(find.text('days in a row'), findsOneWidget);
      expect(find.text('12 practised and 1 rested. Your best run.'), findsOneWidget);
      expect(find.text('2 of 5'), findsOneWidget);
      expect(find.text('Answer 3 more questions today to count it.'), findsOneWidget);
      expect(find.text('2 rest passes, the most you can hold'), findsOneWidget);
      expect(find.text('Miss a day and one is used for you. You earn one every 7 days, and one for every 3 fixes that hold.'), findsOneWidget);
      expect(find.text('October'), findsOneWidget);
      expect(find.text('Moon: a rest pass kept the chain.'), findsOneWidget);
      expect(find.text('Rest pass at 3'), findsOneWidget);
      expect(find.text('Rest pass at 7'), findsOneWidget);
      expect(find.text('Rest pass at 21'), findsOneWidget);
      expect(find.text('Foil edge at 30'), findsOneWidget);
      expect(find.text('1 more day'), findsOneWidget);
      expect(find.text('Exam pause days'), findsOneWidget);
      expect(find.text('Hide my chain'), findsOneWidget);
      // No make-up card without an open day.
      expect(find.textContaining('was missed'), findsNothing);
      expect(allTexts(t).where(_pressure.hasMatch), isEmpty);
    });

    testWidgets('after a break with a make-up open: the card, its rule, and the new chain line', (t) async {
      await _screen(t, v3Server(scenario: 'makeup'));
      expect(find.text('Wednesday was missed and no pass was left. Answer 10 questions today or tomorrow and Wednesday counts.'), findsOneWidget);
      expect(find.text('A make-up can be used once every 14 days.'), findsOneWidget);
      expect(find.text('A new chain starts today. Your best is 23 days.'), findsOneWidget);
      expect(find.text('0 rest passes'), findsOneWidget);
      expect(allTexts(t).where(_pressure.hasMatch), isEmpty);
    });

    testWidgets('Hide my chain shows the hidden line, and Show my chain brings it back', (t) async {
      await _screen(t, v3Server());
      await tapAt(t, find.text('Hide my chain'));
      expect(find.text('Your chain is hidden. It still counts, and nobody else ever sees it.'), findsOneWidget);
      expect(find.text('days in a row'), findsNothing);
      expect(keyLabel('Show my chain'), findsOneWidget);
      await tapAt(t, keyLabel('Show my chain'));
      expect(find.text('days in a row'), findsOneWidget);
      expect(find.text('Hide my chain'), findsOneWidget);
    });

    testWidgets('Exam pause days opens the pause sheet', (t) async {
      await _screen(t, v3Server());
      await tapAt(t, find.text('Exam pause days'));
      expect(find.text('Set days ahead for school exams. Your chain holds on those days. You have 14 a season, and 14 are left.'), findsOneWidget);
    });

    testWidgets('reads at 1.3x text and at 412 dp without overflow', (t) async {
      await _screen(t, v3Server(), scale: 1.3, size: const Size(360, 3200));
      expect(t.takeException(), isNull);
      await _screen(t, v3Server(), size: const Size(412, 2400));
      expect(t.takeException(), isNull);
    });
  });

  group('C2 the Mob', () {
    testWidgets('the pennant, the quest at 51 of 60, what filled it, the parcel, how it counts, the path', (t) async {
      await _screen(t, v3Server(), mobTab: true);
      expect(find.text('3 weeks in a row'), findsOneWidget);
      expect(find.text('A week is stitched each time Chai Circle finishes the weekly quest. Nobody can break it alone.'), findsOneWidget);
      expect(find.text('Best run: 3 weeks'), findsOneWidget);
      expect(find.text("This week's quest"), findsOneWidget);
      expect(find.text('Ends Sunday 11:59 PM'), findsOneWidget);
      expect(find.text('Answer 60 questions together in Mob games and papers.'), findsOneWidget);
      expect(find.text('51 of 60 answered', findRichText: true), findsOneWidget);
      expect(find.text('What filled it'), findsOneWidget);
      expect(find.text("Monday's Mob paper"), findsOneWidget);
      expect(find.text('37'), findsOneWidget);
      expect(find.text("Riya's sprint"), findsOneWidget);
      expect(find.text("Hop is folded in this week's parcel. Finish the quest and everyone in Chai Circle gets Hop."), findsOneWidget);
      expect(find.text('How it counts'), findsOneWidget);
      expect(find.textContaining('Sized for 4 of you: 15 each.'), findsOneWidget);
      expect(find.text('Step out this week'), findsOneWidget);
      for (final s in ['Den stamp at 2', 'Stamp and the desk bell at 4', 'Brass lamp at 8', 'Foil seal at 12']) {
        expect(find.text(s), findsOneWidget);
      }
      // What filled it is by game: no row says how many of you.
      final rows = allTexts(t).where((s) => s.contains("Mob paper") || s.contains("sprint") || s.contains("round"));
      expect(rows.where((s) => s.contains('of you')), isEmpty);
      expect(allTexts(t).where(_pressure.hasMatch), isEmpty);
    });

    testWidgets('70 answered of 60: the true total, "The quest needed 60.", and the bar stays full', (t) async {
      await _screen(t, v3Server(scenario: 'questdone'), mobTab: true);
      expect(find.text('70 answered. The quest needed 60.', findRichText: true), findsOneWidget);
      expect(find.text('70 of 60 answered', findRichText: true), findsNothing);
      expect(find.text('4 weeks in a row'), findsOneWidget);
      expect(find.text('Kabir\'s round'), findsOneWidget);
      // Done: no parcel line and no step-out to offer.
      expect(find.textContaining('is folded in this week'), findsNothing);
      expect(find.text('Step out this week'), findsNothing);
      final bar = t.widget<QuestSegments>(find.byType(QuestSegments));
      expect(bar.answered, 70);
      expect(bar.target, 60);
      expect(QuestSegments.fractionOf(bar.answered, bar.target), 1);
    });

    testWidgets('Step out changes the link, and Step back in undoes it', (t) async {
      await _screen(t, v3Server(scenario: 'one'), mobTab: true);
      await tapAt(t, find.text('Step out this week'));
      expect(find.text('You stepped out this week. Step back in'), findsOneWidget);
      await tapAt(t, find.text('You stepped out this week. Step back in'));
      expect(find.text('Step out this week'), findsOneWidget);
    });

    testWidgets('stepping out can finish a quest, and then the quest says done and the link goes (server rule)', (t) async {
      await _screen(t, v3Server(), mobTab: true);
      await tapAt(t, find.text('Step out this week'));
      expect(find.text('Step out this week'), findsNothing);
      expect(find.text('Answer 45 questions together in Mob games and papers.'), findsOneWidget);
      expect(find.textContaining('Sized for 3 of you: 15 each.'), findsOneWidget);
    });

    testWidgets('a student with no Mob sees only their own chain, without tabs', (t) async {
      await _screen(t, v3Server(scenario: 'fresh'));
      expect(find.text('days in a row'), findsOneWidget);
      expect(find.text('Chai Circle'), findsNothing);
    });
  });
}
