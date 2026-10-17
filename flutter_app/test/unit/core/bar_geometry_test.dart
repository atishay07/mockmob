// The A1 bar's measured geometry (NAV-1017 section 10, checks A2 and A3): a capsule of five tabs
// and a separate 64 dp Start key on one row, measured on the laid-out widgets at 320, 360, 390,
// 412 and 480 dp, expanded and compact, with the app's real fonts. Plus the lens: it must never
// cut into its icon or its word (the owner, 17 Oct, on the old round lens over Practice).
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';

Finder _iconOf(BarIconKind kind) =>
    find.byWidgetPredicate((w) => w is CustomPaint && w.painter is BarIconPainter && (w.painter! as BarIconPainter).glyph == kind.glyph);

BarLensPainter _lens(WidgetTester tester) =>
    tester.widgetList<CustomPaint>(find.byType(CustomPaint)).map((w) => w.painter).whereType<BarLensPainter>().first;

/// Whether [p] lies inside the rounded rect [shape] by at least [margin] (circular corners, which
/// the continuous corners the lens draws never cut deeper than).
bool _insideBy(LensShape shape, Offset p, double margin) {
  final r = shape.rect;
  final inner = r.deflate(margin);
  if (!inner.contains(p)) return false;
  final rad = shape.radius;
  final cx = p.dx < r.left + rad ? r.left + rad : (p.dx > r.right - rad ? r.right - rad : p.dx);
  final cy = p.dy < r.top + rad ? r.top + rad : (p.dy > r.bottom - rad ? r.bottom - rad : p.dy);
  return (p - Offset(cx, cy)).distance <= rad - margin + 1e-6;
}

