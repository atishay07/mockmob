// Today's pieces that the 1018 page suite (today_1018_golden_test.dart) does not draw: the resume
// hero that takes the card's place while a session is open, and the two sheets Today opens (the
// why sheet and More ways to practise). The page itself, every state of TODAY-1018 section 5, the
// road, the weak chapters, Change plan and the paper reel's card are in the 1018 suite; the v13
// glance and road-strip images it replaced were retired with the v13 layout.

import 'package:flutter/material.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/today/logic/today_inputs.dart';
import 'package:mockmob/features/today/logic/today_model.dart';
import 'package:mockmob/features/today/logic/why_model.dart';
import 'package:mockmob/features/today/screens/alternatives_sheet.dart';
import 'package:mockmob/features/today/screens/today_body.dart';
import 'package:mockmob/features/today/screens/why_sheet.dart';

import '../../unit/today/support/today_fixtures.dart';
import 'today_golden_support.dart';

TodayView _view(TodayInputs inputs) => buildToday(inputs);

/// The doc's phone: 412 by 915.
const Size kPhone = Size(412, 915);

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

void main() {
  final now = tuesdayEvening;

  // A session still open takes the card's place: Continue, with the real answered share.
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

  screenGolden('today_why_sheet', () => _sheet(WhySheetBody(model: buildWhy(ashaRecord(now), 'm7', toDate: ashaInputs().date), onSeeAnswers: () {})), dock: false);
  screenGolden(
    'today_alternatives_sheet',
    () => _sheet(AlternativesSheetBody(rows: alternativeRows(ashaInputs(), moveKind: MoveKind.repair, moveSubject: 'accountancy', revise: (size: 10, due: 92)), onRow: (_) {}, onNotToday: () {}, animateIn: false)),
    dock: false,
  );
}
