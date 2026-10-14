// Compass Pro, client side: the projection the server already computes, shown to an account that
// has it and nowhere else (no lock, no pitch), and a shortlist kept on this phone.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/tools/compass/compass_screen.dart';
import 'package:mockmob/features/tools/copy.dart';
import 'package:mockmob/features/tools/pro/compass_pro_models.dart';
import 'package:mockmob/features/tools/pro/compass_pro_repository.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'tools_test_support.dart';

void main() {
  setUpAll(loadAppFonts);

  Future<FakeCompassPro> pump(WidgetTester tester, {required bool pro, Object? body = compassProReady, bool fail = false, MemoryPrefsStore? prefs}) async {
    final repo = FakeCompassPro(body, fail: fail);
    await pumpMockmob(
      tester,
      const CompassScreen(),
      size: const Size(384, 9000),
      wrapInScaffold: false,
      disableAnimations: true,
      overrides: [
        ...toolsOverrides(prefs: prefs ?? savedCompass('english,accountancy,business_studies,economics'), pro: pro),
        compassProRepositoryProvider.overrideWith(() => repo),
      ],
    );
    await tester.pumpAndSettle();
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 30)));
    await tester.pumpAndSettle();
    return repo;
  }

  group('parsing', () {
    test('a locked answer carries nothing to show', () {
      final p = CompassPro.fromJson(const {'ok': true, 'locked': true});
      expect(p.locked, isTrue);
      expect(p.papers, isEmpty);
    });

    test('a ready answer reads papers, the total and the next move', () {
      final p = CompassPro.fromJson(compassProReady);
      expect(p.locked, isFalse);
      expect(p.papers.map((e) => e.name), ['Accountancy', 'English', 'Economics']);
      expect(p.papers[2].ready, isFalse);
      expect(p.papers[2].needed, 18);
      expect(p.total!.mid, 300);
      expect(p.total!.complete, isFalse);
      expect(p.next!.chapter, 'Admission of a partner');
      expect(p.paperMax, 250);
    });

    test('an error answer is not read as a projection', () {
      expect(() => CompassPro.fromJson(const {'ok': false, 'error': 'compass_unavailable'}), throwsFormatException);
      expect(() => CompassPro.fromJson('not json'), throwsFormatException);
    });

    test('the range is set against one published cutoff as the website does', () {
      const band = ProTotal(count: 4, complete: true, max: 1000, low: 600, mid: 650, high: 700);
      expect(proCompare(band, 590).position, ProPosition.above);
      expect(proCompare(band, 590).by, 10);
      expect(proCompare(band, 650).position, ProPosition.within);
      expect(proCompare(band, 712.5).position, ProPosition.below);
      expect(proCompare(band, 712.5).by, 12.5);
      expect(proCompare(band, null).position, ProPosition.none);
    });
  });

  group('on Compass', () {
    testWidgets('an account with access sees the projection, the paper to work on and papers that need more practice', (tester) async {
      final repo = await pump(tester, pro: true);
      expect(repo.fetches, 1);
      expect(find.text(ToolsCopy.proHeading), findsOneWidget);
      expect(find.text('Range 210 to 375'), findsOneWidget);
      expect(find.text(ToolsCopy.proTotalPartial(2)), findsOneWidget);
      expect(find.text(ToolsCopy.proThin(18)), findsOneWidget);
      expect(find.text(ToolsCopy.proNextLead('Accountancy', 100, 250)), findsOneWidget);
      expect(find.text(ToolsCopy.proNextChapter('Admission of a partner', 6, 2, 20)), findsOneWidget);
      expect(find.text(ToolsCopy.proPractise('Accountancy')), findsOneWidget);
    });

    testWidgets('an account without access gets no request, no lock and no pitch', (tester) async {
      final repo = await pump(tester, pro: false);
      expect(repo.fetches, 0);
      expect(find.text(ToolsCopy.proHeading), findsNothing);
      expect(find.text(ToolsCopy.shortlistHeading), findsNothing);
    });

    testWidgets('when the server says locked the section is simply absent', (tester) async {
      final repo = await pump(tester, pro: true, body: const {'ok': true, 'locked': true});
      expect(repo.fetches, 1);
      expect(find.text(ToolsCopy.proHeading), findsNothing);
      expect(find.byType(Scrollable), findsWidgets);
    });

    testWidgets('an unreadable record says so and offers Try again, offline in its own words', (tester) async {
      await pump(tester, pro: true, fail: true);
      expect(find.text(ToolsCopy.offlineBody), findsOneWidget);
      expect(find.text(ToolsCopy.tryAgain), findsOneWidget);
    });

    testWidgets('a shortlist target is added from a programme and a college, and kept on this phone', (tester) async {
      final prefs = savedCompass('english,accountancy,business_studies,economics');
      await pump(tester, pro: true, prefs: prefs);
      expect(find.text(ToolsCopy.shortlistEmpty), findsOneWidget);

      await tester.tap(find.text(ToolsCopy.shortlistAdd));
      await tester.pumpAndSettle();
      expect(find.text(ToolsCopy.shortlistChooseProgramme), findsOneWidget);
      final sheet = find.byType(BottomSheet);
      await tester.enterText(find.descendant(of: sheet, matching: find.byType(TextField)), 'B.Com');
      await tester.pumpAndSettle();
      await tester.tap(find.descendant(of: sheet, matching: find.text('B.Com. (Hons.)')));
      await tester.pumpAndSettle();
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 30)));
      await tester.pumpAndSettle();
      expect(find.text(ToolsCopy.shortlistChooseCollege), findsOneWidget);

      // The first college in the list.
      final colleges = find.descendant(of: find.byType(BottomSheet), matching: find.byType(Text));
      expect(colleges, findsWidgets);
      final first = tester.widgetList<Text>(colleges).map((t) => t.data ?? '').firstWhere((t) => t.isNotEmpty && t != 'B.Com. (Hons.)' && t != ToolsCopy.shortlistChooseCollege && t != ToolsCopy.shortlistAdd);
      await tester.tap(find.descendant(of: sheet, matching: find.text(first)));
      await tester.pumpAndSettle();

      expect(find.text(ToolsCopy.shortlistEmpty), findsNothing);
      expect(find.text(first), findsOneWidget);
      expect(find.text(ToolsCopy.proNeedsFull), findsOneWidget, reason: 'two of four papers: no verdict is invented');
      expect(prefs.values.keys.any((k) => k.contains('shortlist')), isTrue);
    });
  });
}
