import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/features/learn2/data/learn_providers.dart' show LearnOnNotifier, learnOnProvider;
import 'package:mockmob/features/practice/practice_routes.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart' show settleImages;
import '../../unit/learn/support/learn_fixtures.dart' as learn;
import '../../unit/learn2/explore/explore_support.dart';
import '../../unit/practice/support/harness.dart';

/// LK51: Practice's four doors, "Practise | Papers | Learn | Explore", on the Explore door, at 360 by 800 dp, Night and Day, at
/// text 1 and 1.3 (the switch keeps every label whole), and on Practise (where the Papers badge sits on the fourth-door switch).
/// The covers are the recorded answer of the web preview (Accountancy, Pro).
class _On extends LearnOnNotifier {
  @override
  bool build() => true;
}

const Size _size = Size(360, 800);

List<Override> _overrides() {
  final practice = practiceOverrides(
    quotes: FakeQuoteRepository((s, m, c, p) {
      if (m == 'full') return creditsQuote(cost: 50, balance: 120, mode: 'full', count: 50);
      if (m == 'nta' || m == 'smart') return proGate();
      return dailyFree(count: c ?? 10);
    }),
    attempts: const [],
    openRepairs: 4,
    learn: learn.catalog(due: 0),
  );
  final explore = exploreOverrides(CoversApi.of(CoversFixture.pro), subjects: const ['accountancy', 'business_studies', 'economics']);
  final taken = {for (final o in practice) o.origin};
  return [...practice, for (final o in explore) if (!taken.contains(o.origin)) o, learnOnProvider.overrideWith(_On.new)];
}

List<GoRoute> _routes() => [
  GoRoute(path: '/practice', builder: (c, s) => practiceScreen(c, s)),
  stubRoute('/practice/stream'),
  stubRoute('/explore/feed'),
  stubRoute('/practice/setup/:mode'),
  stubRoute('/practice/start'),
  stubRoute('/exam/nta'),
  stubRoute('/tools/compass'),
  stubRoute('/run/:sessionId'),
];

Future<void> _shot(WidgetTester tester, String name, Brightness b, {double textScale = 1}) async {
  await pumpRouted(tester, location: name.startsWith('explore_door') ? '/practice?door=explore' : '/practice', routes: _routes(), overrides: _overrides(), size: _size, textScale: textScale, brightness: b);
  await tester.pump(const Duration(milliseconds: 100));
  await tester.pump(const Duration(milliseconds: 600));
  await tester.pump(const Duration(seconds: 1));
  await settleImages(tester);
  final tag = b == Brightness.dark ? 'night' : 'day';
  await expectLater(find.byKey(previewBoundary), matchesGoldenFile('goldens/${name}_$tag.png'));
  final dir = Platform.environment['MM_PREVIEW_DIR'];
  if (dir != null && dir.isNotEmpty) {
    final boundary = previewBoundary.currentContext!.findRenderObject()! as RenderRepaintBoundary;
    await tester.runAsync(() async {
      final image = await boundary.toImage(pixelRatio: 2);
      final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
      image.dispose();
      await File('$dir/practice_${name}_$tag.png').writeAsBytes(bytes!.buffer.asUint8List());
    });
  }
}

void main() {
  setUpAll(loadAppFonts);

  for (final b in [Brightness.dark, Brightness.light]) {
    group('practice, four doors, ${b.name}', () {
      testWidgets('the Explore door at 360 by 800', (tester) => _shot(tester, 'explore_door', b));
      testWidgets('the Explore door at 360 by 800, text 1.3', (tester) => _shot(tester, 'explore_door_text13', b, textScale: 1.3));
      testWidgets('Practise with the four-door switch at 360 by 800', (tester) => _shot(tester, 'four_doors_practise', b));
      testWidgets('Practise with the four-door switch at 360 by 800, text 1.3', (tester) => _shot(tester, 'four_doors_practise_text13', b, textScale: 1.3));
    });
  }
}
