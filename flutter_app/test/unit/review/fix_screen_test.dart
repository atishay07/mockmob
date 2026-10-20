// Fix it for good (MOBI-CONTRACT 4): the steps in their order, the trap history, check 1 then check 2, held when both
// are right, the charge said truly, and a failure that says nothing was charged.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/models/repair.dart';
import 'package:mockmob/core/router/routes.dart';
import 'package:mockmob/features/review/data/fix_api.dart';
import 'package:mockmob/features/review/data/repair_api.dart';
import 'package:mockmob/features/review/screens/fix_screen.dart';
import 'package:mockmob/features/review/widgets/ai_explanation_note.dart' show AiNoteCopy;

import '../../golden/review/fix_v13_golden_test.dart' show FakeFixChecks, FakeRepairApi, fixResponse;
import '../../golden/review/review_golden_support.dart';
import '../../helpers/golden_harness.dart';

class _LostRepair implements RepairApi {
  _LostRepair(this.error);
  final ApiError error;
  final ids = <String>[];

  @override
  Future<RepairResponse> repair({required String attemptId, required String questionId, required String requestId, int? retryPick}) async {
    ids.add(requestId);
    throw error;
  }
}

class _FailingRepair implements RepairApi {
  int calls = 0;

  @override
  Future<RepairResponse> repair({required String attemptId, required String questionId, required String requestId, int? retryPick}) async {
    calls++;
    throw const ApiError(kind: ApiErrorKind.server, code: 'provider_error', status: 503, details: {'charged': 0});
  }
}

Future<void> _pump(WidgetTester tester, RepairApi api) => pumpMockmob(
      tester,
      const FixScreen(attemptId: 'm7', questionId: 'm7-q0', number: 1),
      size: const Size(412, 3600),
      disableAnimations: true,
      overrides: [
        ...reviewOverrides(),
        repairApiProvider.overrideWithValue(api),
        fixCheckApiProvider.overrideWithValue(FakeFixChecks()),
      ],
      wrapInScaffold: false,
    );

void main() {
  test('the fix route keeps the repair route and names the job', () {
    expect(AppRoutes.reviewFix('m7', 'm7-q0', number: 7), '/review/repair/m7/m7-q0?job=fix&n=7');
    expect(fixResponse.mobi!.historyLine, 'This trap has caught you 4 times in 6 chances.');
    expect(fixResponse.mobi!.yourPick!.letter, 'A');
  });

  testWidgets('the steps come in order, then check 1, check 2 and held', (tester) async {
    await _pump(tester, FakeRepairApi());
    await tester.pumpAndSettle();
    double y(String text) => tester.getTopLeft(find.text(text)).dy;
    expect(y(FixCopy.yourOption), lessThan(y(FixCopy.whyLookedRight)));
    expect(y(FixCopy.whyLookedRight), lessThan(y(FixCopy.whyKeyRight)));
    expect(y(FixCopy.whyKeyRight), lessThan(y(FixCopy.oneRule)));
    expect(y(FixCopy.oneRule), lessThan(y(FixCopy.testIt)));
    expect(find.text('This trap has caught you 4 times in 6 chances.'), findsOneWidget);
    expect(find.text('This fix used 1 credit.'), findsOneWidget);
    expect(find.textContaining('Question 2 of 2'), findsNothing, reason: 'the second check follows the first');

    await tester.tap(find.text('13:5:6'));
    await tester.pump();
    await tester.tap(find.text('Check my answer'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Question 2 of 2'), findsOneWidget);
    expect(find.text(FixCopy.held), findsNothing);

    await tester.tap(find.text('4/8'));
    await tester.pump();
    await tester.tap(find.text('Check my answer'));
    await tester.pumpAndSettle();
    expect(find.text(FixCopy.held), findsOneWidget);
    expect(find.text('Both checks right. This fix is held. Revise brings it back in 3 days.'), findsOneWidget);
  });

  testWidgets('a failed fix says nothing was charged and tries again with a fresh request', (tester) async {
    final api = _FailingRepair();
    await _pump(tester, api);
    await tester.pumpAndSettle();
    expect(find.text(FixCopy.nothingCharged), findsOneWidget);
    await tester.tap(find.text(FixCopy.tryAgain).first);
    await tester.pumpAndSettle();
    expect(api.calls, 2);
  });

  for (final (name, error) in [
    ('offline', const ApiError(kind: ApiErrorKind.network, code: 'network')),
    ('a timeout', const ApiError(kind: ApiErrorKind.timeout, code: 'timeout')),
    ('a 504 with no charge figure', const ApiError(kind: ApiErrorKind.server, code: 'server', status: 504)),
  ]) {
    testWidgets('$name: the outcome is unknown, so it never says nothing was charged, and tries the same request (L-11)', (tester) async {
      final api = _LostRepair(error);
      await _pump(tester, api);
      await tester.pumpAndSettle();
      expect(find.text(FixCopy.lost), findsOneWidget);
      expect(find.text(FixCopy.unknownNote), findsOneWidget);
      expect(find.text(FixCopy.nothingCharged), findsNothing);
      expect(find.textContaining('You are offline'), findsNothing);
      await tester.tap(find.text(FixCopy.tryAgain).first);
      await tester.pumpAndSettle();
      expect(api.ids, hasLength(2));
      expect(api.ids[1], api.ids[0], reason: 'a fix that was written opens free on the same request');
    });
  }

  testWidgets('a written fix says AI wrote it, can be wrong, and can be reported (L-06)', (tester) async {
    await _pump(tester, FakeRepairApi());
    await tester.pumpAndSettle();
    expect(find.text(AiNoteCopy.caveat), findsOneWidget);
    expect(find.text(AiNoteCopy.reportKey), findsOneWidget);
  });
}
