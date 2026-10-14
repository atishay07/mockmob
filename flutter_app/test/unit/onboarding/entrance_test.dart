import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/onboarding/widgets/choice_tile.dart';
import 'package:mockmob/features/onboarding/widgets/entrance.dart';

import '../../helpers/fonts.dart';

Widget _app(Widget child, {bool reduce = false}) => ProviderScope(
      child: MaterialApp(
        theme: buildTheme(Brightness.dark),
        home: Builder(
          builder: (context) => MediaQuery(
            data: MediaQuery.of(context).copyWith(disableAnimations: reduce),
            child: Scaffold(body: child),
          ),
        ),
      ),
    );

class _Counter extends StatefulWidget {
  const _Counter();

  static int created = 0;

  @override
  State<_Counter> createState() => _CounterState();
}

class _CounterState extends State<_Counter> {
  @override
  void initState() {
    super.initState();
    _Counter.created++;
  }

  @override
  Widget build(BuildContext context) => const SizedBox(height: 20);
}

void main() {
  setUpAll(loadAppFonts);

  testWidgets('the headline rises, then is the plain text it was laid out as', (tester) async {
    const title = 'Which CUET are you writing?';
    await tester.pumpWidget(_app(const StepEntrance(child: RiseHeadline(title, style: TextStyle(fontSize: 28)))));
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.text(title), findsNothing, reason: 'painted word by word while it rises');
    expect(find.bySemanticsLabel(title), findsOneWidget, reason: 'read whole while it rises');
    await tester.pump(Entrance.total);
    await tester.pump();
    expect(find.text(title), findsOneWidget);
  });

  testWidgets('reduced motion shows every step entrance finished at once', (tester) async {
    const title = 'Pick a pace you can keep.';
    await tester.pumpWidget(_app(
      const StepEntrance(
        child: Column(children: [RiseHeadline(title, style: TextStyle(fontSize: 28)), EntranceItem(at: Entrance.key, child: Text('Continue'))]),
      ),
      reduce: true,
    ));
    expect(find.text(title), findsOneWidget);
    final opacity = tester.widget<Opacity>(find.ancestor(of: find.text('Continue'), matching: find.byType(Opacity)).first);
    expect(opacity.opacity, 1);
  });

  testWidgets('an item lifting into place keeps its state when it lands', (tester) async {
    _Counter.created = 0;
    await tester.pumpWidget(_app(StepEntrance(child: EntranceItem.answer(0, child: const _Counter()))));
    for (var i = 0; i < 12; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
    expect(_Counter.created, 1, reason: 'never remounted when the lift ends');
  });

  testWidgets('a choice tile tells the guide where the student touched', (tester) async {
    final glances = <Offset>[];
    var taps = 0;
    await tester.pumpWidget(_app(
      GuideGlance(
        onGlance: glances.add,
        child: Center(
          child: SizedBox(
            width: 160,
            child: ChoiceTile(selected: false, onTap: () => taps++, semanticsLabel: 'Early', child: const Text('Early')),
          ),
        ),
      ),
    ));
    await tester.tap(find.text('Early'));
    await tester.pump(const Duration(milliseconds: 400));
    expect(taps, 1);
    expect(glances, hasLength(1));
    expect((glances.single - tester.getCenter(find.byType(ChoiceTile))).distance, lessThan(1));
    expect(tester.getSize(find.byType(ChoiceTile)).height, greaterThanOrEqualTo(48));
  });
}
