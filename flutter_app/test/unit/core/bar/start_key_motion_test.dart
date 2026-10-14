// The Start key's life: it squashes and stretches while dragged (volume kept), its label slides to
// Resume once per open session, and it never does under reduced motion.
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/widgets/widgets.dart';

import '../../../helpers/golden_harness.dart';

Widget _bar({String? resumeId, bool entrance = false}) => Align(
  alignment: Alignment.bottomCenter,
  child: MmBottomBar(
    currentBranch: 0,
    onTab: (_) {},
    onStart: (_) {},
    entrance: entrance,
    startResumeId: resumeId,
    startResumeLabel: resumeId == null ? null : 'Resume Accountancy mock',
  ),
);

void main() {
  setUp(MmBottomBar.resetResumeSlide);

  testWidgets('a bar that arrives with an open session slides once it has landed, not never', (tester) async {
    // The entrance is still running on the first frame; the slide must wait for it, not be lost.
    await pumpMockmob(tester, _bar(resumeId: 's7', entrance: true), size: const Size(360, 780));
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.text('Resume'), findsOneWidget);
    await tester.pumpAndSettle();
    expect(find.text('Resume'), findsNothing, reason: 'and it slid back to Start');
  });

  test('the stretch keeps the key volume: taller means narrower', () {
    final (sx0, sy0) = StartKeyFace.squashFor(0);
    expect((sx0, sy0), (1.0, 1.0));
    final (sx, sy) = StartKeyFace.squashFor(1);
    expect(sy, greaterThan(1));
    expect(sx, lessThan(1));
    expect(sx * sy, closeTo(math.sqrt(sy), 0.001));
    final (qx, qy) = StartKeyFace.squashFor(-0.2);
    expect(qy, lessThan(1), reason: 'springing back through a little squash');
    expect(qx, greaterThan(1));
  });

  testWidgets('the label slides Start to Resume and back once for an open session', (tester) async {
    await pumpMockmob(tester, _bar(resumeId: 's1'), size: const Size(360, 780));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 600));
    expect(find.text('Resume'), findsOneWidget, reason: 'held while the key says Resume');
    await tester.pump(const Duration(milliseconds: 2000));
    expect(find.text('Resume'), findsNothing, reason: 'it slid back to Start');
    expect(find.text('Start'), findsOneWidget);
    await tester.pumpAndSettle();

    // The same session again (the bar rebuilt, or the app back from another screen): no slide.
    await pumpMockmob(tester, _bar(resumeId: 's1'), size: const Size(360, 780));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 600));
    expect(find.text('Resume'), findsNothing);
  });

  testWidgets('a new open session slides once more; no session, no slide', (tester) async {
    await pumpMockmob(tester, _bar(), size: const Size(360, 780));
    await tester.pump(const Duration(milliseconds: 600));
    expect(find.text('Resume'), findsNothing);
    await pumpMockmob(tester, _bar(resumeId: 's2'), size: const Size(360, 780));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 600));
    expect(find.text('Resume'), findsOneWidget);
    await tester.pumpAndSettle();
  });

  testWidgets('under reduced motion the label never slides', (tester) async {
    await pumpMockmob(tester, _bar(resumeId: 's3'), size: const Size(360, 780), disableAnimations: true);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 600));
    expect(find.text('Resume'), findsNothing);
  });
}
