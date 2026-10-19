// R8 Everyone's moment and R9 Fix it together (spec 5.3, F1, F3): no moment names the trap
// question, the open card versus the closed trap card, no count of who was wrong; Fix it together
// is refused before close and shows only your own pick; the fresh question answers at once.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_fake_server.dart';
import 'package:mockmob/features/social/v3/screens/fix_together_screen.dart';
import 'package:mockmob/features/social/v3/screens/moments_screen.dart';
import 'package:mockmob/features/social/v3/widgets/podium_stage.dart';

import '../../../helpers/golden_harness.dart';
import '../../../unit/social/v3/mob_v3_test_kit.dart';
import 'results_kit.dart';

String _plain(WidgetTester tester, Finder f) {
  final w = tester.widget<Text>(f);
  return w.textSpan?.toPlainText() ?? w.data ?? '';
}

List<String> _allText(WidgetTester tester) => [
      for (final e in find.byType(Text).evaluate()) ((e.widget as Text).textSpan?.toPlainText() ?? (e.widget as Text).data ?? ''),
    ];

void main() {
  late MobV3FakeServer server;

  setUpAll(() async {
    loadFoldManifestForTest();
    FoilSheenProgram.enabled = false;
    server = await openServer();
  });

  Future<void> pump(WidgetTester tester, Widget w, {MobV3FakeServer? s}) async {
    await pumpMockmob(tester, w, brightness: Brightness.dark, size: const Size(360, 900), wrapInScaffold: false, overrides: v3Overrides(s ?? server));
    await tester.pump(const Duration(milliseconds: 600));
  }

  group('R8 Everyone\'s moment', () {
    testWidgets('closed with a trap: the trap card, steps, progress and the fix key', (tester) async {
      await pump(tester, const MomentsScreen(gameId: zoyaGame));
      expect(find.text("Everyone's moment"), findsOneWidget);
      expect(find.text('The question that caught most of you'), findsOneWidget);
      expect(find.text('Question 4 caught most of you.'), findsOneWidget);
      expect(find.text('1. Now'), findsOneWidget);
      expect(find.text('See why, then one fresh question.'), findsOneWidget);
      expect(find.text('2. Wednesday 28 Oct'), findsOneWidget);
      expect(find.text('One more checks the fix holds.'), findsOneWidget);
      expect(find.text('Chai Circle has fixed 1 of 3 traps. Crane comes at 3.'), findsOneWidget);
      expect(find.text('Fix question 4 together'), findsOneWidget);
      expect(find.text('Back to the den'), findsNothing);
      expect(find.byKey(const ValueKey('moments-open')), findsNothing);
    });

    testWidgets('F3: no moment mentions the trap question, and nothing counts who was wrong', (tester) async {
      await pump(tester, const MomentsScreen(gameId: zoyaGame));
      for (final id in [youId, riyaId, kabirId, zoyaId]) {
        final f = find.byKey(ValueKey('moment-$id'));
        expect(f, findsOneWidget, reason: 'one row per player');
        final s = _plain(tester, f);
        expect(s.toLowerCase(), isNot(contains('question 4')), reason: s);
      }
      final text = _allText(tester);
      expect(text.where((t) => RegExp(r'\b\d+ of you\b').hasMatch(t)), isEmpty);
      expect(text.where((t) => RegExp(r'got it wrong|were wrong|was wrong', caseSensitive: false).hasMatch(t)), isEmpty);
      // "You" for you, first names for friends.
      expect(_plain(tester, find.byKey(const ValueKey('moment-$youId'))), startsWith('You: '));
      expect(_plain(tester, find.byKey(const ValueKey('moment-$riyaId'))), startsWith('Riya: '));
    });

    testWidgets('open: the answers-open card and "Back to the den"', (tester) async {
      await pump(tester, const MomentsScreen(gameId: riyaGame));
      expect(find.text('The answers open when the game closes at 2:05 PM tomorrow. Fix it together starts then.'), findsOneWidget);
      expect(find.byKey(const ValueKey('moments-trap')), findsNothing);
      expect(find.text('Back to the den'), findsOneWidget);
      expect(find.textContaining('caught'), findsNothing);
    });
  });

  group('R9 Fix it together', () {
    testWidgets('refused before close', (tester) async {
      await pump(tester, const FixTogetherScreen(gameId: riyaGame, q: 4));
      expect(find.text('This opens when the game closes.'), findsOneWidget);
      expect(find.text('Back'), findsOneWidget);
      expect(find.byKey(const ValueKey('fix-sheet')), findsNothing);
    });

    testWidgets('your pick only: one pencil strike (yours), the right one filled, no names', (tester) async {
      await pump(tester, const FixTogetherScreen(gameId: zoyaGame, q: 4));
      expect(find.text('Fix question 4 together'), findsOneWidget);
      expect(find.text('Chai Circle, one trap'), findsOneWidget);
      expect(find.text('Question 4'), findsOneWidget);
      expect(find.text('Why it looked right'), findsOneWidget);
      final struck = find.byWidgetPredicate((w) => w.key is ValueKey && '${(w.key as ValueKey).value}'.endsWith('-struck'));
      expect(struck, findsOneWidget);
      expect(find.byKey(const ValueKey('fix-bubble-1-struck')), findsOneWidget, reason: 'your pick was B');
      expect(find.byKey(const ValueKey('fix-bubble-0-right')), findsOneWidget);
      for (final n in ['Riya', 'Kabir', 'Zoya']) {
        expect(find.textContaining(n), findsNothing, reason: 'nobody else is named on the sheet');
      }
      expect(find.text('Your check opens on Wednesday 28 Oct.'), findsOneWidget);
      expect(find.text('1 of 3'), findsOneWidget);
      expect(find.text('Try a fresh question'), findsOneWidget);
    });

    testWidgets('the fresh question answers at once, with the why', (tester) async {
      await pump(tester, const FixTogetherScreen(gameId: zoyaGame, q: 4));
      await tester.tap(find.text('Try a fresh question'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 600));
      expect(find.byKey(const ValueKey('fix-fresh-stem')), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('fix-option-2')));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 600));
      final verdict = _plain(tester, find.byKey(const ValueKey('fix-verdict')));
      expect(verdict == 'Right. That one is fixed for you.' || verdict == 'Not this one. Here is why.', isTrue);
      expect(find.text('Back to the den'), findsOneWidget);
      expect(find.text('Your check opens on Wednesday 28 Oct.'), findsOneWidget);
    });
  });
}
