import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/review/widgets/collapsible.dart';
import 'package:mockmob/features/review/widgets/mistake_map.dart';

double _opacity(WidgetTester tester, Finder child) {
  final fades = find.ancestor(of: child, matching: find.byType(FadeTransition));
  var o = 1.0;
  for (final e in fades.evaluate()) {
    o *= (e.widget as FadeTransition).opacity.value;
  }
  return o;
}

void main() {
  test('the content fade begins 112 ms into the 320 ms opening', () {
    expect(MmCollapsible.fadeLead, const Duration(milliseconds: 112));
  });

  testWidgets('a thread row stagger starts when the section content fade does, not under it', (tester) async {
    final expanded = ValueNotifier(false);
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ValueListenableBuilder<bool>(
            valueListenable: expanded,
            builder: (context, open, _) => MmCollapsible(
              expanded: open,
              child: const Column(
                children: [
                  ThreadRowIn(index: 0, child: Text('first row')),
                  ThreadRowIn(index: 3, child: Text('fourth row')),
                ],
              ),
            ),
          ),
        ),
      ),
    );
    expanded.value = true;
    await tester.pump();
    // Inside the lead, neither the section content nor the rows have started: nothing is seen
    // while the size opens.
    await tester.pump(const Duration(milliseconds: 100));
    expect(_opacity(tester, find.text('first row')), lessThan(0.05));
    // The section fade and the first row start together: the first row is on its way in...
    await tester.pump(const Duration(milliseconds: 80));
    final early = _opacity(tester, find.text('first row'));
    expect(early, greaterThan(0));
    // ...while the fourth row (90 ms later) is still behind it, so the stagger is visible.
    expect(_opacity(tester, find.text('fourth row')), lessThan(early));
    await tester.pump(const Duration(milliseconds: 600));
    expect(_opacity(tester, find.text('fourth row')), closeTo(1, 0.01));
  });
}
