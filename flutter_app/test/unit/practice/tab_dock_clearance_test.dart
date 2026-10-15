// Nothing on the Practice tab rests under the floating bar (owner recording 15 Oct, item 8). The
// shell adds the bar's clearance to a tab root's bottom padding (MmBarInsets); this pumps the tab
// on a 360 by 800 dp phone with a 24 dp status bar and a 24 dp gesture inset, wrapped the way
// the shell wraps it, and checks the last row ends above the bar's top edge once scrolled.
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/practice/practice_routes.dart';

import '../../helpers/fonts.dart';
import 'support/harness.dart';

const Size _phone = Size(360, 800);
const double _gesture = 24;

/// The page under the shell: the bar's clearance added to the bottom padding, as `AppShell` does.
Widget _underBar(Widget page) => Builder(
  builder: (context) {
    final media = MediaQuery.of(context);
    final clearance = MmBarInsets.clearanceFor(capsule: false);
    return MmBarInsets(
      showing: true,
      capsule: false,
      child: MediaQuery(
        data: media.copyWith(
          padding: media.padding.copyWith(bottom: media.padding.bottom + clearance),
          viewPadding: media.viewPadding.copyWith(bottom: media.viewPadding.bottom + clearance),
        ),
        child: page,
      ),
    );
  },
);

List<GoRoute> _routes() => [
  GoRoute(path: '/practice', builder: (c, s) => _underBar(practiceScreen(c, s))),
  stubRoute('/practice/start'),
  stubRoute('/practice/setup/:mode'),
  stubRoute('/learn'),
];

FakeQuoteRepository _quotes() => FakeQuoteRepository((s, m, c, p) {
  if (m == 'full') return creditsQuote(cost: 50, balance: 120, mode: 'full', count: 50);
  if (m == 'nta') return proGate();
  return dailyFree(count: c ?? 10);
});

/// The lowest edge of any text in [list] that is on the screen.
double _lowestText(Finder list) {
  var lowest = 0.0;
  for (final e in find.descendant(of: list, matching: find.byType(RichText)).evaluate()) {
    final box = e.renderObject;
    if (box is! RenderBox || !box.hasSize || !box.attached) continue;
    final r = box.localToGlobal(Offset.zero) & box.size;
    if (r.top < _phone.height) lowest = math.max(lowest, r.bottom);
  }
  return lowest;
}

void main() {
  setUpAll(loadAppFonts);

  testWidgets('scrolled to the end, the last row ends above the bar on a 360 by 800 phone', (tester) async {
    tester.view.padding = const FakeViewPadding(top: 48, bottom: _gesture * 2);
    await pumpRouted(tester, location: '/practice', routes: _routes(), overrides: practiceOverrides(quotes: _quotes(), attempts: const []), size: _phone);
    for (var i = 0; i < 8; i++) {
      await tester.pump(const Duration(milliseconds: 150));
    }
    final barTop = _phone.height - _gesture - MmBar.lift - MmBar.height;

    final list = find.byType(ListView).first;
    final position = tester.state<ScrollableState>(find.descendant(of: list, matching: find.byType(Scrollable)).first).position;
    // The rows below the modes build as they come into view and the list's length settles with
    // them, so the end is found in steps, each allowed to settle.
    for (var i = 0; i < 6; i++) {
      position.jumpTo(position.maxScrollExtent);
      for (var k = 0; k < 6; k++) {
        await tester.pump(const Duration(milliseconds: 100));
      }
      if ((position.pixels - position.maxScrollExtent).abs() < 0.5) break;
    }
    expect(position.pixels, closeTo(position.maxScrollExtent, 0.5));
    expect(_lowestText(list), lessThanOrEqualTo(barTop - MmBar.contentGap), reason: 'the last row clears the bar with its gap');

    // The modes are reachable: a scroll brings both above the bar.
    position.jumpTo(0);
    await tester.pump(const Duration(milliseconds: 150));
    await tester.ensureVisible(find.text('By chapter'));
    await tester.pump(const Duration(milliseconds: 300));
    for (final title in const ['Quick practice', 'By chapter']) {
      expect(tester.getRect(find.text(title)).bottom, lessThanOrEqualTo(barTop), reason: '$title rests above the bar once scrolled to');
    }
  });
}
