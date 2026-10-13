import 'package:flutter/material.dart';
import 'package:mockmob/features/today/data/today_profile.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/today/logic/today_inputs.dart';
import 'package:mockmob/features/today/logic/today_model.dart';
import 'package:mockmob/features/today/screens/alternatives_sheet.dart';
import 'package:mockmob/features/today/screens/today_body.dart';
import 'package:mockmob/features/today/screens/why_sheet.dart';
import 'package:mockmob/features/today/logic/why_model.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/core/theme/theme.dart';

import '../../unit/today/support/today_fixtures.dart';
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

void main() {
  final now = tuesdayEvening;

  todayGolden('today_ready', () => _view(ashaInputs()));
  todayGolden('today_ready_full', () => _view(ashaInputs()), size: const Size(384, 1900), dock: false);
  todayGolden('today_ready_5min', () => _view(ashaInputs(selectedMinutes: 5)));
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

  todayGolden('today_returning', () => _view(ashaInputs(returning: true, now: now.add(const Duration(days: 4)))));
  todayGolden('today_late_night', () => _view(ashaInputs(now: tuesdayLate)));
  todayGolden('today_offline', () => _view(ashaInputs(offline: true)));
  todayGolden('today_loading', () => _view(TodayInputs(now: now, firstName: 'Asha', week: tuesdayWeek)));
  todayGolden('today_error', () => _view(TodayInputs(now: now, firstName: 'Asha', attemptsFailed: true, week: tuesdayWeek)));
  todayGolden(
    'today_repaired',
    () => _view(ashaInputs(repaired: {'m7': {for (final q in [3, 5, 7, 8, 22, 31]) 'm7-q$q'}})),
  );

  screenGolden(
    'today_why_sheet',
    () => _sheet(WhySheetBody(model: buildWhy(ashaRecord(now), 'm7', toDate: ashaInputs().date), onSeeAnswers: () {})),
    dock: false,
  );
  screenGolden(
    'today_alternatives_sheet',
    () => _sheet(AlternativesSheetBody(rows: alternativeRows(subject: 'accountancy'), onRow: (_) {}, onNotToday: () {})),
    dock: false,
  );
}
