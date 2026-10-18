// Goldens for the Pro nudges (D79 to D84), Night and Day, at 360 by 800 and 412 by 915 logical px,
// at 1x and 1.3x text: the first-session Upgrade sheet with the student's own lines, the NTA gate's
// sheet with the plain lines, and the inline rows with the gate key. Google Play's Pro price is the
// Rs 150 fixture (D82); the app never draws another.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/pro_nudge/pro_nudge.dart';

import '../../helpers/golden_harness.dart';
import '../../unit/billing/billing_test_support.dart';
import '../../unit/pro_nudge/pro_nudge_test_support.dart';
import '../you/you_golden_kit.dart' show setUpGoldenFonts;

const _sizes = [Size(360, 800), Size(412, 915)];
const _scales = [1.0, 1.3];

void _matrix(String name, Widget Function() child, NudgeRig Function() rig, {Future<void> Function(WidgetTester tester)? open}) {
  for (final brightness in [Brightness.dark, Brightness.light]) {
    final tag = brightness == Brightness.dark ? 'night' : 'day';
    for (final size in _sizes) {
      for (final scale in _scales) {
        final file = '${name}_${tag}_${size.width.toInt()}x${size.height.toInt()}${scale == 1 ? '' : '_text130'}';
        testWidgets(file, (tester) async {
          await pumpNudges(tester, child(), rig(), brightness: brightness, size: size, textScale: scale);
          if (open != null) await open(tester);
          await settleNudges(tester, rounds: 14);
          await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/$file.png'));
        });
      }
    }
  }
}

Future<void> _tapOpen(WidgetTester tester) async {
  await tester.tap(find.text('open'));
  await settleNudges(tester);
}

class _Rows extends StatelessWidget {
  const _Rows();

  @override
  Widget build(BuildContext context) => const SampleColumn(
        children: [
          Sample('Result', ProNudgeRow(surface: ProNudgeSurface.result)),
          Sample('Practice tab, under the mocks', ProNudgeRow(surface: ProNudgeSurface.practiceMocks)),
          Sample('A set\'s cost line', ProNudgeRow(surface: ProNudgeSurface.practiceCost)),
          Sample('Review, a weak chapter', ProNudgeRow(surface: ProNudgeSurface.reviewPractise)),
          Sample('A Pro gate', UpgradeEntry(reason: ProReason.smartPractice, note: ProNudgeCopy.creditsRunLow)),
        ],
      );
}

void main() {
  setUpGoldenFonts();
  tearDown(disposeContainers);

  _matrix(
    'pro_nudge_first_session',
    () => const OpenSheetHost(reason: ProReason.firstSession),
    () => NudgeRig(facts: const ProFacts(mocksTaken: 3, weakestChapter: 'Accounting Ratios', practiceCredits: 12, subjectCount: 4)),
    open: _tapOpen,
  );

  _matrix(
    'pro_nudge_nta_gate',
    () => const OpenSheetHost(reason: ProReason.ntaMode),
    NudgeRig.new,
    open: _tapOpen,
  );

  _matrix('pro_nudge_rows', () => const _Rows(), NudgeRig.new);
}
