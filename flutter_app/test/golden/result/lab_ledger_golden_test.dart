import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/result/full/answer_row.dart';
import 'package:mockmob/features/result/full/lab_ledger_section.dart';
import 'package:mockmob/features/result/full/lab_older_note.dart';

import '../../helpers/fonts.dart';
import '../../unit/result/support/lab_fixtures.dart';

/// Mistake Lab slice 1 at 360 dp, Night and Day: the ledger on the ready and basic contracts (at
/// rest after its split, the headline's group open), and an opened answer with how others answered.
Future<void> _shot(WidgetTester tester, String name) async {
  await expectLater(find.byKey(labGoldenKey), matchesGoldenFile('goldens/$name.png'));
  final dir = Platform.environment['MM_PREVIEW_DIR'];
  if (dir == null || dir.isEmpty) return;
  final boundary = tester.renderObject<RenderRepaintBoundary>(find.byKey(labGoldenKey));
  await tester.runAsync(() async {
    final image = await boundary.toImage(pixelRatio: 2);
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    image.dispose();
    await File('$dir/$name.png').writeAsBytes(bytes!.buffer.asUint8List());
  });
}

void main() {
  setUpAll(loadAppFonts);
  setUp(LabLedgerSection.debugResetSeen);

  for (final b in Brightness.values) {
    final tag = b == Brightness.dark ? 'night' : 'day';

    testWidgets('ledger, ready ($tag)', (tester) async {
      await pumpLabHost(
        tester,
        LabLedgerSection(attemptId: 'a7', lab: labOf('ready'), onOpenQuestion: (_) {}, onSeeChanges: () {}),
        brightness: b,
        size: const Size(360, 1500),
      );
      await tester.pumpAndSettle();
      await _shot(tester, 'lab_ledger_ready_$tag');
    });

    testWidgets('ledger, basic ($tag)', (tester) async {
      await pumpLabHost(
        tester,
        LabLedgerSection(attemptId: 'd1', lab: labOf('basic'), onOpenQuestion: (_) {}),
        brightness: b,
        size: const Size(360, 780),
      );
      await tester.pumpAndSettle();
      // One row open, so its do line and chips are in the frame.
      await tester.tap(find.text('Wrong answers'));
      await tester.pumpAndSettle();
      await _shot(tester, 'lab_ledger_basic_$tag');
    });

    // Repair v4: the honest older-paper Lab. A paper from before the capture with nothing missed shows only
    // its one line and its one action, at 390 wide.
    testWidgets('older paper note, before the capture ($tag)', (tester) async {
      await pumpLabHost(
        tester,
        LabOlderNote(older: labOf('none').older!, onAction: (_) {}),
        brightness: b,
        size: const Size(390, 340),
      );
      await tester.pumpAndSettle();
      await _shot(tester, 'lab_older_note_$tag');
    });

    testWidgets('answer row with how others answered ($tag)', (tester) async {
      await pumpLabHost(
        tester,
        AnswerRow(
          item: q17Item(),
          expanded: true,
          onToggle: () {},
          keysOff: false,
          onRepair: () {},
          others: labOf('ready').othersFor('q17'),
          othersTitle: labOf('ready').labels.othersTitle,
        ),
        brightness: b,
        size: const Size(360, 900),
      );
      await tester.pumpAndSettle();
      await _shot(tester, 'answer_row_others_$tag');
    });
  }
}
