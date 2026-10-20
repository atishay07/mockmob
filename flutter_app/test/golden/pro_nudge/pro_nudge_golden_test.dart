// Goldens for the Pro nudges (D79 to D84), Night and Day, at 360 by 800 and 412 by 915 logical px,
// at 1x and 1.3x text: the first-session Upgrade sheet (the dismissible bottom sheet with Not now, D181; visual
// first, D185) with the student's own facts, also on a 360 by 640 phone, with the plain rows, and while Google
// Play is checked or cannot sell; the NTA gate's sheet with the plain lines, and the inline rows with the gate
// key. Google Play's Pro price is the Rs 150 fixture (D82); the app never draws another.

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/pro_nudge/pro_nudge.dart';

import '../../helpers/golden_harness.dart';
import '../../unit/billing/billing_test_support.dart';
import '../../unit/pro_nudge/pro_nudge_test_support.dart';
import '../you/you_golden_kit.dart' show setUpGoldenFonts;

const _sizes = [Size(360, 800), Size(412, 915)];
const _scales = [1.0, 1.3];

void _matrix(
  String name,
  Widget Function() child,
  NudgeRig Function() rig, {
  Future<void> Function(WidgetTester tester)? open,
  List<Size> sizes = _sizes,
  List<double> scales = _scales,
}) {
  for (final brightness in [Brightness.dark, Brightness.light]) {
    final tag = brightness == Brightness.dark ? 'night' : 'day';
    for (final size in sizes) {
      for (final scale in scales) {
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

/// Opens the first-session sheet and waits for its art (the foil seal) to decode on the real event loop, so the
/// golden never catches the sheet before the seal is drawn.
Future<void> _openSheet(WidgetTester tester) async {
  await _tapOpen(tester);
  await settleImages(tester);
}

/// A screen with one key that opens the first-session Upgrade bottom sheet, as the app shell does once the
/// student is armed (a real limit, or the second return to a tab root after a result).
class _OpenFirstSessionSheetHost extends StatelessWidget {
  const _OpenFirstSessionSheetHost();

  @override
  Widget build(BuildContext context) => Center(
        child: TextButton(
          onPressed: () => showUpgradeBottomSheetIfOn(context, reason: ProReason.firstSession),
          child: const Text('open'),
        ),
      );
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
    () => const _OpenFirstSessionSheetHost(),
    () => NudgeRig(facts: const ProFacts(mocksTaken: 3, weakestChapter: 'Accounting Ratios', practiceCredits: 12, subjectCount: 4)),
    open: _openSheet,
    // A short phone too: the price, Get Pro and Not now stay pinned in view at 1.3x text.
    sizes: const [..._sizes, Size(360, 640)],
  );

  // Nothing of the student's own to say yet: the three plain rows.
  _matrix('pro_nudge_first_session_plain', () => const _OpenFirstSessionSheetHost(), NudgeRig.new, open: _openSheet, sizes: const [Size(360, 800)], scales: const [1.0]);

  // Google Play cannot sell: said plainly with Try again, and no key to press.
  _matrix(
    'pro_nudge_first_session_unavailable',
    () => const _OpenFirstSessionSheetHost(),
    () => NudgeRig(facts: const ProFacts(practiceCredits: 6), store: FakePlayStore(available: false)),
    open: _openSheet,
    sizes: const [Size(360, 800)],
    scales: const [1.0],
  );

  // Google Play is being checked: the price's own height, held by a skeleton.
  _matrix(
    'pro_nudge_first_session_checking',
    () => const _OpenFirstSessionSheetHost(),
    () => NudgeRig(facts: const ProFacts(mocksTaken: 1), store: FakePlayStore()..gate = Completer<void>()),
    open: _openSheet,
    sizes: const [Size(360, 800)],
    scales: const [1.0],
  );

  _matrix(
    'pro_nudge_nta_gate',
    () => const OpenSheetHost(reason: ProReason.ntaMode),
    NudgeRig.new,
    open: _tapOpen,
  );

  _matrix('pro_nudge_rows', () => const _Rows(), NudgeRig.new);
}
