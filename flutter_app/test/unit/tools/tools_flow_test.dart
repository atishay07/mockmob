// The tools hand over to each other without piling up (Compass to Combo Planner and back), and
// the Today row names what the student's subjects open.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/features/tools/copy.dart';
import 'package:mockmob/features/tools/hub/tools_shelf.dart';
import 'package:mockmob/features/tools/tools_paths.dart';
import 'package:mockmob/features/tools/widgets/tools_origin.dart';

import 'tools_test_support.dart';

/// A stand-in tool screen: its route's `from`, and one button that hands over to the other tool.
class _Stub extends StatelessWidget {
  const _Stub({required this.name, required this.to, required this.from});

  final String name;
  final String to;
  final String from;

  @override
  Widget build(BuildContext context) => Scaffold(
        body: Column(
          children: [
            Text('screen $name from ${ToolsOrigin.of(context)}'),
            TextButton(onPressed: () => ToolsOrigin.openOrReturn(context, to: to, from: from), child: Text('go to $to')),
          ],
        ),
      );
}

GoRouter _router(String initial) => GoRouter(
      initialLocation: initial,
      routes: [
        GoRoute(path: '/start', builder: (context, state) => const Scaffold(body: Text('start'))),
        GoRoute(
          path: ToolsPaths.compass,
          builder: (context, state) => ToolsOrigin(
            from: state.uri.queryParameters['from'],
            child: const _Stub(name: 'compass', to: ToolsPaths.combo, from: ToolsOrigin.compass),
          ),
        ),
        GoRoute(
          path: ToolsPaths.combo,
          builder: (context, state) => ToolsOrigin(
            from: state.uri.queryParameters['from'],
            child: const _Stub(name: 'combo', to: ToolsPaths.compass, from: ToolsOrigin.combo),
          ),
        ),
      ],
    );

Future<GoRouter> _pump(WidgetTester tester, GoRouter router) async {
  addTearDown(router.dispose);
  await tester.pumpWidget(MaterialApp.router(routerConfig: router));
  await tester.pumpAndSettle();
  return router;
}

void main() {
  testWidgets('Compass to Combo Planner and back goes back, it does not stack a second Compass', (tester) async {
    final router = await _pump(tester, _router('/start'));
    router.push(ToolsPaths.compass);
    await tester.pumpAndSettle();
    expect(find.text('screen compass from null'), findsOneWidget);

    await tester.tap(find.text('go to ${ToolsPaths.combo}'));
    await tester.pumpAndSettle();
    expect(find.text('screen combo from compass'), findsOneWidget);

    // Combo's "See the courses and cutoffs" returns to the Compass it came from.
    await tester.tap(find.text('go to ${ToolsPaths.compass}'));
    await tester.pumpAndSettle();
    expect(find.text('screen compass from null'), findsOneWidget);
    expect(router.canPop(), isTrue);
    router.pop();
    await tester.pumpAndSettle();
    expect(find.text('start'), findsOneWidget, reason: 'one Compass in the stack, not two');
  });

  testWidgets('Combo Planner opened first sends to a Compass that can hand back', (tester) async {
    final router = await _pump(tester, _router('/start'));
    router.push(ToolsPaths.combo);
    await tester.pumpAndSettle();
    expect(find.text('screen combo from null'), findsOneWidget);

    await tester.tap(find.text('go to ${ToolsPaths.compass}'));
    await tester.pumpAndSettle();
    expect(find.text('screen compass from combo'), findsOneWidget);

    await tester.tap(find.text('go to ${ToolsPaths.combo}'));
    await tester.pumpAndSettle();
    expect(find.text('screen combo from null'), findsOneWidget);
  });

  testWidgets('the Today rows say what the subjects open and lead to Compass and all the tools', (tester) async {
    final router = GoRouter(
      initialLocation: '/today',
      routes: [
        GoRoute(path: '/today', builder: (context, state) => const Scaffold(body: SingleChildScrollView(child: ToolsQuietLink()))),
        GoRoute(path: ToolsPaths.compass, builder: (context, state) => const Scaffold(body: Text('compass page'))),
        GoRoute(path: ToolsPaths.hub, builder: (context, state) => const Scaffold(body: Text('hub page'))),
      ],
    );
    addTearDown(router.dispose);
    tester.view.physicalSize = const Size(384, 853) * 2;
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      ProviderScope(
        overrides: toolsOverrides(prefs: savedCompass('english,accountancy,business_studies,economics')),
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 50)));
    await tester.pumpAndSettle();

    expect(find.text(ToolsCopy.compassTitle), findsOneWidget);
    expect(find.textContaining('DU programmes open to your subjects'), findsOneWidget);
    expect(find.text(ToolsCopy.allToolsRow), findsOneWidget);

    await tester.tap(find.text(ToolsCopy.allToolsRow));
    await tester.pumpAndSettle();
    expect(find.text('hub page'), findsOneWidget);
  });

  test('every tool screen has the website name and no banned punctuation', () {
    expect(ToolsCopy.comboTitle, 'Combo Planner');
    expect(ToolsCopy.compassTitle, 'Admission Compass');
    for (final s in [
      ToolsCopy.hubLead,
      ToolsCopy.compassHubNote,
      ToolsCopy.scoreWhy,
      ToolsCopy.scoreHelp,
      ToolsCopy.comboNote,
      ToolsCopy.comboLinkNote,
      ToolsCopy.otherProgrammesNote,
      ToolsCopy.noneOpenFar,
    ]) {
      expect(s, isNot(contains('!')));
      expect(s, isNot(contains('—')));
      expect(s, isNot(contains('·')));
    }
  });
}
