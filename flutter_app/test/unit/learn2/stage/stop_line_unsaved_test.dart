// R8 APP-07: the stop sheet never says "It’s all saved." after an answer failed to save, and neither does the run's
// error end ("Your session is saved ... every rating and answer is saved").
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/learn2/run/run_controller.dart' show RunEndStatus;
import 'package:mockmob/features/learn2/run/run_copy.dart';
import 'package:mockmob/features/learn2/run/run_end.dart';
import 'package:mockmob/features/learn2/run/run_math.dart';
import 'package:mockmob/features/learn2/stage/stage_end_model.dart';
import 'package:mockmob/features/learn2/stage/stage_keys.dart';

import '../../../helpers/fonts.dart';
import 'support/stage_harness.dart';

Widget _runEnd({int unsaved = 0}) => RunEndScreen(
  status: RunEndStatus.error,
  data: null,
  kind: 'chapter',
  chapterTitle: 'Goodwill',
  tally: const RunTally(),
  stoppedAt: null,
  total: 10,
  close: StageCloseKey(onTap: () {}, semanticsLabel: 'Close the session'),
  onRetry: () {},
  keyKind: (_) => RunKeyKind.none,
  onKey: (_) {},
  unsaved: unsaved,
);

void main() {
  setUpAll(loadAppFonts);

  test('nothing failed: all saved', () {
    expect(StageEndModel.stopSheetLine(1, 11), '1 of 11 done. It’s all saved.');
  });

  test('a failed answer is named, and the rest is kept', () {
    expect(StageEndModel.stopSheetLine(1, 11, unsaved: 1), '1 of 11 done. 1 answer didn’t save. The rest is kept.');
    expect(StageEndModel.stopSheetLine(3, 11, unsaved: 2), '3 of 11 done. 2 answers didn’t save. The rest is kept.');
  });

  testWidgets('run error end with nothing unsaved: the session is saved', (tester) async {
    await pumpStage(tester, _runEnd());
    await tester.pumpAndSettle();
    expect(find.text(RunCopy.endErrorTitle), findsOneWidget);
    expect(find.text(RunCopy.endErrorLine), findsOneWidget);
  });

  testWidgets('run error end with an unsaved answer names it and never says everything is saved', (tester) async {
    await pumpStage(tester, _runEnd(unsaved: 1));
    await tester.pumpAndSettle();
    expect(find.text('1 answer didn’t save.'), findsOneWidget);
    expect(find.text(RunCopy.endErrorUnsavedLine), findsOneWidget);
    expect(find.text(RunCopy.endErrorTitle), findsNothing);
    expect(find.textContaining('is saved'), findsNothing);
  });
}
