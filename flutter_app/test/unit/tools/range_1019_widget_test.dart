// 19 Oct, G18 and G19 on screen: the range typed in the sheet and the Colleges rows behind it say
// the same thing in the same words, a pasted range fills both fields, a range over 200 marks wide is
// refused, and "I don't know my range yet" brings back Today's card, which ends in an estimate the
// student can take.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/core/models/practice_quote.dart';
import 'package:mockmob/core/repositories/quote_repository.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/tools/colleges/college_rung.dart';
import 'package:mockmob/features/tools/colleges/colleges_copy.dart';
import 'package:mockmob/features/tools/colleges/colleges_screen.dart';
import 'package:mockmob/features/tools/estimate/estimate_copy.dart';
import 'package:mockmob/features/tools/estimate/estimate_providers.dart';
import 'package:mockmob/features/tools/estimate/estimate_sheet.dart';
import 'package:mockmob/features/tools/estimate/range_choice.dart';
import 'package:mockmob/features/tools/estimate/range_today_card.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'my_colleges_support.dart';
import 'tools_test_support.dart';

/// The owner's four colleges: every Round 1, 2026 UR cutoff between 900 and 920.
FakeMyColleges ownersFour() => FakeMyColleges(start: [
      mc('b-com-hons', 'Hindu College', 'B.Com. (Hons.)'),
      mc('b-com-hons', 'Lady Shri Ram College for Women (W)', 'B.Com. (Hons.)'),
      mc('b-com-hons', 'Hansraj College', 'B.Com. (Hons.)'),
      mc('b-com-hons', 'Kirori Mal College', 'B.Com. (Hons.)'),
    ]);

Attempt _full(String subject, int correct, int wrong) => Attempt.fromJson({
      'id': 'mock-$subject',
      'subject': subject,
      'score': 0,
      'correct': correct,
      'wrong': wrong,
      'unattempted': 50 - correct - wrong,
      'total': 50,
      'mode': 'full',
      'completedAt': DateTime.utc(2026, 10, 12).toIso8601String(),
    });

final _fiveMocks = [
  _full('english', 40, 5),
  _full('accountancy', 30, 10),
  _full('business_studies', 42, 4),
  _full('economics', 36, 8),
  _full('mathematics', 20, 15),
];

const _five = ['english', 'accountancy', 'economics', 'business_studies', 'mathematics'];

/// The quote for any full mock: free as the first in its subject, or 50 credits.
class _Quotes implements QuoteRepository {
  _Quotes({this.firstFree = true});

  final bool firstFree;

  @override
  Future<PracticeQuote> quote({required String subject, required String mode, int? count, String? purpose}) async => PracticeQuote(
        state: 'available',
        launchable: true,
        reasonCode: firstFree ? 'first_full_mock_free' : 'ok',
        creditCost: firstFree ? 0 : 50,
        creditBalance: 90,
        subjectId: subject,
        subjectName: subject,
        modeId: mode,
        count: count,
      );
}

