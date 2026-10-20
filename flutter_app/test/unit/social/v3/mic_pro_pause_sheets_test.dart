// P3 Pass the mic, P4 Free and Pro in the Mob, P5 Exam pause days.

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/billing/widgets/pro_page.dart' show ProPage;
import 'package:mockmob/features/pro_nudge/copy.dart';
import 'package:mockmob/features/social/v3/widgets/free_pro_sheet.dart';
import 'package:mockmob/features/social/v3/widgets/mic_sheet.dart';
import 'package:mockmob/features/social/v3/widgets/pause_sheet.dart';

import '../../billing/billing_test_support.dart' show BillingRig;
import 'mob_v3_test_kit.dart';
import 'sheets_test_kit.dart';

final _price = RegExp(r'₹|\$|\bprice\b|\bbuy\b|per month|\bRs\b|\bUSD\b', caseSensitive: false);

void main() {
  setUp(loadFoldManifestForTest);

  group('P3 Pass the mic', () {
    testWidgets('lists the others, not you; the key waits for a choice, then names who', (t) async {
      await openSheet(t, showMicSheet, sheetOverrides(v3Server(scenario: 'quiet', billing: 'pro')));
      expect(find.text('Let a friend start one game in Chai Circle this week.'), findsOneWidget);
      for (final n in ['Riya', 'Kabir', 'Zoya']) {
        expect(find.text(n), findsOneWidget);
      }
      expect(find.text('Aarav'), findsNothing, reason: 'others only');
      expect(find.text('You can pass it 2 times a week.'), findsOneWidget);
      expect(keyLabel('Pass the mic'), findsOneWidget);
      await tapAt(t, find.text('Kabir'));
      expect(keyLabel('Pass the mic to Kabir'), findsOneWidget);
    });

    testWidgets('passing the mic says it in a toast and closes the sheet', (t) async {
      final server = v3Server(scenario: 'quiet', billing: 'pro');
      await openSheet(t, showMicSheet, sheetOverrides(server));
      await tapAt(t, find.text('Kabir'));
      await tapAt(t, keyLabel('Pass the mic to Kabir'));
      expect(find.text('Kabir can start one game this week.'), findsOneWidget);
      expect(find.text('Let a friend start one game in Chai Circle this week.'), findsNothing);
    });

    testWidgets('MIC_LIMIT is the server sentence, inline, and the sheet stays', (t) async {
      await openSheet(t, showMicSheet, sheetOverrides(FailingServer(scenario: 'quiet', billing: 'pro', micCode: 'MIC_LIMIT')));
      await tapAt(t, find.text('Riya'));
      await tapAt(t, keyLabel('Pass the mic to Riya'));
      expect(find.text('You passed the mic twice this week, the most a week allows. You can pass it again on Monday.'), findsOneWidget);
      expect(find.text('Let a friend start one game in Chai Circle this week.'), findsOneWidget);
    });

    testWidgets('never says who has Pro', (t) async {
      await openSheet(t, showMicSheet, sheetOverrides(v3Server(scenario: 'quiet', billing: 'pro')));
      expect(noText(t, 'Pro'), isTrue);
    });
  });

  group('P4 Free and Pro in the Mob', () {
    testWidgets('the exact lists, no price, a key to the plans', (t) async {
      await openSheet(t, showFreeProSheet, sheetOverrides(v3Server(scenario: 'quiet', billing: 'free'), nudges: true));
      expect(find.text('Pro never changes marks, chains or what you can earn. It adds hosting.'), findsOneWidget);
      expect(find.text('Free, always'), findsOneWidget);
      for (final s in [
        'Play every game your Mob starts, as often as you like.',
        'The weekly Mob paper, in every Mob you are in.',
        'One start a week in each Mob.',
        'Your chain, rest passes and make-up days.',
        'The podium, your marks and Fix it together.',
        'Every Fold and sticker you earn.',
        // Live rooms are not sold while the server's live switch is off (L-04).
        'Start as many games as you like.',
        'Pass the mic to a friend, twice a week.',
        'Start up to 3 Mobs.',
        'Nothing you earn in the Mob is for sale.',
      ]) {
        expect(find.text(s), findsOneWidget, reason: s);
      }
      expect(find.text('Pro adds'), findsOneWidget);
      expect(keyLabel('See Pro plans'), findsOneWidget);
      expect(noText(t, _price), isTrue);
    });

    testWidgets('See Pro plans opens the Pro page with the hosting headline', (t) async {
      await openSheet(t, showFreeProSheet, [...sheetOverrides(v3Server(scenario: 'quiet', billing: 'free'), nudges: true), ...BillingRig(on: true).overrides]);
      await tapAt(t, keyLabel('See Pro plans'));
      await t.pump(const Duration(seconds: 1));
      expect(find.byType(ProPage), findsOneWidget);
      expect(find.text(ProNudgeCopy.head(ProReason.mobHosting).title), findsOneWidget);
    });

    testWidgets('no key when the Pro nudges are off', (t) async {
      await openSheet(t, showFreeProSheet, sheetOverrides(v3Server(scenario: 'quiet', billing: 'free')));
      expect(keyLabel('See Pro plans'), findsNothing);
    });

    testWidgets('with billing off the sheet does not open and no plan word shows', (t) async {
      await openSheet(t, showFreeProSheet, sheetOverrides(v3Server(scenario: 'quiet'), nudges: true));
      expect(find.text('Free and Pro in the Mob'), findsNothing);
      expect(noText(t, 'Pro'), isTrue);
    });
  });

  group('P5 Exam pause days', () {
    testWidgets('the line, the calendar, and no key until days are chosen', (t) async {
      await openSheet(t, showPauseSheet, sheetOverrides(v3Server()));
      expect(find.text('Exam pause days'), findsOneWidget);
      expect(find.text('Set days ahead for school exams. Your chain holds on those days. You have 14 a season, and 14 are left.'), findsOneWidget);
      expect(find.text('October 2026'), findsOneWidget);
      expect(keyLabel('Choose days to pause'), findsOneWidget);
    });

    testWidgets('a day up to today cannot be chosen', (t) async {
      await openSheet(t, showPauseSheet, sheetOverrides(v3Server()));
      await tapAt(t, find.text('21'));
      expect(keyLabel('Choose days to pause'), findsOneWidget);
      await tapAt(t, find.text('22'));
      expect(keyLabel('Choose days to pause'), findsOneWidget);
    });

    testWidgets('choose three days, "Pause 3 days" sets them, then "Clear these days" takes some away', (t) async {
      await openSheet(t, showPauseSheet, sheetOverrides(v3Server()));
      for (final d in ['26', '27', '28']) {
        await tapAt(t, find.text(d));
      }
      expect(keyLabel('Pause 3 days'), findsOneWidget);
      await tapAt(t, keyLabel('Pause 3 days'));
      expect(find.text('Set days ahead for school exams. Your chain holds on those days. You have 14 a season, and 11 are left.'), findsOneWidget);
      expect(keyLabel('Choose days to pause'), findsOneWidget, reason: 'the choice is cleared');
      await tapAt(t, find.text('27'));
      expect(keyLabel('Clear these days'), findsOneWidget);
      await tapAt(t, keyLabel('Clear these days'));
      expect(find.text('Set days ahead for school exams. Your chain holds on those days. You have 14 a season, and 12 are left.'), findsOneWidget);
    });

    testWidgets('PAUSE_LIMIT is the server sentence, inline', (t) async {
      await openSheet(t, showPauseSheet, sheetOverrides(FailingServer(pauseCode: 'PAUSE_LIMIT')));
      await tapAt(t, find.text('26'));
      await tapAt(t, keyLabel('Pause 1 day'));
      expect(find.text('You have used the 14 pause days this season allows.'), findsOneWidget);
    });

    testWidgets('PAUSE_PAST is the server sentence, inline', (t) async {
      await openSheet(t, showPauseSheet, sheetOverrides(FailingServer(pauseCode: 'PAUSE_PAST')));
      await tapAt(t, find.text('26'));
      await tapAt(t, keyLabel('Pause 1 day'));
      expect(find.text('Pause days have to be after today.'), findsOneWidget);
    });

    testWidgets('the later month opens', (t) async {
      await openSheet(t, showPauseSheet, sheetOverrides(v3Server()));
      await tapAt(t, find.bySemanticsLabel('Later month'));
      expect(find.text('November 2026'), findsOneWidget);
    });
  });
}
