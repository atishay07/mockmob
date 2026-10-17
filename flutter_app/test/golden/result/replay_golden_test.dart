import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/result/full/lab_ledger_section.dart';
import 'package:mockmob/features/result/full/replay_section.dart';

import '../../helpers/fonts.dart';
import '../../unit/result/support/lab_fixtures.dart';

/// Mistake Lab slice 2 at 360 dp, Night and Day: the Replay at rest (the whole record, the end and
/// every answer), the Replay scrubbed to 16:42 with "Right, then changed" on, and the ledger of the
/// same paper with its new group, "Crossed out the key", open on "See it in the replay".
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

    testWidgets('replay at rest ($tag)', (tester) async {
      final lab = labOf('replay');
      await pumpLabHost(
        tester,
        ReplaySection(replay: lab.replay!, onOpenQuestion: (_) {}, numbersOf: lab.numbersOf),
        brightness: b,
        size: const Size(360, 1060),
      );
      await tester.pumpAndSettle();
      await _shot(tester, 'replay_rest_$tag');
    });

    testWidgets('replay scrubbed with a chip on ($tag)', (tester) async {
      final lab = labOf('replay');
      await pumpLabHost(
        tester,
        ReplaySection(replay: lab.replay!, onOpenQuestion: (_) {}, numbersOf: lab.numbersOf),
        brightness: b,
        size: const Size(360, 1100),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('replay-chip-changed_from_right')));
      await tester.pumpAndSettle();
      tester.state<ReplaySectionState>(find.byType(ReplaySection)).scrubTo(1, 1002);
      await tester.pumpAndSettle();
      await _shot(tester, 'replay_scrub_$tag');
    });

    testWidgets('replay on one line ($tag)', (tester) async {
      final lab = labOf('replay');
      await pumpLabHost(
        tester,
        ReplaySection(replay: lab.replay!, onOpenQuestion: (_) {}, numbersOf: lab.numbersOf),
        brightness: b,
        size: const Size(360, 760),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('replay-lines-toggle')));
      await tester.pumpAndSettle();
      await _shot(tester, 'replay_one_line_$tag');
    });

    testWidgets('replay of a 58 s paper, fitted to the line ($tag)', (tester) async {
      await pumpLabHost(
        tester,
        ReplaySection(replay: shortReplay(), onOpenQuestion: (_) {}),
        brightness: b,
        size: const Size(360, 420),
      );
      await tester.pumpAndSettle();
      await _shot(tester, 'replay_short_fitted_$tag');
    });

    testWidgets('ledger with crossed out the key ($tag)', (tester) async {
      await pumpLabHost(
        tester,
        LabLedgerSection(attemptId: 'r1', lab: labOf('replay'), onOpenQuestion: (_) {}, onSeeChanges: () {}, onSeeInReplay: (_) {}),
        brightness: b,
        size: const Size(360, 1300),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Crossed out the key'));
      await tester.pumpAndSettle();
      await _shot(tester, 'lab_ledger_struck_$tag');
    });
  }
}
