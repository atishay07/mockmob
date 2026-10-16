import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/practice/copy.dart';
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

  testWidgets('at 360 by 800 the strip, the one Start key and the first mode share the first screen', (tester) async {
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
    final card = tester.getRect(find.byType(SuggestionCard));
    final quick = tester.getRect(find.text(PracticeCopy.quickTitle));
    expect(strip.bottom, lessThanOrEqualTo(card.top), reason: 'the subjects lead, the card follows');
    expect(card.bottom, lessThanOrEqualTo(quick.top), reason: 'the first mode sits under the card');
    expect(quick.bottom, lessThanOrEqualTo(barTop), reason: 'the first mode shows above the bar');
    // One lit Start key on the whole tab.
    for (final e in find.byType(KeyButton).evaluate()) {
      final chain = <String>[];
      e.visitAncestorElements((a) { chain.add(a.widget.runtimeType.toString()); return chain.length < 14; });
      // ignore: avoid_print
      print('DBGKEY ${chain.join(' < ')}');
    }
    // ignore: avoid_print
    print('DBGRECT strip=$strip card=$card quick=$quick barTop=$barTop');
    expect(find.byType(KeyButton), findsOneWidget);
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
