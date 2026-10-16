import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/today/data/today_profile.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/today/logic/today_inputs.dart';
import 'package:mockmob/features/today/logic/today_model.dart';
import 'package:mockmob/features/today/screens/alternatives_sheet.dart';
import 'package:mockmob/features/today/screens/today_body.dart';
import 'package:mockmob/features/today/widgets/length_pill.dart';
import 'package:mockmob/features/today/widgets/colleges_card.dart';
import 'package:mockmob/features/today/widgets/road_rail.dart';
import 'package:mockmob/features/today/widgets/road_section.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/features/today/screens/why_sheet.dart';
import 'package:mockmob/features/today/logic/why_model.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/core/theme/theme.dart';

import '../../unit/today/support/today_fixtures.dart';
import 'package:mockmob/core/auth/load_problem.dart';

import 'today_golden_support.dart';

TodayView _view(TodayInputs inputs) => buildToday(inputs);

/// A glass sheet over the dimmed Today, as the routed sheet shows it.
Widget _sheet(Widget body) => Builder(
      builder: (context) => Stack(
        children: [
          Positioned.fill(child: TodayBody(view: _view(ashaInputs()), callbacks: noopCallbacks)),
          Positioned.fill(child: ColoredBox(color: context.mmColors.scrim)),
          Align(
            alignment: Alignment.bottomCenter,
            child: MmSheetGlass(child: MmSheetScaffold(child: body)),
          ),
        ],
      ),
    );

/// The road to May on its own: the timeline with the dated stops under it, and the ladder.
Widget _road(TodayInputs inputs) => Builder(
      builder: (context) => ColoredBox(
        color: context.mmColors.ground,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(MmSpace.cardGutter, MmSpace.s16, MmSpace.cardGutter, MmSpace.s32),
          child: RoadSection(road: buildRoad(inputs)!, actions: noopRoadActions, onChooseColleges: () {}),
        ),
      ),
    );

/// The road whose saves fail as a phone without a connection does.
Widget _roadFailing(TodayInputs inputs) => Builder(
      builder: (context) => ColoredBox(
        color: context.mmColors.ground,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(MmSpace.cardGutter, MmSpace.s16, MmSpace.cardGutter, MmSpace.s32),
          child: RoadSection(
            road: buildRoad(inputs)!,
            actions: RoadActions(
              savePace: (_) async => throw const ApiError(kind: ApiErrorKind.network, code: 'network'),
              setExamDate: (_) async {},
              setMockTarget: (_) async {},
            ),
          ),
        ),
      ),
    );

/// The road whose saves have not returned yet (a slow connection): the tuners say Saving.
Widget _roadSaving(TodayInputs inputs) => Builder(
      builder: (context) => ColoredBox(
        color: context.mmColors.ground,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(MmSpace.cardGutter, MmSpace.s16, MmSpace.cardGutter, MmSpace.s32),
          child: RoadSection(
            road: buildRoad(inputs)!,
            actions: RoadActions(
              savePace: (_) => Completer<void>().future,
              setExamDate: (_) => Completer<void>().future,
              setMockTarget: (_) => Completer<void>().future,
            ),
          ),
        ),
      ),
    );

/// Brings the exam end of the rail into view and holds the CUET flag a week and a half earlier,
/// the finger still down and clear of the rail's edges (an edge would scroll the rail on).
Future<void> _holdFlag(WidgetTester tester) async {
  final list = tester.widget<ListView>(find.descendant(of: find.byType(RoadRail), matching: find.byType(ListView)));
  final p = list.controller!.position;
  p.jumpTo(p.maxScrollExtent);
  await tester.pump(const Duration(milliseconds: 300));
  final gesture = await tester.startGesture(tester.getCenter(find.byKey(const ValueKey('road-flag'))));
  for (var i = 0; i < 18; i++) {
    await gesture.moveBy(const Offset(-4, 0));
    await tester.pump(const Duration(milliseconds: 16));
  }
  await tester.pump(const Duration(milliseconds: 200));
}

/// Taps the pace strip at stop [n] and lets its save run.
Future<void> _tapPace(WidgetTester tester, int n) async {
  final r = tester.getRect(find.byKey(const ValueKey('road-pace')));
  await tester.tapAt(Offset(r.left + r.width * ((n - 0.5) / 7), r.center.dy));
  await tester.pump(const Duration(milliseconds: 450));
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 300));
}

