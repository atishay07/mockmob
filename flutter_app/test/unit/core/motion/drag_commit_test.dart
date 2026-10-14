import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/motion/motion.dart';

import 'motion_harness.dart';

const _card = ValueKey('card');

Widget _subject({
  required List<MmDragSide> commits,
  MmDragSettle settle = MmDragSettle.back,
  bool left = true,
  bool right = true,
  double follow = 1,
  double commitShare = MmDragPolicy.commitShare,
  ValueChanged<MmDragRelease>? onRelease,
}) {
  return Center(
    child: SizedBox(
      width: 300,
      height: 100,
      child: MmDragCommit(
        left: left,
        right: right,
        settle: settle,
        follow: follow,
        commitShare: commitShare,
        onRelease: onRelease,
        onCommit: commits.add,
        child: const ColoredBox(key: _card, color: Color(0xFF333333), child: SizedBox.expand()),
      ),
    ),
  );
}

double _dx(WidgetTester tester) => tester.getTopLeft(find.byKey(_card)).dx - tester.getTopLeft(find.byType(MmDragCommit)).dx;

void main() {
  group('MmDragPolicy', () {
    test('claims only a clearly sideways drag', () {
      expect(MmDragPolicy.claims(const Offset(30, 10)), isTrue, reason: '30 > 2.2 x 10');
      expect(MmDragPolicy.claims(const Offset(30, 14)), isFalse, reason: '30 < 2.2 x 14');
      expect(MmDragPolicy.claims(const Offset(10, 0)), isFalse, reason: 'inside the touch slop');
      expect(MmDragPolicy.yields(const Offset(5, 30)), isTrue);
      expect(MmDragPolicy.yields(const Offset(30, 5)), isFalse);
    });

    test('follows 1:1, rubber-bands at 0.35 past the edge and on a closed side', () {
      expect(MmDragPolicy.follow(80, left: true, right: true, maxTravel: 300), 80);
      expect(MmDragPolicy.follow(400, left: true, right: true, maxTravel: 300), closeTo(300 + 100 * 0.35, 1e-9));
      expect(MmDragPolicy.follow(-100, left: false, right: true, maxTravel: 300), closeTo(-35, 1e-9));
    });

    test('commits past the distance or on a fling, never against the fling', () {
      MmDragSide? c(double offset, double v) => MmDragPolicy.commits(offset, v, distance: 105, left: true, right: true);
      expect(c(120, 0), MmDragSide.right);
      expect(c(-120, 0), MmDragSide.left);
      expect(c(60, 0), isNull, reason: 'short and slow springs back');
      expect(c(30, 900), MmDragSide.right, reason: 'a short fast fling commits');
      expect(c(120, -900), isNull, reason: 'a fling back cancels a long drag');
      expect(MmDragPolicy.commits(120, 0, distance: 105, left: true, right: false), isNull, reason: 'a closed side');
    });
  });

  group('MmDragCommit', () {
    testWidgets('a drag past the threshold commits once and ticks at the threshold', (tester) async {
      final haptics = RecordingHaptics();
      final commits = <MmDragSide>[];
      await tester.pumpWidget(motionApp(_subject(commits: commits), haptics: haptics));
      final gesture = await tester.startGesture(tester.getCenter(find.byKey(_card)));
      for (var i = 0; i < 14; i++) {
        await gesture.moveBy(const Offset(10, 0));
        await tester.pump(const Duration(milliseconds: 16));
      }
      expect(_dx(tester), closeTo(140, 0.5), reason: 'follows the finger 1:1');
      expect(haptics.count('selection'), 1, reason: 'one tick crossing 105 dp');
      await gesture.up();
      await tester.pumpAndSettle();
      expect(commits, [MmDragSide.right]);
      expect(_dx(tester), closeTo(0, 0.5), reason: 'back mode springs home');
    });

    testWidgets('a short drag springs back without committing', (tester) async {
      final commits = <MmDragSide>[];
      await tester.pumpWidget(motionApp(_subject(commits: commits)));
      final gesture = await tester.startGesture(tester.getCenter(find.byKey(_card)));
      for (var i = 0; i < 4; i++) {
        await gesture.moveBy(const Offset(-10, 0));
        await tester.pump(const Duration(seconds: 1));
      }
      await gesture.up();
      await tester.pump(const Duration(milliseconds: 16));
      expect(_dx(tester), lessThan(0), reason: 'still on its way home');
      await tester.pumpAndSettle();
      expect(commits, isEmpty);
      expect(_dx(tester), closeTo(0, 0.5));
    });

    testWidgets('a vertical drag is not claimed and moves nothing', (tester) async {
      final commits = <MmDragSide>[];
      await tester.pumpWidget(motionApp(_subject(commits: commits)));
      final gesture = await tester.startGesture(tester.getCenter(find.byKey(_card)));
      for (var i = 0; i < 6; i++) {
        await gesture.moveBy(const Offset(3, 12));
        await tester.pump(const Duration(milliseconds: 16));
      }
      expect(_dx(tester), 0);
      await gesture.up();
      await tester.pumpAndSettle();
      expect(commits, isEmpty);
    });

    testWidgets('exit mode leaves past its width; a grab mid-settle retargets', (tester) async {
      final commits = <MmDragSide>[];
      await tester.pumpWidget(motionApp(_subject(commits: commits, settle: MmDragSettle.exit)));
      // A short drag that springs back, grabbed again on its way home.
      var gesture = await tester.startGesture(tester.getCenter(find.byKey(_card)));
      for (var i = 0; i < 6; i++) {
        await gesture.moveBy(const Offset(10, 0));
        await tester.pump(const Duration(seconds: 1));
      }
      await gesture.up();
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 40));
      final mid = _dx(tester);
      expect(mid, inExclusiveRange(0, 60));
      gesture = await tester.startGesture(tester.getCenter(find.byType(MmDragCommit)));
      await tester.pump(const Duration(milliseconds: 100));
      expect(_dx(tester), closeTo(mid, 0.5), reason: 'the grab stopped the spring where it was');
      for (var i = 0; i < 12; i++) {
        await gesture.moveBy(const Offset(10, 0));
        await tester.pump(const Duration(seconds: 1));
      }
      await gesture.up();
      await tester.pumpAndSettle();
      expect(commits, [MmDragSide.right]);
      expect(_dx(tester), greaterThan(300), reason: 'left past its own width');
    });

    testWidgets('a cancelled pointer never commits, even past the threshold', (tester) async {
      final commits = <MmDragSide>[];
      await tester.pumpWidget(motionApp(_subject(commits: commits)));
      final gesture = await tester.startGesture(tester.getCenter(find.byKey(_card)));
      for (var i = 0; i < 14; i++) {
        await gesture.moveBy(const Offset(10, 0));
        await tester.pump(const Duration(milliseconds: 16));
      }
      expect(_dx(tester), closeTo(140, 0.5));
      await gesture.cancel();
      await tester.pumpAndSettle();
      expect(commits, isEmpty, reason: 'the system took the pointer; nothing was decided');
      expect(_dx(tester), closeTo(0, 0.5));
    });

    testWidgets('follow below 1 leans the child; the thresholds count the finger; onRelease carries the offset', (tester) async {
      final commits = <MmDragSide>[];
      final releases = <MmDragRelease>[];
      await tester.pumpWidget(motionApp(_subject(commits: commits, follow: 0.35, onRelease: releases.add)));
      final gesture = await tester.startGesture(tester.getCenter(find.byKey(_card)));
      for (var i = 0; i < 14; i++) {
        await gesture.moveBy(const Offset(-10, 0));
        await tester.pump(const Duration(seconds: 1));
      }
      expect(_dx(tester), closeTo(-140 * 0.35, 0.5), reason: 'the card leans at 0.35 of the finger');
      await gesture.up();
      await tester.pumpAndSettle();
      expect(commits, [MmDragSide.left], reason: '140 dp of finger travel is past 105');
      expect(releases.single.side, MmDragSide.left);
      expect(releases.single.offset, closeTo(-140 * 0.35, 0.5), reason: 'where the card was when it let go');
    });

    testWidgets('commitShare sets the distance as a share of the width', (tester) async {
      final commits = <MmDragSide>[];
      await tester.pumpWidget(motionApp(_subject(commits: commits, commitShare: 0.45)));
      Future<void> drag(int steps) async {
        final gesture = await tester.startGesture(tester.getCenter(find.byType(MmDragCommit)));
        for (var i = 0; i < steps; i++) {
          await gesture.moveBy(const Offset(10, 0));
          await tester.pump(const Duration(seconds: 1));
        }
        await gesture.up();
        await tester.pumpAndSettle();
      }

      await drag(12);
      expect(commits, isEmpty, reason: '120 dp is short of 0.45 x 300');
      await drag(14);
      expect(commits, [MmDragSide.right]);
    });

    testWidgets('a closed side rubber-bands and never commits', (tester) async {
      final commits = <MmDragSide>[];
      await tester.pumpWidget(motionApp(_subject(commits: commits, left: false)));
      final gesture = await tester.startGesture(tester.getCenter(find.byKey(_card)));
      for (var i = 0; i < 20; i++) {
        await gesture.moveBy(const Offset(-10, 0));
        await tester.pump(const Duration(seconds: 1));
      }
      expect(_dx(tester), closeTo(-200 * 0.35, 0.5));
      await gesture.up();
      await tester.pumpAndSettle();
      expect(commits, isEmpty);
    });
  });
}
