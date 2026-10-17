// Today 1018 (TODAY-1018, the owner's 3:30 am yes): the lead card with its two choices and the
// swap, the tappable week, Road to CUET in three layers (due today, this week, the overall goal),
// Weak chapters, Last paper, Repairs and Revise, Your colleges; and Change plan as a guided
// sentence, steps 1 to 3. Every state of section 5, Night and Day, at 412 and 360 and at 1.3x text.
// Judged against tmp/design-1018/today/captures/app-412-*.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/auth/load_problem.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/today/data/today_profile.dart';
import 'package:mockmob/features/today/logic/road_board.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/today/logic/today_inputs.dart';
import 'package:mockmob/features/today/logic/today_model.dart';
import 'package:mockmob/features/today/screens/today_body.dart';
import 'package:mockmob/features/today/widgets/plan_flow_sheet.dart';
import 'package:mockmob/features/today/widgets/road_glance.dart';
import 'package:mockmob/features/today/widgets/weak_chapters.dart';

import '../../unit/today/support/today_fixtures.dart';
import 'today_golden_support.dart';

/// Sunday 18 October 2026, 7:40 PM IST: the mock's own evening.
final DateTime sunday = DateTime.utc(2026, 10, 18, 14, 10);

/// Monday, Thursday and Saturday counted; Sunday is today and planned.
const TodayWeek sundayWeek = TodayWeek(
  studied: [true, false, false, true, false, true, false],
  todayIndex: 6,
  label: '3 of 4 study days',
  goal: 4,
  planned: {0, 3, 5, 6},
  dates: [12, 13, 14, 15, 16, 17, 18],
);

const TodayWeek _sundayDone = TodayWeek(
  studied: [true, false, false, true, false, true, true],
  todayIndex: 6,
  label: '4 of 4 study days',
  goal: 4,
  planned: {0, 3, 5, 6},
  dates: [12, 13, 14, 15, 16, 17, 18],
  met: true,
);

const TodayWeek _newWeek = TodayWeek(
  studied: [false, false, false, false, false, false, false],
  todayIndex: 6,
  label: '0 of 4 study days',
  goal: 4,
  planned: {0, 3, 5, 6},
  dates: [12, 13, 14, 15, 16, 17, 18],
);

TodayInputs activeInputs({TodayWeek week = sundayWeek, int? reviseDue = 6, RoadPlan roadPlan = const RoadPlan()}) {
  final base = ashaInputs(now: sunday, attempts: ashaRecord(sunday), week: week, reviseDue: reviseDue);
  return TodayInputs(
    now: base.now,
    firstName: base.firstName,
    subjects: base.subjects,
    attempts: base.attempts,
    attemptsFetchedAt: base.attemptsFetchedAt,
    plan: base.plan,
    planFetchedAt: base.planFetchedAt,
    week: base.week,
    profile: base.profile,
    reviseDue: reviseDue,
    reviseShown: reviseDue,
    roadPlan: roadPlan,
    repaired: const {
      'm6': {'m6-q2', 'm6-q9'},
    },
  );
}

TodayView activeView() => buildToday(activeInputs());

const Size kPhone = Size(412, 915);
const Size kFull = Size(412, 3000);

Future<void> _tapText(WidgetTester tester, String text, {bool ensure = true}) async {
  final finder = find.text(text).first;
  if (ensure) {
    await tester.ensureVisible(finder);
    await tester.pump();
  }
  await tester.tap(finder);
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 600));
}

Widget _onGround(Widget child) => Builder(
      builder: (context) => ColoredBox(
        color: context.mmColors.ground,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s32 + 16, MmSpace.gutter, MmSpace.s32),
          child: child,
        ),
      ),
    );

/// Change plan as the routed sheet shows it, over the dimmed Today.
Widget _plan(int step) => Builder(
      builder: (context) {
        final view = activeView();
        return Stack(
          children: [
            Positioned.fill(child: TodayBody(view: view, callbacks: noopCallbacks)),
            Positioned.fill(child: ColoredBox(color: context.mmColors.sheetScrim)),
            Align(
              alignment: Alignment.bottomCenter,
              child: MmSheetGlass(
                child: MmSheetScaffold(
                  title: 'Change plan',
                  child: PlanFlowBody(layers: view.glance!.road!, road: view.road!, actions: noopRoadActions, initialStep: step),
                ),
              ),
            ),
          ],
        );
      },
    );

void main() {
  setUp(debugResetTodayPicks);

  // Active: the first screen and the whole page (app-412-active-*).
  todayGolden('today1018_active', activeView, size: kPhone);
  todayGolden('today1018_active_full', activeView, size: kFull, dock: false);
  todayGolden('today1018_active_full_360', activeView, size: const Size(360, 3200), dock: false);
  todayGolden('today1018_active_full_text130', activeView, size: const Size(412, 3800), dock: false, textScale: 1.3);

  // The swap (6.2): Practise your weakest picked; the recommended repair comes back as Suggested.
  todayGolden('today1018_swap_weakest', activeView, size: kPhone, act: (t) => _tapText(t, 'Practise your weakest', ensure: false));

  // Day one, returning, done, loading, error.
  todayGolden(
    'today1018_dayone_full',
    () => buildToday(ashaInputs(now: sunday, attempts: const [], week: _newWeek, profile: const TodayProfile(weakestSubject: 'accountancy'))),
    size: const Size(412, 2400),
    dock: false,
  );
  todayGolden(
    'today1018_returning_full',
    () => buildToday(ashaInputs(now: DateTime.utc(2026, 10, 18, 14, 10), attempts: ashaRecord(DateTime.utc(2026, 10, 9, 14, 10)), week: _newWeek, reviseDue: 14)),
    size: kFull,
    dock: false,
  );
  todayGolden(
    'today1018_done_full',
    () => buildToday(ashaInputs(now: sunday, attempts: ashaRecord(sunday), week: _sundayDone, repaired: repairedAll(ashaRecord(sunday)), repairedToday: 4, reviseDue: 0)),
    size: kFull,
    dock: false,
  );
  todayGolden('today1018_loading', () => buildToday(TodayInputs(now: sunday, firstName: 'Asha', weekLoading: true)), size: kPhone);
  todayGolden(
    'today1018_error_full',
    () => buildToday(TodayInputs(now: sunday, firstName: 'Asha', attemptsFailed: true, readProblem: LoadProblem.busy, lastTriedAt: sunday.subtract(const Duration(minutes: 1)), week: sundayWeek)),
    size: const Size(412, 2000),
    dock: false,
  );

  // The week: Saturday tapped (app-412-week-sat-night).
  todayGolden('today1018_week_sat', activeView, size: kPhone, scrollTo: 420, act: (t) => _tapText(t, 'Sat', ensure: false));

  // The road with each layer open.
  for (final layer in [0, 1, 2]) {
    screenGolden(
      'today1018_road_layer$layer',
      () => _onGround(RoadGlance(layers: activeView().glance!.road!, road: activeView().road!, initialOpen: layer, onOpen: (_) {})),
      size: const Size(412, 760),
      dock: false,
    );
  }

  // A weak chapter open to its mistakes.
  screenGolden(
    'today1018_weak_open',
    () => _onGround(WeakChaptersBlock(weak: activeView().glance!.weak, initialOpen: 0, onOpen: (_) {})),
    size: const Size(412, 1100),
    dock: false,
  );

  // Change plan, steps 1 to 3 (app-412-plan-step*).
  for (final step in [0, 1, 2]) {
    screenGolden('today1018_plan_step${step + 1}', () => _plan(step), size: kPhone, dock: false);
  }
}
