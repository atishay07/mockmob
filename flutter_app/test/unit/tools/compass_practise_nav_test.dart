// tools-06: Compass's Practise chips and the Pro "Practise" key push the setup page over Compass,
// so Back returns to the list the student was working through instead of dropping Compass.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/tools/compass/compass_screen.dart';
import 'package:mockmob/features/tools/copy.dart';
import 'package:mockmob/features/tools/pro/compass_pro_repository.dart';
import 'package:mockmob/features/tools/tools_paths.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'tools_test_support.dart';

/// Stands in for the setup page: shows where it was opened.
class _Setup extends StatelessWidget {
  const _Setup(this.location);

  final String location;

  @override
  Widget build(BuildContext context) => Scaffold(body: Center(child: Text('setup $location')));
}

void main() {
  setUpAll(loadAppFonts);

  Future<GoRouter> pump(WidgetTester tester) async {
    final router = GoRouter(
      routes: [
        GoRoute(
          path: '/',
          builder: (context, state) => const Scaffold(body: Text('tools hub')),
          routes: [GoRoute(path: 'tools/compass', builder: (context, state) => const CompassScreen())],
        ),
        GoRoute(path: '/practice/setup/:mode', builder: (context, state) => _Setup(state.uri.toString())),
      ],
    );
    addTearDown(router.dispose);
    tester.view.physicalSize = const Size(384, 9000) * 2;
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          ...toolsOverrides(prefs: savedCompass('english,accountancy,business_studies,economics'), pro: true),
          compassProRepositoryProvider.overrideWith(() => FakeCompassPro(compassProReady)),
        ],
        child: DefaultAssetBundle(
          bundle: FileAssetBundle(),
          child: MaterialApp.router(
            theme: buildTheme(Brightness.light),
            routerConfig: router,
            builder: (context, app) => MediaQuery(data: MediaQuery.of(context).copyWith(disableAnimations: true), child: app!),
          ),
        ),
      ),
    );
    // Compass is pushed over the page it was opened from, as in the app.
    router.push(ToolsPaths.compass).ignore();
    await tester.pumpAndSettle();
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 30)));
    await tester.pumpAndSettle();
    expect(find.byType(CompassScreen), findsOneWidget);
    return router;
  }

  Future<void> tapThenBack(WidgetTester tester, Finder key, String expected) async {
    await tester.ensureVisible(key);
    await tester.tap(key);
    await tester.pumpAndSettle();
    expect(find.text('setup $expected'), findsOneWidget);
    expect(find.byType(CompassScreen), findsNothing);

    final handled = await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(handled, isTrue);
    expect(find.byType(CompassScreen), findsOneWidget, reason: 'Back returns to Compass');
    expect(find.textContaining('setup '), findsNothing);
  }

  testWidgets('the Pro Practise key opens setup over Compass, and Back returns to it', (tester) async {
    await pump(tester);
    await tapThenBack(
      tester,
      find.text(ToolsCopy.proPractise('Accountancy')),
      '/practice/setup/quick?subject=accountancy',
    );
  });

  testWidgets('a Practise chip opens setup over Compass, and Back returns to it', (tester) async {
    await pump(tester);
    expect(find.text(ToolsCopy.practiseHeading), findsOneWidget);
    final chip = find.byWidgetPredicate((w) => w is MmChip && w.leading == LucideIcons.play).first;
    final label = tester.widget<MmChip>(chip).label;
    await tester.ensureVisible(chip);
    await tester.tap(chip);
    await tester.pumpAndSettle();
    expect(find.textContaining('setup /practice/setup/quick?subject='), findsOneWidget, reason: 'opened from the $label chip');
    expect(find.byType(CompassScreen), findsNothing);

    final handled = await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(handled, isTrue);
    expect(find.byType(CompassScreen), findsOneWidget, reason: 'Back returns to Compass');
  });
}
