// Today, 19 Oct (G12, G7). A brand-new account's suggested deck (four or five real cards built from
// its subjects, the first run and a returning visit, the end of the pass), and Your colleges with
// five picks (the top 3 labelled, "See all 5 colleges") and the See all sheet. Night and Day, at
// 412 x 915 and 360 x 800, and 1.3x text. Each image was opened and looked at.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/today/data/today_profile.dart';
import 'package:mockmob/features/today/logic/suggested_deck.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/today/logic/today_inputs.dart';
import 'package:mockmob/features/today/logic/today_model.dart';
import 'package:mockmob/features/today/screens/today_body.dart' show debugResetTodayPicks;
import 'package:mockmob/features/today/widgets/colleges_sheet.dart';
import 'package:mockmob/features/today/widgets/suggested_stack.dart';

import '../../unit/today/support/today_fixtures.dart';
import 'today_golden_support.dart';

const Size _phone = Size(412, 915);
const Size _small = Size(360, 800);
final DateTime _sunday = DateTime.utc(2026, 10, 18, 14, 10);

const TodayWeek _newWeek = TodayWeek(
  studied: [false, false, false, false, false, false, false],
  todayIndex: 6,
  label: '0 of 4 study days',
  goal: 4,
  planned: {0, 2, 4, 6},
  dates: [12, 13, 14, 15, 16, 17, 18],
);

const List<LadderPick> _five = [
  LadderPick(college: 'Hansraj College', course: 'B.Com (Hons)', closingScore: 912.4, outOf: 1000),
  LadderPick(college: 'Shri Ram College of Commerce', course: 'B.Com (Hons)', closingScore: 924.3, outOf: 1000),
  LadderPick(college: 'Lady Shri Ram College for Women', course: 'B.Com (Hons)', closingScore: 915.0, outOf: 1000),
  LadderPick(college: 'Hindu College', course: 'B.Com (Hons)', closingScore: 919.9, outOf: 1000),
  LadderPick(college: 'Kirori Mal College', course: 'B.Com (Hons)', closingScore: 905.2, outOf: 1000),
];

/// A brand-new account after the setup: four subjects (Accountancy rated weakest, the first check),
/// five colleges, no paper yet, the Mob on and no Mob joined.
TodayView _fresh() => buildToday(ashaInputs(
      now: _sunday,
      attempts: const [],
      week: _newWeek,
      mobInvite: true,
      subjects: const ['english', 'accountancy', 'business_studies', 'economics'],
      profile: const TodayProfile(
        ladder: _five,
        weakestSubject: 'accountancy',
        weakestRated: 'accountancy',
        subjects: ['accountancy', 'economics', 'business_studies', 'english'],
      ),
    ));

/// The heavy account with five colleges.
TodayView _heavyFive() => buildToday(ashaInputs(
      now: _sunday,
      attempts: ashaRecord(_sunday),
      reviseDue: 6,
      profile: const TodayProfile(ladder: _five, weakestSubject: 'accountancy', restWeekdays: {7}),
    ));

const double _toStack = 420;

Future<void> _tap(WidgetTester tester, Key key) async {
  await tester.tap(find.byKey(key));
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 600));
}

Future<void> _passAll(WidgetTester tester) async {
  final n = _fresh().choices.length.clamp(1, deckSize);
  for (var k = 0; k < n; k++) {
    await _tap(tester, SuggestedStack.notNowKey);
  }
}

Future<void> _toColleges(WidgetTester tester) async {
  await tester.scrollUntilVisible(find.text('See all 5 colleges'), 300, scrollable: find.byType(Scrollable).first);
  await tester.drag(find.byType(Scrollable).first, const Offset(0, -200));
  await tester.pumpAndSettle();
}

void main() {
  setUp(() {
    debugResetTodayPicks();
    DeckCoach.debugReset();
    DeckMemoryStore.debugReset();
    SuggestedStack.debugReset();
    DeckCoach.debugRun = DeckCoachRun.taught();
  });
  tearDown(() {
    DeckCoach.debugReset();
    SuggestedStack.debugReset();
  });

  group('a fresh account, first run', () {
    setUp(() {
      DeckCoach.debugRun = DeckCoachRun.fresh();
      SuggestedStack.debugCoachMotion = true;
    });
    todayGolden('today1019_fresh_deck', _fresh, size: _phone, scrollTo: _toStack);
    todayGolden('today1019_fresh_deck_360', _fresh, size: _small, scrollTo: _toStack);
    todayGolden('today1019_fresh_deck_360_text130', _fresh, size: _small, scrollTo: _toStack + 220, textScale: 1.3);
    // The first Not now: the next card on top and the line that says where the card went.
    todayGolden('today1019_fresh_pass', _fresh, size: _phone, scrollTo: _toStack, act: (t) => _tap(t, SuggestedStack.notNowKey));
  });

  // A returning visit: the count, the card, the row.
  todayGolden('today1019_fresh_returning', _fresh, size: _phone, scrollTo: _toStack);
  todayGolden('today1019_fresh_returning_text130', _fresh, size: _phone, scrollTo: _toStack + 180, textScale: 1.3);

  // Every card seen: "You've seen all five.", the pick line, every way to practise; Undo and Go
  // through them again.
  todayGolden('today1019_fresh_end', _fresh, size: _phone, scrollTo: _toStack, act: _passAll);
  todayGolden('today1019_fresh_end_360_text130', _fresh, size: _small, scrollTo: _toStack + 200, textScale: 1.3, act: _passAll);

  // Your colleges with five picks: the top 3 of 5, labelled, and See all 5 colleges.
  todayGolden('today1019_colleges5', _heavyFive, size: _phone, act: _toColleges);
  todayGolden('today1019_colleges5_360', _heavyFive, size: _small, act: _toColleges);
  todayGolden('today1019_colleges5_360_text130', _heavyFive, size: _small, textScale: 1.3, act: _toColleges);

  // The See all sheet: every college, hardest first, with what each needs.
  for (final (name, size, scale) in [('today1019_colleges_sheet', _phone, 1.0), ('today1019_colleges_sheet_360_text130', _small, 1.3)]) {
    screenGolden(
      name,
      () => Align(
        alignment: Alignment.bottomCenter,
        child: MmSheetGlass(
          child: MmSheetScaffold(
            title: TodayCollegesSheet.titleFor(5),
            child: TodayCollegesSheet(colleges: _heavyFive().road!.colleges, category: 'UR', onOpenColleges: () {}),
          ),
        ),
      ),
      size: size,
      textScale: scale,
      dock: false,
      settle: true,
    );
  }
}
