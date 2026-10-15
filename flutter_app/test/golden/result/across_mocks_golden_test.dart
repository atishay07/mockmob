import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/lab_loop.dart';
import 'package:mockmob/features/rules/widgets/across_mocks_view.dart';
import 'package:mockmob/features/rules/widgets/rule_check_view.dart';

import '../../helpers/fonts.dart';
import '../../unit/result/support/lab_fixtures.dart';

Map<String, dynamic> _contract(String name) =>
    jsonDecode(File('test/fixtures/mistake_lab/contract_${name}_v1.json').readAsStringSync()) as Map<String, dynamic>;

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

/// Mistake Lab v4 slice 3 at 360 dp, Night and Day: Across your mocks on the website's contract
/// (at rest after its entrance, then with Show all open, then one line below its gate), and the
/// rule check in each of its four states.
void main() {
  setUpAll(loadAppFonts);
  setUp(AcrossMocksView.debugResetSeen);

  for (final b in Brightness.values) {
    final tag = b == Brightness.dark ? 'night' : 'day';

    testWidgets('across your mocks ($tag)', (tester) async {
      final across = AcrossMocks.tryParse(_contract('across'))!;
      await pumpLabHost(tester, AcrossMocksView(across: across, seenKey: 'g-$tag'), brightness: b, size: const Size(360, 640));
      await tester.pumpAndSettle();
      await _shot(tester, 'across_mocks_$tag');
    });

    testWidgets('across your mocks, all lines, one gated ($tag)', (tester) async {
      final raw = _contract('across');
      final lines = [...(raw['lines'] as List)];
      lines[2] = {
        ...lines[2] as Map,
        'gated': true,
        'marks': 0,
        'text': 'Changes on a later visit against changes without leaving the question: this comparison opens at 8 of each. You have 5 and 3.',
      };
      final across = AcrossMocks.tryParse({...raw, 'lines': lines})!;
      await pumpLabHost(tester, AcrossMocksView(across: across, seenKey: 'g-all-$tag'), brightness: b, size: const Size(360, 900));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Show all 5'));
      await tester.pumpAndSettle();
      await _shot(tester, 'across_mocks_all_$tag');
    });

    testWidgets('the rule check, four states ($tag)', (tester) async {
      final cases = _contract('rulecheck');
      await pumpLabHost(
        tester,
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (final state in ['kept', 'not_kept', 'counted', 'not_checked']) ...[
              RuleCheckView(check: RuleCheck.tryParse(cases[state])!),
              const SizedBox(height: 24),
            ],
          ],
        ),
        brightness: b,
        size: const Size(360, 1260),
      );
      await tester.pumpAndSettle();
      await _shot(tester, 'rule_check_$tag');
    });
  }
}
