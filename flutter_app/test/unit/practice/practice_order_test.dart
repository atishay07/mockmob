import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/insights/ask_mobi.dart' show AskMobiCard;
import 'package:mockmob/features/practice/copy.dart';
import 'package:mockmob/features/practice/widgets/door_switch.dart' show PracticeDoorSwitch;
import 'package:mockmob/features/practice/practice_routes.dart';
import 'package:mockmob/features/practice/widgets/subject_tiles.dart';
import 'package:mockmob/features/practice/widgets/suggestion_card.dart';

import '../../helpers/fonts.dart';
import '../core_data/support/fixtures.dart';
import 'support/harness.dart';

/// L08, the order and the first screen: the subject strip, then the one lit "Up next" card, then the
/// first mode, all above the bar at 360 by 800 dp; the card is the compact one and nothing it
/// said is lost (the count moves into the key).
List<GoRoute> _routes() => [
  GoRoute(path: '/practice', builder: (c, s) => practiceScreen(c, s)),
  stubRoute('/practice/setup/:mode'),
  stubRoute('/learn'),
  stubRoute('/review'),
  stubRoute('/tools/compass'),
];

final DateTime _evening = DateTime(2026, 10, 12, 19);

Future<void> _settle(WidgetTester tester) async {
  await tester.pump(const Duration(milliseconds: 100));
  await tester.pump(const Duration(milliseconds: 600));
  await tester.pump(const Duration(seconds: 2));
}

void main() {
  setUpAll(loadAppFonts);

  testWidgets("at 360 by 800 the door switch, the strip and the first two modes share the first screen; the card follows the modes (H6)", (tester) async {
    final mock = attemptOf(
      id: 'm1',
      subject: 'accountancy',
      completedAt: _evening.subtract(const Duration(days: 1)).millisecondsSinceEpoch,
      questions: chapterOf('Goodwill', wrong: 3),
    );
    await pumpRouted(
      tester,
      location: '/practice',
      routes: _routes(),
      overrides: practiceOverrides(now: _evening, auth: signedIn(subjects: const ['accountancy', 'english']), attempts: [mock]),
      size: const Size(360, 800),
    );
    await _settle(tester);

    // The bar and its lift cover the foot of the screen.
    final barTop = 800 - MmBar.lift - MmBar.height;
    final strip = tester.getRect(find.byType(SubjectTiles));
    final quick = tester.getRect(find.text(PracticeCopy.quickTitle));
    final chapter = tester.getRect(find.text(PracticeCopy.chapterTitle));
    expect(tester.getRect(find.byType(PracticeDoorSwitch)).bottom, lessThanOrEqualTo(strip.top), reason: 'the doors sit under the title');
    expect(strip.bottom, lessThanOrEqualTo(quick.top), reason: 'the subjects lead, the ways to practise follow');
    expect(quick.bottom, lessThan(barTop), reason: 'Quick practice is in the first view (H6: the ways to practise on top)');
    expect(chapter.bottom, lessThan(barTop), reason: 'By chapter is in the first view');
    final card = tester.getRect(find.byType(SuggestionCard, skipOffstage: false));
    expect(card.top, greaterThan(quick.bottom), reason: 'the next set comes after the modes');
    expect(tester.getRect(find.byType(AskMobiCard, skipOffstage: false)).top, greaterThan(card.top), reason: 'Ask Mobi stays under the card');
    await tester.scrollUntilVisible(find.byType(SuggestionCard), 200, scrollable: find.byType(Scrollable).first);
    // No volt key in the page body: the bar's Start key holds the screen's one volt (17 Oct), so
    // the card's own key and the "Edit subjects" link are quieter than it.
    final lit = find.byWidgetPredicate((w) => w is KeyButton && w.variant == KeyVariant.primary);
    expect(lit, findsNothing);
    expect(tester.widget<KeyButton>(find.descendant(of: find.byType(SuggestionCard), matching: find.byType(KeyButton))).variant, KeyVariant.secondary);
  });

  testWidgets('the compact card keeps its count in the key', (tester) async {
    await pumpRouted(
      tester,
      location: '/practice',
      routes: _routes(),
      overrides: practiceOverrides(now: _evening, attempts: const []),
      size: const Size(360, 800),
    );
    await _settle(tester);
    final card = tester.widget<SuggestionCard>(find.byType(SuggestionCard));
    expect(card.compact, isTrue);
    expect(card.showFigure, isFalse);
    expect(card.actionLabel, PracticeCopy.startCount(10));
  });
}
