import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/insights/screens/insights_screen.dart';
import 'package:mockmob/features/insights/copy.dart';

import '../../golden/insights/insights_golden_support.dart';
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';

void main() {
  setUpAll(loadAppFonts);

  test('no text on the insights screens is set below 12 sp (the floor for anything a student reads)', () {
    final small = <String>[];
    final literal = RegExp(r'fontSize:\s*(\d+(?:\.\d+)?)\s*[,)]');
    for (final f in Directory('lib/features/insights').listSync(recursive: true).whereType<File>().where((f) => f.path.endsWith('.dart'))) {
      final lines = f.readAsLinesSync();
      for (var i = 0; i < lines.length; i++) {
        for (final m in literal.allMatches(lines[i])) {
          if (double.parse(m.group(1)!) < 12) small.add('${f.path}:${i + 1}');
        }
      }
    }
    expect(small, isEmpty);
  });

  test('the fine print is one caveat in the sheet and no line under a reply', () {
    expect(InsightsCopy.aboutReply, 'About this reply');
    expect(InsightsCopy.aiCaveat, isNot(contains('!')));
  });

  testWidgets('the record shows Mobi once: the lead finding, not the Ask row', (tester) async {
    await pumpMockmob(
      tester,
      const InsightsScreen(),
      brightness: Brightness.dark,
      disableAnimations: true,
      size: const Size(384, 3300),
      overrides: insightsOverrides(pro: true),
      wrapInScaffold: false,
    );
    await tester.pump(const Duration(seconds: 1));
    expect(find.byType(MobiCharacter), findsOneWidget);
    expect(find.byType(MobiFace), findsNothing);
  });
}