void main() {
  setUpAll(loadAppFonts);

  Finder field(String label) => find.byWidgetPredicate((w) => w is TextField && w.decoration?.labelText == label);

  Future<void> settle(WidgetTester tester) async {
    for (var i = 0; i < 3; i++) {
      await tester.pumpAndSettle();
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 40)));
    }
    await tester.pumpAndSettle();
  }

  Future<void> pumpColleges(WidgetTester tester) async {
    await pumpMockmob(
      tester,
      const CollegesScreen(),
      size: const Size(390, 1800),
      wrapInScaffold: false,
      disableAnimations: true,
      overrides: toolsOverrides(myColleges: ownersFour(), prefs: savedCompass('english,accountancy,business_studies,economics')),
    );
    await settle(tester);
  }

  Future<void> typeRange(WidgetTester tester, String from, String to) async {
    await tester.tap(find.text(CollegesCopy.typeEstimate).first);
    await settle(tester);
    expect(find.byType(EstimateSheet), findsOneWidget);
    await tester.enterText(field(CollegesCopy.from), from);
    await tester.enterText(field(CollegesCopy.to), to);
    await settle(tester);
  }

  testWidgets('900 to 920: the sheet says all four are in reach, and so do the rows after Done', (tester) async {
    await pumpColleges(tester);
    await typeRange(tester, '900', '920');
    expect(find.text('All 4 of your colleges are in reach.'), findsOneWidget);
    expect(find.textContaining('0 of 4'), findsNothing, reason: 'the old "Your colleges: 0 of 4 clear"');
    await tester.tap(find.widgetWithText(KeyButton, CollegesCopy.done));
    await settle(tester);
    expect(find.byType(EstimateSheet), findsNothing);
    final rows = find.descendant(of: find.byType(CollegeRung), matching: find.textContaining('In reach if you score'));
    expect(rows, findsNWidgets(4));
    expect(find.textContaining('Within your range'), findsNothing);
    expect(find.textContaining('900 to 920'), findsWidgets);
  });

  testWidgets('910 to 920: two safe and two in reach, in the sheet and in the rows', (tester) async {
    await pumpColleges(tester);
    await typeRange(tester, '910', '920');
    expect(find.text('Of your 4 colleges, 2 are safe and 2 are in reach.'), findsOneWidget);
    await tester.tap(find.widgetWithText(KeyButton, CollegesCopy.done));
    await settle(tester);
    expect(find.descendant(of: find.byType(CollegeRung), matching: find.textContaining('Safe, with')), findsNWidgets(2));
    expect(find.descendant(of: find.byType(CollegeRung), matching: find.textContaining('In reach if you score')), findsNWidgets(2));
  });

  testWidgets('"900 to 920" pasted into From fills both fields; 920 then 900 swaps; 250 wide is refused', (tester) async {
    await pumpColleges(tester);
    await tester.tap(find.text(CollegesCopy.typeEstimate).first);
    await settle(tester);
    await tester.enterText(field(CollegesCopy.from), '900 to 920');
    await settle(tester);
    expect(tester.widget<TextField>(field(CollegesCopy.from)).controller!.text, '900');
    expect(tester.widget<TextField>(field(CollegesCopy.to)).controller!.text, '920');
    expect(find.text('All 4 of your colleges are in reach.'), findsOneWidget);
    // Typed the other way round, it is the same range.
    await tester.enterText(field(CollegesCopy.from), '920');
    await tester.enterText(field(CollegesCopy.to), '900');
    await settle(tester);
    expect(find.text('All 4 of your colleges are in reach.'), findsOneWidget);
    // 700 to 950 is a gap of 250.
    await tester.enterText(field(CollegesCopy.from), '700');
    await tester.enterText(field(CollegesCopy.to), '950');
    await settle(tester);
    expect(find.text(EstimateCopy.fieldTooWide), findsOneWidget);
    await tester.tap(find.widgetWithText(KeyButton, CollegesCopy.done));
    await settle(tester);
    expect(find.byType(EstimateSheet), findsOneWidget, reason: 'Done keeps the sheet open on a range that is too wide');
  });

  testWidgets('L5: a reversed pair ("920" then "900") shows in the order it is read, 900 then 920, once the student leaves the field', (tester) async {
    await pumpColleges(tester);
    await tester.tap(find.text(CollegesCopy.typeEstimate).first);
    await settle(tester);
    await tester.enterText(field(CollegesCopy.from), '920');
    await tester.enterText(field(CollegesCopy.to), '900');
    await settle(tester);
    expect(find.text('All 4 of your colleges are in reach.'), findsOneWidget, reason: 'read as 900 to 920 straight away');
    // The keyboard goes away: the fields show what is read.
    FocusManager.instance.primaryFocus?.unfocus();
    await settle(tester);
    expect(tester.widget<TextField>(field(CollegesCopy.from)).controller!.text, '900');
    expect(tester.widget<TextField>(field(CollegesCopy.to)).controller!.text, '920');
    expect(find.text('All 4 of your colleges are in reach.'), findsOneWidget);
  });

  testWidgets('L5: Done on a reversed pair keeps 900 to 920 as the typed range', (tester) async {
    await pumpColleges(tester);
    await typeRange(tester, '920', '900');
    await tester.tap(find.widgetWithText(KeyButton, CollegesCopy.done));
    await settle(tester);
    expect(find.byType(EstimateSheet), findsNothing);
    expect(find.textContaining('900 to 920'), findsWidgets);
  });

  testWidgets('"I don\'t know my range yet" clears a typed range and brings back Today\'s card', (tester) async {
    final prefs = MemoryPrefsStore();
    await pumpMockmob(
      tester,
      Builder(
        builder: (context) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            TextButton(onPressed: () => showEstimateSheet(context), child: const Text('open')),
            const RangeTodayBlock(),
          ],
        ),
      ),
      size: const Size(390, 1400),
      disableAnimations: true,
      overrides: [...toolsOverrides(sheet: _five, prefs: prefs), quoteRepositoryProvider.overrideWithValue(_Quotes())],
    );
    await settle(tester);
    // A fresh account with five subjects: the way, English first. D175: even a server that still quotes the old free
    // first mock gets no free promise on the key or under it.
    expect(find.text(EstimateCopy.stepsTitle), findsOneWidget);
    expect(find.text('Sit one full mock in each subject and we’ll estimate your range. Start with English.'), findsOneWidget);
    expect(find.text(EstimateCopy.sitKey('English')), findsOneWidget);
    expect(find.textContaining('free'), findsNothing);
    expect(find.text(EstimateCopy.count(0, 5)), findsOneWidget);

    // A typed range puts the card away.
    await tester.tap(find.text('open'));
    await settle(tester);
    await tester.enterText(field(CollegesCopy.from), '640');
    await tester.enterText(field(CollegesCopy.to), '700');
    await settle(tester);
    await tester.tap(find.widgetWithText(KeyButton, CollegesCopy.done));
    await settle(tester);
    expect(find.text(EstimateCopy.stepsTitle), findsNothing);

    // "I don't know my range yet": the typed range goes and the card comes back.
    await tester.tap(find.text('open'));
    await settle(tester);
    await tester.tap(find.text(EstimateCopy.unknownTitle));
    await settle(tester);
    expect(find.text(EstimateCopy.unknownBody), findsOneWidget);
    await tester.tap(find.widgetWithText(KeyButton, CollegesCopy.done));
    await settle(tester);
    final c = ProviderScope.containerOf(tester.element(find.text('open')));
    expect(c.read(rangeChoiceProvider).value?.choice, RangeChoice.unknown);
    expect(c.read(typedEstimateProvider), isNull);
    expect(find.text(EstimateCopy.stepsTitle), findsOneWidget);
  });

  testWidgets('every subject done: the estimated range with its spread and colleges; taking it puts the card away', (tester) async {
    final prefs = MemoryPrefsStore();
    await pumpMockmob(
      tester,
      ListView(padding: const EdgeInsets.all(16), children: const [RangeTodayBlock()]),
      size: const Size(390, 1000),
      disableAnimations: true,
      overrides: [...toolsOverrides(sheet: _five, prefs: prefs, attempts: _fiveMocks, myColleges: ownersFour()), quoteRepositoryProvider.overrideWithValue(_Quotes())],
    );
    await settle(tester);
    expect(find.text(EstimateCopy.readyTitle), findsOneWidget);
    expect(find.text('665 to 765'), findsOneWidget);
    // Five subjects each have a mock, but DU adds up four papers: the line counts the mocks the estimate is built on (verifier L1).
    final built = ProviderScope.containerOf(tester.element(find.byType(ListView))).read(estimateProvider)!.mocks;
    expect(built, 4);
    expect(find.text(EstimateCopy.readyTruth(built)), findsOneWidget);
    expect(find.text('None of your 4 colleges is in reach yet.'), findsOneWidget);
    await tester.tap(find.text(EstimateCopy.acceptKey));
    await settle(tester);
    expect(find.text(EstimateCopy.readyTitle), findsNothing);
    final c = ProviderScope.containerOf(tester.element(find.byType(ListView)));
    expect(c.read(rangeChoiceProvider).value?.choice, RangeChoice.accepted);
    expect(c.read(estimateProvider)?.source.name, 'mocks', reason: 'the mocks\' range is the one every screen uses');
  });

  testWidgets('a priced mock keeps the Practice cost line under the key, and never says free', (tester) async {
    await pumpMockmob(
      tester,
      ListView(padding: const EdgeInsets.all(16), children: const [RangeTodayBlock()]),
      size: const Size(390, 1000),
      disableAnimations: true,
      overrides: [...toolsOverrides(sheet: _five), quoteRepositoryProvider.overrideWithValue(_Quotes(firstFree: false))],
    );
    await settle(tester);
    expect(find.text(EstimateCopy.sitKey('English')), findsOneWidget);
    expect(find.text('50 credits. You have 90.'), findsOneWidget);
    expect(find.textContaining('free'), findsNothing);
  });
}