Future<void> _pumpBar(WidgetTester tester, {required double width, int branch = 0, bool compact = false, double textScale = 1}) async {
  final notifier = ValueNotifier(compact);
  addTearDown(notifier.dispose);
  await pumpMockmob(
    tester,
    Align(
      alignment: Alignment.bottomCenter,
      child: MmBottomBar(currentBranch: branch, compact: notifier, onTab: (_) {}, onStart: (_) {}),
    ),
    size: Size(width, 780),
    textScale: textScale,
  );
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(() async {
    await loadAppFonts();
    await loadMaterialIconFont();
  });

  group('the formula (NAV 6.1)', () {
    test('row, capsule, key, gap, pad and slot at every width', () {
      for (final (screen, row, gap, pad, capsule, slot) in const [
        (320.0, 304.0, 6.0, 3.0, 234.0, 45.6),
        (360.0, 328.0, 8.0, 4.0, 256.0, 49.6),
        (390.0, 358.0, 8.0, 4.0, 286.0, 55.6),
        (393.0, 361.0, 8.0, 4.0, 289.0, 56.2),
        (412.0, 380.0, 8.0, 4.0, 308.0, 60.0),
        (480.0, 440.0, 8.0, 4.0, 368.0, 72.0),
      ]) {
        final geo = BarGeometry(screen);
        expect(geo.width, closeTo(row, 1e-9), reason: '$screen');
        expect(geo.keyGap, gap, reason: '$screen');
        expect(geo.pad, pad, reason: '$screen');
        expect(geo.capsuleWidth, closeTo(capsule, 1e-9), reason: '$screen');
        expect(geo.slot, closeTo(slot, 1e-9), reason: '$screen');
        // (d) capsule + gap + 64 = row; (e) five slots + 2 x pad = capsule; (g) 44 dp at least.
        expect(geo.capsuleWidth + geo.keyGap + MmBar.keySize, closeTo(geo.width, 1e-9));
        expect(5 * geo.slot + 2 * geo.pad, closeTo(geo.capsuleWidth, 1e-9));
        expect(geo.slot, greaterThanOrEqualTo(44), reason: 'a 44 dp target at $screen');
        expect(geo.keyBox.right, closeTo(geo.width, 1e-9), reason: 'the key closes the row');
      }
    });

    test('the key and the capsule share their top, bottom and centre, expanded and compact', () {
      for (final screen in const [320.0, 360.0, 390.0, 412.0, 480.0]) {
        final geo = BarGeometry(screen);
        for (final e in const [0.0, 0.5, 1.0]) {
          final capsule = geo.capsuleShape(e).outerRect;
          final key = geo.keyCircle(collapse: e);
          expect(key.top, closeTo(capsule.top, 1e-9), reason: '$screen at $e');
          expect(key.bottom, closeTo(capsule.bottom, 1e-9), reason: '$screen at $e');
          expect(key.width, closeTo(key.height, 1e-9), reason: 'a circle');
          expect(key.center.dx, closeTo(geo.keyBox.center.dx, 1e-9), reason: 'it shrinks about its own centre line');
        }
        expect(geo.keyCircle().size, const Size(64, 64));
        expect(geo.keyCircle(collapse: 1).size, const Size(52, 52));
        expect(geo.capsuleShape(1).outerRect.center.dy, 38);
      }
    });

    test('the lens: slot less 1 dp each side, y 4 to 60 expanded, 16 to 60 compact', () {
      final geo = BarGeometry(360);
      for (var i = 0; i < kBarSlots; i++) {
        final lens = geo.lensRect(i);
        expect(lens.top, 4);
        expect(lens.bottom, 60);
        expect(lens.center.dx, closeTo(geo.slotCenter(i), 1e-9));
        expect(lens.width, closeTo(geo.slot - 2, 1e-9));
        final compact = geo.lensRect(i, collapse: 1);
        expect(compact.top, 16);
        expect(compact.bottom, 60);
        expect(geo.iconRect(i, collapse: 1).center.dy, closeTo(compact.center.dy, 1e-9), reason: 'compact icons centre in the lens');
        // The icon and label group (y 11 to 53) centres in the lens.
        expect((geo.iconRect(i).top + geo.labelRect(i).bottom) / 2, closeTo(lens.center.dy, 1e-9));
      }
      expect(MmBar.compactShift, 15);
    });

    test('slots and branches are the same number; Start is no slot', () {
      expect(kBarSlots, 5);
      for (var i = 0; i < kBarSlots; i++) {
        expect(slotToBranch(i), i);
        expect(branchToSlot(i), i);
      }
      final geo = BarGeometry(412);
      for (var x = 0.0; x <= geo.capsuleWidth; x += 3) {
        expect(geo.nearestSlot(x), inInclusiveRange(0, 4));
      }
      expect(geo.nearestSlot(geo.slotCenter(2) + geo.slot * 0.49), 2);
      expect(geo.nearestSlot(geo.slotCenter(2) + geo.slot * 0.51), 3);
    });
  });

  group('measured on screen (NAV 10, check A2)', () {
    for (final width in const [320.0, 360.0, 390.0, 412.0, 480.0]) {
      for (final compact in const [false, true]) {
        final name = '${width.toInt()} dp, ${compact ? 'compact' : 'expanded'}';
        testWidgets('$name: six icon centres on one y, six labels on one line, the key on the capsule\'s edges', (tester) async {
          await _pumpBar(tester, width: width, branch: BarBranch.practice, compact: compact);
          final bar = tester.getRect(find.byType(MmBottomBar));
          final geo = BarGeometry(width);
          final e = compact ? 1.0 : 0.0;
          expect(bar.width, closeTo(geo.width, 0.01));
          expect(bar.left, closeTo((width - geo.width) / 2, 0.01), reason: 'the row is centred');

          // (a) the five tab icons and the key's glyph share one centre line.
          final iconY = bar.top + geo.iconRect(0, collapse: e).center.dy;
          for (final kind in BarIconKind.values) {
            final icon = tester.getRect(_iconOf(kind));
            expect(icon.center.dy, closeTo(iconY, 0.5), reason: '$kind');
            expect(icon.center.dx, closeTo(bar.left + geo.slotCenter(kind.index), 0.5), reason: '$kind on its slot');
          }
          final glyph = tester.getRect(find.byIcon(kStartGlyph));
          expect(glyph.center.dy, closeTo(iconY, 0.5), reason: 'the Start glyph');
          expect(glyph.center.dx, closeTo(bar.left + geo.keyBox.center.dx, 0.5));

          // (b) the five labels and the word Start share one line box (y 39 to 53).
          if (!compact) {
            for (final label in [...kBarTabs.map((t) => t.label), StartKeyFace.word]) {
              final rect = tester.getRect(find.text(label));
              expect(rect.center.dy, closeTo(bar.top + MmBar.labelTop + MmBar.labelHeight / 2, 0.5), reason: label);
              expect(rect.height, lessThanOrEqualTo(MmBar.labelHeight + 0.01), reason: '$label never wraps');
            }
          }

          // (c) the key's circle shares the capsule's top and bottom.
          final keyBox = tester.getRect(find.byType(StartKeyFace));
          final circle = StartKeyFace.keyRect(keyBox.size, e).shift(keyBox.topLeft - bar.topLeft);
          final capsule = geo.capsuleShape(e).outerRect;
          expect(circle.top, closeTo(capsule.top, 0.01));
          expect(circle.bottom, closeTo(capsule.bottom, 0.01));
          expect(circle.left - capsule.right, closeTo(geo.keyGap + (MmBar.keySize - circle.width) / 2, 0.01));

          // (f) the lens sits centred on the open tab.
          final lens = _lens(tester);
          expect((lens.left.value + lens.right.value) / 2, closeTo(geo.slotCenter(BarBranch.practice), 0.01));
        });
      }
    }
  });

  group('the lens never cuts into what it holds (owner, 17 Oct)', () {
    for (final width in const [320.0, 360.0, 390.0, 412.0]) {
      for (final scale in const [1.0, 1.2]) {
        testWidgets('${width.toInt()} dp, text ${scale}x: every tab, icon and word inside the lens', (tester) async {
          for (var branch = 0; branch < kBarSlots; branch++) {
            await _pumpBar(tester, width: width, branch: branch, textScale: scale);
            final bar = tester.getRect(find.byType(MmBottomBar));
            final painter = _lens(tester);
            final shape = BarLensPainter.shapeFor(
              left: painter.left.value,
              right: painter.right.value,
              collapse: 0,
              labelsOut: 0,
              restWidth: painter.restWidth,
              labelWidth: painter.labelWidth,
            );
            final icon = tester.getRect(_iconOf(BarIconKind.values[branch])).shift(-bar.topLeft);
            final label = tester.getRect(find.text(kBarTabs[branch].label)).shift(-bar.topLeft);
            final why = '${kBarTabs[branch].label} at ${width.toInt()} dp, ${scale}x';
            for (final corner in [icon.topLeft, icon.topRight, icon.bottomLeft, icon.bottomRight]) {
              expect(_insideBy(shape, corner, 2), isTrue, reason: 'icon corner $corner, $why, lens $shape');
            }
            // The word's ink sits inside its line box; its box corners stay inside the curve.
            for (final corner in [label.topLeft, label.topRight, label.bottomLeft, label.bottomRight]) {
              expect(_insideBy(shape, corner, 1.5), isTrue, reason: 'label corner $corner, $why, r ${shape.radius}');
            }
            // And the lens never reaches a neighbour's icon.
            for (final n in [branch - 1, branch + 1]) {
              if (n < 0 || n >= kBarSlots) continue;
              final other = tester.getRect(_iconOf(BarIconKind.values[n])).shift(-bar.topLeft);
              expect(shape.rect.overlaps(other), isFalse, reason: 'touches ${kBarTabs[n].label}, $why');
            }
          }
        });
      }
    }

    test('the corner radius: a pill when it can be, never under 10, rounder when compact', () {
      // A label far inside: the lens is a full pill.
      expect(BarLensPainter.cornerRadiusFor(width: 70, height: 56, labelWidth: 20, labelsOut: 0), 28);
      // A wide label on a narrow lens: tighter corners, never below the floor.
      final tight = BarLensPainter.cornerRadiusFor(width: 47.6, height: 56, labelWidth: 41.6, labelsOut: 0);
      expect(tight, inInclusiveRange(BarLensPainter.minRadius, 14));
      // Compact (labels gone): the icon alone, a full pill.
      expect(BarLensPainter.cornerRadiusFor(width: 47.6, height: 44, labelWidth: 41.6, labelsOut: 1), 22);
      // The bound keeps a point the clearance inside the curve.
      final r = BarLensPainter.cornerBound(8, 7);
      final d = math.sqrt(math.pow(r - 8, 2) + math.pow(r - 7, 2));
      expect(d, closeTo(r - BarLensPainter.contentClearance, 1e-9));
    });
  });

  group('the scrub physics (NAV 6.5)', () {
    test('the rubber band resists more the further it is pulled, and never passes 0.55 x 1.2 slots', () {
      const slot = 60.0;
      var last = 0.0;
      for (var o = 6.0; o <= 600; o += 6) {
        final b = MmBottomBar.rubberBand(o, slot);
        expect(b, greaterThan(last));
        expect(b, lessThan(o));
        expect(b, lessThan(1.2 * slot));
        last = b;
      }
      expect(MmBottomBar.rubberBand(-30, slot), -MmBottomBar.rubberBand(30, slot));
    });

    test('a flick projects with the fast decay: 1,000 dp/s travels about 99 dp', () {
      expect(MmBottomBar.project(100, 1000), closeTo(199, 0.01));
      expect(MmBottomBar.project(100, -500), closeTo(50.5, 0.01));
      expect(MmBottomBar.project(100, 0), 100);
    });

    test('two badges at most: Review wins, then Colleges, then You', () {
      final all = MmBottomBar.visibleBadges(const BarBadges(reviewCount: 3, collegesDot: true, youDot: true));
      expect(all, (review: true, colleges: true, you: false));
      final two = MmBottomBar.visibleBadges(const BarBadges(reviewCount: 3, youDot: true));
      expect(two, (review: true, colleges: false, you: true));
    });
  });
}
