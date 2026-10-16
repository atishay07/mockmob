// The Colleges tab (L22, L25, L26) and the keyboard-safe chooser (L24).

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/tools/colleges/college_rung.dart';
import 'package:mockmob/features/tools/colleges/colleges_copy.dart';
import 'package:mockmob/features/tools/colleges/colleges_screen.dart';
import 'package:mockmob/features/tools/estimate/estimate.dart';
import 'package:mockmob/features/tools/my_colleges/my_colleges_sheet.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'my_colleges_support.dart';
import 'tools_test_support.dart';

void main() {
  setUpAll(loadAppFonts);

  Future<FakeMyColleges> pump(WidgetTester tester, Widget child, {FakeMyColleges? fake, Size size = const Size(390, 1600)}) async {
    final f = fake ?? FakeMyColleges(start: [mc('b-com-hons', 'Hansraj College', 'B.Com. (Hons.)'), mc('b-com-hons', 'Kirori Mal College', 'B.Com. (Hons.)')]);
    await pumpMockmob(
      tester,
      child,
      size: size,
      wrapInScaffold: false,
      disableAnimations: true,
      overrides: toolsOverrides(myColleges: f, prefs: savedCompass('english,accountancy,business_studies,economics')),
    );
    for (var i = 0; i < 3; i++) {
      await tester.pumpAndSettle();
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 40)));
    }
    await tester.pumpAndSettle();
    return f;
  }

  test('verdicts use real figures, one decimal, and name the gap', () {
    const e = Estimate(source: EstimateSource.mocks, low: 588, high: 640);
    expect(verdictFor(e, 907.5).v, Verdict.below);
    expect(verdictWords(verdictFor(e, 907.5)), 'Needs 267.5 more');
    expect(verdictWords(verdictFor(e, 600)), 'Within your range');
    expect(verdictWords(verdictFor(e, 575.6)), 'Clears by 12.4');
    expect(verdictFor(e, null).v, Verdict.noSeat);
    expect(estimateRange(e), '588 to 640');
    expect(estimateRange(const Estimate(source: EstimateSource.typed, low: 612, high: 612)), '612');
  });

  testWidgets('the tab lists My colleges with their own Round 1 figures, then Compass and every tool', (tester) async {
    await pump(tester, const CollegesScreen());
    expect(find.text(CollegesCopy.myColleges), findsOneWidget);
    expect(find.byType(CollegeRung), findsNWidgets(2));
    expect(find.text('Hansraj College'), findsOneWidget);
    expect(find.text(CollegesCopy.roundOne), findsWidgets);
    expect(find.text(CollegesCopy.compassTitle), findsOneWidget);
    expect(find.text(CollegesCopy.openCompass), findsOneWidget);
    for (final t in [CollegesCopy.checkTitle, CollegesCopy.comboTitle, 'CUET 2027 exam guide', 'Previous-year questions']) {
      expect(find.text(t), findsOneWidget, reason: t);
    }
    // Never asks for a score; never the old words.
    expect(find.byType(TextField), findsNothing);
    expect(find.textContaining('CSAS'), findsNothing);
    expect(find.textContaining('CUET score'), findsNothing);
  });

  testWidgets('an empty list leads with Choose your colleges; a course chip opens the chooser on that ladder', (tester) async {
    await pump(tester, const CollegesScreen(), fake: FakeMyColleges());
    expect(find.text(CollegesCopy.emptyTitle), findsOneWidget);
    expect(find.text(CollegesCopy.choose), findsOneWidget);
    await tester.tap(find.text('B.Com (Hons)'));
    for (var i = 0; i < 3; i++) {
      await tester.pumpAndSettle();
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 40)));
    }
    await tester.pumpAndSettle();
    expect(find.byType(MyCollegesSheet), findsOneWidget);
    expect(find.text(CollegesCopy.courseChip('B.Com. (Hons.)')), findsOneWidget);
    expect(find.text(CollegesCopy.picked(0)), findsOneWidget);
  });

  testWidgets('with the keyboard up at 360x800 the field and at least three results stay above it', (tester) async {
    await pump(
      tester,
      Scaffold(
        body: Builder(builder: (context) => TextButton(onPressed: () => showMyCollegesSheet(context, entry: MyCollegesEntry.chooser), child: const Text('open'))),
      ),
      fake: FakeMyColleges(),
      size: const Size(360, 800),
    );
    await tester.tap(find.text('open'));
    for (var i = 0; i < 3; i++) {
      await tester.pumpAndSettle();
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 40)));
    }
    // The keyboard comes up (300 dp at a device pixel ratio of 2).
    tester.view.viewInsets = const FakeViewPadding(bottom: 600);
    addTearDown(tester.view.resetViewInsets);
    await tester.pumpAndSettle();
    final sheet = find.byType(MyCollegesSheet);
    await tester.enterText(find.descendant(of: sheet, matching: find.byType(TextField)), 'b');
    await tester.pumpAndSettle();
    const keyboardTop = 800.0 - 300;
    final field = tester.getRect(find.descendant(of: sheet, matching: find.byType(TextField)));
    expect(field.bottom, lessThan(keyboardTop));
    final rows = find.descendant(of: sheet, matching: find.byWidgetPredicate((w) => w.key is ValueKey<String> && (w.key! as ValueKey<String>).value.startsWith('programme-')));
    final visible = [
      for (final e in rows.evaluate())
        if (tester.getRect(find.byWidget(e.widget)).bottom <= keyboardTop) e,
    ];
    expect(visible.length, greaterThanOrEqualTo(3));
  });

  testWidgets('a college typed in the course search offers the colleges of the student\'s course, query kept', (tester) async {
    await pump(
      tester,
      Scaffold(
        body: Builder(builder: (context) => TextButton(onPressed: () => showMyCollegesSheet(context, entry: MyCollegesEntry.chooser), child: const Text('open'))),
      ),
    );
    Future<void> settle() async {
      for (var i = 0; i < 3; i++) {
        await tester.pumpAndSettle();
        await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 40)));
      }
      await tester.pumpAndSettle();
    }

    await tester.tap(find.text('open'));
    await settle();
    // It opens on the student's course; the chip goes back to the programme list.
    await tester.tap(find.text(CollegesCopy.courseChip('B.Com. (Hons.)')));
    await settle();
    final sheet = find.byType(MyCollegesSheet);
    await tester.enterText(find.descendant(of: sheet, matching: find.byType(TextField)), 'hansrj');
    await settle();
    expect(find.text(CollegesCopy.nothingMatches('hansrj')), findsOneWidget);
    await tester.tap(find.text(CollegesCopy.searchCollegesIn('B.Com. (Hons.)')));
    await settle();
    expect(find.text(CollegesCopy.courseChip('B.Com. (Hons.)')), findsOneWidget);
    expect(find.descendant(of: sheet, matching: find.text('Hansraj College')), findsOneWidget);
  });
}
