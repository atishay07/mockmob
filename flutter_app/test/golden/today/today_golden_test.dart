// Today v13 (TODAY-1017): one move, then the glance (This week, the Road to May strip, Last paper,
// Your colleges). Every state of the doc's section 8 and 4.2 at 412 by 915, Night and Day, plus the
// road strip with each tuner open and the hero states that take the card's place.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/auth/load_problem.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/today/data/today_profile.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/today/logic/today_inputs.dart';
import 'package:mockmob/features/today/logic/today_model.dart';
import 'package:mockmob/features/today/logic/why_model.dart';
import 'package:mockmob/features/today/screens/alternatives_sheet.dart';
import 'package:mockmob/features/today/screens/today_body.dart';
import 'package:mockmob/features/today/screens/why_sheet.dart';
import 'package:mockmob/features/today/widgets/road_section.dart';
import 'package:mockmob/features/today/widgets/road_strip.dart';

import '../../unit/today/support/today_fixtures.dart';
import 'today_golden_support.dart';

TodayView _view(TodayInputs inputs) => buildToday(inputs);

/// The doc's phone: 412 by 915.
const Size kPhone = Size(412, 915);

/// The whole page, without the bar, to judge the glance in one picture.
const Size kFull = Size(412, 1700);

/// A glass sheet over the dimmed Today, as the routed sheet shows it.
Widget _sheet(Widget body) => Builder(
      builder: (context) => Stack(
        children: [
          Positioned.fill(child: TodayBody(view: _view(ashaInputs()), callbacks: noopCallbacks)),
          Positioned.fill(child: ColoredBox(color: context.mmColors.scrim)),
          Align(alignment: Alignment.bottomCenter, child: MmSheetGlass(child: MmSheetScaffold(child: body))),
        ],
      ),
    );

/// The road on its own, on the ground, with saves that return at once (or [actions]).
Widget _road(TodayInputs inputs, {RoadActions? actions}) => Builder(
      builder: (context) => ColoredBox(
        color: context.mmColors.ground,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s16, MmSpace.gutter, MmSpace.s32),
          child: RoadSection(road: buildRoad(inputs)!, actions: actions ?? noopRoadActions),
        ),
      ),
    );

Future<void> _tapKey(WidgetTester tester, String key) async {
  await tester.tap(find.byKey(ValueKey(key)));
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 400));
}

/// A new week after eight days away: nothing counted yet, Friday 23 October is today.
const TodayWeek _newWeek = TodayWeek(
  studied: [false, false, false, false, false, false, false],
  todayIndex: 4,
  label: '0 of 4 study days',
  goal: 4,
  planned: {0, 1, 3, 4},
  dates: [19, 20, 21, 22, 23, 24, 25],
);

/// Monday, Tuesday and Thursday counted; Saturday 17 October is today and planned.
const TodayWeek _threeOfFour = TodayWeek(
  studied: [true, true, false, true, false, false, false],
  todayIndex: 5,
  label: '3 of 4 study days',
  goal: 4,
  planned: {0, 1, 3, 5},
  dates: [12, 13, 14, 15, 16, 17, 18],
);

/// The goal met tonight: four of four with Saturday counted.
const TodayWeek _met = TodayWeek(
  studied: [true, true, false, true, false, true, false],
  todayIndex: 5,
  label: '4 of 4 study days',
  goal: 4,
  planned: {0, 1, 3, 5},
  dates: [12, 13, 14, 15, 16, 17, 18],
  met: true,
);