/// Your colleges on the ground, as Today ends.
Widget _colleges(RoadModel road, CollegesCardInfo info) => Builder(
      builder: (context) => ColoredBox(
        color: context.mmColors.ground,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(MmSpace.cardGutter, MmSpace.s16, MmSpace.cardGutter, MmSpace.s32),
          child: CollegesCard(road: road, info: info, onChoose: () {}, onSeeAll: () {}, onCompass: () {}, onRow: (_) {}),
        ),
      ),
    );

void main() {
  final now = tuesdayEvening;

  todayGolden('today_ready', () => _view(ashaInputs()));
  todayGolden('today_ready_full', () => _view(ashaInputs()), size: const Size(384, 1900), dock: false);
  todayGolden('today_practice', () => _view(ashaInputs(attempts: [accountancyMock('clean', daysBefore(tuesdayEvening, 1))])));
  screenGolden('today_road', () => _road(ashaInputs()), size: const Size(384, 1000), dock: false);
  screenGolden('today_road_window', () => _road(ashaInputs(now: DateTime.utc(2027, 5, 10, 8))), size: const Size(384, 720), dock: false);
  todayGolden('today_ready_5min', () => _view(ashaInputs(selectedMinutes: 5)));
  // The first study week of a session explains its marks (design critic 16 Oct, finding 5).
  todayGolden('today_week_first_look', () => _view(ashaInputs()), firstWeekLook: true);
  // The length pill opens its three lengths just above it (finding 1).
  todayGolden(
    'today_length_panel',
    () => _view(ashaInputs()),
    act: (tester) async {
      await tester.tap(find.byType(LengthPill));
      await tester.pumpAndSettle();
    },
  );
  todayGolden('today_ready_text130', () => _view(ashaInputs()), textScale: 1.3);
  todayGolden('today_morning', () => _view(ashaInputs(now: DateTime.utc(2026, 10, 13, 2, 0))));

  todayGolden(
    'today_day_one',
    () => _view(ashaInputs(
      now: DateTime.utc(2026, 10, 13, 13, 0),
      attempts: const [],
      profile: TodayProfile(
        ladder: ashaProfile.ladder,
        weakestSubject: 'accountancy',
        firstMoveAt: DateTime.utc(2026, 10, 13, 14, 30),
        restWeekdays: const {7},
      ),
    )),
  );
  todayGolden('today_day_one_full', () => _view(ashaInputs(attempts: const [])), size: const Size(384, 1500), dock: false);

  todayGolden(
    'today_sealed',
    () => _view(ashaInputs(unopened: [(attemptId: 'm7', receivedAt: now.subtract(const Duration(minutes: 20)))])),
  );

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
  );

  todayGolden(
    'today_ended',
    () => _view(ashaInputs(
      draft: TodayDraft(
        sessionId: 's8',
        subject: 'accountancy',
        isMock: true,
        mockNumber: 8,
        total: 50,
        answered: 31,
        acknowledgedAnswered: 31,
        endsAt: now.subtract(const Duration(hours: 3)),
        resumable: false,
        attemptExists: false,
      ),
    )),
  );

  todayGolden('today_returning', () => _view(ashaInputs(returning: true, now: now.add(const Duration(days: 4)), week: saturdayWeek)));
  todayGolden('today_late_night', () => _view(ashaInputs(now: tuesdayLate)));
  // A 360 by 780 phone: the card's key is under the dock at rest, so the pinned bar holds it.
  todayGolden('today_late_night_short', () => _view(ashaInputs(now: tuesdayLate)), size: const Size(360, 780));
  // At 1.3x the key is below the fold and its label is the short one, on one line.
  todayGolden('today_ready_text130_short', () => _view(ashaInputs()), size: const Size(360, 780), textScale: 1.3);
  todayGolden('today_offline', () => _view(ashaInputs(offline: true)));
  todayGolden('today_loading', () => _view(TodayInputs(now: now, firstName: 'Asha', week: tuesdayWeek)));
  todayGolden('today_error', () => _view(TodayInputs(now: now, firstName: 'Asha', attemptsFailed: true, week: tuesdayWeek)));
  // L01: a Try again that changed nothing says when it ran, in the card (no snackbar).
  todayGolden(
    'today_fail_tried',
    () => _view(TodayInputs(
      now: now,
      firstName: 'Asha',
      attemptsFailed: true,
      readProblem: LoadProblem.busy,
      lastTriedAt: now.subtract(const Duration(minutes: 1)),
      week: tuesdayWeek,
    )),
  );
  // L01: nothing cached and offline: the card names it and is already watching for the network.
  todayGolden(
    'today_fail_offline_nocache',
    () => _view(TodayInputs(now: now, firstName: 'Asha', attemptsFailed: true, readProblem: LoadProblem.offline, offline: true, week: tuesdayWeek)),
  );
  // L01: nothing in hand, online, the server busy: the named cause, Try again, Practise anyway.
  todayGolden(
    'today_fail_busy',
    () => _view(TodayInputs(now: now, firstName: 'Asha', attemptsFailed: true, readProblem: LoadProblem.busy, week: tuesdayWeek)),
    size: const Size(390, 844),
  );
  // L01 S7: the papers are the phone's copy because a refresh failed online; the move stays and
  // the header line runs Try again.
  todayGolden('today_refresh_failed_header', () => _view(ashaInputs(attemptsStale: true)), size: const Size(390, 844));
  // L05: the road at 390, scrolled into view in the full page.
  screenGolden('today_road_rail', () => _road(ashaInputs()), size: const Size(390, 1000), dock: false);
  screenGolden('today_road_rail_text130', () => _road(ashaInputs()), size: const Size(390, 1100), dock: false, textScale: 1.3);
  // L03: the week's first read failed with nothing cached: its slot stays, saying so, so a later
  // read fills it in place instead of adding a section.
  todayGolden('today_week_failed', () => _view(ashaInputs(weekFailed: true)), size: const Size(390, 844));
  todayGolden('today_partial_plan_failed', () => _view(ashaInputs(plan: unavailablePlan())), size: const Size(390, 844));
  screenGolden('today_road_rail_360', () => _road(ashaInputs()), size: const Size(360, 1000), dock: false);
  // L05: a November week selected: the readout says it in words.
  screenGolden(
    'today_road_week_selected',
    () => _road(ashaInputs()),
    size: const Size(390, 1000),
    dock: false,
    act: (tester) async {
      final rail = tester.getRect(find.byType(RoadRail));
      await tester.tapAt(Offset(rail.left + RoadRail.column * 4.5, rail.top + 90));
      // The tap lands on this frame; the readout's fade runs on the frames after it.
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
    },
  );
  // L05: no weekly goal yet: one open pip a week, the pace strip asks for a number.
  screenGolden('today_road_no_goal', () => _road(ashaInputs(week: noGoalWeek)), size: const Size(390, 1000), dock: false);
  // L05 step 8: offline, a pace change springs back and names the cause.
  screenGolden(
    'today_road_save_failed',
    () => _roadFailing(ashaInputs()),
    size: const Size(390, 1000),
    dock: false,
    act: (tester) => _tapPace(tester, 6),
  );
  // L05 8.6: the flag held a week and a half earlier: the readout and the figure say the new date.
  screenGolden('today_road_flag_dragging', () => _road(ashaInputs()), size: const Size(390, 1000), dock: false, act: _holdFlag);
  // L05 8.7: a pace stop tapped and its save still out: Saving, never Saved before it returns.
  screenGolden(
    'today_road_pace_saving',
    () => _roadSaving(ashaInputs()),
    size: const Size(390, 1000),
    dock: false,
    act: (tester) => _tapPace(tester, 6),
  );
  // IA 5.2: Your colleges, with picks and without.
  screenGolden('today_colleges_card_some', () => _colleges(buildRoad(ashaInputs())!, const CollegesCardInfo()), size: const Size(390, 520), dock: false);
  screenGolden(
    'today_colleges_card_none',
    () => _colleges(buildRoad(ashaInputs(profile: null))!, const CollegesCardInfo(open: 35, total: 73)),
    size: const Size(390, 360),
    dock: false,
  );
  todayGolden(
    'today_repaired',
    () => _view(ashaInputs(repaired: repairedAll(ashaRecord(tuesdayEvening)))),
  );

  screenGolden(
    'today_why_sheet',
    () => _sheet(WhySheetBody(model: buildWhy(ashaRecord(now), 'm7', toDate: ashaInputs().date), onSeeAnswers: () {})),
    dock: false,
  );
  screenGolden(
    'today_alternatives_sheet',
    () => _sheet(AlternativesSheetBody(rows: alternativeRows(subject: 'accountancy'), onRow: (_) {}, onNotToday: () {}, animateIn: false)),
    dock: false,
  );
}
