// L05 (owner 16 Oct: "some adjustments can be put directly into the scrolling ... in the
// timeline"): the road is a strip of weeks you scroll sideways, its CUET flag drags to set the
// date, and the two tuners save on release. The page still scrolls vertically over all of it,
// nothing claims "Saved" before the save returns, and a failed save springs back.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/art/art.dart' show SubjectEmblem;
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/today/logic/mobi_presence.dart';
import 'package:mockmob/features/today/copy.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/today/logic/today_model.dart';
import 'package:mockmob/features/today/widgets/road_rail.dart';
import 'package:mockmob/features/today/widgets/road_section.dart';

import '../../helpers/golden_harness.dart';
import 'support/today_fixtures.dart';

class _Saves {
  final List<Set<int>> pace = [];
  final List<DateTime?> dates = [];
  final List<int?> targets = [];
  Object? failPace;

  RoadActions get actions => RoadActions(
        savePace: (days) async {
          pace.add(days);
          if (failPace != null) throw failPace!;
        },
        setExamDate: (d) async => dates.add(d),
        setMockTarget: (n) async => targets.add(n),
      );
}

void main() {
  late ScrollController page;

  Future<RoadModel> pumpRoad(WidgetTester tester, _Saves saves) async {
    RoadRail.debugResetPeek();
    final road = buildRoad(ashaInputs())!;
    page = ScrollController();
    addTearDown(page.dispose);
    await pumpMockmob(
      tester,
      Builder(
        builder: (context) => ColoredBox(
          color: context.mmColors.ground,
          child: SingleChildScrollView(
            controller: page,
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 600),
            child: RoadSection(road: road, actions: saves.actions),
          ),
        ),
      ),
      size: const Size(390, 844),
      disableAnimations: true,
    );
    await tester.pumpAndSettle();
    return road;
  }

  ScrollPosition railPosition(WidgetTester tester) {
    final list = tester.widget<ListView>(find.descendant(of: find.byType(RoadRail), matching: find.byType(ListView)));
    return list.controller!.position;
  }

  testWidgets('a vertical drag over the rail scrolls the page, not the rail', (tester) async {
    await pumpRoad(tester, _Saves());
    final rail = find.byType(RoadRail);
    await tester.dragFrom(tester.getCenter(rail), const Offset(0, -200));
    await tester.pumpAndSettle();
    expect(page.offset, greaterThan(100));
    expect(railPosition(tester).pixels, 0);
  });

  testWidgets('a sideways drag scrolls the rail and sets no date', (tester) async {
    final saves = _Saves();
    await pumpRoad(tester, saves);
    final rail = find.byType(RoadRail);
    final box = tester.getRect(rail);
    await tester.dragFrom(Offset(box.left + 60, box.center.dy), const Offset(-200, 0));
    await tester.pumpAndSettle();
    expect(railPosition(tester).pixels, greaterThan(100));
    expect(saves.dates, isEmpty);
  });

  testWidgets('the flag follows the finger, the readout says the new date, and release saves it', (tester) async {
    final saves = _Saves();
    final road = await pumpRoad(tester, saves);
    // Bring the exam end of the rail into view.
    final p = railPosition(tester);
    p.jumpTo(p.maxScrollExtent);
    await tester.pumpAndSettle();
    final flag = find.byKey(const ValueKey('road-flag'));
    expect(flag, findsOneWidget);
    final gesture = await tester.startGesture(tester.getCenter(flag));
    // A whole week to the right is one column, 48 dp; go in small steps as a finger does.
    for (var i = 0; i < 12; i++) {
      await gesture.moveBy(const Offset(4, 0));
      await tester.pump(const Duration(milliseconds: 16));
    }
    expect(find.textContaining('Your date: '), findsWidgets);
    await gesture.up();
    await tester.pumpAndSettle();
    expect(saves.dates, hasLength(1));
    final saved = saves.dates.single!;
    final from = road.board!.examDate;
    // About a week later; the rail also scrolls on by itself while the finger is at its edge.
    expect(saved.difference(DateTime.utc(from.year, from.month, from.day)).inDays, inInclusiveRange(5, 30));
  });

  testWidgets('a tap on a pace stop saves that many days once, and says Saved only after it returns', (tester) async {
    final saves = _Saves();
    await pumpRoad(tester, saves);
    final strip = find.byKey(const ValueKey('road-pace'));
    await tester.ensureVisible(strip);
    await tester.pumpAndSettle();
    final r = tester.getRect(strip);
    // Stop 5 of 7.
    await tester.tapAt(Offset(r.left + r.width * (4.5 / 7), r.center.dy));
    await tester.pump(const Duration(milliseconds: 450));
    await tester.pump();
    expect(saves.pace, hasLength(1));
    expect(saves.pace.single.length, 5);
    expect(find.textContaining('Saved. '), findsOneWidget);
    await tester.pump(const Duration(seconds: 3));
  });

  testWidgets('a pace save that fails springs back and names the cause', (tester) async {
    final saves = _Saves()..failPace = TimeoutException('slow');
    final road = await pumpRoad(tester, saves);
    final strip = find.byKey(const ValueKey('road-pace'));
    await tester.ensureVisible(strip);
    await tester.pumpAndSettle();
    final r = tester.getRect(strip);
    await tester.tapAt(Offset(r.left + r.width * (1.5 / 7), r.center.dy));
    await tester.pump(const Duration(milliseconds: 450));
    await tester.pumpAndSettle();
    expect(saves.pace, hasLength(1));
    expect(find.textContaining('Your days stay at ${road.board!.goal}.'), findsOneWidget);
    expect(find.textContaining('Saved. '), findsNothing);
  });

  testWidgets('scrolling the mock ruler sets the target on the phone when it comes to rest', (tester) async {
    final saves = _Saves();
    await pumpRoad(tester, saves);
    final ruler = find.byKey(const ValueKey('road-ruler'));
    await tester.ensureVisible(ruler);
    await tester.pumpAndSettle();
    await tester.dragFrom(tester.getCenter(ruler), const Offset(-40, 0));
    await tester.pumpAndSettle();
    expect(saves.targets, hasLength(1));
    expect(find.text(TodayCopy.mocksSaved), findsOneWidget);
    await tester.pump(const Duration(seconds: 3));
  });

  testWidgets('each band names itself at its start and keeps its name in view as it runs off the left', (tester) async {
    await pumpRoad(tester, _Saves());
    expect(find.text(TodayCopy.railBoards), findsNothing, reason: 'boards are months away, off the rail to the right');
    final p = railPosition(tester);
    // Registration opens in February, boards a fortnight later: scroll so both are in view.
    p.jumpTo(RoadRail.column * 15);
    await tester.pumpAndSettle();
    expect(find.text(TodayCopy.railRegistration), findsOneWidget);
    expect(find.text(TodayCopy.railBoards), findsOneWidget);
    // Into the middle of the boards weeks: the word stays just inside the rail's left edge.
    p.jumpTo(RoadRail.column * 19);
    await tester.pumpAndSettle();
    final rail = tester.getRect(find.byType(RoadRail));
    final word = tester.getRect(find.text(TodayCopy.railBoards));
    expect(word.left, inInclusiveRange(rail.left, rail.left + 48));
  });

  testWidgets('Mobi stands on this week only while the header Mobi is out of view, and a tap glides to the next stop', (tester) async {
    SubjectEmblem.idleEnabled = true;
    addTearDown(() {
      SubjectEmblem.idleEnabled = false;
      TodayMobiPresence.reset();
    });
    TodayMobiPresence.reportHeader(true);
    RoadRail.debugResetPeek();
    final road = buildRoad(ashaInputs())!;
    page = ScrollController();
    addTearDown(page.dispose);
    await pumpMockmob(
      tester,
      Builder(
        builder: (context) => ColoredBox(
          color: context.mmColors.ground,
          child: SingleChildScrollView(
            controller: page,
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 600),
            child: RoadSection(road: road, actions: _Saves().actions),
          ),
        ),
      ),
      size: const Size(390, 844),
      disableAnimations: true,
    );
    await tester.pump(const Duration(milliseconds: 700));
    final mobi = find.byKey(const ValueKey('road-mobi'));
    expect(find.byKey(const ValueKey('road-mobi'), skipOffstage: false), findsOneWidget);
    expect(mobi, findsNothing, reason: 'one Mobi per screen: the header has him');
    TodayMobiPresence.reportHeader(false);
    await tester.pump(const Duration(milliseconds: 100));
    final rail = tester.getRect(find.byType(RoadRail));
    final at = tester.getRect(mobi);
    expect(at.left, greaterThanOrEqualTo(rail.left));
    expect(at.right, lessThanOrEqualTo(rail.left + RoadRail.column), reason: 'he stands on this week, the first column');
    await tester.tap(mobi);
    await tester.pump(const Duration(milliseconds: 400));
    expect(railPosition(tester).pixels, greaterThan(0), reason: 'the rail glides to the next stop');
    // Let the point settle back to standing.
    await tester.pump(const Duration(seconds: 3));
  });
}