void main() {
  final now = tuesdayEvening;
  // Saturday 17 October 2026, 8:10 PM IST: the date of this pass.
  final saturday = DateTime.utc(2026, 10, 17, 14, 40);
  final activeRecord = ashaRecord(now);
  TodayInputs active() => ashaInputs(now: saturday, attempts: activeRecord, week: _threeOfFour);
  final returningNow = DateTime.utc(2026, 10, 23, 14, 40);
  TodayInputs returning() => ashaInputs(now: returningNow, attempts: activeRecord, week: _newWeek);
  TodayInputs dayOne() => ashaInputs(now: saturday, attempts: const [], week: _newWeek.copyWithToday(5, [12, 13, 14, 15, 16, 17, 18]), profile: const TodayProfile(weakestSubject: 'accountancy'));
  TodayInputs done() => ashaInputs(now: saturday, attempts: activeRecord, week: _met, repaired: repairedAll(activeRecord), repairedToday: 4);

  // The three personas (section 8), first screen and the whole page.
  todayGolden('today_glance_active', () => _view(active()), size: kPhone);
  todayGolden('today_glance_active_full', () => _view(active()), size: kFull, dock: false);
  todayGolden('today_glance_dayone', () => _view(dayOne()), size: kPhone);
  todayGolden('today_glance_dayone_full', () => _view(dayOne()), size: kFull, dock: false);
  todayGolden('today_glance_returning', () => _view(returning()), size: kPhone);
  todayGolden('today_glance_returning_full', () => _view(returning()), size: kFull, dock: false);
  // Tonight done with the week goal met (one Mobi: the cheer beside the week's line).
  todayGolden('today_glance_done', () => _view(done()), size: kFull, dock: false);
  // Loading: the skeleton at the card's height, the week's marks held.
  todayGolden('today_glance_loading', () => _view(TodayInputs(now: saturday, firstName: 'Asha', weekLoading: true)), size: kPhone);
  // Failed with nothing in hand: the named cause, Try again, Practise anyway.
  todayGolden(
    'today_glance_fail',
    () => _view(TodayInputs(now: saturday, firstName: 'Asha', attemptsFailed: true, readProblem: LoadProblem.busy, lastTriedAt: saturday.subtract(const Duration(minutes: 1)), week: _threeOfFour)),
    size: kPhone,
  );
  // Sparse: one paper so far, so the why says so and the second pill is the full mock.
  todayGolden('today_glance_sparse', () => _view(ashaInputs(now: saturday, attempts: [activeRecord.first], week: _threeOfFour)), size: kPhone);
  // Late at night: the object stays, no sleepy Mobi, "Good evening".
  todayGolden('today_glance_late', () => _view(ashaInputs(now: DateTime.utc(2026, 10, 17, 18, 40), attempts: ashaRecord(saturday), week: _threeOfFour)), size: kPhone);
  // Offline with the papers cached: the key waits for a connection and says so above it.
  todayGolden('today_glance_offline', () => _view(ashaInputs(now: saturday, attempts: activeRecord, week: _threeOfFour, offline: true)), size: kPhone);
  // A handle for a name: no name in the greeting (acceptance 11).
  todayGolden('today_glance_handle', () => _view(ashaInputs(now: saturday, attempts: activeRecord, week: _threeOfFour, firstName: 'app-e2e-student')), size: const Size(360, 800));
  todayGolden('today_glance_text130', () => _view(active()), size: kFull, dock: false, textScale: 1.3);
  // The first week, day 5 with no full mock yet: the path's first timed mock is the move.
  todayGolden(
    'today_glance_first_mock',
    () => _view(ashaInputs(
      now: saturday,
      attempts: [paper(id: 'q1', completedAt: daysBefore(saturday, 4), subject: 'accountancy', mode: 'quick', runs: const [('Partnership fundamentals', V.right, 8), ('Partnership fundamentals', V.wrong, 2)])],
      repaired: const {'q1': {'q1-q9', 'q1-q10'}},
      week: _threeOfFour,
    )),
    size: kPhone,
  );
  // Change length opening its panel is checked in test/unit/today/today_v13_test.dart.

  // The road strip (4.4), at rest and with each thing open in place.
  screenGolden('today_road_strip_rest', () => _road(active()), size: const Size(412, 560), dock: false);
  screenGolden('today_road_strip_pace_open', () => _road(active()), size: const Size(412, 760), dock: false, act: (t) => _tapKey(t, 'road-token-pace'));
  screenGolden('today_road_strip_mocks_open', () => _road(active()), size: const Size(412, 760), dock: false, act: (t) => _tapKey(t, 'road-token-mocks'));
  screenGolden(
    'today_road_strip_rail_open',
    () => _road(active()),
    size: const Size(412, 900),
    dock: false,
    act: (tester) async {
      final r = tester.getRect(find.byType(RoadStrip));
      await tester.tapAt(Offset(r.left + r.width * 0.22, r.top + 80));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));
    },
  );
  // A pace save that fails springs back and says why.
  screenGolden(
    'today_road_strip_save_failed',
    () => _road(active(), actions: RoadActions(savePace: (_) async => throw const ApiError(kind: ApiErrorKind.network, code: 'network'), setExamDate: (_) async {}, setMockTarget: (_) async {})),
    size: const Size(412, 760),
    dock: false,
    act: (tester) async {
      await _tapKey(tester, 'road-token-pace');
      final r = tester.getRect(find.byKey(const ValueKey('road-pace')));
      await tester.tapAt(Offset(r.left + r.width * (5.5 / 7), r.center.dy));
      await tester.pump(const Duration(milliseconds: 450));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
    },
  );
  // The window is open: the road as it was.
  screenGolden('today_road_window', () => _road(ashaInputs(now: DateTime.utc(2027, 5, 10, 8))), size: const Size(412, 720), dock: false);

  // The hero states that take the card's place, unchanged in kind.
  todayGolden('today_sealed', () => _view(ashaInputs(unopened: [(attemptId: 'm7', receivedAt: now.subtract(const Duration(minutes: 20)))])), size: kPhone);
  todayGolden(
    'today_resume',
    () => _view(ashaInputs(
      draft: TodayDraft(
        sessionId: 's8',
        subject: 'accountancy',
        isMock: true,
        mockNumber: 8,
        total: 50,
        answered: 23,
        acknowledgedAnswered: 21,
        endsAt: now.add(const Duration(minutes: 34)),
        lastAckAt: now.subtract(const Duration(minutes: 3)),
        resumable: true,
      ),
    )),
    size: kPhone,
  );
  todayGolden('today_week_failed', () => _view(ashaInputs(weekFailed: true)), size: kPhone);

  screenGolden('today_why_sheet', () => _sheet(WhySheetBody(model: buildWhy(ashaRecord(now), 'm7', toDate: ashaInputs().date), onSeeAnswers: () {})), dock: false);
  screenGolden(
    'today_alternatives_sheet',
    () => _sheet(AlternativesSheetBody(rows: alternativeRows(subject: 'accountancy'), onRow: (_) {}, onNotToday: () {}, animateIn: false)),
    dock: false,
  );
}

extension on TodayWeek {
  /// The same empty week placed on other dates.
  TodayWeek copyWithToday(int today, List<int> dates) =>
      TodayWeek(studied: studied, todayIndex: today, label: label, goal: goal, planned: const {0, 1, 3, 5}, dates: dates);
}
