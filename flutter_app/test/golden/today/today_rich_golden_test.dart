// The richer Today (D52, TODAY-SWIPE-1018, approved by the owner at 12:50 pm on 18 Oct): Mobi back in
// the header, The weeks ahead, Your marks (the trend merged with Last paper) and Weak chapters as
// ordered bars. Night and Day, at 360 x 800 and 412 x 915, and 1.3x text. Judged against
// tmp/design-1018/v15-feedback/shots/d52-*. Each image was opened and looked at.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/today/logic/today_inputs.dart';
import 'package:mockmob/features/today/screens/today_body.dart';
import 'package:mockmob/features/today/widgets/weak_chapters.dart';
import 'package:mockmob/features/today/widgets/weeks_ahead.dart';
import 'package:mockmob/features/today/widgets/your_marks.dart';

import '../../unit/today/support/today_fixtures.dart';
import 'today_1018_golden_test.dart' show activeInputs, activeView, fixturePrices, sunday;
import 'today_golden_support.dart';

Widget _onGround(Widget child) => Builder(
      builder: (context) => ColoredBox(
        color: context.mmColors.ground,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s32 + 16, MmSpace.gutter, MmSpace.s32),
          child: child,
        ),
      ),
    );

/// The rhythm paused: no plan, so the weeks ahead shows the milestones only.
const TodayWeek _paused = TodayWeek(studied: [false, false, false, false, false, false, false], todayIndex: 6, label: 'Paused', paused: true);

Widget _marksAndWeak() {
  final g = activeView().glance!;
  return Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      YourMarksBlock(trend: g.marks, paper: g.paper, onOpen: (_) {}),
      const SizedBox(height: 40),
      WeakChaptersBlock(weak: g.weak, onOpen: (_) {}),
    ],
  );
}

void main() {
  setUp(debugResetTodayPicks);

  // The first screen: Mobi back at the top right, the greeting on one line (d52-today-fold1-*).
  todayGolden('today_rich_fold1_360', activeView, size: const Size(360, 800), prices: fixturePrices);
  todayGolden('today_rich_fold1_412', activeView, size: const Size(412, 915), prices: fixturePrices);
  todayGolden('today_rich_fold1_360_text130', activeView, size: const Size(360, 800), textScale: 1.3, prices: fixturePrices);

  // The weeks ahead (d52-today-weeks-ahead-*).
  screenGolden('today_rich_ahead_360', () => _onGround(WeeksAheadBlock(ahead: activeView().glance!.ahead!, onWeek: (_) {})), size: const Size(360, 800), dock: false);
  screenGolden('today_rich_ahead_412', () => _onGround(WeeksAheadBlock(ahead: activeView().glance!.ahead!, onWeek: (_) {})), size: const Size(412, 915), dock: false);
  screenGolden(
    'today_rich_ahead_360_text130',
    () => _onGround(WeeksAheadBlock(ahead: activeView().glance!.ahead!, onWeek: (_) {})),
    size: const Size(360, 1100),
    dock: false,
    textScale: 1.3,
  );
  // No plan: the milestones only.
  screenGolden(
    'today_rich_ahead_noplan_412',
    () => _onGround(WeeksAheadBlock(ahead: buildToday(activeInputs(week: _paused)).glance!.ahead!)),
    size: const Size(412, 600),
    dock: false,
  );

  // Your marks and Weak chapters (d52-today-marks-*).
  screenGolden('today_rich_marks_360', () => _onGround(_marksAndWeak()), size: const Size(360, 1100), dock: false);
  screenGolden('today_rich_marks_412', () => _onGround(_marksAndWeak()), size: const Size(412, 1100), dock: false);
  screenGolden('today_rich_marks_360_text130', () => _onGround(_marksAndWeak()), size: const Size(360, 1400), dock: false, textScale: 1.3);
  // One full mock only: Last paper alone, as v15.
  screenGolden(
    'today_rich_marks_one_mock_412',
    () {
      final one = ashaInputs(now: sunday, attempts: ashaRecord(sunday).where((a) => a.id == 'm7' || a.id == 'q1').toList(), week: activeInputs().week!, reviseDue: 6);
      final g = buildToday(one).glance!;
      return _onGround(YourMarksBlock(trend: g.marks, paper: g.paper, onOpen: (_) {}));
    },
    size: const Size(412, 500),
    dock: false,
  );

  // The whole refined page (d52-today-full-*).
  todayGolden('today_rich_full_412', activeView, size: const Size(412, 4300), dock: false, prices: fixturePrices);
  todayGolden('today_rich_full_360', activeView, size: const Size(360, 4600), dock: false, prices: fixturePrices);
}
