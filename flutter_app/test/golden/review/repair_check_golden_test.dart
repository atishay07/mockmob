import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/ai_credits.dart';
import 'package:mockmob/core/models/repair_check.dart';
import 'package:mockmob/features/review/data/repair_check_controller.dart';
import 'package:mockmob/features/review/data/repair_check_logic.dart';
import 'package:mockmob/features/review/screens/repair_screen.dart';
import 'package:mockmob/features/review/widgets/repair_check_section.dart' show AskAboutMistake;

import '../../unit/review/support/repair_check_fixtures.dart';
import '../../unit/review/support/repair_v3_fixtures.dart';
import 'review_golden_support.dart';

/// Repair v4: "Ask Mobi about Qn" and "Check it held" on the repair, at 390 wide (Night and Day).
/// Each frame is the repair scrolled to the Ask line, so the explanation's rule sits just above it.
const _size = Size(390, 1500);
const _key = (attemptId: 'm7', questionId: 'm7-q0');

Widget repair() => const RepairScreen(attemptId: 'm7', questionId: 'm7-q0');

Map<String, dynamic> _body(String status) => {
      ...v3Json(),
      'check': {...examples()[status]!, 'href': '/api/recovery/check?attemptId=m7&questionId=m7-q0', 'askHref': '/mentor?tab=ask&q=m7:m7-q0'},
    };

List<Override> _overrides(String status, CheckView view, {AiCredits? wallet}) => [
      ...v3Overrides(v3Outcome(_body(status)), insights: v3Insights(), credits: wallet ?? credits(43)),
      repairCheckProvider(_key).overrideWithBuild((ref, n) => view),
    ];

AiCredits _paused() => AiCredits.fromJson({
      'state': 'paused',
      'wallet': {'state': 'paused', 'known': true, 'total': 43, 'resetAt': '2026-10-31T18:30:00Z'},
    });

CheckView _ready({int? pick}) => planLoaded(readyLoad()).copyWith(pick: pick);

CheckView _answered({required bool right}) => CheckView(
      phase: CheckPhase.answered,
      question: (readyLoad() as CheckReady).question,
      result: answer(right: right, pick: 2).result,
    );

/// The repair scrolled so the Ask line is at the top of the frame, under the run track.
Future<void> _toAsk(WidgetTester tester) async {
  await Scrollable.ensureVisible(tester.element(find.byType(AskAboutMistake)), alignment: 0.1);
  await tester.pump();
}

void main() {
  reviewGolden('repair_check_ready', repair, size: _size, overrides: () => _overrides('ready', _ready()), after: _toAsk);
  reviewGolden('repair_check_picked', repair, size: _size, overrides: () => _overrides('ready', _ready(pick: 2)), after: _toAsk);
  reviewGolden('repair_check_right', repair, size: _size, overrides: () => _overrides('answered', _answered(right: true)), after: _toAsk);
  reviewGolden('repair_check_missed', repair, size: _size, overrides: () => _overrides('answered', _answered(right: false)), after: _toAsk);
  reviewGolden(
    'repair_check_none',
    repair,
    size: _size,
    overrides: () => _overrides('none', planLoaded(const CheckNone(reason: 'no_unseen'))),
    after: _toAsk,
  );
  reviewGolden(
    'repair_check_paused_ask',
    repair,
    size: _size,
    overrides: () => _overrides('ready', _ready(), wallet: _paused()),
    after: _toAsk,
  );
}
