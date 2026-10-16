import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/motion/motion.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart';

import '../../helpers/golden_harness.dart';

Widget _opener(ValueChanged<Future<void>> onOpen) {
  return Builder(
    builder: (context) => Center(
      child: TextButton(
        onPressed: () => onOpen(
          showMmSheet<void>(context: context, title: 'This week', builder: (_) => const Text('Sheet body')),
        ),
        child: const Text('Open'),
      ),
    ),
  );
}

void main() {
  testWidgets('a routed sheet fades instead of sliding when motion is reduced', (tester) async {
    late BuildContext captured;
    await pumpMockmob(tester, Builder(builder: (context) {
      captured = context;
      return const SizedBox.shrink();
    }), disableAnimations: true);
    const page = MmSheetPage<void>(child: Text('Routed'));
    final route = page.createRoute(captured) as ModalBottomSheetRoute<void>;
    expect(route.sheetAnimationStyle!.duration, Motion.reducedFade);
    expect(route.sheetAnimationStyle!.reverseDuration, Motion.reducedFade);
    expect(route.sheetAnimationStyle!.curve, Curves.linear);
  });

  testWidgets('a routed sheet rises in 420 ms at full motion', (tester) async {
    late BuildContext captured;
    await pumpMockmob(tester, Builder(builder: (context) {
      captured = context;
      return const SizedBox.shrink();
    }));
    const page = MmSheetPage<void>(child: Text('Routed'));
    final route = page.createRoute(captured) as ModalBottomSheetRoute<void>;
    expect(route.sheetAnimationStyle!.duration, Motion.sheetIn);
    expect(route.sheetAnimationStyle!.reverseDuration, Motion.sheetOut);
  });

  testWidgets('opens as glass with the 32 dp top radius and closes on the scrim', (tester) async {
    late Future<void> closed;
    await pumpMockmob(tester, _opener((f) => closed = f));

    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();
    expect(find.text('Sheet body'), findsOneWidget);
    expect(find.text('This week'), findsOneWidget);
    expect(find.text('Close'), findsNothing, reason: 'a normal sheet has a drag handle, not a Close key');

    final glass = tester.widget<GlassSurface>(
      find.ancestor(of: find.byType(MmSheetScaffold), matching: find.byType(GlassSurface)).first,
    );
    // GLASS-1017 5.7: it floats, so its bottom corners are concentric with the phone's (the
    // fallback phone corner 36, minus the 8 dp inset).
    expect(glass.borderRadius.topLeft, const Radius.circular(32));
    expect(glass.borderRadius.bottomLeft, const Radius.circular(28));
    expect(glass.role, GlassRole.sheet);
    expect(glass.fill, 0);

    await tester.tapAt(const Offset(180, 20));
    await tester.pumpAndSettle();
    await closed;
    expect(find.text('Sheet body'), findsNothing);
  });

  testWidgets('dismisses with the Close key at text scale 1.5 and fills the screen', (tester) async {
    late Future<void> closed;
    await pumpMockmob(tester, _opener((f) => closed = f), textScale: 1.5);

    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();
    expect(find.text('Close'), findsOneWidget);

    final scaffold = tester.getSize(find.byType(MmSheetScaffold));
    expect(scaffold.height, greaterThan(700), reason: 'a full page, not a partial sheet');

    await tester.tap(find.text('Close'));
    await tester.pumpAndSettle();
    await closed;
    expect(find.text('Sheet body'), findsNothing);
  });

  testWidgets('a non-dismissible sheet ignores the scrim', (tester) async {
    await pumpMockmob(
      tester,
      Builder(
        builder: (context) => Center(
          child: TextButton(
            onPressed: () => showMmSheet<void>(
              context: context,
              isDismissible: false,
              builder: (_) => const Text('Must answer'),
            ),
            child: const Text('Open'),
          ),
        ),
      ),
    );
    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();
    await tester.tapAt(const Offset(180, 20));
    await tester.pumpAndSettle();
    expect(find.text('Must answer'), findsOneWidget);
  });
}
