// M8 of the v15 emulator walk: on Change plan's last question "Done" and the live preview sat below the fold with no cue;
// they only appeared after dragging the sheet. The sheet now pins them in its footer, under the scrolling question.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/features/today/copy.dart' show TodayCopy;
import 'package:mockmob/features/today/copy_glance.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/today/logic/today_inputs.dart';
import 'package:mockmob/features/today/widgets/plan_flow_sheet.dart';
import 'package:mockmob/features/today/widgets/road_section.dart' show RoadActions;

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'support/today_fixtures.dart';

final DateTime _sunday = DateTime.utc(2026, 10, 18, 14, 10);

abstract final class TodayCopyDays {
  static String get first => TodayCopy.weekdayShort.first;
  static String get last => TodayCopy.weekdayShort.last;
}

const TodayWeek _week = TodayWeek(
  studied: [true, false, false, true, false, true, false],
  todayIndex: 6,
  label: '3 of 4 study days',
  goal: 4,
  planned: {0, 3, 5, 6},
  dates: [12, 13, 14, 15, 16, 17, 18],
);

final _overrides = [
  authSnapshotProvider.overrideWithBuild((ref, notifier) => const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u', name: 'Asha Verma')),
];

void main() {
  setUpAll(loadAppFonts);

  Future<List<String?>> openSheet(WidgetTester tester, {int step = 2, Size size = const Size(360, 640)}) async {
    final saved = <String?>[];
    final view = buildToday(ashaInputs(now: _sunday, attempts: ashaRecord(_sunday), week: _week, reviseDue: 6));
    await pumpMockmob(
      tester,
      Builder(
        builder: (context) => Center(
          child: TextButton(
            onPressed: () async => saved.add(await showPlanFlow(
              context,
              layers: view.glance!.road!,
              road: view.road!,
              initialStep: step,
              actions: RoadActions(savePace: (_) async {}, setExamDate: (_) async {}, setMockTarget: (_) async {}),
            )),
            child: const Text('open plan'),
          ),
        ),
      ),
      size: size,
      disableAnimations: true,
      overrides: _overrides,
    );
    await tester.tap(find.text('open plan'));
    await tester.pumpAndSettle();
    return saved;
  }

  Finder inFooter(Finder what) => find.descendant(of: find.byType(PlanFooterHost), matching: what);

  testWidgets('on the last question Done and the preview are in the pinned footer, whole on a short phone with no scroll', (tester) async {
    const size = Size(360, 640);
    await openSheet(tester, size: size);
    expect(inFooter(find.text(GlanceCopy.done)), findsOneWidget);
    expect(tester.getRect(find.text(GlanceCopy.done)).bottom, lessThanOrEqualTo(size.height), reason: 'Done is on screen without dragging');
    // The preview (weeks to the date, study days, mocks to go) stands above it, also in the footer.
    expect(inFooter(find.textContaining('mocks to go')), findsOneWidget);
    final preview = tester.getRect(find.textContaining('mocks to go')).bottom;
    expect(preview, lessThan(tester.getRect(find.text(GlanceCopy.done)).top));
    expect(preview, lessThanOrEqualTo(size.height));
  });

  testWidgets('the question scrolls above the footer; the footer stays put', (tester) async {
    await openSheet(tester, size: const Size(360, 640));
    final before = tester.getTopLeft(find.text(GlanceCopy.done));
    await tester.drag(find.text(GlanceCopy.askMocks), const Offset(0, -120));
    await tester.pumpAndSettle();
    expect(tester.getTopLeft(find.text(GlanceCopy.done)), before, reason: 'the pinned footer does not move with the question');
  });

  testWidgets('the preview in the footer follows each answer', (tester) async {
    await openSheet(tester, size: const Size(360, 640));
    String footerText() => [for (final t in tester.widgetList<Text>(inFooter(find.byType(Text)))) t.data ?? ''].join('|');
    final before = footerText();
    await tester.tap(find.byKey(const ValueKey('plan-pace-week')));
    await tester.pumpAndSettle();
    final week = footerText();
    expect(week, isNot(before), reason: 'one a week changes how many mocks are to go');
    await tester.tap(find.byKey(const ValueKey('plan-pace-month')));
    await tester.pumpAndSettle();
    expect(footerText(), isNot(week));
  });

  testWidgets('Back and Next live in the footer too, and Done closes the sheet with the receipt once something was saved', (tester) async {
    final saved = await openSheet(tester, step: 1, size: const Size(360, 640));
    expect(inFooter(find.text(GlanceCopy.back)), findsOneWidget);
    expect(inFooter(find.byKey(const ValueKey('plan-next'))), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('plan-next')));
    await tester.pumpAndSettle();
    expect(find.text(GlanceCopy.askMocks), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('plan-pace-week')));
    await tester.pumpAndSettle();
    await tester.tap(find.text(GlanceCopy.done));
    await tester.pumpAndSettle();
    expect(find.byType(PlanFlowBody), findsNothing);
    expect(saved, hasLength(1));
    expect(saved.single, isNotNull, reason: 'the receipt line comes back once an answer was saved');
  });

  testWidgets('the seven days fit a 360 dp phone inside the sheet, none past its 20 dp margins', (tester) async {
    await openSheet(tester, step: 1, size: const Size(360, 800));
    expect(tester.takeException(), isNull, reason: 'no overflow');
    final first = tester.getRect(find.text(TodayCopyDays.first));
    final last = tester.getRect(find.text(TodayCopyDays.last));
    expect(first.left, greaterThanOrEqualTo(20));
    expect(last.right, lessThanOrEqualTo(340));
  });

  testWidgets('standing alone (a page, a test) the body keeps its own preview and keys, as before', (tester) async {
    final view = buildToday(ashaInputs(now: _sunday, attempts: ashaRecord(_sunday), week: _week, reviseDue: 6));
    await pumpMockmob(
      tester,
      SingleChildScrollView(padding: const EdgeInsets.all(16), child: PlanFlowBody(layers: view.glance!.road!, road: view.road!, initialStep: 2, onClose: (_) {})),
      size: const Size(412, 2400),
      disableAnimations: true,
      overrides: _overrides,
    );
    expect(find.byType(PlanFooterHost), findsNothing);
    expect(find.text(GlanceCopy.done), findsOneWidget);
    expect(find.textContaining('mocks to go'), findsOneWidget);
  });
}
