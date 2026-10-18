// Today 1018 (TODAY-1018, the owner's 3:30 am yes, and D25-D29): the lead card with its two
// choices and the swap, the tappable week, Road to CUET read at a glance (due today, due this
// week, the overall goal; D26), Weak chapters, Last paper, Repairs and Revise, Your colleges;
// Change plan as a guided sentence, steps 1 to 3; the paper reel's card after a fresh paper (D29).
// Every state of section 5, Night and Day, at 412 (and 360, and 1.3x text, for the active page).
// Judged against tmp/design-1018/today/captures/app-412-*. Each image was opened and looked at.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/auth/load_problem.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/practice/copy.dart';
import 'package:mockmob/features/today/copy.dart';
import 'package:mockmob/features/today/copy_suggested.dart';
import 'package:mockmob/features/today/data/today_profile.dart';
import 'package:mockmob/features/today/logic/move_price.dart';
import 'package:mockmob/features/today/logic/road_board.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/practice/model/open_paper.dart';
import 'package:mockmob/features/practice/model/pending_start.dart';
import 'package:mockmob/features/practice/model/practice_selection.dart';
import 'package:mockmob/features/today/logic/today_inputs.dart';
import 'package:mockmob/features/today/logic/today_model.dart';
import 'package:mockmob/features/today/screens/today_body.dart';
import 'package:mockmob/features/today/widgets/plan_flow_sheet.dart';
import 'package:mockmob/features/today/widgets/road_glance.dart';
import 'package:mockmob/features/today/widgets/suggested_stack.dart';
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

TodayInputs activeInputs({
  TodayWeek week = sundayWeek,
  int? reviseDue = 6,
  int? openRepairs,
  RoadPlan roadPlan = const RoadPlan(),
  DateTime? now,
  bool offline = false,
  bool weekFailed = false,
  String? firstName = 'Asha',
  OpenPaper? openPaper,
  List<({String attemptId, DateTime receivedAt})> unopened = const [],
  Map<String, Set<String>> repaired = const {
    'm6': {'m6-q2', 'm6-q9'},
  },
}) {
  final at = now ?? sunday;
  final base = ashaInputs(now: at, attempts: ashaRecord(sunday), week: week, reviseDue: reviseDue, offline: offline, weekFailed: weekFailed, firstName: firstName);
  return TodayInputs(
    now: base.now,
    firstName: base.firstName,
    subjects: base.subjects,
    attempts: base.attempts,
    attemptsFetchedAt: base.attemptsFetchedAt,
    attemptsStale: base.attemptsStale,
    plan: base.plan,
    planFetchedAt: base.planFetchedAt,
    planStale: base.planStale,
    offline: offline,
    week: base.week,
    weekFailed: weekFailed,
    profile: base.profile,
    reviseDue: reviseDue,
    reviseShown: reviseDue,
    openRepairs: openRepairs,
    roadPlan: roadPlan,
    unopened: unopened,
    repaired: repaired,
    openPaper: openPaper,
  );
}

TodayView activeView() => buildToday(activeInputs());

/// What the quote and the wallet would say for each move the card can show (fixture prices: a
/// 38-credit wallet, a free Quick practice today, a full mock at 10 of 120 credits).
Map<String, String> fixturePrices(TodayView v) {
  final hero = v.hero;
  final moves = [if (hero is MoveHero) hero, for (final c in v.choices) ?c.hero];
  return {
    for (final m in moves)
      if (switch (m.kind) {
        MoveKind.repair || MoveKind.firstRepair || MoveKind.returning => TodayCopy.priceRepair(38),
        MoveKind.revise => TodayCopy.priceFree,
        MoveKind.mock || MoveKind.firstMock => PracticeCopy.usesCredits(10, 120),
        MoveKind.done || MoveKind.failure => null,
        _ => PracticeCopy.freeToday,
      }
          case final String line)
        priceKeyOf(m): line,
  };
}

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

