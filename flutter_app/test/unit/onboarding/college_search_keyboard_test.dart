import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/router/routes.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/onboarding/copy.dart';
import 'package:mockmob/features/onboarding/model/deck.dart';
import 'package:mockmob/features/onboarding/onboarding_routes.dart';
import 'package:mockmob/features/onboarding/widgets/college_search_field.dart';

import '../../golden/onboarding/support.dart';
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';

/// G3 (owner, 19 Oct): "I'm unable to search it. My keyboard gets cut off again and again." The
/// college search on the course step, at 360 dp with the keyboard up: the field keeps its focus
/// through every rebuild (the keyboard opening, the sheet strip folding away, Mobi stepping aside,
/// each letter typed, a drag on the results), stays in view above the keyboard, and "hans" shows
/// Hansraj right under it.
const double _width = 360;

/// The keyboard's height on the 360 dp emulator (about 280 dp, the lower third of the screen).
const double _keyboard = 280;

Future<void> _settle(WidgetTester tester, {int frames = 6}) async {
  for (var i = 0; i < frames; i++) {
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 10)));
    await tester.pump(const Duration(milliseconds: 100));
  }
}

Future<void> _pump(WidgetTester tester, {double height = 800}) async {
  tester.view.physicalSize = Size(_width * 2, height * 2);
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);
  final router = GoRouter(
    initialLocation: AppRoutes.welcome,
    routes: [
      GoRoute(path: AppRoutes.welcome, builder: welcomeScreen),
      GoRoute(path: AppRoutes.signIn, builder: (c, s) => const Scaffold(body: Text('STUB sign-in'))),
      GoRoute(path: AppRoutes.today, builder: (c, s) => const Scaffold(body: Text('STUB today'))),
    ],
  );
  addTearDown(router.dispose);
  await tester.pumpWidget(ProviderScope(
    overrides: onboardingOverrides(answers: studentUpTo(Steps.stage, step: Steps.course).copyWith(courseId: 'b-com-hons')),
    child: DefaultAssetBundle(
      bundle: FileAssetBundle(),
      child: MaterialApp.router(theme: buildTheme(Brightness.dark), routerConfig: router),
    ),
  ));
  await _settle(tester);
  await tester.tap(find.text(OnboardingCopy.continuePlan));
  await _settle(tester, frames: 10);
  expect(find.text(OnboardingCopy.ladderTitle), findsOneWidget);
}

Finder get _field => find.descendant(of: find.byType(CollegeSearchField), matching: find.byType(EditableText));

bool _focused(WidgetTester tester) => tester.widget<EditableText>(_field).focusNode.hasFocus;

/// The keyboard opens: the system reports the bottom inset, as Android does.
Future<void> _openKeyboard(WidgetTester tester) async {
  tester.view.viewInsets = const FakeViewPadding(bottom: _keyboard * 2);
  addTearDown(tester.view.resetViewInsets);
  await _settle(tester, frames: 10);
}

/// The part of the screen the keyboard leaves.
double _visibleBottom(WidgetTester tester) => tester.view.physicalSize.height / tester.view.devicePixelRatio - _keyboard;

void main() {
  setUpAll(loadAppFonts);

  for (final height in [800.0, 640.0]) {
    testWidgets('at 360 by ${height.round()}, typing "hans" keeps the keyboard up and shows Hansraj under the field', (tester) async {
      await _pump(tester, height: height);
      await tester.tap(find.byType(CollegeSearchField));
      await tester.pump();
      expect(_focused(tester), isTrue);
      await _openKeyboard(tester);
      expect(_focused(tester), isTrue, reason: 'the keyboard opening (the strip folds, Mobi steps aside) must not drop the focus');
      expect(tester.testTextInput.isVisible, isTrue);

      // One letter at a time, as a thumb types: every letter rebuilds the ladder.
      var typed = '';
      for (final letter in 'hans'.split('')) {
        typed += letter;
        tester.testTextInput.enterText(typed);
        await _settle(tester, frames: 4);
        expect(_focused(tester), isTrue, reason: 'focus lost after typing "$typed"');
        expect(tester.testTextInput.isVisible, isTrue, reason: 'keyboard gone after typing "$typed"');
      }

      final bottom = _visibleBottom(tester);
      final field = tester.getRect(find.byType(CollegeSearchField));
      expect(field.top, greaterThanOrEqualTo(0));
      expect(field.bottom, lessThanOrEqualTo(bottom), reason: 'the field sits above the keyboard');
      final hansraj = find.text('Hansraj College');
      expect(hansraj, findsOneWidget);
      final row = tester.getRect(hansraj);
      expect(row.top, greaterThan(field.bottom), reason: 'the result is under the field');
      expect(row.bottom, lessThanOrEqualTo(bottom), reason: 'Hansraj is in view above the keyboard, not under it');
    });
  }

  testWidgets('a drag on the results with the keyboard up keeps the keyboard and the focus', (tester) async {
    await _pump(tester, height: 640);
    await tester.tap(find.byType(CollegeSearchField));
    await tester.pump();
    await _openKeyboard(tester);
    tester.testTextInput.enterText('col');
    await _settle(tester, frames: 4);
    final field = tester.getRect(find.byType(CollegeSearchField));
    await tester.dragFrom(Offset(_width / 2, field.bottom + 60), const Offset(0, -120));
    await _settle(tester, frames: 4);
    expect(_focused(tester), isTrue, reason: 'scrolling the results must not put the keyboard away');
    expect(tester.testTextInput.isVisible, isTrue);
  });

  testWidgets('picking a found college keeps the search and the keyboard, so the next one can be typed', (tester) async {
    await _pump(tester, height: 640);
    await tester.tap(find.byType(CollegeSearchField));
    await tester.pump();
    await _openKeyboard(tester);
    tester.testTextInput.enterText('hans');
    await _settle(tester, frames: 4);
    await tester.tap(find.text('Hansraj College'));
    await _settle(tester, frames: 4);
    expect(find.text(OnboardingCopy.onToday), findsOneWidget, reason: 'the pick landed');
    expect(_focused(tester), isTrue);
    expect(tester.testTextInput.isVisible, isTrue);
  });
}