/// Taps [finder] after scrolling it into view, and lets the swap land.
Future<void> _tapIn(WidgetTester tester, Finder finder) async {
  await tester.ensureVisible(finder);
  await tester.pump();
  await tester.tap(finder);
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 600));
  // Back to the top of the page, where the lead card shows the swap.
  await tester.drag(find.byType(Scrollable).first, const Offset(0, 3000));
  await tester.pumpAndSettle();
}

Future<void> _tapKey(WidgetTester tester, String key) async {
  await tester.tap(find.byKey(ValueKey(key)));
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

/// Change plan as showPlanFlow shows it: the live preview and the keys pinned in the sheet's footer, under the scrolling question
/// (v15 walk, M8). On a short phone the last question scrolls and Done never leaves the screen.
Widget _planPinned(int step) {
  final slot = PlanFooterSlot();
  return Builder(
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
                footer: PlanFooterHost(slot: slot),
                child: PlanFlowBody(layers: view.glance!.road!, road: view.road!, actions: noopRoadActions, initialStep: step, footerSlot: slot),
              ),
            ),
          ),
        ],
      );
    },
  );
}

void main() {
  setUp(debugResetTodayPicks);
  // A paper that is open and not on this phone leads Today: the server's own, and a start nobody read.
  todayGolden('today1018_open_paper_held', () => buildToday(activeInputs(openPaper: _openHeld())), size: kPhone, prices: fixturePrices);
  todayGolden('today1018_open_paper_pending', () => buildToday(activeInputs(openPaper: _openPending())), size: kPhone, prices: fixturePrices);

  // Active: the first screen and the whole page (app-412-active-*).
  todayGolden('today1018_active', activeView, size: kPhone, prices: fixturePrices);
  todayGolden('today1018_active_full', activeView, size: kFull, dock: false, prices: fixturePrices);
  todayGolden('today1018_active_full_360', activeView, size: const Size(360, 3200), dock: false, prices: fixturePrices);
  // One count for open repairs (v15 walk, M6): the lead names its batch and the whole ("123 open in all"), and the Repairs tile says the
  // same 123 that Review's header does.
  todayGolden('today1018_active_open_all', () => buildToday(activeInputs(openRepairs: 123)), size: kFull, dock: false, prices: fixturePrices);
  todayGolden('today1018_active_full_text130', activeView, size: const Size(412, 3900), dock: false, textScale: 1.3, prices: fixturePrices);

  // The swap (6.2): Practise your weakest picked; the recommended repair comes back as Suggested,
  // and the price line follows the card.
  // D51: the weakest chapter, on top of the Suggested stack, is chosen with Do this instead.
  todayGolden('today1018_swap_weakest', activeView, size: kPhone, prices: fixturePrices, act: (t) async {
    Finder onTop(String text) => find.descendant(of: find.byKey(SuggestedStack.topKey), matching: find.text(text));
    await _tapIn(t, onTop(SuggestedCopy.doThis));
  });

  // Day one, returning, done, loading, error, offline.
  todayGolden(
    'today1018_dayone_full',
    () => buildToday(ashaInputs(now: sunday, attempts: const [], week: _newWeek, profile: const TodayProfile(weakestSubject: 'accountancy'))),
    size: const Size(412, 2300),
    dock: false,
    prices: fixturePrices,
  );
  todayGolden(
    'today1018_returning_full',
    () => buildToday(ashaInputs(now: sunday, attempts: ashaRecord(DateTime.utc(2026, 10, 9, 14, 10)), week: _newWeek, reviseDue: 14)),
    size: kFull,
    dock: false,
    prices: fixturePrices,
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
  // The failure card at 360 (v15.1 walk): the title takes a third line beside Mobi, never "did no...".
  todayGolden(
    'today1018_error_360',
    () => buildToday(TodayInputs(now: sunday, firstName: 'Asha', attemptsFailed: true, readProblem: LoadProblem.busy, week: sundayWeek)),
    size: const Size(360, 800),
  );
  todayGolden('today1018_offline', () => buildToday(activeInputs(offline: true)), size: kPhone, prices: fixturePrices);

  // The paper reel's card after a fresh paper (D29): one volt key, Not now, no move row under it.
  todayGolden(
    'today1018_reel',
    () => buildToday(activeInputs(unopened: [(attemptId: 'm7', receivedAt: sunday.subtract(const Duration(minutes: 4)))])),
    size: kPhone,
  );

  // D28: at 2:41 AM the greeting follows the clock.
  todayGolden('today1018_late', () => buildToday(activeInputs(now: DateTime.utc(2026, 10, 17, 21, 11))), size: kPhone, prices: fixturePrices);

  // The week's read failed: the week says so in its own space; the road still reads the calendar.
  todayGolden('today1018_week_failed', () => buildToday(activeInputs(weekFailed: true)), size: const Size(412, 1500), dock: false);

  // A handle for a name: no name in the greeting (acceptance 11), at 360.
  todayGolden('today1018_handle_360', () => buildToday(activeInputs(firstName: 'app-e2e-student')), size: const Size(360, 800));

  // The week: Saturday tapped (app-412-week-sat-night).
  todayGolden('today1018_week_sat', activeView, size: kPhone, scrollTo: 420, act: (t) => _tapText(t, 'Sat', ensure: false));

  // The road at rest, and with each layer open.
  screenGolden(
    'today1018_road',
    () => _onGround(RoadGlance(layers: activeView().glance!.road!, road: activeView().road!, onOpen: (_) {})),
    size: const Size(412, 760),
    dock: false,
  );
  for (final layer in [0, 1, 2]) {
    screenGolden(
      'today1018_road_layer$layer',
      () => _onGround(RoadGlance(layers: activeView().glance!.road!, road: activeView().road!, initialOpen: layer, onOpen: (_) {})),
      size: const Size(412, 900),
      dock: false,
    );
  }

  // A weak chapter open to its mistakes: open ones say Repair, a repaired one says Repaired and
  // See repair (F17).
  screenGolden(
    'today1018_weak_open',
    () => _onGround(WeakChaptersBlock(
      weak: buildToday(activeInputs(repaired: () {
        final all = repairedAll(ashaRecord(sunday));
        return {...all, 'm7': {...all['m7']!}..remove('m7-q3')};
      }())).glance!.weak,
      initialOpen: 0,
      onOpen: (_) {},
    )),
    size: const Size(412, 1200),
    dock: false,
  );

  // Change plan, steps 1 to 3 (app-412-plan-step*), and step 1 with My own date open.
  for (final step in [0, 1, 2]) {
    screenGolden('today1018_plan_step${step + 1}', () => _plan(step), size: kPhone, dock: false);
  }
  screenGolden('today1018_plan_own_date', () => _plan(0), size: const Size(412, 1200), dock: false, act: (t) => _tapKey(t, 'plan-date-own'));
  screenGolden('today1018_plan_step3_pinned', () => _planPinned(2), size: const Size(360, 640), dock: false);
  // The owner's own phone, 360 by 800: the last question's "Your own number" card is whole above the pinned footer (v15 walk, the card was cut).
  screenGolden('today1018_plan_step3_pinned_800', () => _planPinned(2), size: const Size(360, 800), dock: false);
}

/// A paper that is open and not on this phone leads Today (v15 walk, credits): the one the server holds, and a start whose
/// answer never came.
OpenPaper _openHeld() => OpenPaper(
      kind: OpenPaperKind.held,
      subjectId: 'accountancy',
      apiMode: 'full',
      count: 50,
      mockNumber: 9,
      endsAt: sunday.add(const Duration(minutes: 47)),
      sessionId: 'sess-9',
    );

OpenPaper _openPending() => OpenPaper(
      kind: OpenPaperKind.pending,
      subjectId: 'accountancy',
      apiMode: 'full',
      count: 50,
      mockNumber: 9,
      start: PendingStart(
        draftKey: 'full:accountancy',
        generationKey: 'gen-key-123456',
        at: sunday.subtract(const Duration(minutes: 3)),
        selection: PracticeSelection(mode: PracticeMode.full, subjectId: 'accountancy'),
        mockNumber: 9,
      ),
    );
